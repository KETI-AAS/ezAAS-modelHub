"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Accordion,
  Badge,
  Card,
  Divider,
  Flex,
  Menu,
  Modal,
  NumberFormatter,
  Select,
  Stepper,
  Tabs,
  Title,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { v4 as uuidv4 } from 'uuid';
import CustomCombobox from "@/components/CustomCombobox";
import { useQuery } from "@tanstack/react-query";
import { MRT_PaginationState } from "mantine-react-table";
import {
  apiVerifyInstance,
  deleteModel,
  exportModel,
  getCodeList,
  getInstanceTargetList,
  getModel,
  upsertInstance,
} from "@/api";
import { addValuePaths, parsingAAS } from "@/utils/aas";
import AASTree, {
  RenderObject,
} from "@/components/feature/model/AASTree";
import { InstanceSavePayload } from "@/types/api";
import { confirmSave } from "@/utils/modal";

import type { AASInstance, VerifyInstanceParams } from "@/types/api";
import { ROUTES } from "@/constants/routes";
import { useRouter } from "next/navigation";
import CancelButton from "@/components/CancelButton";
import { modals } from "@mantine/modals";
import _ from "lodash";
import AASTreeModal from "@/components/AASTreeModal";
import { showToast } from "@/utils/toast";
import VerifyDetailView from "@/components/VerifyDetailView";
import CategoryCombobox from "@/components/CategoryCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/constants/roles";

import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  ChartData,
} from "chart.js";
import BarChart from "@/components/BarChart";
import CarbonFootprintView from "./CarbonFootprintView";
import TechnicalDataView from "./TechnicalDataView";
import HandoverDocumentationView from "./HandoverDocumentationView";


type AASInstanceInsProps = {
  mode: "create" | "edit" | "view";
  instance?: AASInstance;
  combinedAAS?: {
    verification_log?: {
      total: number;
      success: number;
      fail: number;
    };
    assetAdministrationShells: object[];
    submodels?: object[];
    conceptDescriptions?: object[];
    attatchments?: any;
  };
};

const normalizeMetadataPaths = (obj: any) => {
  if (!obj || typeof obj !== 'object') return;

  Object.keys(obj).forEach((key) => {
    if ((key === 'value' || key === 'originalValue') && typeof obj[key] === 'string') {
      const val = obj[key];
      if (val.includes('/aas_files/aas/') && !val.includes('/aas_files/aas/instance/')) {
        obj[key] = val.replace('/aas_files/aas/', '/aas_files/aas/instance/');
      }
    }
    if (typeof obj[key] === 'object') {
      normalizeMetadataPaths(obj[key]);
    }
  });
};

