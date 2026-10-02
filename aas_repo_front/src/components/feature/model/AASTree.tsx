"use client";
import React, { useMemo, useState, memo, useEffect, useRef } from "react";
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Combobox,
  Container,
  Flex,
  Group,
  InputBase,
  JsonInput,
  List,
  Select,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  NumberInput,
  FileInput,
  ThemeIcon,
  Title,
  Tree,
  useCombobox,
  useTree,
  Highlight,
  getTreeExpandedState,
} from "@mantine/core";
import { modals } from "@mantine/modals";
import {
  IconSquareRoundedMinus,
  IconSquareRoundedPlus,
  IconCurrencyLeu,
  IconTrash,
  IconPlus,
  IconRefresh,
  IconCopy,
  IconCornerDownRight,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { confirmSave } from "@/utils/modal";
import treeNodeClass from "@/css/treeNode.module.css";
import { showToast } from "@/utils/toast";
import ElementAdd from "../instance/ElementAdd";
import FilePreviewModal from "../instance/FilePreviewModal";
import { useDisclosure } from "@mantine/hooks";
import _ from "lodash";
import { industrialLanguages } from "@/constants/languages";
import {
  DataTypeDefXsdOptionItems,
  EntityTypes,
  ReferenceTypes,
  getDataTypeDefXsdRule,
} from "@/constants/aasConstants";
import type { ValidationErrors } from "@/utils/validation";

const PREVIEW_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif"];

const isBooleanLikeValue = (value: unknown) =>
  value === true || value === "true" || value === 1 || value === "1";

const toDateTimeLocalValue = (value: unknown) => {
  if (typeof value !== "string" || !value) {
    return "";
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  const parsedDate = new Date(trimmedValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return trimmedValue.replace(/Z$/, "");
  }

  const timezoneOffset = parsedDate.getTimezoneOffset();
  const localDate = new Date(parsedDate.getTime() - timezoneOffset * 60_000);
  return localDate.toISOString().slice(0, 19);
};

const fromDateTimeLocalValue = (value: string) => {
  if (!value) {
    return "";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toISOString();
};

const getErrorPath = (stateKey: string, pathPrefix?: string) => {
  if (!pathPrefix) {
    return stateKey;
  }

  return stateKey.startsWith("[") ? `${pathPrefix}${stateKey}` : `${pathPrefix}.${stateKey}`;
};

const toDateInputValue = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 10);
};

const getNodeErrorCount = (
  node: any,
  errors?: ValidationErrors,
  errorPathPrefix?: string
) => {
  if (!errors || Object.keys(errors).length === 0) {
    return 0;
  }

  const nodePath =
    typeof node?.valuePath === "string" && node.valuePath
      ? getErrorPath(node.valuePath, errorPathPrefix)
      : undefined;

  if (nodePath) {
    return Object.keys(errors).filter(
      (errorPath) => errorPath === nodePath || errorPath.startsWith(`${nodePath}.`) || errorPath.startsWith(`${nodePath}[`)
    ).length;
  }

  if (errorPathPrefix && node?.modelType === "ConceptDescriptions") {
    return Object.keys(errors).filter((errorPath) => errorPath.startsWith(errorPathPrefix)).length;
  }

  return 0;
};

// buildKeysFromPath: valuePath를 기반으로 계층 구조의 keys 배열을 생성합니다.
const buildKeysFromPath = (path: string, fullState: any) => {
  if (!fullState) return [];
  
  const parts = _.toPath(path);
  const keys: any[] = [];
  let currentPath = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (currentPath === "") {
      currentPath = part;
    } else if (/^\d+$/.test(part)) {
      currentPath += `[${part}]`;
    } else {
      currentPath += `.${part}`;
    }

    const obj = _.get(fullState, currentPath);
    if (obj && obj.modelType) {
      let keyValue = obj.idShort;
      
      // Identifiable 타입인 경우 id를 사용
      if (["AssetAdministrationShell", "Submodel", "ConceptDescription"].includes(obj.modelType)) {
        keyValue = obj.id;
      }

      // SubmodelElementList 내부의 요소인 경우 인덱스를 값으로 사용
      // currentPath 예: submodels[0].submodelElements[1].value[0]
      const listMatch = currentPath.match(/(.*)\.value\[(\d+)\]$/);
      if (listMatch) {
        const parentListPath = listMatch[1];
        const index = listMatch[2];
        const parentList = _.get(fullState, parentListPath);
        if (parentList && parentList.modelType === "SubmodelElementList") {
          keyValue = index;
        }
      }

      keys.push({
        type: obj.modelType,
        value: keyValue,
      });
    }
  }
  return keys;
};

