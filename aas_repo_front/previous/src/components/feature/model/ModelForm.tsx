/*
 * 파일명: src/app/aas/ins/page.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 *
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 *
 * 설명: AAS 템플릿 등록 페이지를 제공합니다.
 */
"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { confirmSave } from "@/utils/modal";
import toast from "react-hot-toast";
import { usePathname, useRouter } from "next/navigation";
import { Dropzone, FileWithPath } from "@mantine/dropzone";
import {
  deleteModel,
  exportModel,
  getCodeList,
  getModel,
  getModelVersions,
  importModel,
  upsertModel,
  verifyModel,
} from "@/api";
import {
  IconUpload,
  IconX,
  IconPhoto,
  IconTrash,
  IconMaximize,
  IconBrowserMaximize,
  IconFile,
  IconDownload,
  IconEye,
} from "@tabler/icons-react";
import _ from "lodash";
import {
  Button,
  FileButton,
  Group,
  Indicator,
  Text,
  Image,
  Menu,
  ActionIcon,
  Flex,
  List,
  ThemeIcon,
  //useDisclosure,
  Tooltip,
  Box,
  LoadingOverlay,
  NumberFormatter,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { canAccessPath, PROTECTED_ROUTES, ROUTES } from "@/constants/routes";
import { addValuePaths, parsingAAS, parsingSub } from "@/utils/aas";
import AASTree from "./AASTree";
import { base64ToFile } from "@/utils";
import CancelButton from "@/components/CancelButton";
import { useQuery } from "@tanstack/react-query";
import CustomCombobox from "@/components/CustomCombobox";
import { modals } from "@mantine/modals";
import AASTreeModal from "@/components/AASTreeModal";
import imageCompression from "browser-image-compression";
import { showToast } from "@/utils/toast";
import VerifyDetailView from "@/components/VerifyDetailView";
import { useAuth } from "@/contexts/AuthContext";
import { UserRole } from "@/constants/roles";
import CategoryCombobox from "@/components/CategoryCombobox";
import FilePreviewModal from "../instance/FilePreviewModal";

const ASSET_TYPE_OPTIONS = [
  "Product",
  "Sensor/Device",
  "Equipment",
  "Line/System",
];
const AAS_MATURITY_LEVEL_OPTIONS = ["L0", "L1", "L2", "L3", "L4"];

type Mode = "create" | "edit" | "view";

interface ModelFormProps {
  mode: Mode;
  model?: Record<string, any>;
  modelType: "aasmodel" | "submodel";
  modalMode?: boolean;
}

export default function ModelForm({
  mode,
  model,
  modelType,
  modalMode = false,
}: ModelFormProps) {
  const routeKey = modelType.toUpperCase() as "AASMODEL" | "SUBMODEL";
  const router = useRouter();

  const { user } = useAuth();

  useEffect(() => {
    // document.title = "AAS 템플릿 등록";
  }, []);

  //   카테고리 목록 조회
  const { data: categorys, isSuccess: isSuccessCategorys } = useQuery({
    queryKey: ["common/code", "category"],
    queryFn: () => getCodeList("category"),
  });

  const { data: versions = [] } = useQuery({
    queryKey: [`${modelType}_seq`, mode],
    queryFn: () =>
      getModelVersions({
        modelType,
        modelSeq: model?.[`${modelType}_seq`],
      }),
    enabled: ["edit", "view"].includes(mode),
  });

  const [state, setState] = useState({
    [`${modelType}_name`]: "",
    description: "",
    category_seq: "",
    creator: "",
    asset_type: "",
    aas_maturity_level: "",
  });

  const [model_img, setModel_img] = useState();
  const [guidePdf, setGuidePdf] = useState<File | null>(null);
  const [guideInfo, setGuideInfo] = useState({ filename: "", link: "" });
  const [deleteGuideFlag, setDeleteGuideFlag] = useState(false);

  const [modelFile, setModelFile] = useState<any>();
  const [importedFiles, setImportedFiles] = useState<Record<string, File>>({}); // 추출된 파일들을 저장할 state
  const [metadata, setMetaData] = useState<any>();
  const [loading, setLoading] = useState<boolean>(false);

  const [isTemplateInfoOpen, setTemplateInfoOpen] = useState(true);
  const [isThumbnailOpen, setThumbnailOpen] = useState(true);
  const [isModelOpen, setModelOpen] = useState(true);
  const [isConcepdescriptionOpen, setConcepdescriptionOpen] = useState(true);
  const [isAttachmentsOpen, setAttachmentsOpen] = useState(true);

  // 미리보기 Modal 상태
  const [previewFile, setPreviewFile] = useState<{ url: string; type: string } | null>(null);
  const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);

  // const [treeData, setTreeData] = useState<any[] | null>(null);

  const modelRef = useRef<any>({});
  const treeDataRef = useRef<any>({});
  const resetRef = useRef<() => void>(null);

  const verificationRef = useRef<() => void>(null);
  const [verificationActive, setVerificationActive] = useState<any>();

  const previewThumbnail = useMemo(() => {
    if (!model_img) return null;
    const imageUrl = URL.createObjectURL(model_img);
    return (
      <Image src={imageUrl} onLoad={() => URL.revokeObjectURL(imageUrl)} />
    );
  }, [model_img]);

  const setModelData = (model) => {
    if (model == null) return;
    const {
      description,
      category_seq,
      metadata,
      [`${modelType}_img`]: model_img,
      filename,
      mime_type,
      creator,
      guide_filename,
      guide_link,
      asset_type,
      aas_maturity_level,
      ...rest
    } = model;
    modelRef.current = { ...rest };

    setState({
      [`${modelType}_name`]: model[`${modelType}_name`] || "",
      description: description || "",
      category_seq: String(category_seq),
      creator: creator || "",
      asset_type: asset_type || "",
      aas_maturity_level: aas_maturity_level || "",
    });

    if (model_img) {
      const image = base64ToFile(model_img, filename, mime_type);
      setModel_img(image);
    }

    // 가이드 정보 설정
    if (guide_filename && guide_link) {
      setGuideInfo({ filename: guide_filename, link: guide_link });
    } else {
      setGuideInfo({ filename: "", link: "" });
    }
    setGuidePdf(null); // 파일 상태 초기화
    setDeleteGuideFlag(false); // 삭제 플래그 초기화


    if (metadata) {
      const parsedData =
        typeof metadata == "object" ? metadata : JSON.parse(metadata);
      setMetaData(parsedData);
      // const tree =
      //   modelType == "aasmodel"
      //     ? parsingAAS(addValuePaths({ ...parsedData }))
      //     : parsingSub(addValuePaths({ ...parsedData }));

      // setTreeData(Array.isArray(tree) ? tree : [tree]);
    }
  };

  const treeData = useMemo(() => {
    if (!metadata) {
      return;
    }
    const parsedData = parsingAAS(addValuePaths({ ...metadata }));

    // Submodel 모드일 때 데이터 존재 여부 확인 로직
    if (modelType === "aasmodel") {
        return parsedData;
    } else {
        // parsedData 구조가 유효하고 children이 있을 때만 첫 번째 자식 추출
        if (parsedData && parsedData.length > 0 && 
            parsedData[0].children && parsedData[0].children.length > 0) {
            return [parsedData[0].children[0]];
        }
        // 데이터가 없으면 빈 배열 반환하여 undefined 참조 방지
        return [];
    }
    // const tree =
    //   modelType == "aasmodel" ? parsedData : [parsedData[0].children[0]];
    // return tree;
  }, [metadata]);

  const conceptDescriptionTreeData = useMemo(() => {
    if (!metadata) {
      return;
    }

    // 1. Map을 사용해 ConceptDescription의 중복을 제거합니다. (id 기준)
    const uniqueCDs = new Map();
    (metadata.conceptDescriptions || []).forEach(cd => {
      if (cd.id) { // id가 있는 경우에만 맵에 추가 (id가 key가 됨)
        uniqueCDs.set(cd.id, cd);
      }
    });
    
    // 2. 중복 제거된 Map의 value들로 새로운 children 배열을 생성합니다.
    const children = Array.from(uniqueCDs.values()).map((conceptDescription) => ({
        ...conceptDescription, // 상세 뷰를 위해 전체 객체 정보 포함
        value: conceptDescription.id,
        ConceptDescription: conceptDescription,
    }));

    const tree = [
      {
        value: "ConceptDescriptions",
        modelType: "ConceptDescriptions",
        idShort: `ConceptDescriptions (${
          children.length // 중복 제거된 개수
        } Count)`,
        children: children, // 중복 제거된 children 배열 사용
      },
    ];

    return tree;
  }, [metadata]);

  const version = versions.find((v) => v.id == model?.[`${modelType}_seq`]);

  useEffect(() => {
    if (version) {
      showToast.success(`${version.text} Version loaded successfully`);
    }
    setModelData(model);
  }, [model]);

  //  배포 아이디
  const publishKey =
    modelType == "aasmodel"
      ? `${modelType}_template_id`
      : `${modelType}_semantic_id`;


  // 첨부파일 삭제 핸들러
  const handleRemoveImportedFile = (filename: string) => {
    setImportedFiles(prev => {
      const newState = { ...prev };
      delete newState[filename];
      return newState;
    });
  };


  // 파일 다운로드 핸들러
  const handleDownloadFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // 메모리 누수 방지
  };

  // 파일 미리보기 핸들러
  const handlePreviewFile = (file: File) => {
    const isPdf = file.type.toLowerCase().includes("pdf");
    const isImage = file.type.toLowerCase().startsWith("image/");

    if (isPdf || isImage) {
      const url = URL.createObjectURL(file);
      setPreviewFile({ url, type: file.type });
      openPreview();
    } else {
      // FilePreviewModal이 지원하지 않는 형식
      showToast.warning("이 파일 형식은 미리보기를 지원하지 않습니다.");
    }
  };


  // "View" 모드용 파일 미리보기 핸들러
  const handlePreviewSavedFile = (file: any) => {
    // 'file'은 model.files 배열의 항목입니다.
    const filename = (file.filename || "").toLowerCase();
    const isPdf = filename.endsWith(".pdf");

    // [수정] 이미지 확장자를 정확히 찾아 MIME 타입 매핑
    const imageExt = ['.png', '.jpg', '.jpeg', '.gif'].find(ext => filename.endsWith(ext));
    const isImage = !!imageExt; // Is it an image?
  
    if (isPdf) {
      setPreviewFile({ url: file.link, type: 'application/pdf' });
      openPreview();
    } else if (isImage) {
      // [수정] 올바른 MIME 타입 전달
      const mimeType = imageExt === '.jpg' ? 'image/jpeg' : `image/${imageExt.substring(1)}`;
      setPreviewFile({ url: file.link, type: mimeType });
      openPreview();
    } else {
      showToast.warning("이 파일 형식은 미리보기를 지원하지 않습니다.");
    }
  };

  //  Modal이 닫힐 때 Object URL 해제
  useEffect(() => {
    // Modal이 닫히고 previewFile URL이 남아있으면 해제합니다.
    if (!previewOpened && previewFile) {
      URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
    }
  }, [previewOpened]);

  const clearFile = () => {
    setMetaData(null);
    setImportedFiles({}); // state 초기화
    verificationRef.current = null;
    setVerificationActive(null);
    setGuidePdf(null);
    setDeleteGuideFlag(false);
    resetRef.current?.();
  };

  const onChangeImport = async (file: File | null) => {
    if (!file) return;
    try {
      //setModelFile(file); 원본 aasx 파일 저장은 필요 없음
      const modelId =
        mode == "edit" ? modelRef.current[`${modelType}_id`] : undefined;
      let result;
      result = await importModel({ modelType, file, modelId });
      if (!result) return;

      //const metadata = typeof result === "string" ? JSON.parse(result) : result;
      //setMetaData(metadata);

      // 1. API 응답 구조 (metadata, attachments) 파싱
      const metadata = typeof result.metadata === "string" ? JSON.parse(result.metadata) : result.metadata;
      // 백엔드 API 응답 키인 'attachments'를 사용하도록 수정
      const attachments_data = result.attachments;

      setMetaData(metadata);

      // 2. Base64로 인코딩된 파일들을 File 객체로 변환
      const files: Record<string, File> = {};
      if (attachments_data) {
        for (const filename in attachments_data) {
          // 백엔드에서 보낸 파일 정보 객체
          const fileData = attachments_data[filename]; 
          
          // 파일 경로에서 폴더 부분은 제외하고 파일명만 사용 (basyx는 전체 경로를 키로 반환)
          const cleanFilename = filename.split('/').pop() || filename;
          
          // base64ToFile 호출 시 세 번째 인자로 MIME 타입(fileData.type) 전달
          files[cleanFilename] = base64ToFile(
            fileData.content, // Base64 content
            cleanFilename,    // Filename
            fileData.type     // MIME type
          );
        }
      }
      
      // 3. File 객체들을 state에 저장
      setImportedFiles(files);
      

      

      verificationRef.current = null;
      setVerificationActive(null);
    } catch (error: any) {
      console.error(error.message);
    } finally {
      resetRef.current?.();
    }
  };

  
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setState((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));
  };

  const getModelId = (metadata: object) => {
    if (mode == "create") {
      if (metadata == null) {
        return "";
      }
      if (modelType === "aasmodel") {
        return metadata["assetAdministrationShells"][0].id;
      } else {
        return metadata["submodels"][0]["id"];
      }
    } else {
      return modelRef.current[`${modelType}_id`];
    }
  };

  // ... (handleSubmit 함수 내부)
  const handleSubmit = async (status: "temporary" | "draft") => {
    if (!(await confirmSave("Do you want to Save?"))) return;

    if (mode == "edit") {
      const { data: existSeq } = await verifyModel({
        modelType,
        modelId: modelRef.current?.[`${modelType}_id`],
        errorThrow: false,
      });

      if (
        existSeq != undefined &&
        existSeq != "" &&
        existSeq != modelRef.current?.[`${modelType}_seq`]
      ) {
        const isConfirm = await confirmSave(
          `Model already updated in sequence ${existSeq}. Do you want to continue and overwrite your changes?`,
          {
            labels: {
              confirm: "Confirm",
              cancel: "Cancel",
            },
          }
        );
        if (!isConfirm) return;
      }
    }


    //////////////////////////////////////
    // 검증 로직 임시 주석 2025.10.14 start//

    // 유효성 검사
    // 모델명, 설명,
    if (state[`${modelType}_name`] == "") {
      return toast("Enter Template name", {
        icon: "⚠️",
      });
    }
    if (state.description == "") {
      return toast("Enter description", {
        icon: "⚠️",
      });
    }
    if (state.category_seq == null || state.category_seq == "") {
      return toast("Select category", {
        icon: "⚠️",
      });
    }

    if (metadata == null) {
      return toast(`Import ${routeKey}`, {
        icon: "⚠️",
      });
    }
    //////////////////////////////////////
    // 검증 로직 임시 주석 2025.10.14 end//





    const payloadMetadata = Array.isArray(metadata)
      ? [...metadata]
      : { ...metadata };
    for (const key in treeDataRef.current) {
      const value = treeDataRef.current[key];
      _.set(payloadMetadata, key, value);
    }

    let body = {};

    if (mode == "create") {
      body = {
        [`${modelType}_seq`]: "",
        [`${modelType}_id`]: getModelId(payloadMetadata),
        [publishKey]: "",
        [modelType == "aasmodel" ? "version" : `${modelType}_version`]: "",
        type: "",
        status: "",
        source_project: "",
      };
    } else {
      body = {
        ...modelRef.current,
      };
    }

    body = {
      ...body,
      [`${modelType}_name`]: state[`${modelType}_name`],
      description: state.description,
      category_seq: state.category_seq,
      creator: state.creator,
      asset_type: state.asset_type,
      aas_maturity_level: state.aas_maturity_level,
      metadata: JSON.stringify(payloadMetadata),
    };

    if (["published", "deprecated"].includes(modelRef.current.status)) {
      body[`${modelType}_seq`] = "";
    }

    if (modelType == "submodel") {
      body[publishKey] =
        payloadMetadata["submodels"][0].semanticId.keys[0].value;
    }

    const payload = {
      body: JSON.stringify(body),
    };

    if (model_img) {
      const compressed = await imageCompression(model_img, {
        maxWidthOrHeight: 256,
        useWebWorker: true,
        maxSizeMB: 0.1,
      });
      const image = new File([compressed], compressed.name, {
        type: compressed.type,
      });
      payload["image"] = image as File;
    }

    // if (modelFile) {
    //   payload["attachments"] = modelFile;
    // }

    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => {
      formData.append(key, value);
    });

    // 1. state에 저장된 추출 파일들을 FormData에 추가
    // 백엔드 API (aasmodel.py)는 'attachments'라는 키로 파일 리스트를 받습니다.
    if (importedFiles) {
      Object.values(importedFiles).forEach(file => {
        formData.append("attachments", file);
      });
    }

    // Guide PDF 파일 및 삭제 플래그 추가
    if (guidePdf) {
      formData.append("guide_pdf", guidePdf);
    } else if (deleteGuideFlag) {
      formData.append("delete_guide", "true");
    }

    try {
      setLoading(true);
      const modelSeq = await upsertModel({
        modelType,
        status,
        formData, // formData가 파일들을 포함하여 전송됩니다.
        errorThrow: true,
        withToast: true,
      });
      router.push(ROUTES[routeKey].VIEW(modelSeq));
    } catch (error) {
      console.log(error);
      let json = error?.cause?.json;

      if (json && json.data && typeof json.data === 'string') {
            try {
              // 여기서 검증 데이터 저장
              const verificationData = JSON.parse(json.data);
              verificationRef.current = verificationData;
              
              // 'InstanceForm'과 동일하게 'summary' 객체를 찾아서 첫 번째 오류 탭을 활성화
              const summary = verificationData?.summary; 
              if (summary) {
                // 'summary' 객체 (e.g., { submodels: 27, ... })
                const firstErrorKey = Object.keys(summary).find(
                  (key) => summary[key] > 0
                );
                
                // 탭 인덱스 맵 (VerifyDetailView 탭 순서와 일치해야 함)
                const keyMap = {
                  assetInfo: 0,
                  submodels: 1,
                  conceptDescriptions: 2,
                  constraints: 3,
                  etc: 4,
                };

                // 첫 번째 오류가 있는 탭의 인덱스를 찾아 활성화
                setVerificationActive(keyMap[firstErrorKey] ?? 1); // 1 (submodels)을 기본값으로
              } else {
                // summary가 없는 경우(레거시 형식) 일단 첫번째 탭을 엶
                setVerificationActive(0); 
              }

            } catch (e) {
              console.error("Failed to parse verification error data", e);
              verificationRef.current = null;
              setVerificationActive(null);
            }
          }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format, model) => {
    exportModel({
      modelType,
      format,
      modelSeq: model[`${modelType}_seq`],
      filename: model[`${modelType}_name`],
    });
  };

  const renderFootButtons = () => {
    const modelSeq = model?.[`${modelType}_seq`];
    const aasEditLink = ROUTES[routeKey].EDIT(modelSeq);
    const instanceLink = `${ROUTES.INSTANCE.CREATE}?modelSeq=${modelSeq}`;
    switch (mode) {
      case "view":
        return (
          <>
            {/* ▼▼▼ [권한 로직] ▼▼▼ */}
            {user != null &&
              (user?.user_group_seq <= UserRole.Approvedor ||
                user?.user_seq === model.create_user_seq) && (
              <Link
                href={aasEditLink}
                className="btn btn-light-success btn-sm me-2"
              >
                <i className="fa-regular fa-pen-to-square"></i> Edit{" "}
              </Link>
            )}

            {user != null && (
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <button className="btn btn-success btn-sm me-2 dropdown-toggle">
                    Export
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  {["json", "xml", "aasx"].map((format) => (
                    <Menu.Item
                      key={`${model?.[`${modelType}_seq`]}-${format}`}
                      onClick={() => handleExport(format, model)}
                    >
                      {format}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}
            {user?.user_group_seq === UserRole.User &&
              modelType == "aasmodel" &&
              model?.status == "published" && (
                <Link href={instanceLink} className="btn btn-success btn-sm">
                  <i className="fa-regular fa-copy"></i>Create AAS
                </Link>
              )}
          </>
        );
      case "create":
      case "edit":
        return (
          <>
            <CancelButton />
            {["temporary", "draft"].includes(model?.status) && (
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
                      modelType,
                      modelSeq: modelSeq,
                    });

                    router.replace(ROUTES[routeKey].LIST);
                  }
                }}
              >
                <i className="fa-solid fa-cloud"></i> Delete
              </button>
            )}
            {model?.status != "draft" && (
              <button
                type="button"
                className="btn btn-light-success btn-sm me-2"
                disabled={loading}
                onClick={() => handleSubmit("temporary")}
              >
                <i className="fa-solid fa-cloud"></i> Temporarily save{" "}
              </button>
            )}
            <button
              type="button"
              className="btn btn-success btn-sm me-2"
              disabled={loading}
              onClick={() => handleSubmit("draft")}
            >
              <i className="fa-solid fa-upload"></i>{" "}
              {model?.status == null || model?.status == "published"
                ? "Register"
                : "Save"}
            </button>
          </>
        );
      default:
        break;
    }
  };

  const handleOpen = () => {
    if (!verificationActive) return;
    modals.open({
      withCloseButton: false,
      fullScreen: true,
      closeOnEscape: false,
      children: (
        <>
          <Flex
            justify="flex-end"
            style={{ position: "sticky", top: 10, zIndex: 10 }}
          >
            <Button
              onClick={() => {
                modals.closeAll();
              }}
            >
              Close
            </Button>
          </Flex>
          <div className="text-muted fw-semibold fs-5">
            {Array.isArray(
              verificationRef.current?.[verificationActive]?.message
            ) &&
              verificationRef.current?.[verificationActive]?.message.map(
                (msg) => (
                  <>
                    {msg}
                    <br />
                  </>
                )
              )}
          </div>
        </>
      ),
    });
  };

  return (
    <>
      <FilePreviewModal
        opened={previewOpened}
        onClose={closePreview}
        fileUrl={previewFile?.url || ""}
        fileType={previewFile?.type || ""}
      />
      {/* begin::Toolbar */}
      <div className="toolbar py-5 py-lg-5" id="kt_toolbar">
        {/* begin::Container */}
        <div
          id="kt_toolbar_container"
          className="container-xxl d-flex flex-stack flex-wrap"
        >
          {/* begin::Page title */}
          <div className="page-title d-flex flex-column me-3">
            {/* begin::Title */}
            <h1 className="d-flex text-gray-900 fw-bold my-1 fs-3">
              {modelType === "aasmodel" ? "AAS Template" : "SubModel Template"}{" "}
              -{" "}
              {mode == "create" ? "Register" : mode == "edit" ? "Edit" : "View"}
            </h1>
            {/* end::Title */}
            {/* begin::Breadcrumb */}
            <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">
                <a href="index" className="text-gray-600 text-hover-primary">
                  Home
                </a>
              </li>
              {/* end::Item */}
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">
                {modelType === "aasmodel"
                  ? "AAS Template"
                  : "SubModel Template"}{" "}
                -{" "}
                {mode == "create"
                  ? "Register"
                  : mode == "edit"
                  ? "Edit"
                  : "View"}
              </li>
              {/* end::Item */}
            </ul>
            {/* end::Breadcrumb */}
          </div>
          {/* end::Page title */}
          {/* begin::Actions */}
          <div className="d-flex align-items-center py-2 py-md-1">
            {!modalMode && mode == "view" && (
              <div className="form-floating">
                <select
                  id="version"
                  className="form-select  form-select-md fw-semibold me-3"
                  value={model?.[`${modelType}_seq`]}
                  onChange={(e) => {
                    router.push(ROUTES[routeKey].VIEW(e.target.value));
                  }}
                >
                  {versions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.text}
                    </option>
                  ))}
                </select>
                <label htmlFor="version">Version</label>
              </div>
            )}
            {!modalMode && (
              <Link
                href={ROUTES[routeKey].LIST}
                className="btn btn-lightactive"
              >
                <i className="fa-solid fa-list"></i> List
              </Link>
            )}
            {["create", "edit"].includes(mode) && (
              <>
                {" "}
                <FileButton
                  resetRef={resetRef}
                  onChange={onChangeImport}
                  accept=".aasx,.xml,.json,application/xml,text/xml,application/json"
                >
                  {(props) => (
                    <button
                      className="btn btn-success me-3 fw-bold "
                      {...props}
                    >
                      <i className="fa-solid fa-file-import"></i> Import
                    </button>
                  )}
                </FileButton>
                {mode === "create" && (
                  <button
                    disabled={!metadata}
                    className={`btn btn-${!!metadata ? "danger" : ""} fw-bold`}
                    onClick={clearFile}
                  >
                    <i className="fa-regular fa-file-circle-minus"></i> Reset
                  </button>
                )}
              </>
            )}
          </div>
          {/* end::Actions */}
        </div>
        {/* end::Container */}
      </div>
      {/* end::Toolbar */}
      {/* begin::Container */}
      <div
        id="kt_content_container"
        className="d-flex flex-column-fluid align-items-start container-xxl"
      >
        {/* begin::Post */}
        <div className="content flex-row-fluid" id="kt_content">
          <div className="card">
            <div className="card-header">
              {/* begin::Card title */}
              <div className="card-title fs-3 fw-bold text-primary">
                {mode == "create" ? "Register" : model?.[`${modelType}_name`]}
              </div>
              {/* end::Card title */}
            </div>

            <div id="" className="collapse show p-9">
              <div className="row gx-9 mb-10">
                <div className={mode !== "view" ? "col-lg-8" : "col-12"}>
                  <div className="card h-100">
                    <div
                      className="card-header border-0 bg-light cursor-pointer"
                      style={{ minHeight: "50px" }}
                      onClick={() => setTemplateInfoOpen(!isTemplateInfoOpen)}
                    >
                      {/* begin::Card title */}
                      <div className="card-title fs-4 fw-bold">
                        Template info
                        {version != null && (
                          <span className="badge badge-light-success mx-2">
                            {`Version ${version.text}`}
                          </span>
                        )}
                      </div>
                      {/* end::Card title */}
                      {/* begin::Card toolbar */}
                      <div className="card-toolbar">
                        <div className="btn btn-sm btn-icon btn-active-color-primary">
                          <i
                            className={`fa-solid ${
                              isTemplateInfoOpen
                                ? "fa-chevron-up"
                                : "fa-chevron-down"
                            } fs-4`}
                          ></i>
                        </div>
                      </div>
                      {/* end::Card toolbar */}
                    </div>
                    <div
                      id="template_info_collapse"
                      className={`collapse ${isTemplateInfoOpen ? "show" : ""}`}
                    >
                      {/* begin::Form */}
                      <form
                        id="kt_account_profile_details_form"
                        className="form"
                      >
                        {/* begin::Card body */}
                        <div className="card-body border-top p-9">
                          <div className="row">
                            {["view", "edit"].includes(mode) && (
                              <div
                                className={`col-6 ${
                                  mode === "view" ? "col-lg-6" : ""
                                }`}
                              >
                                <div className="row mb-6">
                                  <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                    Status
                                  </label>
                                  <div className="col-lg-8 fv-row">
                                    <input
                                      type="text"
                                      className="form-control form-control-solid"
                                      readOnly
                                      value={model?.status || ""}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            

                            {["view", "edit"].includes(mode) && (
                              <div
                                className={`col-6 ${
                                  mode === "view" ? "col-lg-6" : ""
                                }`}
                              >
                                <div className="row mb-6">
                                  <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                    Sequence
                                  </label>
                                  <div className="col-lg-8 fv-row">
                                    <input
                                      type="text"
                                      className="form-control form-control-solid"
                                      readOnly
                                      value={
                                        model?.[`${modelType}_seq`] || ""
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            {["view", "edit"].includes(mode) && (
                              <div
                                className={`col-6 ${
                                  mode === "view" ? "col-lg-6" : ""
                                }`}
                              >
                                <div className="row mb-6">
                                  <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                    {modelType == "aasmodel"
                                      ? "Template ID"
                                      : "Semantic ID"}
                                  </label>
                                  <div className="col-lg-8 fv-row">
                                    <input
                                      type="text"
                                      className="form-control form-control-solid"
                                      readOnly
                                      value={model?.[publishKey] || ""}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            <div
                              className={`col-6 ${
                                mode === "view" ? "col-lg-6" : ""
                              }`}
                            >
                              <div className="row mb-6">
                                <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                  Template name
                                </label>
                                <div className="col-lg-8 fv-row">
                                  {mode == "view" ? (
                                    <input
                                      type="text"
                                      className="form-control form-control-solid"
                                      readOnly
                                      value={
                                        model?.[`${modelType}_name`] || ""
                                      }
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      id={`${modelType}_name`}
                                      className="form-control form-control-lg"
                                      placeholder="Please enter"
                                      value={state[`${modelType}_name`]}
                                      onChange={handleInputChange}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                            <div
                              className={`col-12 ${
                                mode === "view" ? "col-lg-12" : ""
                              }`}
                            >
                              <div className="row mb-6">
                                <label className="col-lg-2 col-form-label fw-semibold fs-6">
                                  Description
                                </label>
                                <div className="col-lg-10 fv-row">
                                  {mode == "view" ? (
                                    <textarea
                                      className="form-control form-control-solid"
                                      readOnly
                                      value={model?.description || ""}
                                      rows={3}
                                    />
                                  ) : (
                                    <textarea
                                      id="description"
                                      className="form-control form-control-lg"
                                      placeholder="Please enter"
                                      value={state.description}
                                      onChange={handleInputChange}
                                      rows={3}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Asset Type */}
                            <div
                              className={`col-6 ${
                                mode === "view" ? "col-lg-6" : ""
                              }`}
                            >
                              <div className="row mb-6">
                                <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                  Asset Type
                                </label>
                                <div className="col-lg-8 fv-row">
                                  {mode === "view" ? (
                                    <input
                                      type="text"
                                      className="form-control form-control-solid"
                                      readOnly
                                      value={state.asset_type || ""}
                                    />
                                  ) : (
                                    <select
                                      id="asset_type"
                                      className="form-select"
                                      value={state.asset_type}
                                      onChange={handleInputChange}
                                    >
                                      <option value="">Please enter</option>
                                      {ASSET_TYPE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* AAS Maturity Level */}
                            <div
                              className={`col-6 ${
                                mode === "view" ? "col-lg-6" : ""
                              }`}
                            >
                              <div className="row mb-6">
                                <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                  AAS Maturity Level
                                </label>
                                <div className="col-lg-8 fv-row">
                                  {mode === "view" ? (
                                    <input
                                      type="text"
                                      className="form-control form-control-solid"
                                      readOnly
                                      value={state.aas_maturity_level || ""}
                                    />
                                  ) : (
                                    <select
                                      id="aas_maturity_level"
                                      className="form-select"
                                      value={state.aas_maturity_level}
                                      onChange={handleInputChange}
                                    >
                                      <option value="">Please enter</option>
                                      {AAS_MATURITY_LEVEL_OPTIONS.map(
                                        (option) => (
                                          <option key={option} value={option}>
                                            {option}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  )}
                                </div>
                              </div>
                            </div>



                            <div
                              className={`col-6 ${
                                mode === "view" ? "col-lg-6" : ""
                              }`}
                            >
                              <div className="row mb-6">
                                <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                  Category
                                </label>
                                <div className="col-lg-8 fv-row">
                                  {/* {mode == "view" ||
                                  model?.[`${modelType}_template_id`] ? ( */}
                                  {mode == "view" ? (
                                    <input
                                      type="text"
                                      className="form-control form-control-solid"
                                      readOnly
                                      value={model?.category_name || ""}
                                    />
                                  ) : (
                                    <CategoryCombobox
                                      selectLeafOnly
                                      code={
                                        modelType === "aasmodel"
                                          ? "aas_category"
                                          : "sm_category"
                                      }
                                      value={state.category_seq ?? ""}
                                      setValue={(value) =>
                                        setState({
                                          ...state,
                                          category_seq: value,
                                        })
                                      }
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Creator 항목 */}
                            <div
                              className={`col-6 ${
                                mode === "view" ? "col-lg-6" : ""
                              }`}
                            >
                              <div className="row mb-6">
                                <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                  Creator
                                </label>
                                <div className="col-lg-8 fv-row">
                                  {mode == "view" ? (
                                    <input
                                      type="text"
                                      className="form-control form-control-solid"
                                      readOnly
                                      value={model?.creator || ""}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      id="creator"
                                      className="form-control form-control-lg"
                                      placeholder="Please enter"
                                      value={state.creator}
                                      onChange={handleInputChange}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>


                            {/* Manual Section */}
                            <div
                              className={`col-6 ${
                                mode === "view" ? "col-lg-6" : ""
                              }`}
                            >
                              <div className="row mb-6">
                                <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                  Manual
                                </label>
                                <div className="col-lg-8 fv-row">
                                  {mode === "view" ? (
                                    guideInfo.link ? (
                                      <a
                                        href={guideInfo.link}
                                        download={guideInfo.filename}
                                        className="btn btn-sm btn-light-primary"
                                      >
                                        <IconDownload size="1rem" /> Download{" "}
                                        {guideInfo.filename}
                                      </a>
                                    ) : (
                                      <input
                                        type="text"
                                        className="form-control form-control-solid"
                                        readOnly
                                        value="No guide uploaded"
                                      />
                                    )
                                  ) : (
                                    // 'create' or 'edit' mode
                                    <>
                                      <FileButton
                                        onChange={(file: File | null) => {
                                          if (file && file.size > 50 * 1024 * 1024) {
                                            showToast.error(
                                              "File size must be under 50MB"
                                            );
                                            setGuidePdf(null);
                                          } else {
                                            setGuidePdf(file);
                                            setDeleteGuideFlag(false);
                                          }
                                        }}
                                        accept="application/pdf"
                                      >
                                        {(props) => (
                                          <Button {...props} variant="outline">
                                            Select PDF
                                          </Button>
                                        )}
                                      </FileButton>

                                      {guidePdf ? (
                                        <Box
                                          mt="sm"
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                          }}
                                        >
                                          <IconFile size="1rem" />
                                          <Text size="sm">
                                            {guidePdf.name} (
                                            <NumberFormatter
                                              value={guidePdf.size}
                                              suffix=" bytes"
                                              thousandSeparator
                                            />
                                            )
                                          </Text>
                                          <ActionIcon
                                            color="red"
                                            variant="light"
                                            size="sm"
                                            title="Cancel selection"
                                            onClick={() => setGuidePdf(null)}
                                          >
                                            <IconX size="0.8rem" />
                                          </ActionIcon>
                                        </Box>
                                      ) : (
                                        !guidePdf &&
                                        guideInfo.link && (
                                          <Box
                                            mt="sm"
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "8px",
                                            }}
                                          >
                                            <IconFile size="1rem" />
                                            <Text size="sm" c="dimmed">
                                              Current: {guideInfo.filename}
                                            </Text>
                                            <ActionIcon
                                              color="red"
                                              variant="light"
                                              size="sm"
                                              title="Remove current guide on save"
                                              onClick={() => {
                                                setGuideInfo({
                                                  filename: "",
                                                  link: "",
                                                });
                                                setDeleteGuideFlag(true);
                                              }}
                                            >
                                              <IconX size="0.8rem" />
                                            </ActionIcon>
                                          </Box>
                                        )
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>


                            <div
                              className={`col-6 ${
                                mode === "view" ? "col-lg-6" : ""
                              }`}
                            >
                              <div className="row mb-6">
                                <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                  {modelType === "aasmodel"
                                    ? "AAS id"
                                    : "Submodel id"}
                                </label>
                                <div className="col-lg-8 fv-row">
                                  <input
                                    type="text"
                                    className="form-control form-control-solid"
                                    readOnly
                                    value={
                                      (mode == "create"
                                        ? getModelId(metadata)
                                        : modelRef.current[
                                            `${modelType}_id`
                                          ]) || ""
                                    }
                                  />
                                </div>
                              </div>
                            </div>

                            
                          </div>
                        </div>
                      </form>
                      {/* end::Form */}
                    </div>
                  </div>
                </div>
                {mode != "view" ? (
                  <div className="col-lg-4">
                    <div className="card h-100">
                      <div
                        className="card-header border-0 bg-light cursor-pointer"
                        style={{ minHeight: "50px" }}
                        onClick={() => setThumbnailOpen(!isThumbnailOpen)}
                      >
                        {/* begin::Card title */}
                        <div className="card-title fs-4 fw-bold">
                          Thumbnail image
                        </div>
                        {/* end::Card title */}
                        {/* begin::Card toolbar */}
                        <div className="card-toolbar">
                          <div className="btn btn-sm btn-icon btn-active-color-primary">
                            <i
                              className={`fa-solid ${
                                isThumbnailOpen
                                  ? "fa-chevron-up"
                                  : "fa-chevron-down"
                              } fs-4`}
                            ></i>
                          </div>
                        </div>
                        {/* end::Card toolbar */}
                      </div>
                      <div
                        id="thumbnail_image_collapse"
                        className={`collapse ${isThumbnailOpen ? "show" : ""}`}
                      >
                        {/* begin::Form */}
                        <form
                          id="kt_account_profile_details_form"
                          className="form"
                        >
                          {/* begin::Card body */}
                          <div className="card-body border-top p-9">
                            <div className="row">
                              <label className="col-lg-4 col-form-label fw-semibold fs-6">
                                Thumbnail (256px x 256px)
                              </label>
                              <div className="col-lg-8">
                                {/* begin::Image input */}
                                <div style={{ height: "225px" }}>
                                  {/* begin::Preview existing avatar */}
                                  {mode == "view" ? (
                                    <div
                                      style={{
                                        width: "125px",
                                        height: "125px",
                                      }}
                                    >
                                      {previewThumbnail}
                                    </div>
                                  ) : (
                                    <Indicator
                                      id="indicater"
                                      color="red"
                                      label={
                                        <IconTrash
                                          onClick={(e) => {
                                            setModel_img(undefined);
                                          }}
                                        />
                                      }
                                      inline
                                      offset={4}
                                      size={32}
                                      style={{
                                        cursor: "pointer",
                                      }}
                                    >
                                      <Dropzone
                                        multiple={false}
                                        onDrop={(files) => {
                                          setModel_img(files[0]);
                                        }}
                                        onReject={(files) =>
                                          console.log("rejected files", files)
                                        }
                                        accept={[
                                          "image/png",
                                          "image/jpg",
                                          "image/jpeg",
                                        ]}
                                        w={256}
                                        h={256}
                                      >
                                        <Group
                                          justify="center"
                                          gap="xl"
                                          mih={220}
                                          style={{ pointerEvents: "none" }}
                                        >
                                          {previewThumbnail ? (
                                            previewThumbnail
                                          ) : (
                                            <>
                                              <Dropzone.Accept>
                                                <IconUpload
                                                  size={52}
                                                  color="var(--mantine-color-blue-6)"
                                                  stroke={1.5}
                                                />
                                              </Dropzone.Accept>
                                              <Dropzone.Reject>
                                                <IconX
                                                  size={52}
                                                  color="var(--mantine-color-red-6)"
                                                  stroke={1.5}
                                                />
                                              </Dropzone.Reject>
                                              <Dropzone.Idle>
                                                <IconPhoto
                                                  size={52}
                                                  color="var(--mantine-color-dimmed)"
                                                  stroke={1.5}
                                                />
                                              </Dropzone.Idle>
                                            </>
                                          )}
                                          <div>
                                            <Text
                                              size="sm"
                                              c="dimmed"
                                              inline
                                              mt={7}
                                            >
                                              Allowed file types: png, jpg,
                                              jpeg
                                            </Text>
                                          </div>
                                        </Group>
                                      </Dropzone>
                                    </Indicator>
                                  )}
                                  {/* end::Preview existing avatar */}
                                  {/* begin::Label */}

                                  {/* end::Hint */}
                                </div>
                              </div>
                            </div>
                          </div>
                        </form>
                        {/* end::Form */}
                      </div>
                    </div>
                  </div>
                ) : (
                  ""
                )}
              </div>

              <div className="card mt-10">
                <div
                  className="card-header border-0 bg-light cursor-pointer"
                  style={{ minHeight: "50px" }}
                  onClick={() => setModelOpen(!isModelOpen)}
                >
                  {/* begin::Card title */}
                  <div className="card-title fs-4 fw-bold">
                    <AASTreeModal
                      treeData={treeData}
                      treeDataRefCurrent={treeDataRef.current}
                      metadata={metadata}
                      setMetaData={setMetaData}
                      mode={mode}
                    />
                    Model
                    {Array.isArray(treeData) && treeData.length > 0 && treeData[0] && (
                      <span className="badge badge-light-success mx-2">
                        {treeData[0].id}
                      </span>
                    )}
                  </div>
                  {/* end::Card title */}
                  {/* begin::Card toolbar */}
                  <div className="card-toolbar">
                    <div className="btn btn-sm btn-icon btn-active-color-primary">
                      <i
                        className={`fa-solid ${
                          isModelOpen ? "fa-chevron-up" : "fa-chevron-down"
                        } fs-4`}
                      ></i>
                    </div>
                  </div>
                  {/* end::Card toolbar */}
                </div>
                <div
                  id="model_collapse"
                  className={`collapse ${isModelOpen ? "show" : ""}`}
                >
                  {/* begin::Form */}
                  <form
                    id="kt_account_profile_details_form_model"
                    className="form"
                  >
                    {/* begin::Card body */}
                    <div className="card-body border-top p-9">
                      {Array.isArray(treeData) && (
                        <AASTree
                          style={{ maxHeight: "80vh", overflow: "scroll" }}
                          mb={"sm"}
                          data={treeData}
                          treeDataRefCurrent={treeDataRef.current}
                          editMode={["create", "edit"].includes(mode)}
                        />
                      )}
                    </div>
                  </form>
                  {/* end::Form */}
                </div>
              </div>




              {/* 첨부파일 목록 카드 */}
              {(Object.keys(importedFiles).length > 0 || (mode === 'view' && model?.files?.length > 0)) && (
                <div className="card mt-10">
                  <div
                    className="card-header border-0 bg-light cursor-pointer"
                  style={{ minHeight: "50px" }} 
                    onClick={() => setAttachmentsOpen(!isAttachmentsOpen)}
                  >
                    <div className="card-title fs-4 fw-bold">
                      {/* 모드에 따라 올바른 카운트 표시 */}
                      Attachments ({mode === 'view' ? model.files.length : Object.keys(importedFiles).length} Count)
                    </div>
                    {/* ... (카드 툴바) ... */}
                    <div className="card-toolbar">
                      <div className="btn btn-sm btn-icon btn-active-color-primary">
                        <i
                          className={`fa-solid ${
                            isAttachmentsOpen
                              ? "fa-chevron-up"
                              : "fa-chevron-down"
                          } fs-4`}
                        ></i>
                      </div>
                    </div>
                  </div>
                  <div
                    id="attachments_collapse"
                    className={`collapse ${isAttachmentsOpen ? "show" : ""}`}
                  >
                    <div className="card-body border-top p-9">
                      <List
                        spacing="xs"
                        size="sm"
                        center
                      >

                        {/* --- [분기 처리 시작] --- */}
                        {mode === 'view' ? (
                          /* --- "View" 모드: model.files 렌더링 --- */
                          model.files?.map((file: any) => (
                            <List.Item
                              key={file.realpath} // 고유 키로 realpath 사용
                              icon={
                                <ThemeIcon color="blue" size={24} radius="xl">
                                  <IconFile size="1rem" />
                                </ThemeIcon>
                              }
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingBottom: '8px'
                              }}
                            >
                              <Box>
                                <Text>{file.filename}</Text>
                              </Box>

                              <Group gap="xs" wrap="nowrap">
                                {/* "View" 모드 미리보기 버튼 */}
                                <ActionIcon
                                  color="gray"
                                  variant="light"
                                  onClick={() => handlePreviewSavedFile(file)}
                                  title="Preview file"
                                >
                                  <IconEye size="1rem" />
                                </ActionIcon>

                                {/* "View" 모드 다운로드 버튼 (중첩 <a> 태그 제거) */}
                                <ActionIcon
                                    component="a"
                                    href={file.link}
                                    download={file.filename}
                                    title="Download file"
                                    color="blue"
                                    variant="light"
                                >
                                    <IconDownload size="1rem" />
                                </ActionIcon>
                                {/* "View" 모드에서는 삭제 버튼 없음 */}
                              </Group>
                            </List.Item>
                          ))
                        ) : (
                        /* --- "Create/Edit" 모드: importedFiles 렌더링 --- */
                        Object.values(importedFiles).map((file) => (
                          <List.Item
                            key={file.name}
                            icon={
                              <ThemeIcon color="blue" size={24} radius="xl">
                                <IconFile size="1rem" />
                              </ThemeIcon>
                            }
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingBottom: '8px'
                            }}
                          >
                            <Box>
                              <Text>{file.name}</Text>
                              <Text size="xs" c="dimmed">
                                <NumberFormatter
                                  value={file.size}
                                  suffix=" bytes"
                                  thousandSeparator
                                />
                              </Text>
                            </Box>

                            {/* 아이콘 버튼 그룹 */}
                            <Group gap="xs" wrap="nowrap">
                              {/* 미리보기 버튼 */}
                              <ActionIcon
                                color="gray"
                                variant="light"
                                onClick={() => handlePreviewFile(file)}
                                title="Preview file"
                              >
                                <IconEye size="1rem" />
                              </ActionIcon>

                              {/* 다운로드 버튼 */}
                              <ActionIcon
                                color="blue"
                                variant="light"
                                onClick={() => handleDownloadFile(file)}
                                title="Download file"
                              >
                                <IconDownload size="1rem" />
                              </ActionIcon>

                              {/* 'create' 또는 'edit' 모드일 때만 삭제 버튼 표시 */}
                              {["create", "edit"].includes(mode) && (
                                <ActionIcon
                                  color="red"
                                  variant="light"
                                  onClick={() => handleRemoveImportedFile(file.name)}
                                  title="Remove file"
                                >
                                  <IconX size="1rem" />
                                </ActionIcon>
                              )}
                            </Group>
                            
                          </List.Item>
                          ))
                        )}
                      </List>
                    </div>
                  </div>
                </div>
              )}


              <div className="card mt-10">
                <div
                  className="card-header border-0 bg-light cursor-pointer"
                  style={{ minHeight: "50px" }}
                  onClick={() =>
                    setConcepdescriptionOpen(!isConcepdescriptionOpen)
                  }
                >
                  {/* begin::Card title */}
                  <div className="card-title fs-4 fw-bold">
                    <AASTreeModal
                      treeData={conceptDescriptionTreeData}
                      mode={mode}
                    />
                    Concepdescription
                  </div>
                  {/* end::Card title */}
                  {/* begin::Card toolbar */}
                  <div className="card-toolbar">
                    <div className="btn btn-sm btn-icon btn-active-color-primary">
                      <i
                        className={`fa-solid ${
                          isConcepdescriptionOpen
                            ? "fa-chevron-up"
                            : "fa-chevron-down"
                        } fs-4`}
                      ></i>
                    </div>
                  </div>
                  {/* end::Card toolbar */}
                </div>
                <div
                  id="concepdescription_collapse"
                  className={`collapse ${
                    isConcepdescriptionOpen ? "show" : ""
                  }`}
                >
                  {/* begin::Form */}
                  <form
                    id="kt_account_profile_details_form_concep"
                    className="form"
                  >
                    {/* begin::Card body */}
                    <div className="card-body border-top p-9">
                      {Array.isArray(conceptDescriptionTreeData) && (
                        <AASTree
                          style={{ maxHeight: "80vh", overflow: "scroll" }}
                          mb={"sm"}
                          data={conceptDescriptionTreeData}
                          editMode={["create", "edit"].includes(mode)}
                        />
                      )}
                    </div>
                  </form>
                  {/* end::Form */}
                </div>
              </div>

              <VerifyDetailView
                verificationRef={verificationRef}
                verificationActive={verificationActive}
                setVerificationActive={setVerificationActive}
              />
            </div>

            {!modalMode && (
              <div className="card-footer d-flex justify-content-end py-6 px-9">
                {renderFootButtons()}
              </div>
            )}
          </div>
        </div>
        {/* end::Post */}
      </div>
      {/* end::Container */}
    </>
  );
}