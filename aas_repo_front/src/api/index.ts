import { apiRequest } from "@/app/apiRequest";
import type {
  GetModelListParams,
  GetModelParams,
  ImportModelParams,
  UpsertModelParams,
  ExportModelParams,
  GetPublishedListParams,
  GetPublishedModelParams,
  UpsertPublishedModelParams,
  GetInstanceListParams,
  GetInstanceParams,
  UpsertInstanceParams,
  GetInstanceTargetListParams,
  DeleteModelParams,
  VerifyModelParams,
  GetUserListParams,
  UpsertUserParams,
  VerifyInstanceParams,
} from "@/types/api";
import type { AuthTokenData } from "@/types/auth";

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUp(id: string, pw: string) {
  return apiRequest({
    url: "register",
    options: {
      method: "POST",
      body: JSON.stringify({ id, pw }),
      headers: { "Content-Type": "application/json" },
    },
    withToast: true,
    messages: { loading: "Signing up..." },
  });
}

export async function loginWithCredentials(
  id: string,
  pw: string
): Promise<AuthTokenData> {
  return apiRequest({
    url: "login",
    options: {
      method: "POST",
      body: JSON.stringify({ id, pw }),
      headers: { "Content-Type": "application/json" },
    },
  });
}

export async function sendPasswordResetEmail(email: string): Promise<AuthTokenData> {
  return apiRequest({
    url: `password-reset/request?email=${email}`,
    withToast: true,
  });
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<AuthTokenData> {
  return apiRequest({
    url: "password-reset",
    options: {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
      headers: { "Content-Type": "application/json" },
    },
    withToast: true,
  });
}

// ── Model ─────────────────────────────────────────────────────────────────────

export async function getModelList(params: GetModelListParams) {
  const query = params.searchParams
    ? new URLSearchParams(params.searchParams as Record<string, string>).toString()
    : "";
  const url = `${params.modelType}/list/${params.pageNumber}/${params.pageSize}${query ? `?${query}` : ""}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function getModel(params: GetModelParams) {
  return apiRequest({
    url: `${params.modelType}/${encodeURIComponent(params.modelSeq)}`,
    withToast: params.withToast,
  });
}

export async function getModelVersions(params: GetModelParams) {
  return apiRequest({
    url: `${params.modelType}/history/${encodeURIComponent(params.modelSeq)}`,
    withToast: params.withToast,
  });
}

export async function verifyModel(params: VerifyModelParams) {
  const path = params.modelType === "aasmodel" ? "aasmodel-id" : "submodel-id";
  const paramKey = params.modelType === "aasmodel" ? "aasmodel_id" : "submodel_id";
  return apiRequest({
    url: `${params.modelType}/verify/${path}?${paramKey}=${encodeURIComponent(params.modelId)}`,
    options: { method: "POST" },
    errorThrow: params.errorThrow,
    withToast: params.withToast,
  });
}

export async function importModel(params: ImportModelParams) {
  const formData = new FormData();
  formData.append("file", params.file);
  const url = `basyx/${params.modelType}/import?id=${params.modelId != null ? encodeURIComponent(params.modelId) : ""}`;
  return apiRequest({
    url,
    options: { method: "POST", body: formData },
    withToast: true,
    errorThrow: true,
  });
}

export async function upsertModel(params: UpsertModelParams) {
  return apiRequest({
    url: `${params.modelType}/${params.status}/data`,
    options: { method: "POST", body: params.formData },
    withToast: params.withToast,
    errorThrow: params.errorThrow,
  });
}

export async function deleteModel(params: DeleteModelParams) {
  return apiRequest({
    url: `${params.modelType}/data?${params.modelType}_seq=${params.modelSeq}`,
    options: { method: "DELETE" },
    withToast: true,
  });
}

export async function exportModel(params: ExportModelParams): Promise<void> {
  const format = params.format ?? "json";
  const filename = params.filename ?? params.modelType;
  const payload = {
    name: filename,
    source: "db",
    model_key: String(params.modelSeq),
    modelType: params.modelType,
  };
  const blob = await apiRequest({
    url: `basyx/${params.modelType}/download?format=${format}`,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    responseType: "blob",
    withToast: true,
  });
  const { saveAs } = await import("file-saver");
  saveAs(blob, `${filename}.${format}`);
}

// ── Code ──────────────────────────────────────────────────────────────────────

export async function getCodeList(type: string, withToast = false) {
  return apiRequest({ url: `common/code/${type}`, withToast });
}

// ── Published ─────────────────────────────────────────────────────────────────

export async function getPublishedList(params: GetPublishedListParams) {
  const query = params.searchParams
    ? new URLSearchParams(params.searchParams as Record<string, string>).toString()
    : "";
  const url = `published/list/${params.status}/${params.type}/${params.pageNumber}/${params.pageSize}${query ? `?${query}` : ""}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function getPublishedModel(params: GetPublishedModelParams) {
  return apiRequest({
    url: `published/${params.modelType}/${params.target_seq}`,
    withToast: params.withToast,
  });
}

export async function getPublishedHistoryModel(params: GetPublishedModelParams) {
  return apiRequest({
    url: `published/history/${params.modelType}/${params.target_seq}`,
    withToast: params.withToast,
  });
}

export async function upsertPublishedModel(params: UpsertPublishedModelParams) {
  return apiRequest({
    url: "published/data",
    options: {
      method: params.method,
      body: JSON.stringify(params.body),
      headers: { "Content-Type": "application/json" },
    },
    withToast: params.withToast,
  });
}

export async function getPublishedCount() {
  return apiRequest({ url: "published/count" });
}

// ── Instance ──────────────────────────────────────────────────────────────────

export async function getInstanceTargetList(params: GetInstanceTargetListParams) {
  return apiRequest({
    url: `instance/list/${params.modelType}/${params.category_seq}`,
    withToast: params.withToast,
  });
}

export async function getInstanceList(params: GetInstanceListParams) {
  const query = params.searchParams
    ? new URLSearchParams(params.searchParams as Record<string, string>).toString()
    : "";
  const url = `instance/list/${params.category_seq}/${params.pageNumber}/${params.pageSize}${query ? `?${query}` : ""}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function getInstance(params: GetInstanceParams) {
  return apiRequest({
    url: `instance/${params.instance_seq}`,
    withToast: params.withToast,
  });
}

export async function apiVerifyInstance(params: VerifyInstanceParams) {
  return apiRequest({
    url: "instance/verification",
    options: {
      method: "POST",
      body: JSON.stringify(params),
      headers: { "Content-Type": "application/json" },
    },
    withToast: true,
    errorThrow: true,
  });
}

export async function upsertInstance(params: UpsertInstanceParams) {
  return apiRequest({
    url: "instance/data",
    options: { method: "POST", body: params.formData },
    withToast: params.withToast,
    errorThrow: params.errorThrow,
  });
}

export async function getInstanceDetail(params: GetInstanceParams) {
  return apiRequest({
    url: `instance/detail/${params.instance_seq}`,
    withToast: params.withToast,
  });
}

// ── User ──────────────────────────────────────────────────────────────────────

export async function getUserList(params: GetUserListParams) {
  const query = params.searchParams
    ? new URLSearchParams(params.searchParams as Record<string, string>).toString()
    : "";
  const url = `user/list/${params.pageNumber}/${params.pageSize}${query ? `?${query}` : ""}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function getUser({ userSeq }: { userSeq: string }) {
  return apiRequest({ url: `user/info/${userSeq}` });
}

export async function upsertUser(params: UpsertUserParams) {
  return apiRequest({
    url: "user/info",
    options: {
      method: "POST",
      body: JSON.stringify(params.body),
      headers: { "Content-Type": "application/json" },
    },
    withToast: params.withToast,
  });
}