// RenderObject: 재귀적으로 객체 내부의 속성을 렌더링합니다.
// editMode가 true이면 TextInput으로 입력 가능, false이면 단순 Text로 보여줍니다.
export const RenderObject = memo(
  ({
    obj,
    indent = 0,
    state,
    onValueChange,
    editMode,
    isInstance,
    instanceSeq,
    treeData,
    fullState,
    errors,
    errorPathPrefix,
  }: {
    obj: any;
    indent?: number;
    state: any;
    editMode: boolean;
    onValueChange?: (key: string, value: any, file?: File | undefined) => void;
    isInstance?: boolean;
    instanceSeq?: string;
    treeData?: any;
    fullState?: any;
    errors?: ValidationErrors;
    errorPathPrefix?: string;
  }) => {

    // semanticId 필드의 접힘/펼침 상태를 관리 (기본값: false, 접힌 상태)
    const [isSemanticIdExpanded, setIsSemanticIdExpanded] = useState(false);

    // description 필드의 접힘/펼침 상태 추가
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [previewOpened, { open: openPreview, close: closePreview }] = useDisclosure(false);
    const [previewFile, setPreviewFile] = useState<{ url: string; type: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const valueTypeCombobox = useCombobox();
    const [valueTypeSearch, setValueTypeSearch] = useState("");
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const isProduction = typeof window !== 'undefined' && window.location.hostname !== 'localhost';
    const getCorrectedUrl = (url: string) => {
      if (!url) return url;
      if (isProduction && url.startsWith('/aas_files')) {
        return `/api${url}`;
      }
      return url;
    };


    const [innerState, setInnerState] = useState(state);

    // WORKAROUND: Handle flawed data structure from aas.js
    //const modelType = obj.modelType;
    const modelType = obj.modelType ?? (obj.assetInformation ? "AssetAdministrationShell" : undefined);
    const renderableObj =
      modelType && obj[modelType] ? { ...obj, ...obj[modelType] } : obj;

    useEffect(() => {
      setInnerState({ ...state });
    }, [obj, state]);

    const allowedKeysMap = {
      AssetAdministrationShell: [
        "idShort",
        "id",
        "description",
        "version",
        "assetInformation",
        "submodels",
      ],
      Submodel: ["idShort", "description", "kind", "semanticId"],
      // originalValue는 자식 노드 배열이므로 상세 뷰에서 제외하고,
      // SMC/SML 자체의 속성인 description, semanticId를 표시하도록 변경합니다.
      SubmodelElementCollection: ["idShort", "description", "semanticId"],
      SubmodelElementList: ["idShort", "description", "semanticId"],
      Property: ["idShort", "description", "semanticId", "valueType", "originalValue"],
      MultiLanguageProperty: ["idShort", "description", "semanticId", "originalValue"],
      Range: ["idShort", "description", "semanticId", "valueType", "min", "max"],
      // File: ["idShort", "description", "semanticId", "contentType", "originalValue"],
      File: ["idShort", "description", "semanticId", "contentType", "originalValue"],
      ReferenceElement: ["idShort", "description", "semanticId", "originalValue"],

      Entity: ["idShort", "description", "semanticId", "entityType", "globalAssetId", "statements"],
      // Relationship (BoM)
      RelationshipElement: ["idShort", "description", "semanticId", "first", "second"],

      // ConceptDescription 상세 뷰에 표시할 키
      ConceptDescription: [
        "idShort",
        "id",
        "description",
        "isCaseOf",
        "embeddedDataSpecifications",
      ],
    };

    // Use the modelType from the original object for key lookup
    const keysToShow =
      modelType && allowedKeysMap[modelType] ? allowedKeysMap[modelType] : null;

    // Use the corrected renderableObj to get the entries
    let allEntries = Object.entries(renderableObj);

    const filteredEntries = keysToShow
      ? allEntries.filter(([k]) => keysToShow.includes(k))
      : allEntries;

    const openReferenceModal = (keysPath: string) => {
      if (!treeData) return;
      modals.open({
        title: "Select AAS Element for ModelReference",
        size: "xl",
        children: (
          <Box p="md">
            <AASTree
              data={treeData}
              editMode={false}
              simpleView={true}
              onNodeClick={(selectedNode) => {
                if (selectedNode && selectedNode.valuePath) {
                  const keys = buildKeysFromPath(
                    selectedNode.valuePath,
                    fullState || state
                  );

                  if (onValueChange) {
                    onValueChange(keysPath, keys);
                  }
                  setInnerState((prev: any) => ({
                    ...prev,
                    [keysPath]: keys,
                  }));
                  state[keysPath] = keys;

                  modals.closeAll();
                  showToast.success(
                    "Reference keys updated from selected node hierarchy."
                  );
                }
              }}
              fullState={fullState || state}
            />
          </Box>
        ),
      });
    };

    const handleReferenceTypeChange = async (val: string | null, stateKey: string) => {
      const keysPath = stateKey.replace(/\.type$/, ".keys");
      const currentKeys = innerState[keysPath] ?? _.get(fullState || state, keysPath) ?? [];
      
      const isExternalToModel = val === "ModelReference";
      const isModelToExternal = val === "ExternalReference";

      if (isExternalToModel) {
        // ExternalReference -> ModelReference
        // GlobalReference의 value가 입력된 경우만 확인창 띄움
        const hasGlobalRefValue = Array.isArray(currentKeys) && currentKeys.some(k => k.type === "GlobalReference" && k.value);
        if (hasGlobalRefValue) {
            const confirmed = await confirmSave("ModelReference로 변경하면 기존의 외부 참조(GlobalReference) 정보가 삭제되며, AAS 내부의 엘리먼트를 새로 선택해야 합니다. 계속하시겠습니까?", { labels: { confirm: "확인", cancel: "취소" } });
            if (!confirmed) {
              // Revert Select value if canceled - this is tricky because Select is controlled by innerState
              setInnerState((prev: any) => ({ ...prev, [stateKey]: innerState[stateKey] }));
              return;
            }
        }
        
        // 데이터 초기화: 기존의 GlobalReference 키를 삭제하고 빈 keys 배열로 만듭니다.
        const newKeys: any[] = [];
        setInnerState((prev: any) => ({ ...prev, [stateKey]: val, [keysPath]: newKeys }));
        if (onValueChange) {
            onValueChange(stateKey, val);
            onValueChange(keysPath, newKeys);
        }
        state[stateKey] = val;
        state[keysPath] = newKeys;

        // AAS 트리 선택 팝업 활성화
        if (treeData && !stateKey.includes("semanticId")) {
            openReferenceModal(keysPath);
        }
      } else if (isModelToExternal) {
        // ModelReference -> ExternalReference
        // GlobalReference 제외하고 value가 입력된 경우만 확인창 띄움
        const hasOtherValues = Array.isArray(currentKeys) && currentKeys.some(k => k.type !== "GlobalReference" && k.value);
        if (hasOtherValues) {
            const confirmed = await confirmSave("ExternalReference로 변경하면 기존에 작성된 하위 경로(SubmodelElement 등)가 삭제되고 GlobalReference 형식으로 초기화됩니다. 계속하시겠습니까?", { labels: { confirm: "확인", cancel: "취소" } });
            if (!confirmed) {
              setInnerState((prev: any) => ({ ...prev, [stateKey]: innerState[stateKey] }));
              return;
            }
        }

        // 데이터 초기화: ExternalReference 기본값으로 설정
        const newKeys = [{ type: "GlobalReference", value: "" }];
        setInnerState((prev: any) => ({ ...prev, [stateKey]: val, [keysPath]: newKeys }));
        if (onValueChange) {
            onValueChange(stateKey, val);
            onValueChange(keysPath, newKeys);
        }
        state[stateKey] = val;
        state[keysPath] = newKeys;
      } else {
        // Fallback for other types
        setInnerState((prev: any) => ({
          ...prev,
          [stateKey]: val,
        }));
        if (onValueChange) {
          onValueChange(stateKey, val);
        }
        state[stateKey] = val;
      }
    };

    return (
      <div
        style={{
          paddingLeft: `calc(2rem * ${indent})`,
          whiteSpace: "pre-wrap",
        }}
      >
        {filteredEntries
          .filter(([k, v]) => {
            // valuePath는 항상 숨깁니다.
            if (k === "valuePath") return false;

            // 그 외 기본 필터링 조건
            return (
              k !== "children" &&
              k !== "label" &&
              k !== "modelType" &&
              k !== "AssetAdministrationShell" &&
              // Submodel의 value는 submodelElements를 가리키는 배열이므로, 상세 보기에서 혼동을 주지 않기 위해 제외합니다.
              !(obj.modelType === "Submodel" && k === "value") &&
              k !== "Submodel"
            );
          })
          // .sort() 라인을 대체합니다
          .sort((a, b) => {
            // 필드 순서를 직접 정의합니다.
            const fieldOrder = [
              "idShort",
              "valueType",
              "originalValue",
              "id",
              
              //"value",
              
              "min",
              "max",
              "first",
              "second",
              "contentType",
              "entityType",
              "globalAssetId",
              "kind",
              "description",
              "semanticId",
              // --- 기타 필드 (순서대로 추가) ---
              "isCaseOf",
              "embeddedDataSpecifications",
              "assetInformation",
              "statements",
              "submodels",
               
              "type",
              "keys" 
            ];

            const keyA = a[0]; // a[0]는 'key'입니다.
            const keyB = b[0]; // b[0]는 'key'입니다.

            const indexA = fieldOrder.indexOf(keyA);
            const indexB = fieldOrder.indexOf(keyB);

            // 두 키 모두 fieldOrder에 있는 경우, 해당 순서대로 정렬
            if (indexA !== -1 && indexB !== -1) {
              return indexA - indexB;
            }
            
            // 한쪽만 fieldOrder에 있는 경우, 있는 쪽이 먼저 오도록
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;

            // 둘 다 fieldOrder에 없는 경우, 기존 순서(알파벳순) 유지
            return keyA.localeCompare(keyB);
          })
          .map(([key, value], index) => {
            const parentKey = obj.valuePath ?? obj.value ?? '';
            const stateKey = parentKey ? `${parentKey}.${key}` : key;
            // 'description' 필드를 항상 langStrings 배열로 렌더링하기 위해
            // 값이 문자열이나 null일 경우 렌더링용 배열로 정규화합니다.
            let renderValue = value;
            if (key === "description" && !Array.isArray(value)) {
              renderValue = [{ 
                language: 'en', 
                // 값이 문자열이면 해당 값을, 아니면 빈 문자열을 text로 사용합니다.
                text: typeof value === 'string' ? value : '' 
              }];
            }
            const isAasId = parentKey === "assetAdministrationShells[0]" && key === "id";
            const isSubmodelId = typeof parentKey === 'string' && parentKey.startsWith("submodels[") && key === "id";
            const isSemanticIdValue = stateKey.endsWith("semanticId.keys[0].value");
            const isFileElement = obj.modelType === "File";
            const isFileValueField = isFileElement && key === "originalValue";
            const isRangeMin = obj.modelType === "Range" && key === "min";
            const isRangeMax = obj.modelType === "Range" && key === "max";
            const isValueTypeElement = obj.modelType === "Property" || obj.modelType === "Range";
            const isValueTypeTargetField = isValueTypeElement && (key === "originalValue" || key === "min" || key === "max");

            // semanticId 내부 필드인지 확인하는 변수 추가
            // stateKey (e.g., "...semanticId.keys[0].value")에 ".semanticId."가 포함되어 있는지 확인
            const isInsideSemanticId = stateKey.includes(".semanticId.");

            // description 필드 편집 가능 여부 결정
            const isDescriptionField = key === "description";
            const isSmcOrSml = obj.modelType === "SubmodelElementCollection" || obj.modelType === "SubmodelElementList";
            const canEditDescription = isDescriptionField && !isSmcOrSml;

            // Submodel ID는 수정 불가능하게 유지하고, semanticId.keys[0].value는 수정 가능하게 합니다.
            let tempEditMode = editMode ? (!isSubmodelId || isSemanticIdValue) : false;

            const currentValueType =
              innerState[`${parentKey}.valueType`] ??
              state[`${parentKey}.valueType`] ??
              obj.valueType;
            const valueTypeRule = isValueTypeTargetField
              ? getDataTypeDefXsdRule(currentValueType)
              : undefined;
            const currentFieldValue = innerState[stateKey] ?? value ?? "";
            const fieldError = errors?.[getErrorPath(stateKey, errorPathPrefix)];
            const filteredValueTypeOptions = DataTypeDefXsdOptionItems.filter((item) =>
              item.label.toLowerCase().includes(valueTypeSearch.trim().toLowerCase())
            );

            // input field 스타일링 로직 
            const inputStyle: React.CSSProperties = {};
            if ((isInsideSemanticId && !isSemanticIdValue) || (isFileElement && key === "contentType")) {
              inputStyle.color = "#b3bec7ff"; // 기존 read-only 필드
            } else if (key === "originalValue") {
              // originalValue 필드 하이라이트
              inputStyle.borderColor = "var(--mantine-color-blue-6)";
              inputStyle.borderWidth = "1.5px";
              inputStyle.boxShadow = "0 0 4px var(--mantine-color-blue-2)";
            }

            // UI 표시용 키 이름 설정 (originalValue -> value)
            let displayLabel = key;
            if (key === "originalValue") {
              displayLabel = "value";
            }

            // MultiLanguageProperty 전용 UI 로직
            if (
              obj.modelType === "MultiLanguageProperty" &&
              (key === "value" || key === "originalValue")
            ) {
              // 값이 배열이 아니면 빈 배열로 초기화 (안전장치)
              // innerState에 있는 값이 최신이므로 우선 사용
              const currentValue = innerState[stateKey] ?? value;
              const mlpValue = Array.isArray(currentValue) ? currentValue : [];

              return (
                <React.Fragment key={`${key}-${index}`}>
                   <Group w={"100%"} py="4" justify="space-between" wrap="nowrap" gap="xl">
                    <div style={{ width: "100%" }}>
                      {/* 라벨 및 추가 버튼 영역 */}
                      <Flex justify={"flex-start"} align={"center"} style={{ width: '100%', marginBottom: '8px' }}>
                        <div
                          style={{
                            backgroundColor: "#f9f9f9",
                            border: "1px solid #efefef",
                            borderRadius: "5px",
                            padding: "2px 5px 2px 15px",
                            marginRight: "10px",
                          }}
                        >
                          <Text className="fs-8" miw={"110px"}>{displayLabel}</Text>
                        </div>
                        
                        {/* 편집 모드일 때만 추가 버튼 표시 */}
                        {(tempEditMode || editMode) && (
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            title="Add Language"
                            onClick={() => {
                              // 빈 항목({ language: "en", text: "" }) 추가
                              const newValue = [...mlpValue, { language: "en", text: "" }];
                              setInnerState((prev: any) => ({ ...prev, [stateKey]: newValue }));
                              if (onValueChange) onValueChange(stateKey, newValue);
                            }}
                          >
                            <IconPlus size={14} />
                          </ActionIcon>
                        )}
                      </Flex>

                      {/* 언어별 입력 리스트 영역 */}
                      <Flex direction="column" gap="xs" w="100%">
                        {mlpValue.map((item: any, idx: number) => (
                          <Group key={idx} gap="xs" wrap="nowrap">
                             {/* 1. 언어 코드 입력 (Select 박스 사용) */}
                            <Select
                              id={`${stateKey}[${idx}].language`}
                              placeholder="Lang"
                              w={80}
                              data={industrialLanguages}
                              value={item.language || ""}
                              readOnly={!editMode}
                              disabled={!editMode}
                              onChange={(val) => {
                                const newValue = [...mlpValue];
                                newValue[idx] = { ...newValue[idx], language: val };
                                setInnerState((prev: any) => ({ ...prev, [stateKey]: newValue }));
                                if (onValueChange) onValueChange(stateKey, newValue);
                              }}
                            />
                            {/* 2. 텍스트 값 입력 */}
                            <TextInput
                              id={`${stateKey}[${idx}].text`}
                              placeholder="Text value"
                              style={{ flexGrow: 1 }}
                              value={item.text || ""}
                              readOnly={!editMode}
                              onChange={(e) => {
                                const newValue = [...mlpValue];
                                // 해당 인덱스의 text 값 업데이트
                                newValue[idx] = { ...newValue[idx], text: e.target.value };
                                setInnerState((prev: any) => ({ ...prev, [stateKey]: newValue }));
                                if (onValueChange) onValueChange(stateKey, newValue);
                              }}
                            />
                             {/* 3. 삭제 버튼 (편집 모드일 때만) */}
                            {editMode && (
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                size="sm"
                                title="Remove"
                                onClick={() => {
                                  // 해당 인덱스 항목 삭제
                                  const newValue = mlpValue.filter((_: any, i: number) => i !== idx);
                                  setInnerState((prev: any) => ({ ...prev, [stateKey]: newValue }));
                                  if (onValueChange) onValueChange(stateKey, newValue);
                                }}
                              >
                                <IconTrash size={14} />
                              </ActionIcon>
                            )}
                          </Group>
                        ))}
                        {/* 데이터가 없을 때 안내 문구 */}
                        {mlpValue.length === 0 && !editMode && (
                           <Text c="dimmed" size="xs" fs="italic" pl={1}>No values defined.</Text>
                        )}
                      </Flex>
                    </div>
                  </Group>
                </React.Fragment>
              );
            }
            
            // Reference.keys 전용 UI 로직
            if (key === "keys" && Array.isArray(value)) {
              const currentValue = innerState[stateKey] ?? value;
              const keysValue = Array.isArray(currentValue) ? currentValue : [];
              const isSemanticIdKeys = stateKey.includes("semanticId");
              const keyTypeInputStyle: React.CSSProperties = {
                width: "230px",
                color: "#b3bec7ff",
              };
              
              const typeKey = stateKey.replace(/\.keys$/, ".type");
              const currentType = innerState[typeKey] ?? renderableObj.type;
              const isExternalReference = currentType === "ExternalReference";

              return (
                <React.Fragment key={`${key}-${index}`}>
                  <Group w={"100%"} py="4" justify="space-between" wrap="nowrap" gap="xl">
                    <div style={{ width: "100%" }}>
                      <Title
                        order={3}
                        mb={"4"}
                        style={{
                          backgroundColor: "#fefefe",
                          border: "1px solid #efefef",
                          borderRadius: "5px",
                          padding: "5px 15px",
                          color: "#333",
                          fontSize: '14px',
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div>
                          <i
                            className="fa-regular fa-file-lines me-2"
                            style={{ color: "#ee8843" }}
                          ></i>{" "}
                          {displayLabel}
                        </div>

                        {/* 편집 모드이고 ModelReference 일 때만 새로고침 버튼 표시 */}
                        {!isSemanticIdKeys && (tempEditMode || editMode) && currentType === "ModelReference" && (
                          <ActionIcon
                            variant="light"
                            color="blue"
                            size="sm"
                            title="Refresh Key"
                            onClick={() => openReferenceModal(stateKey)}
                          >
                            <IconRefresh size={14} />
                          </ActionIcon>
                        )}
                      </Title>

                      {/* Key별 입력 리스트 영역 */}
                      <div>
                        <div
                          style={{
                            paddingLeft: `calc(1rem * ${indent + 1})`,
                            whiteSpace: "pre-wrap",
                            width: "100%",
                          }}
                        >
                        {keysValue.map((item: any, idx: number) => (
                          <Group key={idx} py="4" gap="xs" wrap="nowrap">
                            <input
                              type="text"
                              className="fs-8 form-control"
                              id={`${stateKey}[${idx}].type`}
                              value={item.type || ""}
                              readOnly
                              style={keyTypeInputStyle}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                              }}
                            />
                            <input
                              type="text"
                              className="fs-8 form-control"
                              id={`${stateKey}[${idx}].value`}
                              value={item.value || ""}
                              readOnly={!editMode || !isExternalReference}
                              style={{
                                ...((!editMode || !isExternalReference) ? { color: "#b3bec7ff" } : {}),
                                flexGrow: 1,
                              }}
                              onChange={(e) => {
                                const newValue = [...keysValue];
                                // 해당 인덱스의 value 값 업데이트
                                newValue[idx] = { ...newValue[idx], value: e.target.value };
                                setInnerState((prev: any) => ({ ...prev, [stateKey]: newValue }));
                                if (onValueChange) onValueChange(stateKey, newValue);
                              }}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                              }}
                            />
                          </Group>
                        ))}
                        {keysValue.length === 0 && !editMode && (
                          <Text c="dimmed" size="xs" fs="italic" pl={1}>No keys defined.</Text>
                        )}
                        </div>
                      </div>
                    </div>
                  </Group>
                </React.Fragment>
              );
            }
            
            

            return (
              <React.Fragment key={`${key}-${index}`}>
                <Group
                  w={"100%"}
                  py="4"
                  justify="space-between"
                  wrap="nowrap"
                  gap="xl"
                >
                  <div style={{ width: "100%" }}>
                    {/* 'description' 키를 'semanticId'와 동일하게 최우선으로 처리 ▼▼▼ */}
                    {key === "description" ? (
                      <div key={`${key}-${index}`} style={{ paddingLeft: `calc(1rem * ${indent})` }}>
                        <Title
                          order={3}
                          mb={"4"}
                          style={{
                            backgroundColor: "#fefefe",
                            border: "1px solid #efefef",
                            borderRadius: "5px",
                            padding: "5px 15px",
                            color: "#333",
                            fontSize: '14px',
                            cursor: "pointer", // 클릭 가능하도록 커서 변경
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                          onClick={() => setIsDescriptionExpanded(prev => !prev)} // 클릭 시 상태 토글
                        >
                          <div>
                            <i
                              className="fa-regular fa-file-lines me-2"
                              style={{ color: "#ecdd78" }} // description 아이콘
                            ></i>{" "}
                            {key}
                          </div>
                          {/* 화살표 아이콘 */}
                          <i 
                            className={`fa-solid ${isDescriptionExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}
                            style={{ fontSize: '12px', color: '#666' }}
                          ></i>
                        </Title>
                        
                        {/* description 내용 조건부 렌더링 */}
                        {isDescriptionExpanded && (
                          <> 
                            {/* 'renderValue'는 상단의 정규화 로직으로 항상 배열임 */}
                            {renderValue.map((item, itemIndex) => (
                              <div key={`${key}-${itemIndex}`}>
                                {typeof item === "object" ? (
                                  <RenderObject
                                    obj={{ ...item, valuePath: `${stateKey}[${itemIndex}]` }} 
                                    state={state}
                                    indent={indent + 1}
                                    onValueChange={onValueChange}
                                    editMode={tempEditMode || canEditDescription}
                                    isInstance={isInstance}
                                    instanceSeq={instanceSeq}
                                    treeData={treeData}
                                    fullState={fullState}
                                    errors={errors}
                                    errorPathPrefix={errorPathPrefix}
                                  />
                                ) : (
                                  item
                                )}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    ) : key === "semanticId" ? (
                      <div key={`${key}-${index}`} style={{ paddingLeft: `calc(1rem * ${indent})` }}>
                        <Title
                          order={3}
                          mb={"4"}
                          style={{
                            backgroundColor: "#fefefe",
                            border: "1px solid #efefef",
                            borderRadius: "5px",
                            padding: "5px 15px",
                            color: "#333",
                            fontSize: '14px',
                            cursor: "pointer", 
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                          onClick={() => setIsSemanticIdExpanded(prev => !prev)} 
                        >
                          <div>
                            <i
                              className="fa-regular fa-file-lines me-2"
                              style={{ color: "#ecdd78" }}
                            ></i>{" "}
                            {key}
                          </div>
                          <i 
                            className={`fa-solid ${isSemanticIdExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}
                            style={{ fontSize: '12px', color: '#666' }}
                          ></i>
                        </Title>
                        {isSemanticIdExpanded && (
                          <RenderObject
                            obj={{ 
                              type: "ExternalReference", 
                              keys: [{ type: "GlobalReference", value: "" }], 
                              ...(value || {}), 
                              valuePath: stateKey 
                            }}
                            state={state}
                            indent={indent + 1}
                            onValueChange={onValueChange}
                            editMode={tempEditMode || canEditDescription}
                            isInstance={isInstance}
                            instanceSeq={instanceSeq}
                            treeData={treeData}
                            fullState={fullState}
                            errors={errors}
                            errorPathPrefix={errorPathPrefix}
                          />
                        )}
                      </div>

                      ) : Array.isArray(renderValue) ? (
                      // description이 아닌 다른 배열의 렌더링 로직
                      <div>
                        <Title
                          order={3}
                          mb={"4"}
                          style={{
                            backgroundColor: "#fefefe",
                            border: "1px solid #efefef",
                            borderRadius: "5px",
                            padding: "5px 15px",
                            color: "#333",
                            fontSize:'14px'
                          }}
                        >
                          <i
                            className="fa-regular fa-file-lines me-2"
                            style={{ color: "#ee8843" }} // other array 아이콘
                          ></i>{" "}
                          {displayLabel}
                        </Title>
                        {renderValue.map((item, itemIndex) => (
                          <div key={`${key}-${itemIndex}`}>
                            {typeof item === "object" ? (
                              <RenderObject
                                obj={{ ...item, valuePath: `${stateKey}[${itemIndex}]` }} 
                                state={state}
                                indent={indent + 1}
                                onValueChange={onValueChange}
                                editMode={tempEditMode || canEditDescription}
                                isInstance={isInstance}
                                instanceSeq={instanceSeq}
                                treeData={treeData}
                                fullState={fullState}
                                errors={errors}
                                errorPathPrefix={errorPathPrefix}
                              />
                            ) : (
                              item
                            )}
                          </div>
                        ))}
                      </div>

                    // 'value'를 'renderValue'로 변경
                    ) : typeof renderValue === "object" && renderValue !== null ? ( 
                      <div key={`${key}-${index}`} style={{ paddingLeft: `calc(1rem * ${indent})` }}>
                        <Title
                          order={3}
                          mb={"4"}
                          style={{
                            backgroundColor: "#fefefe",
                            border: "1px solid #efefef",
                            borderRadius: "5px",
                            padding: "5px 15px",
                            color: "#333",
                            fontSize:'14px'
                          }}
                        >
                          <i
                            className="fa-regular fa-file-lines me-2"
                            style={{ color: "#ecdd78" }}
                          ></i>{" "}
                          {displayLabel}
                        </Title>
                        <RenderObject
                          //'value'를 'renderValue'로 변경
                          obj={{ ...renderValue, valuePath: stateKey }} 
                          state={state}
                          indent={indent + 1}
                          onValueChange={onValueChange}
                          editMode={tempEditMode || canEditDescription}
                          isInstance={isInstance}
                          instanceSeq={instanceSeq}
                          treeData={treeData}
                          fullState={fullState}
                          errors={errors}
                          errorPathPrefix={errorPathPrefix}
                        />
                      </div>
                    ) : (
                  <Flex justify={"flex-start"} align={"center"} style={{width: '100%'}}>
                    <div
                      style={{
                        backgroundColor: "#f9f9f9",
                        border: "1px solid #efefef",
                        borderRadius: "5px",
                        padding: "2px 5px 2px 15px",
                        marginRight: "10px",
                      }}
                    >
                      {/* key 대신 displayLabel 사용 */}
                      <Text className="fs-8" miw={"110px"}>
                        {displayLabel}
                      </Text>
                    </div>

                    {tempEditMode || canEditDescription ? (
                      // --- 편집 모드 ---
                      <Flex
                        style={{ width: "100%" }}
                        gap="xs"
                        direction={isFileValueField ? "row" : "column"}
                        align={isFileValueField ? "center" : undefined}
                      >
                        {key === "language" ? (
                          <Select
                            id={stateKey}
                            style={{ flexGrow: 1 }}
                            data={industrialLanguages}
                            value={innerState[stateKey] ?? value ?? ""}
                            onChange={(val) => {
                              setInnerState((prev: any) => ({
                                ...prev,
                                [stateKey]: val,
                              }));
                              if (onValueChange) {
                                onValueChange(stateKey, val);
                              }
                              state[stateKey] = val;
                            }}
                          />
                        ) : key === "valueType" ? (
                          <Combobox
                            store={valueTypeCombobox}
                            withinPortal={false}
                            onOptionSubmit={(val) => {
                              setValueTypeSearch(val);
                              setInnerState((prev: any) => ({
                                ...prev,
                                [stateKey]: val,
                              }));
                              if (onValueChange) {
                                onValueChange(stateKey, val);
                              }
                              state[stateKey] = val;
                              valueTypeCombobox.closeDropdown();
                            }}
                          >
                            <Combobox.Target>
                              <TextInput
                                id={stateKey}
                                style={{ flexGrow: 1 }}
                                value={innerState[stateKey] ?? value ?? ""}
                                onFocus={() => {
                                  setValueTypeSearch("");
                                }}
                                onClick={() => {
                                  setValueTypeSearch("");
                                  valueTypeCombobox.toggleDropdown();
                                }}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                  const nextValue = e.currentTarget.value;
                                  setValueTypeSearch(nextValue);
                                  setInnerState((prev: any) => ({
                                    ...prev,
                                    [stateKey]: nextValue,
                                  }));
                                  if (onValueChange) {
                                    onValueChange(stateKey, nextValue);
                                  }
                                  state[stateKey] = nextValue;
                                  
                                  valueTypeCombobox.openDropdown();
                                }}
                                onBlur={() => {
                                  valueTypeCombobox.closeDropdown();
                                }}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                }}
                                rightSection={<Combobox.Chevron />}
                              />
                            </Combobox.Target>

                            <Combobox.Dropdown>
                              <Combobox.Options mah={240} style={{ overflowY: "auto" }}>
                                {filteredValueTypeOptions.length > 0 && (
                                  filteredValueTypeOptions.map((item) => (
                                    <Combobox.Option value={item.value} key={item.value}>
                                      {item.label}
                                    </Combobox.Option>
                                  ))
                                )}
                              </Combobox.Options>
                            </Combobox.Dropdown>
                          </Combobox>
                        ) : valueTypeRule?.inputKind === "boolean" ? (
                          <Switch
                            id={stateKey}
                            checked={isBooleanLikeValue(currentFieldValue)}
                            onChange={(e) => {
                              const nextValue = e.currentTarget.checked ? "true" : "false";
                              setInnerState((prev: any) => ({
                                ...prev,
                                [stateKey]: nextValue,
                              }));
                              if (onValueChange) {
                                onValueChange(stateKey, nextValue);
                              }
                              state[stateKey] = nextValue;
                            }}
                            onLabel="true"
                            offLabel="false"
                            size="xl"
                            styles={{
                              root: { paddingTop: 6, paddingBottom: 6 },
                              track: { minWidth: 72, height: 36 },
                              thumb: { width: 28, height: 28 },
                              body: { alignItems: "center" },
                              labelWrapper: { fontSize: "14px" },
                            }}
                          />
                        ) : valueTypeRule?.inputKind === "date" ? (
                          <input
                            type="date"
                            className="fs-8 form-control"
                            id={stateKey}
                            value={toDateInputValue(currentFieldValue)}
                            onChange={(e) => {
                              setInnerState((prev: any) => ({
                                ...prev,
                                [stateKey]: e.target.value,
                              }));
                              if (onValueChange) {
                                onValueChange(e.target.id, e.target.value);
                              }
                              state[e.target.id] = e.target.value;
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                            style={inputStyle}
                          />
                        ) : valueTypeRule?.inputKind === "datetime-local" ? (
                          <input
                            type="datetime-local"
                            className="fs-8 form-control"
                            id={stateKey}
                            value={toDateTimeLocalValue(currentFieldValue)}
                            onChange={(e) => {
                              const nextValue = fromDateTimeLocalValue(e.target.value);
                              setInnerState((prev: any) => ({
                                ...prev,
                                [stateKey]: nextValue,
                              }));
                              if (onValueChange) {
                                onValueChange(e.target.id, nextValue);
                              }
                              state[e.target.id] = nextValue;
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                            style={inputStyle}
                          />
                        ) : key === "type" && obj.hasOwnProperty("keys") && !isInsideSemanticId ? (
                          <Select
                              id={stateKey}
                              style={{ flexGrow: 1 }}
                              data={ReferenceTypes}
                              value={innerState[stateKey] ?? value ?? ""}
                              onChange={(val) => handleReferenceTypeChange(val, stateKey)}
                            />
                        ) : key === "entityType" ? (
                          <Select
                            id={stateKey}
                            style={{ flexGrow: 1 }}
                            data={EntityTypes}
                            value={innerState[stateKey] ?? value ?? ""}
                            onChange={(val) => {
                              setInnerState((prev: any) => ({
                                ...prev,
                                [stateKey]: val,
                              }));
                              if (onValueChange) {
                                onValueChange(stateKey, val);
                              }
                              state[stateKey] = val;
                            }}
                          />
                        ) : stateKey.includes(".description[") && key === "text" ? (
                          <Textarea
                            id={stateKey}
                            autosize
                            minRows={3}
                            maxRows={8}
                            value={currentFieldValue}
                            placeholder="Description"
                            onChange={(e) => {
                              setInnerState((prev: any) => ({
                                ...prev,
                                [stateKey]: e.target.value,
                              }));
                              if (onValueChange) {
                                onValueChange(e.target.id, e.target.value);
                              }
                              state[e.target.id] = e.target.value;
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                            readOnly={isInsideSemanticId}
                            styles={{ input: inputStyle }}
                          />
                        ) : (
                          <input
                            type={valueTypeRule?.inputKind === "number" ? "number" : "text"}
                            className="fs-8 form-control"
                            id={stateKey}
                            value={currentFieldValue}
                            step={valueTypeRule?.step}
                            onChange={(e) => {
                              setInnerState((prev: any) => ({
                                ...prev,
                                [stateKey]: e.target.value,
                              }));
                              if (onValueChange) {
                                onValueChange(e.target.id, e.target.value);
                              }
                              state[e.target.id] = e.target.value;
                            }}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                            }}
                            // semanticId 내부 필드일 경우 readOnly 및 연한 글자색 적용
                            readOnly={isInsideSemanticId || (isFileElement && key === "contentType")}
                            style={inputStyle}
                          />
                        )}
                        {fieldError && (
                          <Text c="red" size="sm" fw={500}>
                            {fieldError}
                          </Text>
                        )}

                        {/* 'value' 필드일 때만 파일 컨트롤 표시 */}
                        {tempEditMode && isFileElement && key === "originalValue" && (
                          <>
                            <FilePreviewModal
                                opened={previewOpened}
                                onClose={closePreview}
                                fileUrl={previewFile?.url || ""}
                                fileType={previewFile?.type || ""}
                            />
                            {/* 파일 업로드 버튼 */}
                            <input
                              type="file"
                              className="fs-8 form-control"
                              style={{width: 'auto', flexGrow: 1}}
                              ref={fileInputRef}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file && onValueChange) {
                                  setUploadedFile(file); // Store file in dedicated state

                                  const fileKey = `${parentKey}.fileObject`; // Key for parent state
                                  const contentTypeKey = `${parentKey}.contentType`;
                                  const valueKey = stateKey; // current key (e.g., ...value)

                                  // 1. Tell parent about the file object
                                  onValueChange(fileKey, file, file); 
                                  // 2. Update content type in parent
                                  onValueChange(contentTypeKey, file.type);
                                  // 3. Update value (filename) in parent
                                  onValueChange(valueKey, file.name); 

                                  // Update UI immediately for filename and content type
                                  setInnerState((prev) => ({
                                    ...prev,
                                    [contentTypeKey]: file.type,
                                    [valueKey]: file.name,
                                  }));
                                }
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                            />
                            {/* 미리보기 버튼 */}
                            <Button
                              size="xs"
                              ml="xs"
                              style={{overflow:'inherit'}}
                              onClick={() => {
                                const fileValue = innerState[stateKey] ?? value;
                                const contentType = innerState[`${parentKey}.contentType`] ?? obj.contentType;
                                
                                if (uploadedFile instanceof File && PREVIEW_MIME_TYPES.includes(uploadedFile.type)) {
                                    setPreviewFile({ url: URL.createObjectURL(uploadedFile), type: uploadedFile.type });
                                    openPreview();
                                } else if (typeof fileValue === 'string' && contentType) {
                                    let finalUrl = fileValue;
                                    if (isInstance && instanceSeq) {
                                        if (finalUrl.includes('/aas_files/aas/') && !finalUrl.includes('/aas_files/aas/instance/')) {
                                            finalUrl = finalUrl.replace('/aas_files/aas/', '/aas_files/aas/instance/');
                                        } else if (!finalUrl.startsWith('http') && !finalUrl.startsWith('blob:') && !finalUrl.startsWith('/')) {
                                            const fileName = finalUrl.split('/').pop();
                                            finalUrl = `/aas_files/aas/instance/${instanceSeq}/${fileName}`;
                                        }
                                    }

                                    finalUrl = getCorrectedUrl(finalUrl);

                                    if (PREVIEW_MIME_TYPES.includes(contentType)) {
                                        setPreviewFile({ url: finalUrl, type: contentType });
                                        openPreview();
                                    } else {
                                        showToast.warning("미리보기를 지원하지 않는 파일 형식입니다.");
                                    }
                                } else {
                                    showToast.warning("미리보기를 지원하지 않는 파일 형식이거나 파일이 없습니다.");
                                }
                              }}
                            >
                              미리보기
                            </Button>
                          </>
                        )}
                      </Flex>
                    ) : (
                      // --- 뷰 모드 ---
                      <Flex justify="space-between" align="center" style={{width: '100%'}}>
                        <Text
                          fw={600}
                          className="fs-8"
                          style={{ paddingLeft: "5px", wordBreak: "break-all" }}
                        >
                          {innerState[stateKey] ?? value ?? ""} {/* value prop 단순화 */}
                        </Text>

                        {/* 뷰 모드 미리보기 버튼 */}
                        {isFileElement && key === "originalValue" && (
                          <>
                            <FilePreviewModal
                              opened={previewOpened}
                              onClose={closePreview}
                              fileUrl={previewFile?.url || ""}
                              fileType={previewFile?.type || ""}
                            />
                            <Button
                              size="xs"
                              ml="md"
                              onClick={() => {
                                let fileUrl = innerState[stateKey] ?? value;
                                const contentType = innerState[`${parentKey}.contentType`] ?? obj.contentType;

                                if (fileUrl && typeof fileUrl === 'string' && contentType) {
                                    let finalUrl = fileUrl;
                                    if (isInstance && instanceSeq) {
                                        if (finalUrl.includes('/aas_files/aas/') && !finalUrl.includes('/aas_files/aas/instance/')) {
                                            finalUrl = finalUrl.replace('/aas_files/aas/', '/aas_files/aas/instance/');
                                        } else if (!finalUrl.startsWith('http') && !finalUrl.startsWith('blob:') && !finalUrl.startsWith('/')) {
                                            const fileName = finalUrl.split('/').pop();
                                            finalUrl = `/aas_files/aas/instance/${instanceSeq}/${fileName}`;
                                        }
                                    }

                                    finalUrl = getCorrectedUrl(finalUrl);

                                    if (PREVIEW_MIME_TYPES.includes(contentType)) {
                                      setPreviewFile({ url: finalUrl, type: contentType });
                                      openPreview();
                                    } else {
                                      showToast.warning("미리보기를 지원하지 않는 파일 형식입니다.");
                                    }
                                } else {
                                  showToast.warning("미리보기를 지원하지 않는 파일 형식이거나 URL이 없습니다.");
                                }
                              }}
                            >
                              미리보기
                            </Button>
                          </>
                        )}
                      </Flex>
                    )}
                  </Flex>
                )}
                  </div>
                </Group>
               
              </React.Fragment>
            );
          })}
      </div>
    );
  }
);



// RenderNodeDetails: 노드의 상세 정보를 카드로 표시 (내부에서 RenderObject에 editMode 전달)
const RenderNodeDetails = memo(
  ({
    level,
    node,
    state,
    editMode,
    onValueChange,
    isInstance,
    instanceSeq,
    treeData,
    fullState,
    errors,
    errorPathPrefix,
  }: {
    level: number;
    node: any;
    state: any;
    editMode: boolean;
    onValueChange?: (key: string, value: any, file?: File) => void;
    isInstance?: boolean;
    instanceSeq?: string;
    treeData?: any;
    fullState?: any;
    errors?: ValidationErrors;
    errorPathPrefix?: string;
  }) => (
    <Card
      key={`${node.value}-${level}`}
      ml={`calc(3rem * ${level - 1})`}
      mb=""
      radius="md"
      padding="md"
      withBorder
      style={{
        borderColor: "#e6e6e6",
        borderWidth: "1px",
        backgroundColor: "#f1f1f1",
      }}
    >
      <Title
        order={3}
        mb={"sm"}
        style={{
          backgroundColor: "#fefefe",
          border: "1px solid #efefef",
          borderRadius: "5px",
          padding: "5px 15px",
          color: "#043b5fff",
          fontSize:'14px'
        }}
      >
        <i className="fa-regular fa-rectangle-list me-2"></i> {node.modelType}
      </Title>
      <RenderObject
        obj={node}
        state={state}
        editMode={editMode}
        onValueChange={onValueChange}
        isInstance={isInstance}
        instanceSeq={instanceSeq}
        treeData={treeData}
        fullState={fullState}
        errors={errors}
        errorPathPrefix={errorPathPrefix}
      />
    </Card>
  )
);

// RenderTreeNode: 개별 트리 노드를 렌더링, editMode 전달
const modelTypeToBadge = (
  modelType: string
): { label: string; color: string } => {
  switch (modelType) {
    case "AssetAdministrationShell":
      return { label: "AAS", color: "blue" };
    case "Submodel":
      return { label: "Submodel", color: "green" };
    case "Property":
      return { label: "PRO", color: "grape" };
    case "SubmodelElementCollection":
      return { label: "SMC", color: "violet" };
    case "SubmodelElementList":
      return { label: "SML", color: "indigo" };
    case "SubmodelElement":
      return { label: "SME", color: "cyan" };
    case "MultiLanguageProperty":
      return { label: "MLPRO", color: "lime" };
    case "ConceptDescription":
      return { label: "CD", color: "yellow" };
    case "Entity":
      return { label: "Entity", color: "red" };
    case "RelationshipElement":
      return { label: "RE", color: "indigo" };
    default:
      return { label: modelType, color: "gray" };
  }
};

const RenderTreeNode = memo(
  ({
    level,
    node,
    expanded,
    elementProps,
    state,
    editMode,
    onValueChange,
    onNodeClick,
    simpleView,
    onAdd,
    onDelete,
    onCopy,
    onPaste,
    copiedElement,
    onReorder,
    onDragStartNode,
    onDragEndNode,
    getDraggedNode,
    isDragging,
    overNodePath,
    setOverNodePath,
    dropPosition,
    setDropPosition,
    isInstance,
    instanceSeq,
    treeData,
    fullState,
    errors,
    errorPathPrefix,
  }: {
    level: number;
    node: any;
    expanded: boolean;
    elementProps: any;
    state: any;
    editMode: boolean;
    onValueChange?: (key: string, value: any, file?: File) => void;
    onNodeClick?: (node: any) => void;
    simpleView?: boolean;
    onAdd?: (node: any, elementType: string, idShort: string) => void;
    onDelete?: (node: any) => void;
    onCopy?: (node: any) => void;
    onPaste?: (targetNode: any) => void;
    copiedElement?: any;
    onReorder?: (dragNode: any, dropNode: any, position: "top" | "bottom") => void;
    onDragStartNode?: (node: any) => void;
    onDragEndNode?: () => void;
    getDraggedNode?: () => any;
    isDragging: boolean;
    overNodePath: string | null;
    setOverNodePath: (path: string | null) => void;
    dropPosition: "top" | "bottom" | null;
    setDropPosition: (pos: "top" | "bottom" | null) => void;
    isInstance?: boolean;
    instanceSeq?: string;
    treeData?: any;
    fullState?: any;
    errors?: ValidationErrors;
    errorPathPrefix?: string;
  }) => {
    const badgeProps = modelTypeToBadge(node.modelType);
    const nodeErrorCount = getNodeErrorCount(node, errors, errorPathPrefix);
    const rectRef = useRef<DOMRect | null>(null);

    const canHaveChildren = [
      "Submodel",
      "SubmodelElementCollection",
      "SubmodelElementList",
      "Entity",
    ].includes(node.modelType);

    const isDeletable =
      node.valuePath && !node.valuePath.startsWith("assetAdministrationShells");

    //const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    // ConceptDescription은 'children' 배열이 없어도 상세 정보를 펼칠 수 있어야 합니다.
    //const hasPropertiesToExpand = node.modelType === "ConceptDescription";
    // 'children'이 없는 리프 노드 중에서도 상세 정보를 펼쳐볼 수 있는 타입들을 정의합니다.
    const detailExpandableTypes = [
      "ConceptDescription",
      "Property",
      "MultiLanguageProperty",
      "Range",
      "File",
      "ReferenceElement",
      "RelationshipElement",
    ];

    const hasPropertiesToExpand = detailExpandableTypes.includes(node.modelType);
    const hasActualChildren = Array.isArray(node.children) && node.children.length > 0;
    const isExpandable = hasActualChildren || hasPropertiesToExpand;
    const canReorder =
      editMode &&
      !!onReorder &&
      !!node.valuePath &&
      !node.valuePath.startsWith("assetAdministrationShells");
    const treeElementProps = _.omit(elementProps, ["onClick", "style"]);
    const dragProps: any = {
      draggable: canReorder,
      onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
        if (!canReorder) return;
        e.stopPropagation();
        onDragStartNode?.(node);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", node.valuePath);

        // 이전 커스텀 드래그 이미지 잔여물이 혹시 있다면 제거
        const existingDragImage = document.getElementById("aas-tree-drag-image");
        if (existingDragImage && existingDragImage.parentNode) {
          existingDragImage.parentNode.removeChild(existingDragImage);
        }

        // 커스텀 드래그 이미지 생성
        const dragImage = document.createElement("div");
        dragImage.id = "aas-tree-drag-image";
        dragImage.style.position = "absolute";
        dragImage.style.top = "-1000px";
        dragImage.style.left = "-1000px";
        dragImage.style.padding = "4px 10px";
        dragImage.style.background = "white";
        dragImage.style.border = "1.5px solid var(--mantine-color-blue-6)";
        dragImage.style.borderRadius = "6px";
        dragImage.style.display = "flex";
        dragImage.style.alignItems = "center";
        dragImage.style.gap = "8px";
        dragImage.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        dragImage.style.whiteSpace = "nowrap";
        dragImage.style.zIndex = "-1";

        dragImage.innerHTML = `
          <span style="
            background: var(--mantine-color-${badgeProps.color}-1);
            color: var(--mantine-color-${badgeProps.color}-7);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            border: 1px solid var(--mantine-color-${badgeProps.color}-2);
          ">${badgeProps.label}</span>
          <span style="
            font-size: 13px;
            font-weight: 600;
            color: #333;
          ">${node.idShort}</span>
        `;
        document.body.appendChild(dragImage);
        
        // 마우스 위치가 이미지의 중앙 근처에 오도록 설정
        e.dataTransfer.setDragImage(dragImage, 10, 15);
        
        // 드래그 시작 직후 이미지 제거 (브라우저가 이미지를 캡처한 후)
        setTimeout(() => {
          if (document.body.contains(dragImage)) {
            document.body.removeChild(dragImage);
          }
        }, 0);
      },
      onDragEnter: (e: React.DragEvent<HTMLDivElement>) => {
        if (!canReorder) return;
        rectRef.current = e.currentTarget.getBoundingClientRect();
      },
      onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
        const draggedNode = getDraggedNode?.();
        if (
          !canReorder ||
          !draggedNode ||
          draggedNode.valuePath === node.valuePath
        ) {
          return;
        }

        // 형제 노드인지 확인 (부모 경로 비교)
        const getParentPath = (path: string) => {
          const parts = _.toPath(path);
          return parts.length > 1 ? parts.slice(0, -1).join(".") : "";
        };

        if (getParentPath(draggedNode.valuePath) !== getParentPath(node.valuePath)) {
          return;
        }

        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        // 위치 계산 (상단/하단 절반 기준) - 캐싱된 rect 활용
        const rect = rectRef.current || e.currentTarget.getBoundingClientRect();
        if (!rectRef.current) {
          rectRef.current = rect;
        }
        const y = e.clientY - rect.top;
        const position = y < rect.height / 2 ? "top" : "bottom";
        
        if (overNodePath !== node.valuePath || dropPosition !== position) {
          setOverNodePath(node.valuePath);
          setDropPosition(position);
        }
      },
      onDragLeave: () => {
        rectRef.current = null;
        if (overNodePath === node.valuePath) {
          setOverNodePath(null);
          setDropPosition(null);
        }
      },
      onDrop: (e: React.DragEvent<HTMLDivElement>) => {
        rectRef.current = null;
        const draggedNode = getDraggedNode?.();
        const currentDropPos = dropPosition;
        setOverNodePath(null);
        setDropPosition(null);

        // 잔여 커스텀 드래그 이미지 안전 제거
        const dragImage = document.getElementById("aas-tree-drag-image");
        if (dragImage && dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage);
        }

        if (
          !canReorder ||
          !draggedNode ||
          draggedNode.valuePath === node.valuePath ||
          !currentDropPos
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        
        // dropPosition 정보를 함께 전달
        onReorder?.(draggedNode, node, currentDropPos);
        onDragEndNode?.();
      },
      onDragEnd: () => {
        rectRef.current = null;
        setOverNodePath(null);
        setDropPosition(null);

        // 잔여 커스텀 드래그 이미지 안전 제거
        const dragImage = document.getElementById("aas-tree-drag-image");
        if (dragImage && dragImage.parentNode) {
          dragImage.parentNode.removeChild(dragImage);
        }

        onDragEndNode?.();
      },
    };

    const isTarget = overNodePath === node.valuePath;

    return (
      <Box mb={"xs"} style={{ position: "relative" }}>
        {/* 삽입 가이드라인 (밑줄/윗줄) - 간격 중앙에 오도록 -6px 조정 */}
        {isTarget && (
          <Box
            style={{
              position: "absolute",
              left: level === 2 ? "0.2rem" : `calc(3rem * ${level - 2})`,
              right: 0,
              height: "3px",
              backgroundColor: "var(--mantine-color-blue-6)",
              zIndex: 10,
              top: dropPosition === "top" ? -6 : "auto",
              bottom: dropPosition === "bottom" ? -6 : "auto",
              pointerEvents: "none",
            }}
          />
        )}
        <Group
          mh="100px"
          h={"auto"}
          mb="xs"
          pl={level === 2 ? "0.2rem" : `calc(3rem * ${level - 2})`}
          {...treeElementProps}
          {...dragProps}
          style={{
            ...elementProps.style,
            cursor: canReorder ? "grab" : undefined,
            borderRadius: 4,
          }}
        >
          <Flex 
            h="100%" 
            align="center" 
            gap="xs" 
            style={{ 
              width: '100%', 
              overflow: 'hidden',
              pointerEvents: isDragging ? 'none' : 'auto' 
            }}
          >
            <Box
              style={{ cursor: isExpandable ? 'pointer' : 'default', display: 'flex', alignItems: 'center' }}
              onClick={(e) => {
                if (isExpandable) {
                  elementProps.onClick(e);
                }
              }}
            >
              {level > 1 && <IconCurrencyLeu color="gray" />}
              {isExpandable ? ( 
                expanded ? (
                  <IconSquareRoundedMinus color="var(--mantine-color-blue-6)" />
                ) : (
                  <IconSquareRoundedPlus color="var(--mantine-color-blue-6)" />
                )
              ) : (
                <IconSquareRoundedMinus />
              )}
            </Box>
            
            <Box 
              h={"100%"} 
              className={treeNodeClass.item} 
              style={{ minWidth: 0, flexGrow: 1, cursor: 'pointer' }}
              onClick={() => {
                if (onNodeClick) {
                  onNodeClick(node);
                } else if (isExpandable) {
                  elementProps.onClick({} as any);
                }
              }}
            >
                {simpleView ? (
                  <Group gap="xs" ml={"xs"} style={{ flexWrap: "nowrap" }}>
                    <Badge
                      variant="light"
                      radius="sm"
                      size="sm"
                      color={badgeProps.color}
                      style={{ minWidth:'33px'}}
                    >
                      {badgeProps.label}
                    </Badge>
                    
                    <Text 
                      title={node.idShort} 
                      size="1.10rem"
                      fw={400} 
                      style={{ 
                          whiteSpace: "nowrap", 
                          overflow: "hidden", 
                          textOverflow: "ellipsis", 
                          flexGrow: 1, 
                          minWidth: 0,
                          lineHeight:'15px', 
                      }}
                      >
                      {node.idShort}
                    </Text>
                    {nodeErrorCount > 0 && (
                      <Badge color="red" variant="filled" radius="sm" size="sm">
                        {nodeErrorCount}
                      </Badge>
                    )}
                    
                  </Group>
                ) : (
                  <>
                    <Badge
                      className={treeNodeClass.modelType}
                      variant="light"
                      radius="sm"
                      size="md"
                      ml={"xs"}
                      color={badgeProps.color}
                    >
                      {badgeProps.label}
                    </Badge>
                    <Text size="sm" fw={700} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {node.idShort}
                    </Text>
                    {nodeErrorCount > 0 && (
                      <Badge color="red" variant="filled" radius="sm" size="sm">
                        {nodeErrorCount}
                      </Badge>
                    )}
                    <Text
                      className={"fs-8"}
                      c={"gray.7"}
                      style={{
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {["SubmodelElementCollection", "SubmodelElementList"].includes(
                        node.modelType
                      ) ? (
                        `# of values: ${
                          Array.isArray(node.children) ? node.children.length : 0
                        }`
                      ) : node.modelType === "Property" ? (
                        //String(node.originalValue ?? node.value ?? "")
                        String(state?.[`${node.valuePath}.originalValue`] ?? node.originalValue ?? "")

                      ) : node.modelType === "RelationshipElement" ? (
                      //String(node.originalValue ?? "")
                      String(state?.[`${node.valuePath}.originalValue`] ?? node.originalValue ?? "")


                      ) : node.modelType === "MultiLanguageProperty" ? (
                        Array.isArray(node.originalValue) // .originalValue가 실제 값 배열을 담고 있습니다.
                          ? node.originalValue.map((v) => `[${v.language}] ${v.text}`).join(", ")
                          : String(node.originalValue ?? node.value ?? "")
                      ) : node.modelType === "File" ? (
                        typeof node.originalValue === 'string'
                            ? node.originalValue.split('/').pop() 
                            : String(node.originalValue ?? "")
                        ) : node.id}
                    </Text>
                  </>
                )}
              </Box>
              {editMode && (
                <Group gap={4}>
                  {node.modelType !== "Submodel" && isDeletable && onCopy && (
                    <Tooltip label="Copy Element">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopy(node);
                        }}>
                        <IconCopy size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}

                  {copiedElement && onPaste && canHaveChildren && (
                    <Tooltip label={`Paste '${copiedElement.idShort}'`}>
                      <ActionIcon
                        variant="subtle"
                        color="green"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPaste(node);
                        }}>
                        <IconCornerDownRight size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}

                  {onDelete && isDeletable && (
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const confirmed = await confirmSave(
                          `'${node.idShort}' 항목을 삭제하시겠습니까?`,
                          {
                            labels: { confirm: "삭제", cancel: "취소" },
                            confirmProps: { color: "red" },
                          }
                        );
                        if (confirmed) {
                          onDelete(node);
                        }
                      }}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Group>
              )}
              {editMode && onAdd && canHaveChildren && (
                <ElementAdd
                  onAdd={(elementType, idShort) => {
                    onAdd(node, elementType, idShort);
                  }}
                  // 모든 타입 추가 가능하도록 allowedTypes 제거
                />
              )}
            </Flex>
        </Group>
        {/* {expanded &&
          !simpleView &&
          ["AssetAdministrationShell", "Submodel", "ConceptDescription"].map(
            (type) =>
              type in node ? (
                <RenderNodeDetails
                  key={type}
                  level={level}
                  node={node[type]}
                  state={state}
                  editMode={editMode}
                  onValueChange={onValueChange}
                />
              ) : (
                ""
              )
          )} */}
          {/* 트리뷰 전체 상세보기로 전환 */}
        {expanded && !simpleView && (
          <RenderNodeDetails
            key={`${node.valuePath}-details`}
            level={level}
            node={node}
            state={state}
            editMode={editMode}
            onValueChange={onValueChange}
            isInstance={isInstance}
            instanceSeq={instanceSeq}
            treeData={treeData}
            fullState={fullState}
            errors={errors}
            errorPathPrefix={errorPathPrefix}
          />
        )}
      </Box>
    );
  }
);

