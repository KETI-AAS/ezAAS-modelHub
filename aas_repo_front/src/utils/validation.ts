import _ from "lodash";
import { DataTypeDefXsdValues } from "@/constants/aasConstants";

export type ValidationErrors = Record<string, string>;

const DATA_TYPE_DEF_XSD_SET = new Set<string>(DataTypeDefXsdValues);

const URI_REGEX = /^(?:[a-zA-Z][a-zA-Z\d+\-.]*:|\/|\.{1,2}\/|#|\?)[^\s]*$/;
const BASE64_BINARY_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})?$/;
const DURATION_REGEX =
  /^-?P(?=\d|T\d)(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;
const GDAY_REGEX = /^---(0[1-9]|[12]\d|3[01])$/;
const GMONTH_REGEX = /^--(0[1-9]|1[0-2])$/;
const GMONTHDAY_REGEX = /^--(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const GYEAR_REGEX = /^-?\d{4,}$/;
const GYEARMONTH_REGEX = /^-?\d{4,}-(0[1-9]|1[0-2])$/;
const HEX_BINARY_REGEX = /^(?:[0-9a-fA-F]{2})*$/;
const INTEGER_REGEX = /^[+\-]?\d+$/;
const DECIMAL_REGEX = /^[+\-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+\-]?\d+)?$/;
const TIME_REGEX = /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+\-]\d{2}:\d{2})?$/;

const addError = (errors: ValidationErrors, path: string, message: string) => {
  if (!path || errors[path]) {
    return;
  }

  errors[path] = message;
};

const validateLength = (
  value: unknown,
  min: number,
  max: number,
  emptyMessage: string,
  rangeMessage: string
) => {
  if (typeof value !== "string") {
    return emptyMessage;
  }

  const trimmedValue = value.trim();
  if (trimmedValue.length < min) {
    return emptyMessage;
  }

  if (trimmedValue.length > max) {
    return rangeMessage;
  }

  return undefined;
};

