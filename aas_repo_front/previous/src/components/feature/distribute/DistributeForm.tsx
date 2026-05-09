// /app/register/RegisterForm.tsx
"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, Select } from "@mantine/core";
import toast from "react-hot-toast";
import _ from "lodash";
import {
  getCodeList,
  getPublishedList,
  getPublishedModel,
  upsertPublishedModel,
} from "@/api";
import { convertToSelectData, formatDateToDotYMD } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import {
  MantineReactTable,
  MRT_PaginationState,
  MRT_RowData,
  useMantineReactTable,
} from "mantine-react-table";
import { confirmSave } from "@/utils/modal";
import { ROUTES } from "@/constants/routes";
import CancelButton from "@/components/CancelButton";
import CustomCombobox from "@/components/CustomCombobox";
import DistributeDetailView from "./DistributeDetailView";
import { modals } from "@mantine/modals";
import { showToast } from "@/utils/toast";
import CategoryCombobox from "@/components/CategoryCombobox";

interface DistributeForm {
  mode?: "create" | "edit";
  model?: Model;
}

interface Model {
  Datalake_Seq_No: number;
  category_name: string;
  category_seq: number;
  create_date: string;
  create_user_seq: number;
  description: string;
  draft_user_nm: string;
  last_mod_date: string;
  last_mod_user_seq: number;
  published_user_nm: string;
  status: "draft" | "temporary" | "published" | string;
  target_id: string;
  target_name: string;
  target_seq: number;
  target_version: string | null;
  tmp_seman_id: string | null;
  ty: "aasmodel" | "submodel" | string;
  type: string | null;
  guide_filename?: string | null; 
  guide_realpath?: string | null;
}

const getModelState = (model: Model | undefined) => {
  return {
    target_name: model?.target_name ?? "",
    category_seq: model?.category_seq ? String(model?.category_seq) : "",
    // version: "",
    description: model?.description ?? "",
    status: model?.status ?? "",
  };
};

