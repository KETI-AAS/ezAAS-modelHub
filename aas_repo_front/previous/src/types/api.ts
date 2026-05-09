// src/types/api.ts

import { User } from "@/app/user/page";

export type ModelType = "aasmodel" | "submodel" | "instance";
export type StatusType = "temporary" | "draft" | "published" | "deprecated";

export interface GetModelListParams {
  modelType: ModelType;
  pageNumber: number;
  pageSize: number;
  searchParams?: {
    searchKey?: string;
    category_seq?: string;
    p?: "p";
  };
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface GetModelParams {
  modelType: ModelType;
  modelSeq: string;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface VerifyModelParams {
  modelType: ModelType;
  modelId: string;
  errorThrow?: boolean;
  withToast?: boolean;
}

export interface ImportModelParams {
  modelType: ModelType;
  file: File;
  modelId?: string;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface UpsertModelParams {
  modelType: ModelType;
  status: "temporary" | "draft";
  formData: FormData;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface ExportModelParams {
  modelType: ModelType;
  format?: "json" | "xml" | "aasx";
  modelSeq: string;
  filename?: string;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface DeleteModelParams {
  modelType: string;
  modelSeq: string;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface GetCodeListParams {
  type: string;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface GetPublishedModelParams {
  target_seq: string;
  modelType: "all" | ModelType;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface GetPublishedListParams {
  status: StatusType;
  type: "all" | ModelType;
  pageNumber: number;
  pageSize: number;
  searchParams?: Record<string, any>;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface UpsertPublishedModelParams {
  method: "POST" | "PUT";
  body: object;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface GetInstanceTargetListParams {
  category_seq: string;
  modelType: string;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface GetInstanceListParams {
  category_seq: string;
  pageNumber: number;
  pageSize: number;
  searchParams?: Record<string, any>;

  withToast?: boolean;
  errorThrow?: boolean;
}

export interface GetInstanceParams {
  instance_seq: string;

  withToast?: boolean;
  errorThrow?: boolean;
}

export interface InstanceSavePayload {
  instance_seq: string;
  instance_name: string;
  description: string;
  verification: string;
  aasmodel_seq: string;
  aasmodel_metadata: string;
  submodels: any[];
  status: string;
}

export interface VerifyInstanceParams {
  instance_seq: string;
  aasmodel: object;
  submodels: object[];
}

export interface UpsertInstanceParams {
  //body: InstanceSavePayload;
  formData: FormData; //2025.10.17 (File형식 대응)

  withToast?: boolean;
  errorThrow?: boolean;
}

export interface AASInstance {
  instance_seq: string;
  instance_name: string;
  description: string;
  verification: string;
  status: string;
  submodels: any[];

  aasmodel_seq: string;
  aasmodel_name: string;
  aasmodel_id: string;
  aasmodel_template_id: string;
  aasmodel_version: string;
  aasmodel_description: string;
  aasmodel_metadata: Record<string, any>;

  category_name: string;

  create_date: string;
  create_user_seq: string;
  last_mod_date: string;
  last_mod_user_seq: string;
}

export interface GetUserListParams {
  pageNumber: number;
  pageSize: number;
  searchParams?: Record<string, any>;
  withToast?: boolean;
  errorThrow?: boolean;
}

export interface UpsertUserParams {
  body: User;
  withToast?: boolean;
  errorThrow?: boolean;
}