const validateMaxLength = (value: unknown, max: number, rangeMessage: string) => {
  if (value == null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return value.length > max ? rangeMessage : undefined;
};

const parseComparableValue = (valueType: string, value: unknown) => {
  if (value == null || value === "") {
    return undefined;
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return undefined;
  }

  switch (valueType) {
    case "xs:byte":
    case "xs:int":
    case "xs:integer":
    case "xs:long":
    case "xs:negativeInteger":
    case "xs:nonNegativeInteger":
    case "xs:nonPositiveInteger":
    case "xs:positiveInteger":
    case "xs:short":
    case "xs:unsignedByte":
    case "xs:unsignedInt":
    case "xs:unsignedLong":
    case "xs:unsignedShort":
      return INTEGER_REGEX.test(stringValue) ? Number(stringValue) : undefined;
    case "xs:decimal":
    case "xs:double":
    case "xs:float":
      return DECIMAL_REGEX.test(stringValue) ? Number(stringValue) : undefined;
    case "xs:date":
      return DATE_REGEX.test(stringValue)
        ? new Date(stringValue).getTime()
        : undefined;
    case "xs:dateTime":
      return DATETIME_REGEX.test(stringValue)
        ? new Date(stringValue).getTime()
        : undefined;
    case "xs:time":
      return TIME_REGEX.test(stringValue)
        ? new Date(`1970-01-01T${stringValue}`).getTime()
        : undefined;
    default:
      return undefined;
  }
};

const isBigIntInRange = (value: string, min?: bigint, max?: bigint) => {
  try {
    const parsedValue = BigInt(value);
    if (min != null && parsedValue < min) {
      return false;
    }
    if (max != null && parsedValue > max) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

const normalizeBooleanScalar = (value: unknown) => {
  if (value === true || value === "true" || value === 1 || value === "1") {
    return "true";
  }

  if (value === false || value === "false" || value === 0 || value === "0") {
    return "false";
  }

  return value;
};

const normalizeBooleanValues = (node: unknown) => {
  if (!node || typeof node !== "object") {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach(normalizeBooleanValues);
    return;
  }

  const objectNode = node as Record<string, unknown>;

  if (objectNode.valueType === "xs:boolean") {
    if ("value" in objectNode) {
      objectNode.value = normalizeBooleanScalar(objectNode.value);
    }
    if ("originalValue" in objectNode) {
      objectNode.originalValue = normalizeBooleanScalar(objectNode.originalValue);
    }
    if ("min" in objectNode) {
      objectNode.min = normalizeBooleanScalar(objectNode.min);
    }
    if ("max" in objectNode) {
      objectNode.max = normalizeBooleanScalar(objectNode.max);
    }
  }

  Object.values(objectNode).forEach((value) => {
    if (value && typeof value === "object") {
      normalizeBooleanValues(value);
    }
  });
};

const validateByDataType = (valueType: unknown, value: unknown) => {
  if (value == null || value === "") {
    return undefined;
  }

  const stringValue = String(value).trim();
  if (!stringValue) {
    return undefined;
  }

  switch (valueType) {
    case "xs:anyURI":
      return URI_REGEX.test(stringValue)
        ? undefined
        : "RFC 3986 형식의 URI를 입력해주세요.";
    case "xs:base64Binary":
      return BASE64_BINARY_REGEX.test(stringValue)
        ? undefined
        : "base64Binary 형식으로 입력해주세요.";
    case "xs:boolean":
      return ["true", "false"].includes(stringValue)
        ? undefined
        : "true 또는 false만 입력해주세요.";
    case "xs:byte":
      return isBigIntInRange(stringValue, BigInt(-128), BigInt(127))
        ? undefined
        : "xs:byte 범위(-128~127)로 입력해주세요.";
    case "xs:date":
      return DATE_REGEX.test(stringValue)
        ? undefined
        : "YYYY-MM-DD 형식으로 입력해주세요.";
    case "xs:dateTime":
      return DATETIME_REGEX.test(stringValue)
        ? undefined
        : "YYYY-MM-DDThh:mm:ss 형식으로 입력해주세요.";
    case "xs:decimal":
      return DECIMAL_REGEX.test(stringValue)
        ? undefined
        : "소수 형식으로 입력해주세요.";
    case "xs:duration":
      return DURATION_REGEX.test(stringValue)
        ? undefined
        : "ISO 8601 duration 형식으로 입력해주세요.";
    case "xs:gDay":
      return GDAY_REGEX.test(stringValue)
        ? undefined
        : "---DD 형식으로 입력해주세요.";
    case "xs:gMonth":
      return GMONTH_REGEX.test(stringValue)
        ? undefined
        : "--MM 형식으로 입력해주세요.";
    case "xs:gMonthDay":
      return GMONTHDAY_REGEX.test(stringValue)
        ? undefined
        : "--MM-DD 형식으로 입력해주세요.";
    case "xs:gYear":
      return GYEAR_REGEX.test(stringValue)
        ? undefined
        : "YYYY 형식으로 입력해주세요.";
    case "xs:gYearMonth":
      return GYEARMONTH_REGEX.test(stringValue)
        ? undefined
        : "YYYY-MM 형식으로 입력해주세요.";
    case "xs:hexBinary":
      return HEX_BINARY_REGEX.test(stringValue)
        ? undefined
        : "짝수 길이의 16진수 문자열만 입력할 수 있습니다.";
    case "xs:int":
      return isBigIntInRange(stringValue, BigInt(-2147483648), BigInt(2147483647))
        ? undefined
        : "xs:int 범위로 입력해주세요.";
    case "xs:integer":
      return INTEGER_REGEX.test(stringValue)
        ? undefined
        : "정수만 입력해주세요.";
    case "xs:long":
      return isBigIntInRange(
        stringValue,
        BigInt("-9223372036854775808"),
        BigInt("9223372036854775807")
      )
        ? undefined
        : "xs:long 범위로 입력해주세요.";
    case "xs:negativeInteger":
      return isBigIntInRange(stringValue) && BigInt(stringValue) < BigInt(0)
        ? undefined
        : "0보다 작은 정수만 입력해주세요.";
    case "xs:nonNegativeInteger":
      return isBigIntInRange(stringValue) && BigInt(stringValue) >= BigInt(0)
        ? undefined
        : "0 이상 정수만 입력해주세요.";
    case "xs:nonPositiveInteger":
      return isBigIntInRange(stringValue) && BigInt(stringValue) <= BigInt(0)
        ? undefined
        : "0 이하 정수만 입력해주세요.";
    case "xs:positiveInteger":
      return isBigIntInRange(stringValue) && BigInt(stringValue) > BigInt(0)
        ? undefined
        : "0보다 큰 정수만 입력해주세요.";
    case "xs:short":
      return isBigIntInRange(stringValue, BigInt(-32768), BigInt(32767))
        ? undefined
        : "xs:short 범위(-32768~32767)로 입력해주세요.";
    case "xs:time":
      return TIME_REGEX.test(stringValue)
        ? undefined
        : "hh:mm:ss 형식으로 입력해주세요.";
    case "xs:unsignedByte":
      return isBigIntInRange(stringValue, BigInt(0), BigInt(255))
        ? undefined
        : "xs:unsignedByte 범위(0~255)로 입력해주세요.";
    case "xs:unsignedInt":
      return isBigIntInRange(stringValue, BigInt(0), BigInt("4294967295"))
        ? undefined
        : "xs:unsignedInt 범위로 입력해주세요.";
    case "xs:unsignedLong":
      return isBigIntInRange(
        stringValue,
        BigInt(0),
        BigInt("18446744073709551615")
      )
        ? undefined
        : "xs:unsignedLong 범위로 입력해주세요.";
    case "xs:unsignedShort":
      return isBigIntInRange(stringValue, BigInt(0), BigInt(65535))
        ? undefined
        : "xs:unsignedShort 범위(0~65535)로 입력해주세요.";
    case "xs:double":
    case "xs:float":
      return DECIMAL_REGEX.test(stringValue)
        ? undefined
        : "숫자 형식으로 입력해주세요.";
    default:
      return undefined;
  }
};

const walkNode = (node: unknown, path: string, errors: ValidationErrors) => {
  if (!node || typeof node !== "object") {
    return;
  }

  const objectNode = node as Record<string, unknown>;

  if ("idShort" in objectNode) {
    const idShortMessage = validateLength(
      objectNode.idShort,
      1,
      128,
      "idShort는 1자 이상 입력해주세요.",
      "idShort는 128자 이하로 입력해주세요."
    );
    if (idShortMessage) {
      addError(errors, `${path}.idShort`, idShortMessage);
    }
  }

  if (Array.isArray(objectNode.description)) {
    objectNode.description.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        return;
      }

      const textPath = `${path}.description[${index}].text`;
      const textMessage = validateMaxLength(
        (item as Record<string, unknown>).text,
        1023,
        "description은 1023자 이하로 입력해주세요."
      );

      if (textMessage) {
        addError(errors, textPath, textMessage);
      }
    });
  }

  if (typeof objectNode.valueType === "string") {
    if ("originalValue" in objectNode && !Array.isArray(objectNode.originalValue)) {
      const message = validateByDataType(objectNode.valueType, objectNode.originalValue);
      if (message) {
        addError(errors, `${path}.originalValue`, message);
      }
    }

    if ("min" in objectNode) {
      const minMessage = validateByDataType(objectNode.valueType, objectNode.min);
      if (minMessage) {
        addError(errors, `${path}.min`, minMessage);
      }
    }

    if ("max" in objectNode) {
      const maxMessage = validateByDataType(objectNode.valueType, objectNode.max);
      if (maxMessage) {
        addError(errors, `${path}.max`, maxMessage);
      }
    }

    if ("min" in objectNode && "max" in objectNode) {
      const minValue = parseComparableValue(objectNode.valueType, objectNode.min);
      const maxValue = parseComparableValue(objectNode.valueType, objectNode.max);

      if (
        minValue != null &&
        maxValue != null &&
        minValue > maxValue
      ) {
        addError(errors, `${path}.max`, "max는 min보다 크거나 같아야 합니다.");
      }
    }
  }

  if (objectNode.modelType === "Property" || objectNode.modelType === "Range") {
    const valueTypePath = `${path}.valueType`;
    const valueType = objectNode.valueType;
    const normalizedValueType =
      typeof valueType === "string" ? valueType.trim() : "";

    if (!normalizedValueType) {
      addError(errors, valueTypePath, "valueType은 필수입니다.");
    } else if (!DATA_TYPE_DEF_XSD_SET.has(normalizedValueType)) {
      addError(errors, valueTypePath, "DataTypeDefXsds에 정의된 valueType만 사용할 수 있습니다.");
    }
  }

  Object.entries(objectNode).forEach(([key, value]) => {
    if (!value || typeof value !== "object") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        walkNode(item, `${path}.${key}[${index}]`, errors);
      });
      return;
    }

    walkNode(value, `${path}.${key}`, errors);
  });
};

export const validateAasMetadata = (metadata: unknown) => {
  const errors: ValidationErrors = {};

  if (!metadata || typeof metadata !== "object") {
    return errors;
  }

  const objectMetadata = metadata as Record<string, unknown>;

  Object.entries(objectMetadata).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        walkNode(item, `${key}[${index}]`, errors);
      });
      return;
    }

    if (value && typeof value === "object") {
      walkNode(value, key, errors);
    }
  });

  return errors;
};

export const mergeMetadataWithStagedChanges = (
  metadata: unknown,
  stagedChanges: Record<string, Record<string, unknown>> = {}
) => {
  const mergedMetadata = _.cloneDeep(metadata);

  Object.entries(stagedChanges).forEach(([rootKey, changes]) => {
    Object.entries(changes ?? {}).forEach(([path, value]) => {
      if (!path || path.endsWith(".fileObject") || value instanceof File) {
        return;
      }

      const fullPath =
        rootKey === "conceptDescriptions" && path.startsWith("[")
          ? `conceptDescriptions${path}`
          : path;

      _.set(mergedMetadata, fullPath, value);
    });
  });

  normalizeBooleanValues(mergedMetadata);

  return mergedMetadata;
};
