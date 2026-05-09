"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import KTComponent from "@/metronic/core";
import {
  Badge,
  Divider,
  Flex,
  Menu,
  Modal,
  NumberFormatter,
  Select,
  Text,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import CustomCombobox, {
  CustomComboboxItem,
} from "@/components/CustomCombobox";
import { useQuery } from "@tanstack/react-query";
import { MRT_PaginationState } from "mantine-react-table";
import {
  apiVerifyInstance,
  deleteModel,
  exportModel,
  getCodeList,
  getInstanceList,
  getInstanceTargetList,
  getModel,
  getModelList,
  upsertInstance,
} from "@/api";
// import CustomComboboxQuery from "@/components/QueryCombobox";
import { addValuePaths, parsingAAS, parsingSub } from "@/utils/aas";
import AASTree from "@/components/feature/model/AASTree";
import toast from "react-hot-toast";
import { InstanceSavePayload } from "@/types/api";
import { confirmSave } from "@/utils/modal";
import { metadata } from "@/app/page";

import type { AASInstance, VerifyInstanceParams } from "@/types/api";
import { ROUTES } from "@/constants/routes";
import { useRouter, useSearchParams } from "next/navigation";
import CancelButton from "@/components/CancelButton";
import { modals } from "@mantine/modals";
import _ from "lodash";
import AASTreeModal from "@/components/AASTreeModal";
import { showToast } from "@/utils/toast";
import VerifyDetailView from "@/components/VerifyDetailView";
import CategoryCombobox from "@/components/CategoryCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/constants/roles";

type AASInstanceInsProps = {
  mode: "create" | "edit" | "view";
  instance?: AASInstance;
  combinedAAS?: {
    assetAdministrationShells: object[];
    submodels?: object[];
    conceptDescriptions?: object[];
    attatchments?: any;
  };
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
  const { user } = useAuth();

  const [opened, { open, close }] = useDisclosure(false);

  const treeDataRef = useRef<any>({});

  // 스크롤 threadholding 시 데이터 concat
  const [modelType, setModelType] = useState("");
  const [modelSeq, setModelSeq] = useState("");
  const [aasmodel, setAasmodel] = useState(initialState.aasmodel);

  const [submodels, setSubmodels] = useState([]);

  const verificationRef = useRef<() => void>(null);
  const [verificationActive, setVerificationActive] = useState<any>();

  // 검색 박스 상태 값
  const [searchState, setSearchState] = useState({
    category_seq: "all",
  });

  const [inputState, setInputState] = useState<{
    instance_name: string;
    description: string;
    verification: "fail" | "success" | undefined;
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

  // create and navigated on model template view
  useEffect(() => {
    if (typeof window === "undefined") return;

    const modelSeq = new URLSearchParams(window.location.search).get(
      "modelSeq"
    );
    if (instance || !modelSeq) return;

    const fetchModel = async () => {
      const data = await getModel({ modelSeq, modelType: "aasmodel" });
      const model = data[0];
      setAasmodel(renameKey(model, "metadata", "aasmodel_metadata"));
      treeDataRef.current[model.aasmodel_id] = {};
      setInputState({
        instance_name: model.aasmodel_name,
        description: model.description,
      });
    };

    fetchModel();
  }, []);

  // view or edit
  useEffect(() => {
    if (!instance) {
      return;
    }
    setInputState({
      instance_name: instance.instance_name,
      description: instance.description,
      verification: instance.verification,
    });

    setAasmodel({
      aasmodel_seq: instance.aasmodel_seq,
      aasmodel_metadata: instance.aasmodel_metadata,
    });

    treeDataRef.current[instance.aasmodel_id] = {};

    const submodels = instance.submodels || [];
    setSubmodels(submodels);
    submodels.forEach((submodel) => {
      treeDataRef.current[submodel.submodel_id] = {};
    });
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
    } else {
      return metadata["submodels"][0]["id"];
    }
  };

  const convertToTreeData = (modelType: "aasmodel" | "submodel", metadata) => {
    if (!metadata) {
      return;
    }
    const parsedMetadata =
      typeof metadata == "object" ? metadata : JSON.parse(metadata);
    const valuePaths = addValuePaths({ ...parsedMetadata });
    const parsedData = parsingAAS(valuePaths);
    const tree =
      modelType == "aasmodel" ? parsedData : [parsedData[0].children[0]];
    return tree;
  };

  const treeData = useMemo(() => {
    if (!getModelId("aasmodel", aasmodel.aasmodel_metadata)) return;

    return convertToTreeData("aasmodel", aasmodel.aasmodel_metadata);
  }, [aasmodel]);

  const submodelTreeData = useMemo(() => {
    return submodels
      .filter(
        (submodel) => !!getModelId("submodel", submodel["submodel_metadata"])
      )
      .map((submodel) =>
        convertToTreeData("submodel", submodel["submodel_metadata"])
      );
  }, [submodels]);

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

  // 인스턴스 검증
  const verifyInstance = async () => {
    let verification: "success" | "fail";
    // submodel 수정내용 적용
    const payloadSubmodels = submodels.map((submodel) => {
      return applyMetadata("submodel", submodel.submodel_metadata);
    });

    const body: VerifyInstanceParams = {
      instance_seq: instance?.instance_seq ?? "",
      aasmodel: applyMetadata("aasmodel", aasmodel.aasmodel_metadata),
      submodels: payloadSubmodels,
    };

    try {
      setLoading(true);
      const result = await apiVerifyInstance(body);

      verification = "success";
      verificationRef.current = null;
      setVerificationActive(null);
    } catch (error) {
      console.log(error);
      let json = error?.cause?.json;

      if (json) {
        // 여기서 검증 데이터 저장
        setVerificationActive(0);
        verificationRef.current = JSON.parse(error?.cause?.json.data);
      }

      verification = "fail";
    } finally {
      setLoading(false);
    }

    setInputState({ ...inputState, verification });

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
    // validation check
    // 추가 서브모델이 없는 경우
    // if (submodels.length == 0) {
    //   return showToast.error("Please add submodel");
    // }

    // 인스턴스 검즈
    const verification = await verifyInstance();
    if (verification == "fail") {
      if (
        !(await confirmSave(
          "Validation has failed. Would you like to continue anyway?"
        ))
      )
        return;
    }

    // aasmodel 수정내용 적용
    const payloadAASmodel = {
      ...aasmodel,
      aasmodel_metadata: JSON.stringify(
        applyMetadata("aasmodel", aasmodel.aasmodel_metadata)
      ),
    };

    // submodel 수정내용 적용
    const payloadSubmodels = submodels.map((submodel) => {
      return {
        ...submodel,
        submodel_metadata: JSON.stringify(
          applyMetadata("submodel", submodel.submodel_metadata)
        ),
      };
    });

    let body: InstanceSavePayload;

    if (mode == "create") {
      body = {
        ...inputState,
        verification,
        instance_seq: "",
        aasmodel_seq: payloadAASmodel.aasmodel_seq,
        aasmodel_metadata: payloadAASmodel.aasmodel_metadata,
        status: "Y",
        submodels: payloadSubmodels,
      };
    } else if (mode == "edit") {
      body = {
        ...inputState,
        verification,
        instance_seq: instance.instance_seq,
        aasmodel_seq: payloadAASmodel.aasmodel_seq,
        aasmodel_metadata: payloadAASmodel.aasmodel_metadata,
        status: "Y",
        submodels: payloadSubmodels,
      };
    }

    try {
      setLoading(true);
      const result = await upsertInstance({
        body,
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
      withToast: true,
    });
  };

  //  combinedAAS memo
  const combinedAASTreeData = useMemo(() => {
    if (!getModelId("aasmodel", combinedAAS)) return;

    return convertToTreeData("aasmodel", combinedAAS);
  }, [combinedAAS]);

  // Combined Model CD
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
                          {/* begin::Card title */}
                          <div className="card-title fs-4 fw-bold">Model</div>
                          {/* end::Card title */}
                        </div>
                        <div id="" className="collapse show">
                          {/* begin::Form */}
                          <form
                            id="kt_account_profile_details_form"
                            className="form"
                          >
                            {/* begin::Card body */}
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
                          {/* end::Form */}
                        </div>
                      </div>

                      <div className="card mt-10">
                        <div
                          className="card-header border-0 bg-light"
                          style={{ minHeight: "50px" }}
                        >
                          {/* begin::Card title */}
                          <div className="card-title fs-4 fw-bold">
                            Concepdescription
                          </div>
                          {/* end::Card title */}
                        </div>
                        <div id="" className="collapse show">
                          {/* begin::Form */}
                          <form
                            id="kt_account_profile_details_form"
                            className="form"
                          >
                            {/* begin::Card body */}
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
                          {/* end::Form */}
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
                        key={format}
                        onClick={() => handleExport(format, instance)}
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
            {mode == "edit" && (
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
            {((mode === "create" && user?.user_group_seq === UserRole.User) ||
              (mode === "edit" &&
                user?.user_seq === instance?.create_user_seq)) && (
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

  return (
    <div>
      {/*begin::Toolbar*/}
      <div className="toolbar py-5 py-lg-5" id="kt_toolbar">
        {/*begin::Container*/}
        <div
          id="kt_toolbar_container"
          className="container-xxl d-flex flex-stack flex-wrap"
        >
          {/*begin::Page title*/}
          <div className="page-title d-flex flex-column me-3">
            {/*begin::Title*/}
            <h1 className="d-flex text-gray-900 fw-bold my-1 fs-3">
              My AAS Instance -{" "}
              {mode == "create" ? "Create" : mode.toUpperCase()}
            </h1>
            {/*end::Title*/}
            {/*begin::Breadcrumb*/}
            <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
              {/*begin::Item*/}
              <li className="breadcrumb-item text-gray-600">
                <Link href="/" className="text-gray-600 text-hover-primary">
                  Home
                </Link>
              </li>
              {/*end::Item*/}
              {/*begin::Item*/}
              <li className="breadcrumb-item text-gray-600">
                My AAS Instance -{" "}
                {mode == "create" ? "Create" : mode.toUpperCase()}
              </li>
              {/*end::Item*/}
            </ul>
            {/*end::Breadcrumb*/}
          </div>
          {/*end::Page title*/}
          {/*begin::Actions*/}
          <div className="d-flex align-items-center py-2 py-md-1">
            {/*begin::Button*/}
            <Link href="/instance" className="btn btn-light active me-2">
              <i className="fa-solid fa-list"></i> List
            </Link>
            {/*end::Button*/}
            {mode == "create" && (
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
          {/*end::Actions*/}
        </div>
        {/*end::Container*/}
      </div>
      {/*end::Toolbar*/}
      {/*begin::Container*/}
      <div
        id="kt_content_container"
        className="d-flex flex-column-fluid align-items-start container-xxl"
      >
        {/*begin::Post*/}
        <div className="content flex-row-fluid" id="kt_content">
          <div className="row mb-6">
            <div className="col-lg-12">
              <div className="card">
                <div className="card-header border-0">
                  {/*begin::Card title*/}
                  <div className="card-title fs-3 fw-bold">
                    Instance info{" "}
                    {instance?.instance_seq && (
                      <Badge
                        ml={"sm"}
                        size="xl"
                        radius={"xl"}
                        variant="filled"
                        color={"blue.4"}
                      >
                        {instance?.instance_seq}
                      </Badge>
                    )}
                  </div>

                  {/*end::Card title*/}
                </div>

                <div id="" className="collapse show">
                  {/*begin::Card body*/}
                  <div className="card-body border-top p-9">
                    <div className="row mb-6">
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Instance name
                      </label>
                      <div className="col-lg-4 fv-row">
                        {mode == "view" ? (
                          <label className="col-form-label fw-semibold fs-6">
                            {instance?.instance_name}
                          </label>
                        ) : (
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
                        )}
                      </div>
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Category
                      </label>
                      <div className="col-lg-4 fv-row fv-plugins-icon-container">
                        {mode == "view" ? (
                          <label className="col-form-label fw-semibold fs-6">
                            {instance?.category_name}
                          </label>
                        ) : (
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            defaultValue={
                              mode == "create"
                                ? aasmodel.category_name
                                : instance?.category_name
                            }
                            readOnly
                          />
                        )}
                      </div>
                    </div>
                    <div className="row mb-6">
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Description
                      </label>
                      <div className="col-lg-10 fv-row">
                        {mode == "view" ? (
                          <label className="col-form-label fw-semibold fs-6">
                            {instance?.description}
                          </label>
                        ) : (
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
                        )}
                      </div>
                    </div>
                    <div className="row mb-6">
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Verification
                      </label>
                      <div
                        className="col-lg-10 fv-row"
                        style={{ display: "flex", alignItems: "center" }}
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
                </div>
              </div>

              <div className="card mt-10">
                <div className="card-header bg-light">
                  {/*begin::Card title*/}
                  <div className="card-title fs-3 fw-bold text-primary">
                    <AASTreeModal
                      treeData={treeData}
                      treeDataRefCurrent={treeDataRef.current[treeData?.[0].id]}
                      metadata={aasmodel.aasmodel_metadata}
                      setMetaData={(metadata) => {
                        setAasmodel((prev) => ({
                          ...prev,
                          aasmodel_metadata: metadata,
                        }));
                      }}
                      mode={mode}
                    />
                    AAS Template info{" "}
                    {Array.isArray(treeData) && (
                      <>
                        <span className="fs-7 badge badge-light-success mx-2">
                          {treeData[0].id}
                        </span>
                        <Flex>
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
                      </>
                    )}
                  </div>
                  {/*end::Card title*/}
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
                <div className="collapse show">
                  <div className="card-body border-top p-4">
                    {Array.isArray(treeData) && (
                      <AASTree
                        // h="410px"
                        // style={{ maxHeight: "500px", overflow: "scroll" }}
                        style={{ maxHeight: "80vh", overflow: "scroll" }}
                        mb={"sm"}
                        data={treeData}
                        treeDataRefCurrent={treeDataRef.current[treeData[0].id]}
                        editMode={mode != "view"}
                      />
                    )}
                  </div>
                </div>
              </div>

              {submodelTreeData.map((treeData, i) => {
                return (
                  <div key={treeData[0].id} className="card mt-10">
                    <div className="card-header bg-light">
                      {/*begin::Card title*/}
                      <div className="card-title fs-3 fw-bold text-primary">
                        <AASTreeModal
                          treeData={treeData}
                          treeDataRefCurrent={
                            treeDataRef.current[treeData?.[0].id]
                          }
                          metadata={submodels[i].submodel_metadata}
                          setMetaData={(metadata) => {
                            setSubmodels((prev) =>
                              prev.map((submodel, index) =>
                                i == index
                                  ? { ...submodel, submodel_metadata: metadata }
                                  : submodel
                              )
                            );
                          }}
                          mode={mode}
                        />
                        Submodel Template info{" "}
                        {Array.isArray(treeData) && (
                          <>
                            <span className="fs-7 badge badge-light-success mx-2">
                              {treeData[0].id}
                            </span>
                            <Flex>
                              <span className="fs-7 badge badge-light mx-2">
                                {submodels[i].submodel_seq}
                              </span>
                              <Divider size="sm" orientation="vertical" />
                              <span className="fs-7 badge badge-light mx-2">
                                {submodels[i].submodel_name}
                              </span>
                              <Divider size="sm" orientation="vertical" />
                              <span className="fs-7 badge badge-light mx-2">
                                v
                                {mode == "create"
                                  ? submodels[i].version
                                  : submodels[i].submodel_version}
                              </span>
                            </Flex>
                          </>
                        )}
                      </div>
                      {/*end::Card title*/}
                      <div className="d-flex align-items-center py-2 py-md-1">
                        {["create", "edit"].includes(mode) && (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => {
                              setSubmodels(
                                submodels.filter(
                                  (_, modelIndex) => modelIndex != i
                                )
                              );

                              delete treeDataRef.current[treeData[0].id];
                            }}
                          >
                            <i className="fa-solid fa-trash"></i> Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="collapse show">
                      <div className="card-body border-top p-4">
                        {Array.isArray(treeData) && (
                          <AASTree
                            // h="410px"
                            // style={{ maxHeight: "500px", overflow: "scroll" }}
                            style={{ maxHeight: "80vh", overflow: "scroll" }}
                            mb={"sm"}
                            data={treeData}
                            treeDataRefCurrent={
                              treeDataRef.current[treeData[0].id]
                            }
                            editMode={mode != "view"}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* 서브모델 템플릿 */}
              {["create", "edit"].includes(mode) && (
                <div className="card mt-10" data-v-91e48dcf="">
                  <div className="card-header border-0" data-v-91e48dcf="">
                    <div className="card-title fs-3 fw-bold" data-v-91e48dcf="">
                      Submodel Template info
                    </div>
                    <div
                      className="d-flex align-items-center py-2 py-md-1"
                      data-v-91e48dcf=""
                    >
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => {
                          open();
                          setModelType("submodel");
                        }}
                      >
                        <i
                          className="fa-solid fa-file-lines"
                          data-v-91e48dcf=""
                        ></i>{" "}
                        Select Submodel Template
                      </button>
                    </div>
                  </div>
                  <div id="" className="collapse show" data-v-91e48dcf="">
                    <form
                      id="kt_account_profile_details_form"
                      className="form"
                      data-v-91e48dcf=""
                    ></form>
                  </div>
                </div>
              )}

              {/* 검증 결과 뷰 */}
              <VerifyDetailView
                verificationRef={verificationRef}
                verificationActive={verificationActive}
                setVerificationActive={setVerificationActive}
              />
              {/* 하위 버튼 */}
              <div className="card mt-10" data-v-91e48dcf="">
                <div
                  className="card-footer d-flex justify-content-end py-6 px-9 border-0"
                  data-v-91e48dcf=""
                >
                  {renderFootButtons()}
                </div>
              </div>
            </div>
          </div>
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
                      setAasmodel(
                        renameKey(model, "metadata", "aasmodel_metadata")
                      );
                      treeDataRef.current[model.aasmodel_id] = {};

                      setInputState({
                        instance_name: model.aasmodel_name,
                        description: model.description,
                      });
                    } else {
                      // aasmodel 안에 있는지 확인
                      const id = model.submodel_id;
                      const semanticId = model.submodel_semantic_id;
                      if (
                        aasmodel.aasmodel_metadata.submodels.find(
                          (item) =>
                            item.modelType == "Submodel" &&
                            item.semanticId != null &&
                            item.semanticId.keys[0].value == semanticId &&
                            item.id == id
                        )
                      ) {
                        return showToast.error("Already exists in AAS");
                      }
                      //   추가한 서브모델 배열에 있는지 확인
                      if (
                        submodels.find(
                          (item) =>
                            item.submodel_id == id &&
                            item.submodel_semantic_id == semanticId
                        )
                      ) {
                        return showToast.error("Already added as a submodel");
                      }

                      setSubmodels((prev) =>
                        prev.concat(
                          renameKey(model, "metadata", "submodel_metadata")
                        )
                      );

                      treeDataRef.current[id] = {};
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
