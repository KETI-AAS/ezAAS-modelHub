/*
 * 파일명: src/app/instance/server/page.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 * 
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 * 
 * 설명: AAS 인스턴스 서버 생성 페이지를 제공합니다.
 */

'use client';

import React from 'react';
import Link from 'next/link';

export default function InstanceServer() {
  return (
    <>
      {/* begin::Toolbar */}
      <div className="toolbar py-5 py-lg-5" id="kt_toolbar">
        {/* begin::Container */}
        <div id="kt_toolbar_container" className="container-xxl d-flex flex-stack flex-wrap">
          {/* begin::Page title */}
          <div className="page-title d-flex flex-column me-3">
            {/* begin::Title */}
            <h1 className="d-flex text-gray-900 fw-bold my-1 fs-3">서버 만들기 -  Create an instance server</h1>
            {/* end::Title */}
            {/* begin::Breadcrumb */}
            <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">
                <Link href="/" className="text-gray-600 text-hover-primary">Home</Link>
              </li>
              {/* end::Item */}
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">My AAS Instance</li>
              {/* end::Item */}
            </ul>
            {/* end::Breadcrumb */}
          </div>
          {/* end::Page title */}
          {/* begin::Actions */}
          <div className="d-flex align-items-center py-2 py-md-1">
            {/* begin::Button */}
            <Link href="/instance" className="btn btn-light active"><i className="fa-solid fa-list"></i> List</Link>
            {/* end::Button */}
          </div>
          {/* end::Actions */}
        </div>
        {/* end::Container */}
      </div>
      {/* end::Toolbar */}
      {/* begin::Container */}
      <div id="kt_content_container" className="d-flex flex-column-fluid align-items-start container-xxl">
        {/* begin::Post */}
        <div className="content flex-row-fluid" id="kt_content">
          <div className="row mb-6">
            <div className="col-lg-4">
              <div className="card">
                <div className="card-header">
                  {/* begin::Card title */}
                  <div className="card-title fs-3 fw-bold">Instance 선택</div>
                  {/* end::Card title */}
                </div>

                <div id="" className="collapse show">
                  <div className="card card-flush border-0">
                    {/* begin::Card body */}
                    <div className="card-body pt-0" style={{ height: "339px", overflow: "auto" }}>
                      {/* begin::Table container */}
                      <div className="table-responsive">
                        {/* begin::Table */}
                        <table id="kt_project_users_table" className="table table-row-bordered table-row-dashed gy-4 align-middle fw-bold">
                          <thead className="fs-7 text-gray-500 text-uppercase">
                            <tr>
                              <th className="min-w-70px">인스턴스명</th>
                              <th className="min-w-150px">생성일</th>
                              <th className="min-w-50px">선택</th>
                            </tr>
                          </thead>
                          <tbody className="fs-6">
                            <tr>
                              <td>ExampleMotor</td>
                              <td>2025-03-07</td>
                              <td className="text-end">
                                <a href="#" className="btn btn-success btn-sm">select</a>
                              </td>
                            </tr>
                            <tr>
                              <td>ExampleMotor</td>
                              <td>2025-03-07</td>
                              <td className="text-end">
                                <a href="#" className="btn btn-success btn-sm">select</a>
                              </td>
                            </tr>
                            <tr>
                              <td>ExampleMotor</td>
                              <td>2025-03-07</td>
                              <td className="text-end">
                                <a href="#" className="btn btn-success btn-sm">select</a>
                              </td>
                            </tr>
                            <tr>
                              <td>ExampleMotor</td>
                              <td>2025-03-07</td>
                              <td className="text-end">
                                <a href="#" className="btn btn-success btn-sm">select</a>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {/* end::Table */}
                      </div>
                      {/* end::Table container */}
                    </div>
                    {/* end::Card body */}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg-8">
              <div className="card">
                <div className="card-header border-0">
                  {/* begin::Card title */}
                  <div className="card-title fs-3 fw-bold">Instance 서버 정보 입력</div>
                  {/* end::Card title */}
                </div>

                <div id="" className="collapse show">
                  {/* begin::Form */}
                  <form id="kt_account_profile_details_form" className="form">
                    {/* begin::Card body */}
                    <div className="card-body border-top p-9">
                      <div className="row mb-6">
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">인스턴스 명</label>
                        <div className="col-lg-10 fv-row">
                          <input type="text" name="company" className="form-control form-control-lg form-control-solid" placeholder="입력해주세요" defaultValue="Sample Template" />
                        </div>
                      </div>
                      <div className="row mb-6">
                        <label className="col-lg-2 col-form-label fw-semibold fs-6">샘플 속성</label>
                        <div className="col-lg-10 fv-row fv-plugins-icon-container" data-select2-id="select2-data-125-6fwh">
                          <select name="" aria-label="카테고리를 선택해주세요" 
                          //data-control="select2" 
                          data-placeholder="카테고리를 선택해주세요..." 
                          className="form-select form-select-lg form-select-solid" 
                          defaultValue="id">
                            <option value="">샘플 속성 포함 여부를 선택해주세요</option>
                            <option value="id">포함</option>
                            <option value="msa">미포함</option>
                          </select>
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
              <button type="button" className="btn btn-light btn-sm me-2"><i className="fa-solid fa-xmark"></i> Cancel </button>
              <button type="button" className="btn btn btn-success btn-sm"><i className="fa-solid fa-upload"></i> Register</button>
            </div>
          </div>
        </div>
        {/* end::Post */}
      </div>
      {/* end::Container */}
    </>
  );
} 