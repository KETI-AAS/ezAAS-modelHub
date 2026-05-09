import { getModel, getPublishedHistoryModel, getPublishedModel } from "@/api";
import DistributeDetailView from "@/components/feature/distribute/DistributeDetailView";
import { ROUTES } from "@/constants/routes";
import { formatDateToDotYMD } from "@/utils";
import { Badge } from "@mantine/core";
import Link from "next/link";

interface Props {
  params: {
    modelType: "aasmodel" | "submodel";
    targetSeq: string;
  };
}

export default async function Page({ params }: Props) {
  const { modelType, targetSeq } = await params;

  let model = await getPublishedModel({
    modelType,
    target_seq: targetSeq,
  });
  const history = await getPublishedHistoryModel({
    modelType,
    target_seq: targetSeq,
  });

  model = model ? model.data[0] : {};

  return (
    <>
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
                Publish - View
              </h1>
              {/*end::Title*/}
              {/*begin::Breadcrumb*/}
              <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
                {/*begin::Item*/}
                <li className="breadcrumb-item text-gray-600">
                  <a href="/" className="text-gray-600 text-hover-primary">
                    Home
                  </a>
                </li>
                {/*end::Item*/}
                {/*begin::Item*/}
                <li className="breadcrumb-item text-gray-600">
                  Publish - View
                </li>
                {/*end::Item*/}
              </ul>
              {/*end::Breadcrumb*/}
            </div>
            {/*end::Page title*/}
            {/*begin::Actions*/}
            <div className="d-flex align-items-center py-2 py-md-1">
              {/*begin::Button*/}
              <Link
                href={ROUTES.DISTRIBUTE.LIST}
                className="btn btn-light active"
              >
                <i className="fa-solid fa-list"></i> List
              </Link>
              {/*end::Button*/}
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
            <div className="card">
              <div className="card-header border-0">
                {/*begin::Card title*/}
                <div className="card-title fs-3 fw-bold">
                  Published Info{" "}
                  <Badge ml={"sm"} size="lg" radius={"sm"} variant={"filled"}>
                    {model.ty}
                  </Badge>
                </div>

                {/*end::Card title*/}
              </div>

              <div id="" className="collapse show">
                {/*begin::Form*/}
                <form id="kt_account_profile_details_form" className="form">
                  {/*begin::Card body*/}
                  <div className="card-body border-top p-9">
                    <div className="row mb-6">
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Template Name
                      </label>
                      <div className="col-lg-4 fv-row">
                        <input
                          type="text"
                          name="company"
                          className="form-control form-control-lg form-control-solid"
                          placeholder="Please enter the value."
                          value={model.target_name}
                          readOnly
                        />
                      </div>
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Categories
                      </label>
                      <div className="col-lg-4 fv-row">
                        <input
                          type="text"
                          name="company"
                          className="form-control form-control-lg form-control-solid"
                          placeholder="Please enter the value."
                          value={model.category_name}
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="row mb-6">
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Modify Date
                      </label>
                      <div className="col-lg-4 fv-row">
                        <input
                          type="text"
                          name="company"
                          className="form-control form-control-lg form-control-solid"
                          placeholder="Please enter the value."
                          value={
                            model?.create_date
                              ? formatDateToDotYMD(
                                  model?.create_date
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
                          name="company"
                          className="form-control form-control-lg form-control-solid"
                          placeholder="Please enter the value."
                          value={
                            model?.last_mod_date
                              ? formatDateToDotYMD(
                                  model?.last_mod_date
                                ).replaceAll(".", "-")
                              : ""
                          }
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="row mb-6">
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Published Manager
                      </label>
                      <div className="col-lg-4 fv-row">
                        <input
                          type="text"
                          name="company"
                          className="form-control form-control-lg form-control-solid"
                          placeholder="Please enter the value."
                          value={model?.draft_user_nm ?? ""}
                          readOnly
                        />
                      </div>
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Published Approver
                      </label>
                      <div className="col-lg-4 fv-row">
                        <input
                          type="text"
                          name="company"
                          className="form-control form-control-lg form-control-solid"
                          placeholder="Please enter the value."
                          value={model?.published_user_nm ?? ""}
                          readOnly
                        />
                      </div>
                    </div>
                    <div className="row mb-6">
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Status
                      </label>
                      <div className="col-lg-4 fv-row">
                        <input
                          type="text"
                          name="company"
                          className="form-control form-control-lg form-control-solid"
                          placeholder="Please enter the value."
                          value={model?.status?.toUpperCase() ?? ""}
                          readOnly
                        />
                      </div>
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Version
                      </label>
                      <div className="col-lg-4 fv-row">
                        <input
                          type="text"
                          name="company"
                          className="form-control form-control-lg form-control-solid"
                          placeholder="Please enter the value."
                          value={model?.target_version ?? ""}
                          readOnly
                        />
                      </div>
                    </div>

                    {/* [START] 추가된 Creator 및 Guide 부분 */}
                    <div className="row mb-6">
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Creator
                      </label>
                      <div className="col-lg-4 fv-row">
                        <input
                          type="text"
                          className="form-control form-control-lg form-control-solid"
                          value={model?.creator ?? ""} 
                          readOnly
                        />
                      </div>

                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Guide(pdf)
                      </label>
                      <div className="col-lg-4 fv-row d-flex align-items-center">
                        {model?.guide_filename ? (
                          <a
                            // 실제 파일 다운로드 경로에 맞게 수정이 필요할 수 있음.
                            // href={`/api/download/${model.guide_realpath}`}
                            href={model.guide_realpath ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-light-success btn-sm"
                          >
                            <i className="fa-solid fa-file-pdf me-2"></i>
                            {model.guide_filename}
                          </a>
                        ) : (
                          <span className="text-gray-500">No Guide File</span>
                        )}
                      </div>
                    </div>
                    {/* [END] 추가된 부분 */}

                    <div className="row mt-6">
                      <label className="col-lg-2 col-form-label fw-semibold fs-6">
                        Description
                      </label>
                      <div className="col-lg-10 fv-row">
                        <input
                          type="text"
                          name="company"
                          className="form-control form-control-lg form-control-solid"
                          placeholder="Please enter the value."
                          value={model?.description ?? ""}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                </form>
                {/*end::Form*/}
              </div>
            </div>

            <div className="card mt-5">
              <div className="card-header">
                {/*begin::Card title*/}
                <div className="card-title fs-3 fw-bold">History</div>
                {/*end::Card title*/}
              </div>

              <div id="" className="collapse show">
                <div className="card card-flush border-0">
                  {/*begin::Card body*/}
                  <div className="card-body pt-0">
                    {/*begin::Table container*/}
                    <div className="table-responsive">
                      {/*begin::Table*/}
                      {history.length > 0 && (
                        <table
                          id="kt_project_users_table"
                          className="table table-row-bordered table-row-dashed gy-4 align-middle fw-bold"
                        >
                          <thead className="fs-7 text-gray-500 text-uppercase">
                            <tr>
                              <th className="min-w-100px">이력</th>
                              <th className="min-w-100px">Template Name</th>
                              <th className="min-w-100px">Published Manager</th>
                              <th className="min-w-100px">
                                Published Approver
                              </th>
                              <th className="min-w-100px">Status</th>
                              <th className="min-w-100px">Version</th>
                              <th className="min-w-100px text-end">
                                Detail View
                              </th>
                            </tr>
                          </thead>
                          <tbody className="fs-6">
                            {history.map((item, i, arr) => {
                              let state;
                              if (item.status == "draft") {
                                state = "승인 대기";
                              } else {
                                state = "배포";
                              }
                              return (
                                <tr
                                  key={`${item.target_seq}${item.ty}`}
                                  className={
                                    `${targetSeq}${modelType}` ==
                                    `${item.target_seq}${item.ty}`
                                      ? "bg-light-success"
                                      : ""
                                  }
                                >
                                  <td>
                                    {/*begin::User*/}
                                    <div className="d-flex align-items-center">
                                      {/*begin::Info*/}
                                      <div className="d-flex flex-column justify-content-center">
                                        {formatDateToDotYMD(item.last_mod_date)}
                                      </div>
                                      {/*end::Info*/}
                                    </div>
                                    {/*end::User*/}
                                  </td>
                                  <td>{item.target_name}</td>
                                  <td>{item.draft_user_nm}</td>
                                  <td>{item.published_user_nm}</td>
                                  <td>{item.status.toUpperCase()}</td>
                                  <td>{item.target_version}</td>
                                  <td className="text-end">
                                    <DistributeDetailView
                                      modelType={item.ty}
                                      modelSeq={item.target_seq}
                                    >
                                      {" "}
                                      <button className="btn btn-success btn-sm">
                                        <i className="fa-regular fa-file"></i>{" "}
                                        Detaile View
                                      </button>
                                    </DistributeDetailView>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                      {/*end::Table*/}
                    </div>
                    {/*end::Table container*/}
                  </div>
                  {/*end::Card body*/}
                </div>
              </div>
            </div>

            <div className="card mt-10">
              <div className="card-footer d-flex justify-content-end py-6 px-9 border-0">
                {model.status == "published" && (
                  <Link
                    href={ROUTES.DISTRIBUTE.EDIT({
                      modelType: model.ty,
                      targetSeq: model.target_seq,
                    })}
                    type="button"
                    className="btn btn-light-success btn-sm me-2"
                  >
                    <i className="fa-solid fa-gear"></i> Edit{" "}
                  </Link>
                )}
              </div>
            </div>
          </div>
          {/*end::Post*/}
        </div>
        {/*end::Container*/}
      </div>
    </>
  );
}