// src/api/index.ts
import { saveAs } from "file-saver";
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
import { AuthTokenData } from "@/types/auth";


export async function signUp(id: string, pw: string) {
  const url = "register";

  const options = {
    method: "POST",
    body: JSON.stringify({ id, pw }),
    headers: { "Content-Type": "application/json" },
  };
  return apiRequest({
    url,
    options,
    withToast: true,
    messages: {
      loading: "Signing up...",
    },
  });
}

export async function loginWithCredentials(
  id: string,
  pw: string
): Promise<AuthTokenData> {
  const url = "login";

  const options = {
    method: "POST",
    body: JSON.stringify({ id, pw }),
    headers: { "Content-Type": "application/json" },
  };
  return apiRequest({ url, options });
}

// 비밀번호 초기화 링크 전송
export async function sendPasswordResetEmail(
  email: string
): Promise<AuthTokenData> {
  const url = `password-reset/request?email=${email}`;

  return apiRequest({ url, withToast: true });
}

// 비밀번호 초기화 링크 전송
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<AuthTokenData> {
  const url = `password-reset`;

  const options = {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
    headers: { "Content-Type": "application/json" },
  };
  return apiRequest({ url, options, withToast: true });
}

export async function getModelList(params: GetModelListParams) {
  const url = `${params.modelType}/list/${params.pageNumber}/${params.pageSize}?${new URLSearchParams(params.searchParams).toString()}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function getModel(params: GetModelParams) {
  const url = `${params.modelType}/${encodeURIComponent(params.modelSeq)}`;
  return apiRequest({
    url,
    withToast: params.withToast,
  });
}

export async function getModelVersions(params: GetModelParams) {
  const url = `${params.modelType}/history/${encodeURIComponent(params.modelSeq)}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function verifyModel(params: VerifyModelParams) {
  const path = params.modelType === "aasmodel" ? "aasmodel-id" : "submodel-id";
  const paramKey =
    params.modelType === "aasmodel" ? "aasmodel_id" : "submodel_id";
  const url = `${params.modelType}/verify/${path}?${paramKey}=${encodeURIComponent(params.modelId)}`;
  return apiRequest({
    url,
    options: { method: "POST" },
    errorThrow: params.errorThrow,
    withToast: params.withToast,
  });
}

export async function importModel(params: ImportModelParams) {
  const formData = new FormData();
  formData.append("file", params.file);

  let url = `basyx/${params.modelType}/import`;

  url += `?id=${params.modelId != null ? encodeURIComponent(params.modelId) : ""}`;

  return apiRequest({
    url,
    options: { method: "POST", body: formData },
    withToast: true,
    errorThrow: true,
  });
}

export async function upsertModel(params: UpsertModelParams) {
  const url = `${params.modelType}/${params.status}/data`;
  return apiRequest({
    url,
    options: { method: "POST", body: params.formData },
    withToast: params.withToast,
    errorThrow: params.errorThrow,
  });
}

export async function deleteModel(params: DeleteModelParams) {
  const url = `${params.modelType}/data?${params.modelType}_seq=${params.modelSeq}`;
  return apiRequest({
    url,
    options: {
      method: "DELETE",
    },
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

  let url = `basyx/${params.modelType}/download?format=${format}`;

  const blob = await apiRequest({
    url,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    responseType: "blob",
    withToast: true,
  });

  saveAs(blob, `${filename}.${format}`);
}

export async function getCodeList(type: string, withToast = false) {
  const url = `common/code/${type}`;
  return apiRequest({ url, withToast });
}

export async function getPublishedList(params: GetPublishedListParams) {
  const url = `published/list/${params.status}/${params.type}/${params.pageNumber}/${params.pageSize}?${new URLSearchParams(params.searchParams).toString()}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function getPublishedModel(params: GetPublishedModelParams) {
  const url = `published/${params.modelType}/${params.target_seq}`;
  return apiRequest({
    url,
    withToast: params.withToast,
  });
}

export async function getPublishedHistoryModel(
  params: GetPublishedModelParams
) {
  const url = `published/history/${params.modelType}/${params.target_seq}`;
  return apiRequest({
    url,
    withToast: params.withToast,
  });
}

export async function upsertPublishedModel(params: UpsertPublishedModelParams) {
  const url = `published/data`;
  return apiRequest({
    url,
    options: {
      method: params.method,
      body: JSON.stringify(params.body),
      headers: { "Content-Type": "application/json" },
    },
    withToast: params.withToast,
  });
}

export async function getPublishedCount() {
  const url = `published/count`;
  return apiRequest({ url });
}

export async function getInstanceTargetList(
  params: GetInstanceTargetListParams
) {
  const url = `instance/list/${params.modelType}/${params.category_seq}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function getInstanceList(params: GetInstanceListParams) {
  const url = `instance/list/${params.category_seq}/${params.pageNumber}/${params.pageSize}?${new URLSearchParams(params.searchParams).toString()}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function getInstance(params: GetInstanceParams) {
  const url = `instance/${params.instance_seq}`;
  return apiRequest({
    url,
    withToast: params.withToast,
  });
}

// 인스턴스 검증
export async function apiVerifyInstance(params: VerifyInstanceParams) {
  const url = `instance/verification`;
  return apiRequest({
    url,
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
  const url = `instance/data`;

  return apiRequest({
    url,
    options: {
      method: "POST",
      body: params.formData,
    },
    withToast: params.withToast,
    errorThrow: params.errorThrow,
  });
}

export async function getInstanceDetail(params: GetInstanceParams) {
  const url = `instance/detail/${params.instance_seq}`;
  return apiRequest({
    url,
    withToast: params.withToast,
  });
}

export async function getUserList(params: GetUserListParams) {
  const url = `user/list/${params.pageNumber}/${params.pageSize}?${new URLSearchParams(params.searchParams).toString()}`;
  return apiRequest({ url, withToast: params.withToast });
}

export async function getUser({ userSeq }: { userSeq: string }) {
  const url = `user/info/${userSeq}`;
  return apiRequest({ url });
}

export async function upsertUser(params: UpsertUserParams) {
  const url = `user/info`;
  return apiRequest({
    url,
    options: {
      method: "POST",
      body: JSON.stringify(params.body),
      headers: { "Content-Type": "application/json" },
    },
    withToast: params.withToast,
  });
}

// AAS Instance 서버 패키지 다운로드
export const downloadInstanceServer = async (instanceSeq: number | string) => {
  try {
    const url = `instance/server/${instanceSeq}`;
    const response = await apiRequest({
      url,
      withToast: true, // 로딩바 및 에러 토스트 자동 처리
    });

    if (response && response.result === 'ok') {
      const path = response.data.saved_path;
      // 성공 시 알림
      alert(`Server files created successfully!\nPath: ${path}`);
    } else {
      // 실패 시 알림
      if (response && response.msg) {
        // alert(`Failed: ${response.msg}`);
      }
    }
  } catch (error: any) {
    console.error("Server Create Error:", error);
    // apiRequest 내부에서 처리가 안 된 에러만 여기서 처리
    alert("An error occurred while creating server files.");
  }
};