// AASTree: Tree 컴포넌트를 감싸고, renderNode에 editMode 전달
interface AASTreeProps {
  data: any;
  treeDataRefCurrent?: any;
  editMode: boolean;
  onValueChange?: (key: string, value: any, file?: File) => void;
  onNodeClick?: (node: any) => void;
  simpleView?: boolean;
  onAdd?: (node: any, elementType: string, idShort: string) => void;
  onDelete?: (node: any, elementType: string) => void;
  onCopy?: (node: any) => void;
  onPaste?: (targetNode: any) => void;
  copiedElement?: any;
  onReorder?: (dragNode: any, dropNode: any, position: "top" | "bottom") => void;
  isInstance?: boolean;
  instanceSeq?: string;
  fullState?: any;
  errors?: ValidationErrors;
  errorPathPrefix?: string;
  [key: string]: any;
}

function AASTree({
  data,
  treeDataRefCurrent,
  editMode,
  onValueChange,
  onNodeClick,
  simpleView,
  onAdd,
  onDelete,
  onCopy,
  onPaste,
  copiedElement,
  onReorder,
  isInstance,
  instanceSeq,
  fullState,
  errors,
  errorPathPrefix,
  ...styleProps
}: AASTreeProps) {
  const tree = useTree({});
  const draggedNodeRef = useRef<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [overNodePath, setOverNodePath] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<"top" | "bottom" | null>(null);

  const dataWithUniqueIds = useMemo(() => {
    if (!data) return [];

    const injectUniqueId = (nodes: any[], parentUniqueId = ""): any[] => {
      return nodes.map((node, index) => {
        const id = node.id;
        const idShort = node.idShort;
        const currentUniqueId = id 
          ? id 
          : (parentUniqueId ? `${parentUniqueId}/${idShort || index}` : (idShort || node.valuePath || `node-${index}`));

        const updatedNode = {
          ...node,
          uniqueId: currentUniqueId,
        };

        if (Array.isArray(node.children)) {
          updatedNode.children = injectUniqueId(node.children, currentUniqueId);
        }

        return updatedNode;
      });
    };

    return injectUniqueId(data);
  }, [data]);

  useEffect(() => {
    if (data && data.length > 0 && data[0]?.value) {
      tree.expand(data[0].value);
    }

    // if (treeDataRefCurrent) {
    //   treeDataRefCurrent = {};
    // }
  }, [data, treeDataRefCurrent]);

  return (
    <Box {...styleProps}>
      <Tree
        mt="xs"
        data={dataWithUniqueIds}
        tree={tree}
        renderNode={(props: any) => (
          <RenderTreeNode
            {...props}
            key={`${props.node.uniqueId || props.node.valuePath || props.node.value}`}
            state={treeDataRefCurrent ?? {}}
            editMode={editMode}
            onValueChange={onValueChange}
            onNodeClick={onNodeClick}
            simpleView={simpleView}
            onAdd={onAdd}
            onDelete={onDelete}
            onCopy={onCopy}
            onPaste={onPaste}
            copiedElement={copiedElement}
            onReorder={onReorder}
            onDragStartNode={(node) => {
              draggedNodeRef.current = node;
              setIsDragging(true);
            }}
            onDragEndNode={() => {
              draggedNodeRef.current = null;
              setIsDragging(false);
              setOverNodePath(null);
              setDropPosition(null);
            }}
            getDraggedNode={() => draggedNodeRef.current}
            isDragging={isDragging}
            overNodePath={overNodePath}
            setOverNodePath={setOverNodePath}
            dropPosition={dropPosition}
            setDropPosition={setDropPosition}
            isInstance={isInstance}
            instanceSeq={instanceSeq}
            treeData={data}
            fullState={fullState}
            errors={errors}
            errorPathPrefix={errorPathPrefix}
          />
        )}
      />
    </Box>
  );
}

export default memo(AASTree);