export default function DistributeForm({ mode, model }: DistributeForm) {
  const router = useRouter();

  //   모델 타입 조회
  const { data: modelTypes = [], isSuccess: isSuccessModelTypes } = useQuery({
    queryKey: ["common/code", "SYS200"],
    queryFn: () => getCodeList("SYS200"),
  });

  //   카테고리 목록 조회
  const { data: categorys = [], isSuccess: isSuccessCategorys } = useQuery({
    queryKey: ["common/code", "category"],
    queryFn: () => getCodeList("category"),
  });

  //   첫 번째 모델 선택
  const [modelType, setModelType] = useState("all");
  //   첫 번째 모델 선택

  // 배포항목 테이블 페이지네이션
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  //   배포정보 입력 상태
  const [state, setState] = useState(getModelState(model));

  //   배포항목 조회
  const { data: models, isFetching: isFetchingModels } = useQuery({
    queryKey: ["getPublishedList", modelType, pagination],
    queryFn: () =>
      getPublishedList({
        status: "draft",
        type: modelType,
        pageNumber: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        searchParams: {
          p: "p",
        },
      }),
    enabled: mode == "create",
  });

  const modelsData = models?.data ?? [];

  const table = useMantineReactTable({
    columns: [
      {
        accessorKey: "ty",
        header: "Model Type",
        size: 10,
        Cell: ({ cell }) => {
          return (
            <span
              className={`badge badge-light${cell.getValue() == "aasmodel" ? "-primary" : ""}  bage_body`}
            >
              {cell.getValue() == "aasmodel" ? "AAS" : "Submodel"}
            </span>
          );
        },
      },
      { accessorKey: "category_name", header: "Category", size: 10 },
      {
        accessorKey: "target_name",
        header: "Template Name",
        size: 10,
      },
      {
        accessorKey: "target_version",
        header: "VER",
        size: 10,
      },
      {
        accessorKey: "target_seq",
        header: "SEQ",
        size: 10,
      },
      {
        accessorKey: "externalButtons",
        header: "Select",
        size: 10,
        Cell: ({ row }) => (
          <Button
            size="xs"
            onClick={() =>
              onSelectModel(row.original.ty, row.original["target_seq"])
            }
          >
            select
          </Button>
        ),
      },
    ],
    data: modelsData as MRT_RowData[],
    rowCount: models?.recordsTotal ?? 0,
    state: {
      pagination,
      showSkeletons: isFetchingModels,
    },
    onPaginationChange: setPagination,
    paginationDisplayMode: "pages",
    manualPagination: true,
    enablePagination: true,
    enableRowSelection: false,
    enableColumnActions: false,
    enableColumnFilters: false,
    enableTopToolbar: false,
    enableSorting: false,
    mantineTableContainerProps: {
      style: {
        height: "300px",
        overflow: "scroll",
      },
    },
  });

  const modelRef = useRef<Model>(model);

  const fetchModelData = async (type, targetSeq) => {
    const data = await getPublishedModel({
      modelType: type,
      target_seq: targetSeq,
    });
    if (data) {
      const model: Model = data.data[0];
      modelRef.current = model;
      setState(getModelState(model));
    }
  };
  //   배포항목 선택 시 상세 정보 조회
  const onSelectModel = fetchModelData;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({
      ...prev,
      [e.target.id]: e.target.value,
    }));
  };

  //   저장
  const handleSubmit = async () => {
    // 유효성 검사
    for (const key in state) {
      const value = state[key];
      if (value == null || value == "") {
        return showToast.error(`Please Enter ${key}`);
      }
    }

    if (!(await confirmSave("Do you want to Save?"))) return;

    const body = {
      ...modelRef.current,
      ...state,
    };

    if (body["target_version"]) {
      body["version"] = body["target_version"];
    }

    await upsertPublishedModel({
      method: mode == "edit" ? "PUT" : "POST",
      body,
    });

    router.push(
      ROUTES.DISTRIBUTE.VIEW({
        modelType: body["ty"],
        targetSeq: body["target_seq"],
      })
    );
  };

  return (
    <>
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
              Publish - {mode == "create" ? "Register" : "Edit"}
            </h1>

            {/* end::Title */}
            {/* begin::Breadcrumb */}
            <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">
                <a href="/" className="text-gray-600 text-hover-primary">
                  Home
                </a>
              </li>
              {/* end::Item */}
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">
                Publish - {mode == "create" ? " Register" : " Edit"}
              </li>

              {/* end::Item */}
            </ul>
            {/* end::Breadcrumb */}
          </div>
          {/* end::Page title */}
          {/* begin::Actions */}
          <div className="d-flex align-items-center py-2 py-md-1">
            {/* begin::Button */}
            <a href="/distribute" className="btn btn-light active">
              <i className="fa-solid fa-list"></i> List
            </a>
            {/* end::Button */}
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
          <div className="row mb-6">
            {/* 수정 모드일 경우 숨기기 */}
            <div className={`col-lg-6 ${mode == "edit" && "d-none"}`}>
              <div className="card">
                <div className="card-header">
                  {/* begin::Card title */}
                  <div className="card-title fs-3 fw-bold">Draft List</div>
                  {/* end::Card title */}
                </div>

                <div id="" className="collapse show">
                  <div
                    className="card card-flush border-0"
                    style={{ height: "100%" }}
                  >
                    {/* begin::Card body */}
                    <div
                      className="card-body pt-0 px-4"
                      // style={{ height: "410px" }}
                    >
                      {/* begin::Table container */}
                      <Box my={"xs"}>
                        <CustomCombobox
                          className="form-control border-0 flex-grow-1"
                          data={
                            modelTypes
                              ? [{ id: "all", text: "All" }, ...modelTypes]
                              : modelTypes
                          }
                          mappingFn={(item) => ({
                            value: item.id,
                            label: item.text,
                          })}
                          value={modelType}
                          onChange={(value) => setModelType(value ?? "all")}
                        />
                      </Box>
                      <MantineReactTable table={table} />
                      {/* end::Table container */}
                    </div>
                    {/* end::Card body */}
                  </div>
                </div>
              </div>
            </div>

            <div className={`col-lg-${mode == "edit" ? "12" : "6"}`}>
              <div className="card">
                <div className="card-header border-0">
                  {/* begin::Card title */}
                  <div className="card-title fs-3 fw-bold">
                    Publish Info{" "}
                    {mode == "create" &&
                      (modelRef.current?.ty != null || model?.ty != null) && (
                        <span
                          className={`mx-2 fs-6 badge badge-light${(mode == "create" ? modelRef.current?.ty : model?.ty) == "aasmodel" ? "-primary" : ""}  bage_body`}
                        >
                          {(modelRef.current?.ty ?? model?.ty)?.toUpperCase()}
                        </span>
                      )}
                  </div>

                  {/* end::Card title */}
                </div>

                <div id="" className="collapse show">
                  {/* begin::Form */}
                  <form id="kt_account_profile_details_form" className="form">
                    {/* begin::Card body */}
                    <div
                      className="card-body border-top p-9"
                      // style={{ height: "410px" }}
                    >
                      <div className="row mb-4">
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Template ID
                        </label>
                        <div className="col-lg-10 fv-row">
                          <input
                            type="text"
                            id="tmp_seman_id"
                            value={modelRef.current?.tmp_seman_id ?? ""}
                            className="form-control form-control-lg"
                            readOnly
                          />
                        </div>
                      </div>
                      <div className="row mb-4">
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Template Name
                        </label>
                        <div className="col-lg-4 fv-row">
                          <input
                            type="text"
                            id={"target_name"}
                            value={state.target_name ?? ""}
                            onChange={handleInputChange}
                            className="form-control form-control-lg form-control-solid"
                            placeholder="Please enter the value."
                          />
                        </div>
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Category
                        </label>
                        <div
                          className="col-lg-4 fv-row fv-plugins-icon-container"
                          data-select2-id="select2-data-125-6fwh"
                        >
                          <CategoryCombobox
                            selectLeafOnly
                            disabled={
                              model?.status == "published" ||
                              !!modelRef.current?.tmp_seman_id
                            }
                            code={
                              modelRef.current?.ty === "aasmodel"
                                ? "aas_category"
                                : modelRef.current?.ty === "submodel"
                                  ? "sm_category"
                                  : "category2"
                            }
                            value={state.category_seq ?? ""}
                            setValue={(value) =>
                              setState({ ...state, category_seq: value })
                            }
                          />
                        </div>
                      </div>
                      <div className="row mb-4">
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Modify Date
                        </label>
                        <div className="col-lg-4 fv-row">
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            value={
                              modelRef.current?.create_date
                                ? formatDateToDotYMD(
                                    modelRef.current?.create_date
                                  ).replaceAll(".", "-")
                                : ""
                            }
                            readOnly
                          />
                        </div>
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Published Date
                        </label>
                        <div className="col-lg-4 fv-row">
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            value={
                              modelRef.current?.last_mod_date
                                ? formatDateToDotYMD(
                                    modelRef.current?.last_mod_date
                                  ).replaceAll(".", "-")
                                : ""
                            }
                            readOnly
                          />
                        </div>
                      </div>
                      <div className="row mb-4">
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Published Manager
                        </label>
                        <div className="col-lg-4 fv-row">
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            value={modelRef.current?.draft_user_nm ?? ""}
                            readOnly
                          />
                        </div>
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Published Approver
                        </label>
                        <div className="col-lg-4 fv-row">
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            value={modelRef.current?.published_user_nm ?? ""}
                            readOnly
                          />
                        </div>
                      </div>
                      <div className="row mb-4">
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Status
                        </label>
                        <div className="col-lg-4 fv-row">
                          {["published", "deprecated"].includes(
                            model?.status
                          ) ? (
                            <CustomCombobox
                              className="form-control form-control-lg border-0 flex-grow-1"
                              data={["published", "deprecated"]}
                              value={state.status}
                              onChange={(value) =>
                                setState((prev) => ({ ...prev, status: value }))
                              }
                            />
                          ) : (
                            <input
                              type="text"
                              className="form-control form-control-lg"
                              value={model?.status ?? ""}
                              readOnly
                            />
                          )}
                        </div>
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Version{" "}
                          <DistributeDetailView
                            modelType={
                              mode == "create"
                                ? modelRef.current?.ty
                                : model?.ty
                            }
                            modelSeq={
                              mode == "create"
                                ? modelRef.current?.target_seq
                                : model?.target_seq
                            }
                          >
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ padding: "2px 5px" }}
                            >
                              DetaileView
                            </button>
                          </DistributeDetailView>
                        </label>
                        <div className="col-lg-4 fv-row">
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            value={modelRef.current?.target_version ?? ""}
                            readOnly
                          />
                        </div>
                      </div>

                      {/* [추가] Description 위에 Creator와 Manual 행 추가 */}
                      <div className="row mb-4">
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Creator
                        </label>
                        <div className="col-lg-4 fv-row">
                          {/* Creator는 draft_user_nm (최초 작성자)를 보여줍니다 */}
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            value={modelRef.current?.draft_user_nm ?? ""}
                            readOnly
                          />
                        </div>
                        
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Manual
                        </label>
                        <div className="col-lg-4 fv-row d-flex align-items-center">
                          {modelRef.current?.guide_filename ? (
                            <a 
                              href="#" 
                              onClick={(e) => {
                                e.preventDefault();
                                // 다운로드 로직 혹은 링크 이동
                                alert("다운로드 기능은 서버 API 경로에 맞춰 href를 수정해야 합니다.\n파일명: " + modelRef.current?.guide_filename);
                              }}
                              className="btn btn-light-danger btn-sm"
                            >
                              <i className="fa-solid fa-file-pdf me-2"></i>
                              {/* 파일명 보여주기 */}
                              {modelRef.current.guide_filename} 
                            </a>
                          ) : (
                            <span className="text-gray-500">No Guide File</span>
                          )}
                        </div>
                      </div>


                      <div className="row ">
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">
                          Description
                        </label>
                        <div className="col-lg-10 fv-row">
                          <input
                            type="text"
                            id="description"
                            value={state.description ?? ""}
                            onChange={handleInputChange}
                            className="form-control form-control-lg"
                            placeholder="Please enter the value."
                          />
                        </div>
                      </div>
                    </div>
                  </form>
                  {/* end::Form */}
                </div>
              </div>
            </div>
          </div>

          <div className="card mt-10">
            <div className="card-footer d-flex justify-content-end py-6 px-9 border-0">
              <CancelButton />
              <button
                type="button"
                className="btn btn btn-success btn-sm"
                onClick={handleSubmit}
              >
                <i className="fa-solid fa-upload"></i>{" "}
                {mode == "create" ? "Register" : "Save"}
              </button>
            </div>
          </div>
        </div>
        {/* end::Post */}
      </div>
      {/* end::Container */}
    </>
  );
}