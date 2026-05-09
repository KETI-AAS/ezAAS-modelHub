/*
 * 파일명: src/app/user/ins/page.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 * 
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 * 
 * 설명: 사용자 프로필 등록 페이지를 제공합니다.
 */

'use client';

import React from 'react';
import Link from 'next/link';

export default function UserIns() {
  return (
    <>
      {/* begin::Toolbar */}
      <div className="toolbar py-5 py-lg-5" id="kt_toolbar">
        {/* begin::Container */}
        <div id="kt_toolbar_container" className="container-xxl d-flex flex-stack flex-wrap">
          {/* begin::Page title */}
          <div className="page-title d-flex flex-column me-3">
            {/* begin::Title */}
            <h1 className="d-flex text-gray-900 fw-bold my-1 fs-3">My Profile - Register</h1>
            {/* end::Title */}
            {/* begin::Breadcrumb */}
            <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">
                <Link href="/" className="text-gray-600 text-hover-primary">Home</Link>
              </li>
              {/* end::Item */}
              {/* begin::Item */}
              <li className="breadcrumb-item text-gray-600">My Profile</li>
              {/* end::Item */}
            </ul>
            {/* end::Breadcrumb */}
          </div>
          {/* end::Page title */}
        </div>
        {/* end::Container */}
      </div>
      {/* end::Toolbar */}
      {/* begin::Container */}
      <div id="kt_content_container" className="d-flex flex-column-fluid align-items-start container-xxl">
        {/* begin::Post */}
        <div className="content flex-row-fluid" id="kt_content">
          <div className="card mb-5 mb-xl-10">
            {/* begin::Card header */}
            <div className="card-header border-0 cursor-pointer" role="button" data-bs-toggle="collapse" data-bs-target="#kt_account_profile_details" aria-expanded="true" aria-controls="kt_account_profile_details">
              {/* begin::Card title */}
              <div className="card-title m-0">
                <h3 className="fw-bold m-0">Profile Details</h3>
              </div>
              {/* end::Card title */}
            </div>
            {/* begin::Card header */}
            {/* begin::Content */}
            <div id="kt_account_settings_profile_details" className="collapse show">
              {/* begin::Form */}
              <form id="kt_account_profile_details_form" className="form">
                {/* begin::Card body */}
                <div className="card-body border-top p-9">
                  {/* begin::Input group */}
                  <div className="row mb-6">
                    {/* begin::Label */}
                    <label className="col-lg-4 col-form-label required fw-semibold fs-6">ID</label>
                    {/* end::Label */}
                    {/* begin::Col */}
                    <div className="col-lg-8 fv-row">
                      <input type="text" name="company" className="form-control form-control-lg" placeholder="Company name" value="GD.Hong" />
                    </div>
                    {/* end::Col */}
                  </div>
                  <div className="row mb-6">
                    {/* begin::Label */}
                    <label className="col-lg-4 col-form-label required fw-semibold fs-6">E-mail</label>
                    {/* end::Label */}
                    {/* begin::Col */}
                    <div className="col-lg-8 fv-row">
                      <input type="text" name="company" className="form-control form-control-lg" placeholder="Company name" value="gdhong@keti.com" />
                    </div>
                    {/* end::Col */}
                  </div>

                  <div className="row mb-6">
                    {/* begin::Label */}
                    <label className="col-lg-4 col-form-label required fw-semibold fs-6">Name</label>
                    {/* end::Label */}
                    {/* begin::Col */}
                    <div className="col-lg-8">
                      {/* begin::Row */}
                      <div className="row">
                        {/* begin::Col */}
                        <div className="col-lg-6 fv-row">
                          <input type="text" name="fname" className="form-control form-control-lg mb-3 mb-lg-0" placeholder="First name" value="홍" />
                        </div>
                        {/* end::Col */}
                        {/* begin::Col */}
                        <div className="col-lg-6 fv-row">
                          <input type="text" name="lname" className="form-control form-control-lg" placeholder="Last name" value="길동" />
                        </div>
                        {/* end::Col */}
                      </div>
                      {/* end::Row */}
                    </div>
                    {/* end::Col */}
                  </div>
                  {/* end::Input group */}
                  
                  {/* begin::Input group */}
                  <div className="row mb-6">
                    {/* begin::Label */}
                    <label className="col-lg-4 col-form-label fw-semibold fs-6">
                      <span className="required">Mobile</span>
                    </label>
                    {/* end::Label */}
                    {/* begin::Col */}
                    <div className="col-lg-8 fv-row">
                      <input type="tel" name="phone" className="form-control form-control-lg" placeholder="Phone number" value="010-1234-5678" />
                    </div>
                    {/* end::Col */}
                  </div>
                  {/* end::Input group */}
                  {/* begin::Input group */}
                  <div className="row mb-6">
                    {/* begin::Label */}
                    <label className="col-lg-4 col-form-label fw-semibold fs-6">
                      <span className="required">Create Date</span>
                    </label>
                    {/* end::Label */}
                    {/* begin::Col */}
                    <div className="col-lg-8 fv-row">
                      <input type="tel" name="phone" className="form-control form-control-lg form-control-solid" placeholder="Phone number" value="2025-01-05" readOnly />
                    </div>
                    {/* end::Col */}
                  </div>
                  {/* end::Input group */}
                  
                  {/* begin::Input group */}
                  <div className="row mb-6">
                    {/* begin::Label */}
                    <label className="col-lg-4 col-form-label fw-semibold fs-6">
                      <span className="required">Role</span>
                    </label>
                    {/* end::Label */}
                    {/* begin::Col */}
                    <div className="col-lg-8 fv-row">
                      <select name="country" aria-label="Select a Country" 
                      //data-control="select2" 
                      className="form-select form-select-lg fw-semibold" 
                      data-hide-search="true">
                        <option value="1" selected>User</option>
                        <option value="2">Template Manager</option>
                        <option value="3">System Manager</option>
                      </select>
                    </div>
                    {/* end::Col */}
                  </div>
                  {/* end::Input group */}
                </div>
                {/* end::Card body */}
                {/* begin::Actions */}
                <div className="card-footer d-flex justify-content-end py-6 px-9">
                  <Link href="/user" type="button" className="btn btn-light btn-sm me-2">
                    <i className="fa-solid fa-xmark"></i> Cancel
                  </Link>
                  <button type="button" className="btn btn btn-success btn-sm">
                    <i className="fa-solid fa-upload"></i> Register
                  </button>
                </div>
                {/* end::Actions */}
              </form>
              {/* end::Form */}
            </div>
            {/* end::Content */}
          </div>
        </div>
        {/* end::Post */}
      </div>
      {/* end::Container */}
    </>
  );
} 