const initialState = {
  aasmodel: {
    aasmodel: "",
    aasmodel_metadata: {},
  },
};
export default function InstanceForm({
  mode,
  instance,
  combinedAAS,
}: AASInstanceInsProps) {
  const router = useRouter();
  
    ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
  );

  const countModelTypes = (nodes: any[]): Record<string, number> => {
    const counts: Record<string, number> = {};
    const queue = [...nodes];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node) {
        counts[node.modelType] = (counts[node.modelType] || 0) + 1;
        if (node.children) {
          queue.push(...node.children);
        }
      }
    }
    return counts;
  };


  const { user } = useAuth();

  const [activeStep, setActiveStep] = useState(0);
  const [activeTab, setActiveTab] = useState("templateInfo"); // "templateInfo", "submodel", "treeView"
  const [activeDetailTab, setActiveDetailTab] = useState("aasTree");

  const [opened, { open, close }] = useDisclosure(false);

  const treeDataRef = useRef<any>({});

  const [modelType, setModelType] = useState("");
  const [modelSeq, setModelSeq] = useState("");
  const [aasmodel, setAasmodel] = useState(initialState.aasmodel);
  const [treeData, setTreeData] = useState<any[] | undefined>(undefined);

  const verificationRef = useRef<() => void>(null);
  const [verificationActive, setVerificationActive] = useState<any>();

  const [searchState, setSearchState] = useState({
    category_seq: "all",
  });

  const [inputState, setInputState] = useState<{
    instance_name: string;
    description: string;
    verification: "fail" | "success" | undefined;
    verification_log?: {
      total: number;
      success: number;
      fail: number;
    };
  }>({
    instance_name: "",
    description: "",
    verification: undefined,
  });

  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<{
    node: any;    
    rootId: string;
  } | null>(null);
  const [selectedHierarchyNode, setSelectedHierarchyNode] = useState<any>(null);
  const [selectedCDNode, setSelectedCDNode] = useState<any | null>(null);

  const { data: categorys } = useQuery({
    queryKey: ["common/code", "category"],
    queryFn: () => getCodeList("category"),
  });

  const { data: verifications } = useQuery({
    queryKey: ["common/code", "SYS300"],
    queryFn: () => getCodeList("SYS300"),
  });

  const {
    data: models,
    isFetching: isFetchingModels,
    isSuccess,
    refetch,
  } = useQuery({
    queryKey: [modelType, pagination, searchState],
    queryFn: () =>
      getInstanceTargetList({
        modelType,
        category_seq: searchState.category_seq,
        withToast: true,
      }),
    enabled: modelType != "" && searchState.category_seq != "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const modelSeq = new URLSearchParams(window.location.search).get(
      "modelSeq"
    );
    if (instance || !modelSeq) return;

    const fetchModel = async () => {
      const data = await getModel({ modelSeq, modelType: "aasmodel" });
      const model = _.cloneDeep(data[0]);

      // assetKind를 'Instance'로 변경
      if (
        model.metadata?.assetAdministrationShells &&
        model.metadata.assetAdministrationShells.length > 0
      ) {
        model.metadata.assetAdministrationShells[0].assetInformation.assetKind =
          "Instance";
      }

      setAasmodel(renameKey(model, "metadata", "aasmodel_metadata"));
      treeDataRef.current[model.aasmodel_id] = {};
      setInputState((prev) => ({
        ...prev,
        instance_name: prev.instance_name || model.aasmodel_name,
        description: prev.description || model.description,
      }));
    };

    fetchModel();
  }, []);

  useEffect(() => {
    if (!instance) {
      return;
    }
    setInputState({
      instance_name: instance.instance_name,
      description: instance.description,
      verification: instance.verification,
      verification_log: instance.verification_log,
    });

    const aasmodelMetadata = _.cloneDeep(instance.aasmodel_metadata);
    normalizeMetadataPaths(aasmodelMetadata);

    // 인스턴스에 이미 연결된 서브모델과 CD를 메인 메타데이터 상태로 병합합니다.
    if (aasmodelMetadata) {
      // 1. Submodel 병합
      if (!aasmodelMetadata.submodels) {
        aasmodelMetadata.submodels = [];
      }

      if (Array.isArray(instance.submodels)) {
        instance.submodels.forEach((sm_entry) => {
          // sm_entry.submodel_metadata는 { assetAdministrationShells, submodels, ... } 구조
          // 실제 Submodel 정의는 .submodels[0]에 있습니다.
          if (
            sm_entry.submodel_metadata &&
            Array.isArray(sm_entry.submodel_metadata.submodels) &&
            sm_entry.submodel_metadata.submodels.length > 0
          ) {
            const submodelDefinition = sm_entry.submodel_metadata.submodels[0];

            // handleSubmit이 submodel_seq를 참조하므로, 꼭 주입해줘야 합니다.
            submodelDefinition.submodel_seq = sm_entry.submodel_seq;

            // 메인 메타데이터 상태에 추가합니다.
            aasmodelMetadata.submodels.push(submodelDefinition);
          }
        });
      }

      // 2. ConceptDescription 병합 (중복 제거)
      if (!aasmodelMetadata.conceptDescriptions) {
        aasmodelMetadata.conceptDescriptions = [];
      }
      
      const cdMap = new Map();
      // 기본 AAS의 CD를 Map에 추가
      (aasmodelMetadata.conceptDescriptions || []).forEach((cd: any) => {
        if (cd && cd.id) cdMap.set(cd.id, cd);
      });

      // 로드된 모든 서브모델의 CD를 Map에 추가 (중복 덮어쓰기)
      if (Array.isArray(instance.submodels)) {
        instance.submodels.forEach((sm_entry) => {
          if (
            sm_entry.submodel_metadata &&
            Array.isArray(sm_entry.submodel_metadata.conceptDescriptions)
          ) {
            sm_entry.submodel_metadata.conceptDescriptions.forEach((cd: any) => {
              if (cd && cd.id) cdMap.set(cd.id, cd);
            });
          }
        });
      }
      // 중복 제거된 CD 리스트를 다시 할당
      aasmodelMetadata.conceptDescriptions = Array.from(cdMap.values());
    }




    // assetKind를 'Instance'로 변경
    if (
      aasmodelMetadata?.assetAdministrationShells &&
      aasmodelMetadata.assetAdministrationShells.length > 0
    ) {
      aasmodelMetadata.assetAdministrationShells[0].assetInformation.assetKind =
        "Instance";
    }

    setAasmodel({
      aasmodel_seq: instance.aasmodel_seq,
      aasmodel_metadata: aasmodelMetadata,
    });

    treeDataRef.current[instance.aasmodel_id] = {};
  }, [instance]);

  const removeAASModel = () => {
    setModelSeq("");
    setAasmodel(initialState.aasmodel);
    delete treeDataRef.current[aasmodel.aasmodel_id];
  };

  const getModelId = (modelType: "aasmodel" | "submodel", metadata: object) => {
    if (metadata == null) {
      return;
    }
    if (modelType === "aasmodel") {
      return metadata?.["assetAdministrationShells"]?.[0]?.id;
    }
    if (metadata["submodels"] && metadata["submodels"].length > 0) {
      return metadata["submodels"][0]["id"];
    }
    return null;
  };

  const convertToTreeData = (
    modelType: "aasmodel" | "submodel",
    metadata
  ) => {
    if (!metadata) {
      return;
    }
    const parsedMetadata =
      typeof metadata == "object" ? metadata : JSON.parse(metadata);
    const valuePaths = addValuePaths({ ...parsedMetadata });
    const parsedData = parsingAAS(valuePaths);
    return parsedData;
  };

  const conceptDescriptionTreeData = useMemo(() => {
    const metadata = aasmodel.aasmodel_metadata;
    if (!metadata || !metadata.conceptDescriptions) {
      return;
    }

    // Map을 사용해 ConceptDescription의 중복을 제거합니다. (id 기준)
    const uniqueCDs = new Map();
    (metadata.conceptDescriptions || []).forEach((cd: any) => {
      if (cd && cd.id) { // cd 객체와 id가 유효한지 확인
        uniqueCDs.set(cd.id, cd);
      }
    });

    // 중복 제거된 Map의 value들로 새로운 children 배열을 생성합니다.
    const children = Array.from(uniqueCDs.values()).map((cd: any, index: number) => {
      // valuePath는 중복 제거된 리스트의 index를 기준으로 다시 생성합니다.
      const valuePath = `conceptDescriptions[${index}]`;
      return {
        label: cd.idShort,
        ...cd,
        value: cd.id, // 고유한 ID
        valuePath: valuePath,
      };
    });


    const tree = [
      {
        value: "ConceptDescriptions",
        modelType: "ConceptDescriptions",
        idShort: `ConceptDescriptions (${uniqueCDs.size})`, // 중복 제거된 개수
        label: (
          <>
            <NumberFormatter
              thousandSeparator=","
              value={uniqueCDs.size} // 중복 제거된 개수로 수정
            />
            <Text component="span" className={"fs-8"} ml={4} c={"gray.7"} style={{ textAlign: "left" }}>
              Count
            </Text>
          </>
        ),
        children: children, // 중복 제거된 children 배열 사용
      },
    ];



    // const tree = [
    //   {
    //     value: "ConceptDescriptions",
    //     modelType: "ConceptDescriptions",
    //     idShort: `ConceptDescriptions (${metadata.conceptDescriptions.length})`,
    //     label: (
    //       <>
    //         <NumberFormatter
    //           thousandSeparator=","
    //           value={metadata.conceptDescriptions.length}
    //         />
    //         <Text component="span" className={"fs-8"} ml={4} c={"gray.7"} style={{ textAlign: "left" }}>
    //           Count
    //         </Text>
    //       </>
    //     ),
    //     children: metadata.conceptDescriptions.map((cd: any, index: number) => {
    //       const valuePath = `conceptDescriptions[${index}]`;
    //       return {
    //         label: cd.idShort,
    //         ...cd,
    //         value: cd.id,
    //         valuePath: valuePath,
    //       };
    //     }),
    //   },
    // ];

    return tree;
  }, [aasmodel.aasmodel_metadata]);

  useEffect(() => {
    if (!getModelId("aasmodel", aasmodel.aasmodel_metadata)) {
      setTreeData(undefined);
      return;
    }
    const parsedTreeData = convertToTreeData("aasmodel", aasmodel.aasmodel_metadata);
    setTreeData(parsedTreeData);
  }, [aasmodel]);
  
  const componentCounts = useMemo(() => {
    if (!treeData) return {};
    return countModelTypes(treeData);
  }, [treeData]);

  const chartData: ChartData<"bar"> = useMemo(() => {
    const labels = Object.keys(componentCounts);
    const data = Object.values(componentCounts);
    return {
      labels,
      datasets: [
        {
          label: "Component Count",
          data,
          backgroundColor: [
            "rgba(255, 99, 132, 0.8)",
            "rgba(75, 192, 192, 0.8)",
            "rgba(54, 162, 235, 0.8)",
            "rgba(255, 206, 86, 0.8)",
            "rgba(153, 102, 255, 0.8)",
            "rgba(255, 159, 64, 0.8)",
          ],
          borderColor: "rgba(255, 255, 255, 0)",
          borderWidth: 0,
        },
      ],
    };
  }, [componentCounts]);

  function renameKey<T extends object>(
    obj: T,
    oldKey: keyof T,
    newKey: string
  ): Record<string, any> {
    const { [oldKey]: oldValue, ...rest } = obj;
    return {
      [newKey]: oldValue,
      ...rest,
    };
  }

  const applyMetadata = (modelType, metadata) => {
    const payloadMetadata = Array.isArray(metadata)
      ? [...metadata]
      : { ...metadata };

    const refObj = treeDataRef.current[getModelId(modelType, payloadMetadata)];
    for (const key in refObj) {
      const value = refObj[key];
      _.set(payloadMetadata, key, value);
    }
    return payloadMetadata;
  };

  const verifyInstance = async () => {
    let verification: "success" | "fail";

    const body: VerifyInstanceParams = {
      instance_seq: instance?.instance_seq ?? "",
      aasmodel: applyMetadata("aasmodel", aasmodel.aasmodel_metadata),
      submodels: [], // Refactored: Submodels are now part of aasmodel
    };

    try {
      setLoading(true);
      const result = await apiVerifyInstance(body);

      verification = "success";
      verificationRef.current = null;
      setInputState((prev) => ({ ...prev, verification, verification_log: result.data?.summary }));
      setVerificationActive(null);
    } catch (error) {
      console.log(error);
      let json = error?.cause?.json;
      verification = "fail";

      // 'json' (오류 응답)이 존재하고 'json.data' 필드가 유효한 '문자열'인지 확인
      if (json && json.data && typeof json.data === 'string') {
        try {
          // 'data'가 비어있지 않은 문자열이므로 파싱 시도
          const verificationData = JSON.parse(json.data);
          
          if (verificationData) {
            // 파싱 성공: 검증 상세 결과가 있음
            setVerificationActive(0); // 상세 결과 탭 활성화
            verificationRef.current = verificationData; // VerifyDetailView로 데이터 전달
            setInputState((prev) => ({ 
              ...prev, 
              verification: 'fail', 
              verification_log: verificationData?.summary // 상단 요약 정보 업데이트
            }));
          } else {
            // 파싱은 성공했으나 결과가 'null' 등 비어있는 경우
            setInputState((prev) => ({ ...prev, verification: 'fail', verification_log: undefined }));
            verificationRef.current = null;
            setVerificationActive(null);
          }
        } catch (e) {
          // JSON.parse 실패 (e.g., json.data가 "dsfa..." 같은 잘못된 문자열)
          console.error("Failed to parse verification data", e);
          setInputState((prev) => ({ ...prev, verification: 'fail', verification_log: undefined }));
          verificationRef.current = null;
          setVerificationActive(null);
        }
      } else {
        // 'json.data'가 비어있거나(""), null, undefined, 또는 문자열이 아닌 경우
        // "Unexpected end of JSON input" 오류가 발생하는 지점
        console.warn("Verification failed, but no detailed error data was provided by the backend.", json);
        setInputState((prev) => ({ ...prev, verification: 'fail', verification_log: undefined }));
        verificationRef.current = null;
        setVerificationActive(null);
      }

    } finally {
      setLoading(false);
    }
    if (verification === 'fail' && !verificationRef.current) {
      setInputState((prev) => ({ ...prev, verification }));
    }

    return verification;
  };

  const handleSubmit = async () => {
    if (!(await confirmSave("Do you want to Save?"))) return;

    for (const key in inputState) {
      const value = inputState[key];
      if (value == "") {
        return showToast.error(`Please check ${key} field`);
      }
    }

    let verification: "success" | "fail";

    // 4단계(Verification)에서 이미 실행한 검증 결과를 사용합니다.
    if (inputState.verification === "success" || inputState.verification === "fail") {
      verification = inputState.verification;
    } else {
      // 만약 4단계에서 검증을 실행하지 않았다면 (e.g. 건너뛰었다면) 지금 실행합니다.
      verification = await verifyInstance();
    }
    
    // 검증 실패 시 확인 절차는 동일하게 유지합니다.
    if (verification == "fail") {
      if (
        !(await confirmSave(
          "Validation has failed. Would you like to continue anyway?"
        ))
      )
        return;
    }


    const payloadAASmodel = {
      ...aasmodel,
      aasmodel_metadata: JSON.stringify(
        applyMetadata("aasmodel", aasmodel.aasmodel_metadata)
      ),
    };

    // Submodel을 백엔드로 보낼 때, 각 Submodel 정의와
    // 해당 Submodel이 참조하는 ConceptDescription을 함께 묶어 전송합니다.
    const submodelsFromAAS =
      (aasmodel.aasmodel_metadata?.submodels as any[])?.map((sm) => {
        // 'sm'은 Submodel 정의 객체입니다.
        // 이 Submodel 정의 내부에서 참조하는 모든 'semanticId' 값을 찾습니다.
        const referencedCDs = new Set<string>();
        
        function findSemanticIds(element: any) {
          if (typeof element !== 'object' || element === null) return;
          
          // semanticId (단일)
          if (element.semanticId && element.semanticId.keys) {
            element.semanticId.keys.forEach(k => k.value && referencedCDs.add(k.value));
          }
          // isCaseOf (배열)
          if (element.isCaseOf && Array.isArray(element.isCaseOf)) {
            element.isCaseOf.forEach(ref => ref.keys?.forEach(k => k.value && referencedCDs.add(k.value)));
          }

          // 탐색
          if (element.submodelElements) { // Submodel 또는 SubmodelElementCollection
            element.submodelElements.forEach(findSemanticIds);
          }
          if (element.statements) { // Entity
            element.statements.forEach(findSemanticIds);
          }
          if (element.value && typeof element.value === 'object') { // List, Collection, Range 등
             if (Array.isArray(element.value)) {
                element.value.forEach(findSemanticIds);
             } else {
                findSemanticIds(element.value);
             }
          }
        }
        
        findSemanticIds(sm); // Submodel 정의부터 탐색 시작

        // 전체 CD 목록에서 참조된 CD 객체만 필터링합니다.
        const allCDs = aasmodel.aasmodel_metadata?.conceptDescriptions || [];
        const associatedCDs = allCDs.filter(cd => cd.id && referencedCDs.has(cd.id));

        // 백엔드가 요구하는 AAS Environment 형식으로 래핑합니다.
        // return {
        //   submodel_seq: sm.submodel_seq || "",
        //   submodel_metadata: JSON.stringify({
        //     assetAdministrationShells: [],
        //     submodels: [sm], // Submodel 정의
        //     conceptDescriptions: associatedCDs, // 이 Submodel이 참조하는 CD
        //   }),
        // };

        return {
      // 빈 문자열("")은 백엔드 Integer 타입 검증에서 400 에러를 유발하므로 null로 보냅니다.
        submodel_seq: sm.submodel_seq || null,
        submodel_metadata: JSON.stringify({
          assetAdministrationShells: [],
          submodels: [sm], // Submodel 정의
          conceptDescriptions: associatedCDs, // 이 Submodel이 참조하는 CD
        }),
      };
      }) || [];

    // aasmodel_metadata에 submodels가 없는 경우를 대비하여 빈 배열을 기본값으로 사용
    //const submodelsToSend = submodelsFromAAS.length > 0 ? submodelsFromAAS : [{ submodel_seq: "", submodel_metadata: "{}" }];
    const submodelsToSend = submodelsFromAAS.length > 0 ? submodelsFromAAS : [{ submodel_seq: null, submodel_metadata: "{}" }];


    let body: InstanceSavePayload;

    if (mode == "create") {
      body = {
        ...inputState,
        verification,
        instance_seq: "",
        aasmodel_seq: payloadAASmodel.aasmodel_seq,
        aasmodel_metadata: payloadAASmodel.aasmodel_metadata,
        status: "Y",
        submodels: submodelsToSend,
      };
    } else if (mode == "edit") {
      body = {
        ...inputState,
        verification,
        instance_seq: instance.instance_seq,
        aasmodel_seq: payloadAASmodel.aasmodel_seq,
        aasmodel_metadata: payloadAASmodel.aasmodel_metadata,
        status: "Y",
        submodels: submodelsToSend,
      };
    }

    const formData = new FormData();
    formData.append("body", JSON.stringify(body));

    // Append all files from treeDataRef to formData
    const allFilesToUpload: File[] = [];
    Object.values(treeDataRef.current).forEach((rootChanges: any) => {
      Object.values(rootChanges).forEach((change: any) => {
        if (change instanceof File) {
          allFilesToUpload.push(change);
        }
      });
    });
    for (const file of allFilesToUpload) {
      formData.append("attachments", file);
    }
    
    try {
      setLoading(true);
      const result = await upsertInstance({
        formData,
        withToast: true,
      });
      router.push(ROUTES.INSTANCE.LIST);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format, instance: AASInstance) => {
    exportModel({
      modelType: "instance",
      format,
      modelSeq: instance.instance_seq,
      filename: instance.instance_name,
      source: "db",
      withToast: true,
    });
  };

  const combinedAASTreeData = useMemo(() => {
    if (!getModelId("aasmodel", combinedAAS)) return;

    return convertToTreeData("aasmodel", combinedAAS);
  }, [combinedAAS]);

  const combinedAASConceptDescriptionTreeData = useMemo(() => {
    if (!combinedAAS) {
      return;
    }

    const tree = [
      {
        value: "ConceptDescriptions",
        modelType: "ConceptDescriptions",
        idShort: (
          <>
            <NumberFormatter
              thousandSeparator
              value={combinedAAS.conceptDescriptions.length}
            />
            <Text
              component="span"
              className={"fs-8"}
              ml={4}
              c={"gray.7"}
              style={{ textAlign: "left" }}
            >
              Count
            </Text>
          </>
        ),
        children: combinedAAS.conceptDescriptions.map((conceptDescription) => ({
          ...conceptDescription,
          value: conceptDescription.id,
          ConceptDescription: conceptDescription,
        })),
      },
    ];

    return tree;
  }, [combinedAAS]);

  const handleDelete = async () => {
    if (!selectedNode || selectedNode.node.modelType !== "Submodel") {
      return;
    }

    const isConfirm = await confirmSave(
      `Are you sure you want to delete the submodel '${selectedNode.node.idShort}'?`,
      {
        labels: { confirm: "Delete", cancel: "Cancel" },
        confirmProps: { color: "red.8" },
      }
    );

    if (!isConfirm) {
      return;
    }

    const submodelIdToDelete = selectedNode.node.id;
    const submodelValuePath = selectedNode.node.valuePath;
    const rootId = selectedNode.rootId;

    // Clean up treeDataRef for the deleted submodel and its children
    if (treeDataRef.current[rootId] && submodelValuePath) {
      const newRefForRoot = { ...treeDataRef.current[rootId] };
      for (const key in newRefForRoot) {
        if (key.startsWith(submodelValuePath)) {
          delete newRefForRoot[key];
        }
      }
      treeDataRef.current[rootId] = newRefForRoot;
    }

    setAasmodel((prev) => {
      const newMetadata = _.cloneDeep(prev.aasmodel_metadata);

      // 서브모델 '정의' 목록(root.submodels)에서 삭제
      if (newMetadata.submodels) {
        newMetadata.submodels = newMetadata.submodels.filter(
          (sm) => sm.id !== submodelIdToDelete
        );
      }

      // AAS 쉘의 '참조' 목록(AAS[0].submodels)에서 삭제
      if (
        newMetadata.assetAdministrationShells &&
        Array.isArray(newMetadata.assetAdministrationShells) &&
        newMetadata.assetAdministrationShells.length > 0 &&
        Array.isArray(newMetadata.assetAdministrationShells[0].submodels)
      ) {
        newMetadata.assetAdministrationShells[0].submodels =
          newMetadata.assetAdministrationShells[0].submodels.filter((ref) => {
            // ref.keys[0].value가 삭제하려는 ID와 일치하지 않는 것만 남김
            if (
              ref.keys &&
              Array.isArray(ref.keys) &&
              ref.keys.length > 0
            ) {
              return ref.keys[0].value !== submodelIdToDelete;
            }
            return true; // 안전장치: 구조가 다른 참조는 일단 유지
          });
      }

      return { ...prev, aasmodel_metadata: newMetadata };
    });

    setSelectedNode(null);
    showToast.success("Submodel deleted successfully.");
  };

  const handleCDDetailSave = () => {
    if (!selectedCDNode) {
      showToast.error("No Concept Description selected.");
      return;
    }

    const changes = treeDataRef.current['conceptDescriptions'];

    if (!changes || Object.keys(changes).length === 0) {
      showToast.warning("No changes to save.");
      return;
    }

    const newMetadata = _.cloneDeep(aasmodel.aasmodel_metadata);

    for (const key in changes) {
      // The path in changes is relative to the conceptDescriptions array
      const fullPath = `conceptDescriptions.${key}`;
      _.set(newMetadata, fullPath, changes[key]);
    }

    setAasmodel(prev => ({ ...prev, aasmodel_metadata: newMetadata }));
    delete treeDataRef.current['conceptDescriptions']; // Clear changes after applying
    showToast.success(`Changes for '${selectedCDNode.idShort}' have been saved.`);
  }

  const handleDetailChange = (path: string, value: any, file?: File) => {
    if (!selectedNode) return;
    const { rootId } = selectedNode;
    if (!treeDataRef.current[rootId]) {
      treeDataRef.current[rootId] = {};
    }

    // Store file object directly in treeDataRef for later upload
    if (file) {
      treeDataRef.current[rootId][path] = file;
      // Also update the value for display (e.g., filename)
      treeDataRef.current[rootId][`${path.substring(0, path.lastIndexOf('.'))}.value`] = value;
    } else {
      treeDataRef.current[rootId][path] = value;
      // 해당 노드가 'File' 또는 'Property' 타입이라면, 백엔드 호환성을 위해 'value' 필드도 동일하게 업데이트합니다.
      const nodeType = selectedNode.node.modelType;
      if (path.endsWith('.originalValue') && (nodeType === 'File' || nodeType === 'Property')) {
        const valuePath = path.replace(/\.originalValue$/, '.value');
        treeDataRef.current[rootId][valuePath] = value;
      }
    }

    // Force re-render to show changes in input fields
    setSelectedNode(prev => prev ? ({ ...prev }) : null);
  };

  const handleDetailSave = () => {
    if (!selectedNode) {
      showToast.error("No item selected.");
      return;
    }

    const { node, rootId } = selectedNode;
    const changes = treeDataRef.current[rootId];

    if (!changes || Object.keys(changes).length === 0) {
      showToast.warning("No changes to save.");
      return;
    }

    // Create a deep copy of the current aasmodel metadata to avoid direct mutation.
    const newMetadata = _.cloneDeep(aasmodel.aasmodel_metadata);

    // Apply the staged changes from treeDataRef to the new metadata object.
    for (const key in changes) {
      _.set(newMetadata, key, changes[key]);
    }

    // Update the main aasmodel state with the new metadata.
    // This will trigger a re-render of the AASTree and Preview components.
    setAasmodel(prev => ({ ...prev, aasmodel_metadata: newMetadata }));

    // Manually update treeData for immediate reflection in the preview tab
    const newTreeData = convertToTreeData("aasmodel", newMetadata);
    setTreeData(newTreeData);

    showToast.success(`Changes for '${node.idShort}' have been saved and applied.`);
  };

  const handleAddElement = (
    parentNode: any,
    elementType: string,
    idShort: string
  ) => {
    const newElement: any = { // Use 'any' for flexibility in creating different element types
      idShort: idShort,
      //id: uuidv4(), // 필수: 고유 ID를 생성하여 할당합니다.
      modelType: elementType,
      description: [{ language: 'en', text: '' }], // langStrings
      semanticId: {
        type: "ModelReference",
        keys: [
          {
            type: "GlobalReference",
            value: "", // Default empty value
          },
        ],
      },
    };

    switch (elementType) {
      case "Property":
        newElement.valueType = "xs:string";
        newElement.value = "";
        newElement.category = "PARAMETER"; // optional
        newElement.semanticId = { keys: [] };
        break;
      case "MultiLanguageProperty":
        newElement.valueType = "xs:string";
        newElement.value = [
          { language: "en-US", text: "" }
        ];
        break;
      case "Range":
        newElement.valueType = "xs:integer";
        newElement.min = 0;
        newElement.max = 0;
        break;
      case "File":
        newElement.contentType = "";
        newElement.value = "";
        break;
      case "ReferenceElement":
        newElement.value = { type: "ModelReference", keys: [] };
        break;

      // SubmodelElementCollection 케이스 분리
      case "SubmodelElementCollection":
        newElement.value = [];
        //newElement.allowDuplicates = false;
        break;

      // SubmodelElementList 케이스 분리 및 필수 속성 추가
      case "SubmodelElementList":
        newElement.value = [];
        newElement.allowDuplicates = false;
        // [필수] AAS V3.0 표준에 따라 리스트 내부 요소의 타입을 지정합니다.
        // "SubmodelElement"는 Property, File, Collection 등 모든 하위 타입을 허용하는 기본값입니다.
        newElement.typeValueListElement = "SubmodelElement";   
        // 리스트 순서가 의미 있음을 명시 (AAS 기본값)
        newElement.orderRelevant = true; 
        break;

      case "Entity":
        newElement.entityType = "SelfManagedEntity";
        newElement.statements = [];
        newElement.globalAssetId = "";
        newElement.specificAssetId = []; // optional but recommended
        break;
      case "RelationshipElement":
        newElement.first = { type: "ModelReference", keys: [] };
        newElement.second = { type: "ModelReference", keys: [] };
        break;
      default:
        break;
    }

    setAasmodel((prev) => {
      const newMetadata = _.cloneDeep(prev.aasmodel_metadata);
      const parentPath = parentNode.valuePath;

      let childrenPath;
      if (parentNode.modelType === "Submodel") {
        childrenPath = `${parentPath}.submodelElements`;
      } else if (
        ["SubmodelElementCollection", "SubmodelElementList"].includes(
          parentNode.modelType
        )
      ) {
        childrenPath = `${parentPath}.value`;
      } else if (parentNode.modelType === "Entity") {
        childrenPath = `${parentPath}.statements`;
      }

      if (childrenPath) {
        const children = _.get(newMetadata, childrenPath, []);
        if (
          Array.isArray(children) &&
          !children.find((c) => c.idShort === idShort)
        ) {
          children.push(newElement);
          _.set(newMetadata, childrenPath, children);
        } else if (!children) {
          _.set(newMetadata, childrenPath, [newElement]);
        }
      }

      return { ...prev, aasmodel_metadata: newMetadata };
    });
    showToast.success(`Element '${idShort}' added to '${parentNode.idShort}'.`);
  };

  const handleDeleteElement = (node: any) => {
    setAasmodel((prev) => {
      const newMetadata = _.cloneDeep(prev.aasmodel_metadata);

      if (node.modelType === 'Submodel') {
        // --- 서브모델 삭제 로직 ---
        const submodelIdToDelete = node.id;

        // 서브모델 '정의' 목록(root.submodels)에서 삭제
        if (newMetadata.submodels) {
          newMetadata.submodels = newMetadata.submodels.filter(
            (sm) => sm.id !== submodelIdToDelete
          );
        }

        // AAS 쉘의 '참조' 목록(AAS[0].submodels)에서 삭제
        if (
          newMetadata.assetAdministrationShells &&
          Array.isArray(newMetadata.assetAdministrationShells) &&
          newMetadata.assetAdministrationShells.length > 0 &&
          Array.isArray(newMetadata.assetAdministrationShells[0].submodels)
        ) {
          newMetadata.assetAdministrationShells[0].submodels =
            newMetadata.assetAdministrationShells[0].submodels.filter((ref) => {
              // ref.keys[0].value가 삭제하려는 ID와 일치하지 않는 것만 남김
              if (
                ref.keys &&
                Array.isArray(ref.keys) &&
                ref.keys.length > 0
              ) {
                return ref.keys[0].value !== submodelIdToDelete;
              }
              return true; // 구조가 다른 참조는 일단 유지
            });
        }
      } else {
        // ▼▼▼▼▼ 하위 요소(SubmodelElement) 삭제 로직 ▼▼▼▼▼
        
        // 1. Lodash의 toPath를 사용하여 경로를 배열로 안전하게 분리합니다. (예: 'a[0].b' -> ['a', '0', 'b'])
        const pathParts = _.toPath(node.valuePath);
        const lastPart = pathParts[pathParts.length - 1];

        // 2. 마지막 경로가 숫자(인덱스)인지 확인합니다.
        if (!isNaN(Number(lastPart))) {
          const parentPath = pathParts.slice(0, -1); // 마지막 인덱스 제외한 부모 경로
          const index = Number(lastPart);
          const parent = _.get(newMetadata, parentPath);

          // 3. 부모가 배열이면 splice로 삭제하여 길이를 줄입니다. (구멍 방지)
          if (Array.isArray(parent)) {
            parent.splice(index, 1);
          } else {
            // 배열이 아니면 unset
            _.unset(newMetadata, node.valuePath);
          }
        } else {
          // 인덱스가 아니면(객체 속성 등) unset
          _.unset(newMetadata, node.valuePath);
        }
      }
      // ▲▲▲▲▲ [수정 완료] ▲▲▲▲▲

      return { ...prev, aasmodel_metadata: newMetadata };
    });
    showToast.success(`Element '${node.idShort}' deleted.`);
  };

  const handleAddConceptDescription = (
    parentNode: any,
    elementType: string, // Should be 'ConceptDescription'
    idShort: string
  ) => {
    if (elementType !== "ConceptDescription") return;

    const newCD = {
      idShort: idShort,
      id: uuidv4(),
      modelType: "ConceptDescription",
      description: [{ language: "en", text: "" }],
    };

    setAasmodel((prev) => {
      const newMetadata = _.cloneDeep(prev.aasmodel_metadata);
      if (!newMetadata.conceptDescriptions) {
        newMetadata.conceptDescriptions = [];
      }
      newMetadata.conceptDescriptions.push(newCD);
      return { ...prev, aasmodel_metadata: newMetadata };
    });
    showToast.success(`Concept Description '${idShort}' added.`);
  };

  const handleDeleteConceptDescription = (node: any) => {
    if (node.modelType !== "ConceptDescription") return;

    setAasmodel((prev) => {
      const newMetadata = _.cloneDeep(prev.aasmodel_metadata);
      const pathParts = node.valuePath.match(/(.*)\[(\d+)\]$/);
      if (pathParts) {
        const parentPath = pathParts[1];
        const index = parseInt(pathParts[2], 10);
        const parentArray = _.get(newMetadata, parentPath);
        if (Array.isArray(parentArray)) {
          _.pullAt(parentArray, index);
        }
      }
      return { ...prev, aasmodel_metadata: newMetadata };
    });

    showToast.success(`Concept Description '${node.idShort}' deleted.`);
  };

  const renderFootButtons = () => {
    const aasEditLink = ROUTES.INSTANCE.EDIT(instance?.instance_seq);
    switch (mode) {
      case "view":
        return (
          <>
            <button
              className="btn btn-light-facebook btn-sm me-2"
              onClick={async () => {
                if (combinedAASTreeData == null) {
                  return;
                }

                modals.open({
                  fullScreen: true,
                  children: (
                    <>
                      <div className="card mt-10">
                        <div
                          className="card-header border-0 bg-light"
                          style={{ minHeight: "50px" }}
                        >
                          <div className="card-title fs-4 fw-bold">Model</div>
                        </div>
                        <div id="" className="collapse show">
                          <form
                            id="kt_account_profile_details_form"
                            className="form"
                          >
                            <div className="card-body border-top p-9">
                              {Array.isArray(combinedAASTreeData) && (
                                <AASTree
                                  mb={"sm"}
                                  data={combinedAASTreeData}
                                  editMode={false}
                                />
                              )}
                            </div>
                          </form>
                        </div>
                      </div>

                      <div className="card mt-10">
                        <div
                          className="card-header border-0 bg-light"
                          style={{ minHeight: "50px" }}
                        >
                          <div className="card-title fs-4 fw-bold">
                            Concepdescription
                          </div>
                        </div>
                        <div id="" className="collapse show">
                          <form
                            id="kt_account_profile_details_form"
                            className="form"
                          >
                            <div className="card-body border-top p-9">
                              {Array.isArray(
                                combinedAASConceptDescriptionTreeData
                              ) && (
                                <AASTree
                                  mb={"sm"}
                                  data={combinedAASConceptDescriptionTreeData}
                                  editMode={false}
                                />
                              )}
                            </div>
                          </form>
                        </div>
                      </div>
                    </>
                  ),
                });
              }}
            >
              View Combined Model
            </button>
            {user?.user_seq === instance?.create_user_seq && (
              <>
                <Link
                  href={aasEditLink}
                  className="btn btn-light-success btn-sm me-2"
                >
                  <i className="fa-regular fa-pen-to-square"></i> Edit{" "}
                </Link>
                <Menu shadow="md" width={200}>
                  <Menu.Target>
                    <button className="btn btn-success btn-sm me-2 dropdown-toggle">
                      Export
                    </button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    {["json", "xml", "aasx"].map((format) => (
                      <Menu.Item
                      key={`${instance.instance_seq}-${format}`}
                        onClick={() =>
                          instance?.instance_seq && instance?.instance_name && handleExport(format, instance)
                        }
                      >
                        {format}
                      </Menu.Item>
                    ))}
                  </Menu.Dropdown>
                </Menu>
              </>
            )}
          </>
        );
      case "create":
      case "edit":
        return (
          <>
            <CancelButton />
            {mode == "edit" && 
              (user?.user_group_seq === UserRole.Manager || user?.user_seq === instance?.create_user_seq) && (

              <button
                type="button"
                className="btn btn-danger btn-sm me-2"
                disabled={loading}
                onClick={async () => {
                  const isConfirm = await confirmSave(
                    "Are you sure you want to delete it?",
                    {
                      labels: { confirm: "Delete", cancel: "Cancel" },
                      confirmProps: { color: "red.8" },
                    }
                  );
                  if (isConfirm) {
                    const result = await deleteModel({
                      modelType: "instance",
                      modelSeq: instance?.instance_seq,
                    });

                    router.replace(ROUTES.INSTANCE.LIST);
                  }
                }}
              >
                <i className="fa-solid fa-cloud"></i> Delete
              </button>
            )}
            <button
              type="button"
              className="btn btn-facebook btn-sm me-2"
              disabled={loading}
              onClick={verifyInstance}
            >
              <i className="fa-solid fa-certificate"></i>
              Verify
            </button>
            {/* System Manager(1) 또는 User(3)일 때만 생성/저장 버튼 표시 */}
            {((mode === "create" && (user?.user_group_seq === 1 || user?.user_group_seq === 3)) ||
              (mode === "edit" &&
                (
                  // System Manager(1)는 항상 수정 가능
                  user?.user_group_seq === 1 || 
                  // User(3)는 본인이 생성한 것만 수정 가능
                  (user?.user_group_seq === 3 && user?.user_seq === instance?.create_user_seq)
                )
              )) && (
              <button
                type="button"
                className="btn btn-success btn-sm me-2"
                disabled={loading}
                onClick={() => handleSubmit()}
              >
                <i className="fa-solid fa-upload"></i>{" "}
                {mode == "create" ? "Create" : "Save"}
              </button>
            )}
          </>
        );
      default:
        break;
    }
  };

  const originalForm = (
    <div key={mode === 'view' ? instance?.instance_seq : 'create-preview'}>
      <div className="row mb-6">
        <div className="col-lg-12">
          <div className="card mb-5 mb-xxl-8">
            <div className="card-body pt-9 pb-0">
              {/* begin::Details */}
              <div className="d-flex flex-wrap flex-sm-nowrap">
                {/* begin: Pic */}
                <div className="me-7 mb-4">
                  <div className="symbol symbol-100px symbol-lg-160px symbol-fixed position-relative">
                    {/* Note: In Next.js, images in the `public` folder are referenced from the root. */}
                    <img src="/assets/media/aas/aas_blank.jpg" alt="제품 이미지" />
                    <div className="position-absolute translate-middle bottom-0 start-100 mb-6 bg-success rounded-circle border border-4 border-body h-20px w-20px"></div>
                  </div>
                </div>
                {/* end::Pic */}
                {/* begin::Info */}
                <div className="flex-grow-1">
                  {/* begin::Title */}
                  <div className="d-flex justify-content-between align-items-start flex-wrap mb-2">
                    {/* begin::User */}
                    <div className="d-flex flex-column">
                      {/* begin::Name */}
                      <div className="d-flex align-items-center mb-2">
                        <a className="text-gray-900 text-hover-primary fs-2 fw-bold me-1">{mode === 'view' ? instance?.instance_name : inputState.instance_name}</a>
                        <a onClick={(e) => e.preventDefault()} aria-label="Verified">
                          {/* Note: In a real app, you would use a dedicated icon library like `react-icons`. */}
                          <i className="ki-outline ki-verify fs-1 text-primary"></i>
                        </a>
                      </div>
                      {/* end::Name */}
                      {/* begin::Info */}
                      <div className="d-flex flex-wrap fw-semibold fs-6 mb-4 pe-2">
                        <a className="d-flex align-items-center text-gray-500 text-hover-primary me-5 mb-2">
                          <i className="ki-outline ki-profile-circle fs-4 me-1"></i> ID :&nbsp;
                          {Array.isArray(treeData) && treeData.length > 0 && (
                              <>
                              {treeData[0].id}
                                </>
                            )
                          }
                        </a>
                      </div>
                      {/* end::Info */}
                    </div>
                    {/* end::User */}
                    {/* begin::Actions */}
                    {mode === 'view' && user?.user_seq === instance?.create_user_seq && (
                      <div className="d-flex my-4">
                        <Menu shadow="md" width={200}>
                          <Menu.Target>
                            <button className="btn btn-sm btn-light-primary me-2 dropdown-toggle">
                              Export
                            </button>
                          </Menu.Target>
                          <Menu.Dropdown>
                            {["json", "xml", "aasx"].map((format) => (
                              <Menu.Item
                                key={format}
                                onClick={() =>
                                  instance?.instance_seq && instance?.instance_name && handleExport(format, instance)
                                }
                              >
                                {format}
                              </Menu.Item>
                            ))}
                          </Menu.Dropdown>
                        </Menu>
                        <Link href={ROUTES.INSTANCE.EDIT(instance?.instance_seq)} className="btn btn-sm btn-primary me-3">Edit</Link>
                      </div>
                    )}
                    {/* end::Actions */}
                  </div>
                  {/* end::Title */}
                  {/* begin::Stats */}
                  <div className="d-flex flex-wrap flex-stack">
                    {/* begin::Wrapper */}
                    <div className="d-flex flex-column flex-grow-1 pe-8">
                      {/* begin::Stats */}
                      <div className="d-flex flex-wrap">
                        {/* begin::Stat */}
                        <div className="border border-gray-300 border-dashed rounded min-w-125px py-3 px-4 me-6 mb-3">
                          {/* begin::Number */}
                          <div className="d-flex align-items-center">
                            <i className="fa-solid fa-list fs-3 text-primary me-2"></i>
                            <div className="fs-2 fw-bold">{mode === 'view' ? instance?.category_name : aasmodel?.category_name}</div>
                          </div>
                          {/* end::Number */}
                          {/* begin::Label */}
                          <div className="fw-semibold fs-6 text-gray-500">Category</div>
                          {/* end::Label */}
                        </div>
                        {/* end::Stat */}
                        {/* begin::Stat */}
                        <div className="border border-gray-300 border-dashed rounded min-w-125px py-3 px-4 me-6 mb-3">
                          {/* begin::Number */}
                          <div className="d-flex align-items-center">
                            {(mode === 'view' ? instance?.verification : inputState.verification) && (
                              <div className="fs-2 fw-bold">
                                <Badge
                                  size="lg"
                                  color={
                                    (mode === 'view' ? instance?.verification : inputState.verification) === "success"
                                      ? "green"
                                      : "red.4"
                                  }
                                  radius="sm"
                                >
                                  {mode === 'view' ? instance?.verification : inputState.verification}
                                </Badge>
                              </div>
                            )}
                          </div>
                          {/* end::Number */}
                          {/* begin::Label */}
                          <div className="fw-semibold fs-6 text-gray-500">Verification</div>
                          {/* end::Label */}
                        </div>
                        {/* end::Stat */}
                        {/* begin::Stat */}
                        <div className="border border-gray-300 border-dashed rounded min-w-125px py-3 px-4 me-6 mb-3">
                          {/* begin::Number */}
                          <div className="d-flex align-items-center">
                            <i className="fa-solid fa-file-lines fs-3 text-info me-2"></i>
                            <div className="fs-2 fw-bold">{mode === 'view' ? instance?.aasmodel_version : aasmodel?.version}</div>
                          </div>
                          {/* end::Number */}
                          {/* begin::Label */}
                          <div className="fw-semibold fs-6 text-gray-500">Version</div>
                          {/* end::Label */}
                        </div>
                        {/* end::Stat */}
                        {/* begin::Stat */}
                        <div className="border border-gray-300 border-dashed rounded min-w-125px py-3 px-4 me-6 mb-3">
                          {/* begin::Number */}
                          <div className="d-flex align-items-center">
                            <i className="fa-solid fa-file-lines fs-3 text-gray-500 me-2"></i>
                            <div className="fs-2 fw-bold">{mode === 'view' ? instance?.instance_seq : '(auto)'}</div>
                          </div>
                          {/* end::Number */}
                          {/* begin::Label */}
                          <div className="fw-semibold fs-6 text-gray-500">Instance seq </div>
                          {/* end::Label */}
                        </div>
                        {/* end::Stat */}
                        {/* begin::Stat */}
                        <div className="border border-gray-300 border-dashed rounded min-w-125px py-3 px-4 me-6 mb-3">
                          {/* begin::Number */}
                          <div className="d-flex align-items-center">
                            <i className="fa-solid fa-calendar-days fs-3 text-gray-500 me-2"></i>
                            <div className="fs-2 fw-bold">
                              {mode === 'view' && instance?.create_date ? new Intl.DateTimeFormat('ko-KR').format(new Date(instance.create_date)) : 'N/A'}
                            </div>
                          </div>
                          {/* end::Number */}
                          {/* begin::Label */}
                          <div className="fw-semibold fs-6 text-gray-500">Create Date</div>
                          {/* end::Label */}
                        </div>
                        {/* end::Stat */}

                        {/* ▼▼▼ [신규] Last Update 스탯 추가 ▼▼▼ */}
                        <div className="border border-gray-300 border-dashed rounded min-w-125px py-3 px-4 me-6 mb-3">
                          {/* begin::Number */}
                          <div className="d-flex align-items-center">
                            <i className="fa-solid fa-calendar-check fs-3 text-gray-500 me-2"></i>
                            <div className="fs-2 fw-bold">
                              {mode === 'view' && instance?.last_mod_date ? new Intl.DateTimeFormat('ko-KR').format(new Date(instance.last_mod_date)) : 'N/A'}
                            </div>
                          </div>
                          {/* end::Number */}
                          {/* begin::Label */}
                          <div className="fw-semibold fs-6 text-gray-500">Last Update</div>
                          {/* end::Label */}
                        </div>
                        {/* end::Stat */}
                        {/* ▲▲▲ [신규] 추가 완료 ▲▲▲ */}


                      </div>
                      {/* end::Stats */}
                    </div>
                    {/* end::Wrapper */}
                  </div>
                  {/* end::Stats */}
                </div>
                {/* end::Info */}
              </div>
              {/* end::Details */}
              {/* begin::Navs */}
              <ul className="nav nav-stretch nav-line-tabs nav-line-tabs-2x border-transparent fs-5 fw-bold">
                {/* begin::Nav item */}
                <li className="nav-item mt-2">
                  <a
                    className={`nav-link text-active-primary ms-0 me-10 py-5 ${
                      activeTab === "templateInfo" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("templateInfo")}
                    style={{ cursor: "pointer" }}
                  >
                    AAS Instance info
                  </a>
                </li>
                {/* end::Nav item */}
                {/* begin::Nav item */}
                <li className="nav-item mt-2">
                  <a
                    className={`nav-link text-active-primary ms-0 me-10 py-5 ${
                      activeTab === "submodel" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("submodel")}
                    style={{ cursor: "pointer" }}
                  >
                    Submodel
                  </a>
                </li>
                {/* end::Nav item */}
                {/* begin::Nav item */}
                <li className="nav-item mt-2">
                  <a
                    className={`nav-link text-active-primary ms-0 me-10 py-5 ${
                      activeTab === "treeView" ? "active" : ""
                    }`}
                    onClick={() => setActiveTab("treeView")}
                    style={{ cursor: "pointer" }}
                  >
                    Tree view
                  </a>
                </li>
                {/* end::Nav item */}
              </ul>
              {/* begin::Navs */}
            </div>
          </div>
        </div>
      </div>

      {activeTab === "templateInfo" && (<div className="row g-5 g-xxl-8">
        <div className="col-lg-4 d-flex">
          <div className="card flex-fill">
            <div className="card-header border-0 bg-light" style={{ minHeight: '50px' }}>
              <div className="card-title fs-4 fw-bold">Instance info</div>
            </div>
            <div className="card-body border-top p-6">
              <div className="table-responsive">
                <table className="table table-row-dashed table-row-gray-300 align-middle">
                  <tbody>
                    {/* <tr>
                      <th className="text-gray-700 fw-bold w-25 min-w-100px">AAS idShort</th>
                      <td className="text-gray-900 fw-semibold"><div className="text-primary fw-bold">{treeData?.[0]?.idShort}</div></td>
                    </tr> */}
                    {/* <tr>
                      <th className="text-gray-700 fw-bold">버전</th>
                      <td className="text-gray-900 fw-semibold">
                        <div className="text-primary fw-bold">
                          {mode == "create"
                            ? aasmodel.version
                            : instance.aasmodel_version}

                        </div>
                      </td>
                    </tr> */}
                    <tr>
                      <th className="text-gray-700 fw-bold">Asset Kind</th>
                      <td className="text-gray-900 fw-semibold"><div className="text-primary fw-bold">{treeData?.[0]?.AssetAdministrationShell?.assetInformation?.assetKind}</div></td>
                    </tr>
                    <tr>
                      <th className="text-gray-700 fw-bold">Global Asset ID</th>
                      <td className="text-gray-900 fw-semibold"><div className="text-primary fw-bold"> {Array.isArray(treeData) && treeData.length > 0 && (
                              <>
                              {treeData[0].id}
                                </>
                            )
                          }</div></td>
                    </tr>
                    <tr>
                      <th className="text-gray-700 fw-bold">Reference Submodel</th>
                      <td className="text-gray-900 fw-semibold">
                        <ul className="m-0 ps-0 list-unstyled">
                          {Array.isArray(treeData) &&
                            treeData?.[0]?.children
                              ?.filter(
                                (child) => child.modelType === "Submodel"
                              )
                              .map((submodel, index) => (
                                <li key={`${submodel.id || submodel.idShort}-${index}`} className="mb-1 text-primary fw-bold">
                                  {submodel.idShort || `Submodel ${index + 1}`}
                                </li>
                              ))}
                        </ul>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4 d-flex">
          <div className="card flex-fill">
            <div className="card-header border-0 bg-light" style={{ minHeight: '50px' }}>
              <div className="card-title fs-4 fw-bold">Description</div>
            </div>
            <div className="card-body border-top p-6">
              {mode === 'view' ? instance?.description : inputState.description}
            </div>
          </div>
        </div>
        <div className="col-lg-4 d-flex">
          <div className="card flex-fill">
            <div className="card-header border-0 bg-light" style={{ minHeight: '50px' }}>
              <div className="card-title fs-4 fw-bold">Components</div>
            </div>
            <div className="card-body border-top p-6">
              <div style={{ position: 'relative', margin: 'auto', height: '100%', width: '100%' }}>
                {Object.keys(componentCounts).length > 0 ? (
                  <BarChart data={chartData} />
                ) : (
                  <Text>No components to display.</Text>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

    {activeTab === 'submodel' && (() => {
      const aasNode = treeData?.[0];
      if (!aasNode || !aasNode.children) {
        return (
          <div className="card">
            <div className="card-body">
              <div className="text-center text-muted">AAS Template not loaded.</div>
            </div>
          </div>
        );
      }
      const submodelTreeNodes = aasNode.children.filter(child => child.modelType === 'Submodel');

      return (
        <div className="row mb-6" id="v_submodel">
          <div className="col-lg-12">
            <div className="card">
              <div className="card-header border-0 bg-light" style={{ minHeight: '50px' }}>
                <div className="card-title fs-4 fw-bold">Submodels</div>
              </div>
              <div className="card-body border-top p-9">
                {submodelTreeNodes.length > 0 ? (
                  <Accordion variant="separated">
                    {submodelTreeNodes.map((submodelNode, index) => (
                      <Accordion.Item key={`${submodelNode.idShort || 'submodel'}-${index}`} value={submodelNode.idShort || `submodel-${index}`}>
                        <Accordion.Control>
                          <Flex align="center" gap="md">
                            <Text>{submodelNode.idShort || "Submodel"}</Text>
                            {/* {submodelNode.idShort?.includes("Nameplate") && (
                              <Badge color="blue" variant="light">
                                Nameplate
                              </Badge>
                            )}
                            {submodelNode.idShort?.startsWith("Technical") && (
                              <Badge color="teal" variant="light">
                                Technical Data
                              </Badge>
                            )} */}
                          </Flex>
                        </Accordion.Control>
                        <Accordion.Panel>
                          {submodelNode.idShort?.includes("Nameplate") ? (
                          (() => {
                            // --- 1. 헬퍼 함수 및 헤더 정보 추출 ---
                            const getAllProperties = (elements: any[]): any[] => {
                              let properties: any[] = [];
                              if (!Array.isArray(elements)) return properties;
                              
                              for (const element of elements) {
                                if (['Property', 'MultiLanguageProperty', 'File'].includes(element.modelType)) {
                                  properties.push(element);
                                } else if (['SubmodelElementCollection', 'SubmodelElementList'].includes(element.modelType)) {
                                  const children = element.children || _.get(aasmodel.aasmodel_metadata, `${element.valuePath}.value`, []);
                                  properties = properties.concat(getAllProperties(children));
                                }
                              }
                              return properties;
                            };

                            const allProperties = getAllProperties(submodelNode.children || []);

                            const getPropValue = (idShort: string): string => {
                              const propNode = allProperties.find(p => p.idShort === idShort);
                              if (!propNode) return 'N/A';
                              
                              const propData = _.get(aasmodel.aasmodel_metadata, propNode.valuePath);
                              if (propData?.modelType === 'MultiLanguageProperty' && Array.isArray(propData.value)) {
                                const enValue = propData.value.find(v => v.language === 'en');
                                return enValue?.text || propData.value[0]?.text || 'N/A';
                              }
                              return String(propData?.value || 'N/A');
                            };

                            const getFileValue = (idShort: string): string => {
                              const propNode = allProperties.find(p => p.idShort === idShort);
                              if (!propNode) return '/assets/media/thumbnail_placeholder.svg';
                              const propData = _.get(aasmodel.aasmodel_metadata, propNode.valuePath);
                              return propData?.value || '/assets/media/thumbnail_placeholder.svg';
                            };

                            const manufacturerName = getPropValue('ManufacturerName');
                            const productDesignation = getPropValue('ManufacturerProductDesignation');
                            const productImage = getFileValue('URI_of_the_ProductImage') || getFileValue('ProductImage');


                            // --- 2. 뷰 렌더링 (헤더) ---
                            return (
                              <div className="card" style={{ maxWidth: '100%', margin: 'auto' }}>
                                <div className="card-body p-5">
                                  {/* 2a. 상단 헤더 (이미지, 제조사명, 제품명) */}
                                  <div className="d-flex">
                                    <div className="symbol symbol-100px symbol-fixed me-5">
                                      {/* <img src={productImage} alt="Product" /> */}
                                    </div>
                                    <div className="flex-grow-1">
                                      <div className="d-flex justify-content-between align-items-start">
                                        <div className="d-flex flex-column">
                                          <div className="text-gray-800 text-hover-primary fs-4 fw-bold">{productDesignation}</div>
                                          <span className="text-muted fw-semibold fs-6">{manufacturerName}</span>
                                        </div>
                                        <span className="badge badge-light-success fs-8 fw-bold">
                                          {new Intl.DateTimeFormat('ko-KR').format(new Date(instance?.create_date ?? Date.now()))}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* --- 3. 탭 렌더링 로직 --- */}
                                  {(() => {
                                    const allChildren = submodelNode.children || [];
                                    
                                    // "General" 탭: 1레벨 자식 중 Property, File, MLP 등
                                    // 헤더에 사용된 속성도 포함하도록 필터링을 제거합니다.
                                    const generalProperties = allChildren.filter(child => 
                                      ['Property', 'MultiLanguageProperty', 'File', 'Range'].includes(child.modelType)
                                      // !['ManufacturerName', 'ManufacturerProductDesignation', 'URI_of_the_ProductImage', 'ProductImage'].includes(child.idShort) // <-- 이 라인 제거
                                    );

                                    // 3b. "SMC/SML" 탭: 1레벨 자식 중 Collection 및 List
                                    const collectionTabs = allChildren.filter(child => 
                                      ['SubmodelElementCollection', 'SubmodelElementList'].includes(child.modelType)
                                    );

                                    // 3c. 기본 탭 설정
                                    const defaultTab = generalProperties.length > 0 ? "general" : (collectionTabs[0]?.idShort || null);

                                    if (!defaultTab) {
                                      return <Text c="dimmed" mt="md">This submodel has no displayable elements.</Text>;
                                    }

                                    // 3d. 탭 UI 렌더링
                                    return (
                                      <Tabs defaultValue={defaultTab} mt="md">
                                        <Tabs.List>
                                          {/* "General" 탭 (최상위 속성이 있을 경우) */}
                                          {generalProperties.length > 0 && (
                                            <Tabs.Tab value="general">
                                              <Flex align="center" gap="xs">
                                                <Text>General</Text>
                                                <Badge color="blue" variant="light">
                                                  {generalProperties.length}
                                                </Badge>
                                              </Flex>
                                            </Tabs.Tab>
                                          )}

                                          {/* Collection/List 탭 */}
                                          {collectionTabs.map((tab, index) => (
                                            <Tabs.Tab key={tab.idShort || `col-tab-${index}`} value={tab.idShort}>
                                              <Flex align="center" gap="xs">
                                                <Text>{tab.idShort}</Text>
                                                {Array.isArray(tab.children) && (
                                                  <Badge color="blue" variant="light">
                                                    {tab.children.length}
                                                  </Badge>
                                                )}
                                              </Flex>
                                            </Tabs.Tab>
                                          ))}
                                        </Tabs.List>

                                        {/* "General" 탭 패널 (카드 뷰) */}
                                        {generalProperties.length > 0 && (
                                          <Tabs.Panel value="general" pt="lg">
                                            <div className="d-flex flex-wrap justify-content-start">
                                              <div className="d-flex flex-wrap">
                                                {generalProperties.map(propNode => {
                                                  // getPropValue는 'allProperties' (평탄화된) 목록에서 값을 찾습니다.
                                                  const value = getPropValue(propNode.idShort);
                                                  
                                                  if (value === 'N/A' || !value) return null;
                                                  
                                                  // [유지] 기존 카드 렌더링
                                                  return (
                                                    <div key={`${propNode.idShort}-${propNode.valuePath}`} className="border border-gray-300 border-dashed rounded min-w-125px py-2 px-4 me-4 mb-3">
                                                      <div className="fs-6 text-gray-800 fw-bold">{value}</div>
                                                      <div className="fw-semibold text-gray-400">{propNode.idShort}</div>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          </Tabs.Panel>
                                        )}

                                        {/* Collection/List 탭 패널 (카드 뷰) */}
                                        {collectionTabs.map((tabNode) => {
                                          // 이 탭(SMC/SML)에 속한 모든 하위 속성을 재귀적으로 찾습니다.
                                          const innerProperties = getAllProperties(tabNode.children || []);

                                          return (
                                            <Tabs.Panel key={tabNode.idShort} value={tabNode.idShort} pt="lg">
                                              <div className="d-flex flex-wrap justify-content-start">
                                                <div className="d-flex flex-wrap">
                                                  {innerProperties.map(propNode => {
                                                    // getPropValue는 'allProperties' (평탄화된) 목록에서 값을 찾습니다.
                                                    const value = getPropValue(propNode.idShort);
                                                    
                                                    if (value === 'N/A' || !value) return null;

                                                    // 카드 렌더링
                                                    return (
                                                      <div key={`${propNode.idShort}-${propNode.valuePath}`} className="border border-gray-300 border-dashed rounded min-w-125px py-2 px-4 me-4 mb-3">
                                                        <div className="fs-6 text-gray-800 fw-bold">{value}</div>
                                                        <div className="fw-semibold text-gray-400">{propNode.idShort}</div>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            </Tabs.Panel>
                                          );
                                        })}
                                      </Tabs>
                                    );
                                  })()}

                                </div>
                              </div>
                            );
                          })()
                          // ▲▲▲▲▲ [수정] "Nameplate" 블록 여기까지 ▲▲▲▲▲
                          ) : submodelNode.idShort?.includes("CarbonFootprint") ? (
                            <CarbonFootprintView
                              submodelNode={submodelNode}
                              aasmodelMetadata={aasmodel.aasmodel_metadata}
                            />
                        
                        
                          ) : submodelNode.idShort?.includes("HandoverDocumentation") ? (
                            <HandoverDocumentationView
                              submodelNode={submodelNode}
                              aasmodelMetadata={aasmodel.aasmodel_metadata}
                            />

                        ) : submodelNode.idShort?.startsWith("Technical") ? (
                          (() => {
                            const technicalDataTabs = submodelNode.children?.filter(
                              (child) => ['SubmodelElementCollection', 'SubmodelElementList'].includes(child.modelType)
                            );

                            if (!technicalDataTabs || technicalDataTabs.length === 0) {
                              return <AASTree data={[submodelNode]} editMode={false} />;
                            }

                            return (
                              <Tabs defaultValue={technicalDataTabs[0].idShort}>
                                <Tabs.List>
                                  {technicalDataTabs.map((tab, index) => (
                                    <Tabs.Tab key={tab.idShort || `tech-tab-${index}`} value={tab.idShort}>
                                      <Flex align="center" gap="xs">
                                        <Text>{tab.idShort}</Text>
                                        {Array.isArray(tab.children) && (
                                          <Badge color="blue" variant="light">
                                            {tab.children.length}
                                          </Badge>
                                        )}
                                      </Flex>
                                    </Tabs.Tab>
                                  ))}
                                </Tabs.List>

                                {technicalDataTabs.map((tab) => (
                                  <Tabs.Panel key={tab.idShort} value={tab.idShort} pt="xs">
                                    <TechnicalDataView elements={tab.children || []} metadata={aasmodel.aasmodel_metadata} />
                                  </Tabs.Panel>
                                ))}
                              </Tabs>
                            );
                          })()
                        ) : submodelNode.idShort?.includes("HierarchicalStructures") ? (
                            <div className="row">
                              {/*begin::Component Hierarchy (Left Panel)*/}
                              <div className="col-lg-5 d-flex m-0">
                                <div className="card flex-fill rounded-3 border">
                                  <div className="card-header border-0 bg-light rounded-top-3" style={{ minHeight: '50px' }}>
                                    <div className="card-title fs-4 fw-bold text-dark">Component Hierarchy</div>
                                  </div>
                                  <div className="card-body p-6">
                                    <AASTree
                                      data={[submodelNode]}
                                      editMode={false}
                                      simpleView={true}
                                      onNodeClick={(node) => {
                                        setSelectedHierarchyNode(node);
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                              {/*end::Component Hierarchy (Left Panel)*/}

                              {/*begin::Component Details (Right Panel)*/}
                              <div className="col-lg-7 d-flex m-0">
                                <div className="card flex-fill rounded-3 border">
                                  <div className="card-header border-0 bg-light rounded-top-3" style={{ minHeight: '50px' }}>
                                    <div className="card-title fs-4 fw-bold text-dark">Component Details</div>
                                  </div>
                                  <div className="card-body p-6">
                                    {selectedHierarchyNode ? (
                                      <>
                                        <div className="d-flex justify-content-between align-items-center mb-4">
                                          <div className="d-flex align-items-center">
                                            <h2 className="fs-4 fw-bold mb-0">{selectedHierarchyNode.idShort}</h2>
                                          </div>
                                        </div>
                                        <p className="fs-6 text-muted mb-6">{selectedHierarchyNode.description?.[0]?.text || ''}</p>

                                        <div className="table-responsive mb-6">
                                          <table className="table table-striped table-borderless align-middle gs-0 gy-4">
                                            <thead>
                                              <tr className="fw-bold text-muted bg-light">
                                                <th className="min-w-100px ps-4 rounded-start">ID Short</th>
                                                <th className="min-w-100px">Version</th>
                                                <th className="min-w-150px rounded-end">Entry Type</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              <tr>
                                                <td className="ps-4">{selectedHierarchyNode.idShort}</td>
                                                <td>{selectedHierarchyNode.version || 'N/A'}</td>
                                                <td>{selectedHierarchyNode.modelType}</td>
                                              </tr>
                                            </tbody>
                                          </table>
                                        </div>

                                        {selectedHierarchyNode.children && selectedHierarchyNode.children.length > 0 && (
                                          <div id="subcomponents-section">
                                            <h3 className="fs-5 fw-bold mb-4">Sub-Components ({selectedHierarchyNode.children.length})</h3>
                                            <div className="table-responsive">
                                              <table className="table table-striped table-borderless align-middle gs-0 gy-4">
                                                <thead>
                                                  <tr className="fw-bold text-muted bg-light">
                                                    <th className="min-w-200px ps-4 rounded-start">Name</th>
                                                    <th className="min-w-150px">Type</th>
                                                    <th className="min-w-100px rounded-end">Version</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {selectedHierarchyNode.children.map((child, idx) => (
                                                    <tr key={child.idShort || idx}>
                                                      <td className="ps-4">{child.idShort}</td>
                                                      <td>{child.modelType}</td>
                                                      <td>{child.version || 'N/A'}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        )}

                                        {selectedHierarchyNode.statements && selectedHierarchyNode.statements.length > 0 && (
                                          <div id="relationships-section" className="mt-6">
                                            <h3 className="fs-5 fw-bold mb-4">Relationships ({selectedHierarchyNode.statements.length})</h3>
                                            <div id="relationshipsContainer">
                                              {selectedHierarchyNode.statements.map((statement, idx) => (
                                                <div key={statement.idShort || idx} className="mb-2">
                                                  <Badge color="cyan" variant="light">{statement.idShort}</Badge>
                                                  <Text size="sm" c="dimmed">
                                                    {`First: ${statement.first?.keys?.[0]?.value || 'N/A'}`}
                                                  </Text>
                                                  <Text size="sm" c="dimmed">
                                                    {`Second: ${statement.second?.keys?.[0]?.value || 'N/A'}`}
                                                  </Text>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <div className="d-flex h-100 justify-content-center align-items-center">
                                        <span className="text-muted">
                                          Select a component from the hierarchy to see details.
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {/*end::Component Details (Right Panel)--*/}
                            </div>
                        ) : (
                          <AASTree
                            data={[submodelNode]}

                            editMode={false}
                          />
                        )}
                        </Accordion.Panel>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-center text-muted">No submodels to display.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    })()}

    {activeTab === 'treeView' && (
      <>
        <div className="card mt-5">
          <div className="card-header border-0 bg-light" style={{ minHeight: '50px' }}>
            <div className="card-title fs-4 fw-bold">AAS Tree View</div>
          </div>
          <div className="card-body border-top p-9">
            {Array.isArray(treeData) && (
              <AASTree
                data={treeData}
                editMode={false}
                isInstance={!!instance}
                instanceSeq={instance?.instance_seq}
              />
            )}
          </div>
        </div>
        <div className="card mt-10">
          <div className="card-header border-0 bg-light" style={{ minHeight: '50px' }}>
            <div className="card-title fs-4 fw-bold">ConceptDescription Tree View</div>
          </div>
          <div className="card-body border-top p-9">
            {Array.isArray(conceptDescriptionTreeData) && (
              <AASTree
                data={conceptDescriptionTreeData}
                editMode={false}
              />
            )}
          </div>
        </div>
      </>
    )}
  </div>
  );

  return (
    <div>
      <div className="toolbar py-5 py-lg-5" id="kt_toolbar">
        <div
          id="kt_toolbar_container"
          className="container-xxl d-flex flex-stack flex-wrap"
        >
          <div className="page-title d-flex flex-column me-3">
            <h1 className="d-flex text-gray-900 fw-bold my-1 fs-3">
              My AAS Instance -{" "}
              {mode == "create" ? "Create" : mode.toUpperCase()}
            </h1>
            <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
              <li className="breadcrumb-item text-gray-600">
                <Link href="/" className="text-gray-600 text-hover-primary">
                  Home
                </Link>
              </li>
              <li className="breadcrumb-item text-gray-600">
                My AAS Instance -{" "}
                {mode == "create" ? "Create" : mode.toUpperCase()}
              </li>
            </ul>
          </div>
          <div className="d-flex align-items-center py-2 py-md-1">
            <Link href="/instance" className="btn btn-light active me-2">
              <i className="fa-solid fa-list"></i> List
            </Link>
            {mode == "create" && activeStep === 1 && (
              <button
                type="button"
                data-bs-toggle="modal"
                data-bs-target="#kt_modal_invite_friends"
                className="btn btn-success"
                onClick={() => {
                  open();
                  setModelType("aasmodel");
                }}
              >
                <i className="fa-solid fa-file-lines"></i> Select AAS Template
              </button>
            )}
          </div>
        </div>
      </div>
      <div
        id="kt_content_container"
        className="d-flex flex-column-fluid align-items-start container-xxl"
      >
        <div className="content flex-row-fluid" id="kt_content">
          {mode === "view" ? (
            originalForm
          ) : (
            <>
              <Stepper
                active={activeStep}
                onStepClick={setActiveStep}
                breakpoint="sm"
                className="card p-8"
              >
                <Stepper.Step
                  label="기본정보 입력"
                  description="Basic Information"
                />
                <Stepper.Step
                  label="세부 설정"
                  description="Detailed Settings"
                />
                <Stepper.Step label="미리보기" description="Preview" />
                <Stepper.Step label="검증" description="Validation" />
                <Stepper.Step label="완료" description="Complete" />
              </Stepper>

              <div className="row mb-6 mt-10">
                <div className="col-lg-12">
                  {activeStep === 0 && (
                    <div className="card">
                      <div className="card-header border-0">
                        <div className="card-title fs-3 fw-bold">
                          Instance info
                        </div>
                      </div>
                      <div className="collapse show">
                        <div className="card-body border-top p-9">
                          <div className="row mb-6">
                            <label className="col-lg-2 col-form-label required fw-semibold fs-6">
                              Instance name
                            </label>
                            <div className="col-lg-10 fv-row">
                              <input
                                type="text"
                                className="form-control form-control-lg"
                                placeholder="Please enter"
                                value={inputState.instance_name ?? ""}
                                onChange={(e) => {
                                  setInputState((prev) => ({
                                    ...prev,
                                    instance_name: e.target.value,
                                  }));
                                }}
                              />
                            </div>
                          </div>
                          <div className="row mb-6">
                            <label className="col-lg-2 col-form-label fw-semibold fs-6">
                              Description
                            </label>
                            <div className="col-lg-10 fv-row">
                              <input
                                type="text"
                                className="form-control form-control-lg"
                                placeholder="Please enter"
                                value={inputState.description ?? ""}
                                onChange={(e) => {
                                  setInputState((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeStep === 1 && (
                    <>
                      {Array.isArray(treeData) ? (
                        <div className="card mb-10">
                          <div className="card-header bg-light">
                            <div className="card-title fs-3 fw-bold text-primary">
                              <AASTreeModal
                                treeData={treeData}
                                treeDataRefCurrent={
                                  treeDataRef.current[treeData?.[0].id]
                                }
                                metadata={aasmodel.aasmodel_metadata}
                                setMetaData={(metadata) => {
                                  setAasmodel((prev) => ({
                                    ...prev,
                                    aasmodel_metadata: metadata,
                                  }));
                                }}
                                mode={mode}
                              />
                              <span className="fs-7 badge badge-light-success mx-2">
                                {treeData[0].id}
                              </span>
                              <Flex wrap="wrap" gap="xs">
                                <span className="fs-7 badge badge-light mx-2">
                                  {aasmodel.aasmodel_seq}
                                </span>
                                <Divider size="sm" orientation="vertical" />
                                <span className="fs-7 badge badge-light mx-2">
                                  {mode == "create"
                                    ? aasmodel.aasmodel_name
                                    : instance?.aasmodel_name}
                                </span>
                                <Divider size="sm" orientation="vertical" />
                                <span className="fs-7 badge badge-light mx-2">
                                  v
                                  {mode == "create"
                                    ? aasmodel.version
                                    : instance.aasmodel_version}
                                </span>
                                <Divider size="sm" orientation="vertical" />
                                <span className="fs-7 badge badge-light mx-2">
                                  {mode == "create"
                                    ? aasmodel.status
                                    : instance.status}
                                </span>
                              </Flex>
                            </div>
                            {mode == "create" && (
                              <div className="d-flex align-items-center py-2 py-md-1">
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={removeAASModel}
                                >
                                  <i className="fa-solid fa-trash"></i> Remove
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="card mb-10">
                          <div className="card-header bg-light">
                            <div className="card-title fs-3 fw-bold text-primary">
                              AAS Template info
                            </div>
                            <div className="d-flex align-items-center py-2 py-md-1">
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => {
                                  open();
                                  setModelType("aasmodel");
                                }}
                              >
                                <i className="fa-solid fa-file-lines"></i>{" "}
                                Select AAS Template
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {Array.isArray(treeData) && (
                        <Tabs value={activeDetailTab} onChange={(value) => setActiveDetailTab(value ?? 'aasTree')}>
                          <Tabs.List>
                            <Tabs.Tab value="aasTree">AAS Tree</Tabs.Tab>
                            <Tabs.Tab value="cdTree">CD Tree</Tabs.Tab>
                          </Tabs.List>

                          <Tabs.Panel value="aasTree" pt="xs">
                            <div className="d-flex flex-row" style={{ gap: "1rem" }}>
                              <div className="flex-grow-1" style={{ flexBasis: "40%", minWidth: "40%" }}>
                                {Array.isArray(treeData) && (
                                  <div className="card">
                                    <div className="card-header bg-light">
                                      <div className="card-title fs-3 fw-bold text-primary">
                                        AAS Tree
                                      </div>
                                      <div className="d-flex align-items-center py-2 py-md-1">
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          onClick={() => {
                                            open();
                                            setModelType("submodel");
                                          }}
                                        >
                                          <i className="fa-solid fa-plus"></i> Add
                                          Submodel
                                        </button>
                                      </div>
                                    </div>
                                    <div className="card-body border-top p-4">
                                      <AASTree
                                        style={{
                                          maxHeight: "80vh",
                                          overflow: "scroll",
                                        }}
                                        mb={"sm"}
                                        data={treeData}
                                        treeDataRefCurrent={
                                          treeDataRef.current[treeData[0].id]
                                        }
                                        editMode={mode != "view"}
                                        onNodeClick={(node) =>
                                          setSelectedNode({
                                            node,
                                            rootId: treeData[0].id,
                                          })
                                        }
                                        simpleView={true}
                                        onAdd={handleAddElement}
                                        onDelete={handleDeleteElement}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              {Array.isArray(treeData) && (
                                <div
                                  className="flex-grow-1"
                                  style={{ flexBasis: "60%" }}
                                >
                                  <div className="card">
                                    <div className="card-header d-flex justify-content-between align-items-center">
                                      <h3 className="card-title mb-0">Details {selectedNode ? `- ${selectedNode.node.idShort}` : ''}</h3>
                                      <div>
                                        <button
                                          type="button"
                                          className="btn btn-success btn-sm me-2"
                                          onClick={handleDetailSave}
                                        >
                                          저장
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-danger btn-sm"
                                          onClick={handleDelete}
                                          disabled={!selectedNode || selectedNode.node.modelType !== 'Submodel'}
                                        >
                                          삭제
                                        </button>
                                      </div>
                                    </div>
                                    <div className="card-body" style={{ minHeight: "80vh" }}>
                                      {selectedNode ? (
                                        <RenderObject
                                        obj={selectedNode.node}
                                          state={
                                            treeDataRef.current[selectedNode.rootId] ?? {}
                                          }
                                          onValueChange={handleDetailChange}
                                          editMode={mode != "view"}
                                          isInstance={!!instance}
                                          instanceSeq={instance?.instance_seq}
                                        />
                                      ) : (
                                        <div className="d-flex h-100 justify-content-center align-items-center">
                                          <span className="text-muted">
                                            Select an item from the tree to see details.
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </Tabs.Panel>

                          <Tabs.Panel value="cdTree" pt="xs">
                            <div className="d-flex flex-row" style={{ gap: "1rem" }}>
                              <div className="flex-grow-1" style={{ flexBasis: "40%", minWidth: "40%" }}>
                                <div className="card">
                                  <div className="card-header bg-light">
                                    <div className="card-title fs-3 fw-bold text-primary">
                                      CD Tree
                                    </div>
                                    <div className="d-flex align-items-center py-2 py-md-1">
                                      {mode !== "view" && (
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm"
                                          onClick={() =>
                                            handleAddConceptDescription(null, "ConceptDescription", "NewConceptDescription")
                                          }
                                        >
                                          <i className="fa-solid fa-plus"></i> Add CD
                                        </button>
                                      )}
                                    </div>

                                  </div>
                                  <div className="card-body border-top p-4">
                                    {Array.isArray(conceptDescriptionTreeData) && (
                                      <AASTree
                                        style={{
                                          maxHeight: "80vh",
                                          overflow: "scroll",
                                        }}
                                        mb={"sm"}
                                        data={conceptDescriptionTreeData}
                                        editMode={mode !== "view"}
                                        simpleView={true}
                                        onNodeClick={(node) => {
                                          // When adding/deleting, the tree re-renders and this might be called.
                                          // We check if the previously selected node still exists.
                                          if (node.modelType !== 'ConceptDescriptions') {
                                            setSelectedCDNode(node);
                                          } else {
                                            setSelectedCDNode(null);
                                          }
                                        }}
                                        onAdd={handleAddConceptDescription}
                                        onDelete={handleDeleteConceptDescription}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex-grow-1" style={{ flexBasis: "60%" }}>
                                <div className="card">
                                  <div className="card-header d-flex justify-content-between align-items-center">
                                    <h3 className="card-title mb-0">Details {selectedNode ? `- ${selectedNode.node.idShort}` : ''}</h3>
                                    <div>
                                      <button
                                        type="button"
                                        className="btn btn-success btn-sm me-2"
                                        onClick={handleCDDetailSave}
                                      >
                                        저장
                                      </button>
                                    </div>
                                  </div>
                                  <div className="card-body" style={{ minHeight: "80vh" }}>
                                    {selectedCDNode ? (
                                      <RenderObject
                                        obj={{
                                          idShort: selectedCDNode.idShort,
                                          id: selectedCDNode.id,
                                          description: selectedCDNode.description,
                                        }}
                                        state={treeDataRef.current['conceptDescriptions'] ?? {}}
                                        onValueChange={(path, value) => {
                                          if (!treeDataRef.current['conceptDescriptions']) {
                                            treeDataRef.current['conceptDescriptions'] = {};
                                          }
                                          // Find the index of the current CD to build the path
                                          const cdIndex = (aasmodel.aasmodel_metadata?.conceptDescriptions || []).findIndex(cd => cd.id === selectedCDNode.id);
                                          if (cdIndex === -1) return; // Should not happen
                                          const relativePath = `[${cdIndex}].${path}`;
                                          treeDataRef.current['conceptDescriptions'][relativePath] = value;
                                          setSelectedCDNode(prev => prev ? { ...prev } : null);
                                        }}
                                        editMode={mode !== "view"}
                                      />
                                    ) : (
                                      <div className="d-flex h-100 justify-content-center align-items-center">
                                        <span className="text-muted">Select an item from the tree to see details.</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Tabs.Panel>
                        </Tabs>
                      )}
                    </>
                  )}

                  {activeStep === 2 && originalForm }

                  {activeStep === 3 && (
                    <div className="card">
                      <div className="card-header border-0">
                        <div className="card-title fs-3 fw-bold">
                          Verification
                        </div>
                      </div>
                      <div className="card-body border-top p-9">
                        <div className="d-flex flex-column align-items-center">
                          <button
                            type="button"
                            className="btn btn-facebook btn-lg mb-4"
                            disabled={loading}
                            onClick={verifyInstance}
                          >
                            <i className="fa-solid fa-certificate"></i>
                            Run Verification
                          </button>
                          <div className="row mb-6" style={{width:'300px'}}>
                            <label className="col-lg-6 col-form-label fw-semibold fs-6">
                              Verification Status:
                            </label>
                            <div
                              className="col-lg-6 fv-row"
                              style={{
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              {inputState.verification != null && (
                                <Badge
                                  size="xl"
                                  color={
                                    inputState.verification === "success"
                                      ? "green"
                                      : "red.4"
                                  }
                                  radius="sm"
                                >
                                  {inputState.verification}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <VerifyDetailView
                          verificationRef={verificationRef}
                          verificationActive={verificationActive}
                          setVerificationActive={setVerificationActive}
                        />
                      </div>
                    </div>
                  )}

                  {activeStep === 4 && (
                    <div className="card">
                      <div className="card-header border-0">
                        <div className="card-title fs-3 fw-bold">
                          Complete
                        </div>
                      </div>
                      <div className="card-body border-top p-9 text-center">
                        <p className="fs-4">
                          You have completed all the steps.
                        </p>
                        <p className="fs-5 mb-8">
                          Click the button below to finalize your instance.
                        </p>
                        {/* ▼▼▼ [수정] 권한 조건 변경: System Manager(1) 또는 User(3) ▼▼▼ */}
                        {((mode === "create" &&
                          (user?.user_group_seq === UserRole.User || user?.user_group_seq === UserRole.Manager)) ||
                          (mode === "edit" &&
                            (user?.user_group_seq === UserRole.Manager || user?.user_seq === instance?.create_user_seq))) && (
                        /* ▲▲▲ [수정 완료] ▲▲▲ */
                          <button
                            type="button"
                            className="btn btn-success btn-lg me-2"
                            disabled={loading}
                            onClick={() => handleSubmit()}
                          >
                            <i className="fa-solid fa-upload"></i>{" "}
                            {mode == "create" ? "Create" : "Save"}
                          </button>
                        )}
                        {mode == "edit" && (
                          <button
                            type="button"
                            className="btn btn-danger btn-lg me-2"
                            disabled={loading}
                            onClick={async () => {
                              const isConfirm = await confirmSave(
                                "Are you sure you want to delete it?",
                                {
                                  labels: {
                                    confirm: "Delete",
                                    cancel: "Cancel",
                                  },
                                  confirmProps: { color: "red.8" },
                                }
                              );
                              if (isConfirm) {
                                await deleteModel({
                                  modelType: "instance",
                                  modelSeq: instance?.instance_seq,
                                });
                                router.replace(ROUTES.INSTANCE.LIST);
                              }
                            }}
                          >
                            <i className="fa-solid fa-cloud"></i> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="card mt-10">
                <div className="card-footer d-flex justify-content-end py-6 px-9 border-0">
                  <CancelButton />
                  {activeStep > 0 && (
                    <button
                      type="button"
                      className="btn btn-light me-2"
                      onClick={() => setActiveStep(activeStep - 1)}
                    >
                      Back
                    </button>
                  )}
                  {activeStep < 4 && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (activeStep === 0 && !inputState.instance_name) {
                          return showToast.error(
                            "Please enter an instance name."
                          );
                        }
                        if (activeStep === 1 && !Array.isArray(treeData)) {
                          return showToast.error(
                            "Please select an AAS Template."
                          );
                        }
                        setActiveStep(activeStep + 1);
                      }}
                    >
                      Next
                    </button>

                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {/*end::Post*/}
      </div>
      {/*end::Container*/}

      <div
        className={`modal ${opened ? "d-block" : "d-none"}`}
        id="kt_modal_invite_friends"
        tabIndex={-1}
        aria-hidden="true"
      >
        {/*begin::Modal dialog*/}
        <div className="modal-dialog mw-650px">
          {/*begin::Modal content*/}
          <div className="modal-content">
            {/*begin::Modal header*/}
            <div className="modal-header">
              {/*begin::Modal title*/}
              <h2>
                {modelType == "aasmodel" ? "AAS" : "Submodel"} Template 선택
              </h2>
              {/*end::Modal title*/}
              {/*begin::Close*/}
              <div
                className="btn btn-icon btn-sm btn-active-light-primary ms-2"
                data-bs-dismiss="modal"
                aria-label="Close"
                onClick={() => {
                  close();
                  setModelSeq("");
                }}
              >
                <i className="fa-solid fa-xmark fs-2x"></i>
              </div>
              {/*end::Close*/}
            </div>
            {/*end::Modal header*/}
            {/*begin::Modal body*/}
            <div className="modal-body scroll-y mx-5 mx-xl-15 my-7">
              {/*begin::Form*/}
              {/*begin::Input group*/}
              <div className="d-flex flex-column mb-7 fv-row">
                {/*begin::Label*/}
                <label className="required fs-6 fw-semibold mb-2">
                  Template 목록
                </label>
                {/*end::Label*/}
                {/*begin::Input*/}

                <div className="mb-4">
                  <CategoryCombobox
                    code={
                      modelType === "aasmodel" ? "aas_category" : "sm_category"
                    }
                    value={searchState.category_seq}
                    setValue={(value) =>
                      setSearchState((prev) => ({
                        ...prev,
                        category_seq: value ?? "all",
                      }))
                    }
                  />
                </div>
                <CustomCombobox
                  className="form-control form-control-solid border-0 flex-grow-1"
                  data={
                    isFetchingModels
                      ? []
                      : models?.map((item) => ({
                          ...item,
                          value: String(item[`${modelType}_seq`]),
                          label: item[`${modelType}_name`],
                        }))
                  }
                  value={modelSeq}
                  onChange={(value) => setModelSeq(value)}
                  renderComboboxOptionItem={(item) => {
                    return (
                      <Flex gap={"sm"} align={"center"}>
                        <span className="badge badge-light-success">
                          {item["category_name"]}
                        </span>
                        <span className="badge badge-light-danger">
                          {item[`${modelType}_name`]}
                        </span>
                        <span className="badge badge-light">
                          {item["version"]}
                        </span>
                      </Flex>
                    );
                  }}
                />

                {/*end::Input*/}
              </div>
              {/*end::Input group*/}
              {/*begin::Actions*/}
              <div className="text-center pt-15">
                <button
                  type="reset"
                  className="btn btn-light me-3"
                  data-bs-dismiss="modal"
                  onClick={() => {
                    close();
                    setModelSeq("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    if (modelSeq == "") {
                      return showToast.error("Please select model");
                    }
                    // 데이터 불러오기
                    const data = await getModel({
                      modelSeq: modelSeq,
                      modelType,
                    });

                    const model = data[0];
                    if (modelType == "aasmodel") {
                      const renamedModel = renameKey(model, "metadata", "aasmodel_metadata");
                      if (renamedModel.aasmodel_metadata) {
                        normalizeMetadataPaths(renamedModel.aasmodel_metadata);
                      }

                      setAasmodel(renamedModel);
                      treeDataRef.current[model.aasmodel_id] = {};

                      setInputState((prev) => ({
                        ...prev,
                        instance_name: prev.instance_name || model.aasmodel_name,
                        description: prev.description || model.description,
                      }));


                    } else {
                      const fetchedMetadata = model.metadata;
                      const templateSubmodelData = fetchedMetadata.submodels?.[0]; // 템플릿 원본

                      if (!templateSubmodelData) {
                        return showToast.error("Selected submodel data is invalid.");
                      }

                      
                      // 1. 템플릿을 기반으로 새 인스턴스를 생성
                      const submodelData = _.cloneDeep(templateSubmodelData); 

                      // 2. 새 인스턴스를 위한 고유 ID 생성
                      const newInstanceId = uuidv4();
                      submodelData.id = newInstanceId; // 새 ID 할당

                      // 3. 템플릿의 'kind'를 'Instance'로 변경
                      if (submodelData.kind === "Template") {
                        submodelData.kind = "Instance";
                      }
                      
                      // 4. 원본 템플릿의 seq는 DB 저장을 위해 별도로 저장
                      submodelData.submodel_seq = model.submodel_seq;
                      
                      // 5. modelType 보장
                      submodelData.modelType = "Submodel"; 

                      // 6. 템플릿 ID 기반의 중복 검사 로직 제거
                      // (항상 새 ID를 가진 인스턴스를 추가하므로 중복이 발생하지 않음)
                      // if (isDuplicate) { ... }

                      // 7. 새 인스턴스 ID로 참조(Reference) 생성
                      const submodelReference = {
                        type: "ModelReference", // AAS 사양에 맞게 "ModelReference" 사용
                        keys: [{ type: "Submodel", value: newInstanceId }], // 새 ID 사용
                      };

                      setAasmodel((prev) => {
                        const newMetadata = _.cloneDeep(
                          prev.aasmodel_metadata
                        );

                        if (!newMetadata.submodels) {
                          newMetadata.submodels = [];
                        }
                        // 새 ID가 할당된 submodelData 추가
                        newMetadata.submodels.push(submodelData); 

                        // 새 ID를 참조하는 submodelReference 추가
                        newMetadata.assetAdministrationShells[0].submodels.push(
                          submodelReference 
                        );

                        // 추가된 Submodel의 ConceptDescription을 메인 CD 목록에 병합합니다.
                        if (fetchedMetadata.conceptDescriptions) {
                          if (!newMetadata.conceptDescriptions) {
                            newMetadata.conceptDescriptions = [];
                          }
                          // 중복은 상위 로직에서 처리하므로 여기서는 우선 추가합니다.
                          newMetadata.conceptDescriptions.push(
                            ...fetchedMetadata.conceptDescriptions
                          );
                        }

                        console.log("Updated newMetadata:", newMetadata);

                        return {
                          ...prev,
                          aasmodel_metadata: newMetadata,
                        };
                      });
                      
                      }
                    setModelSeq("");

                    close();
                  }}
                >
                  <span className="indicator-label">Ok</span>
                </button>
              </div>
              {/*end::Actions*/}
              {/*end::Form*/}
            </div>
            {/*end::Modal body*/}
          </div>
          {/*end::Modal content*/}
        </div>
        {/*end::Modal dialog*/}
      </div>
      {/*end::Modal - Invite Friends*/}
    </div>
  );
}