/*
 * 파일명: src/app/about/page.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 * 
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 * 
 * 설명: KETI AAS Repository Hub 소개 페이지를 제공합니다.
 */

'use client';

import React, { useEffect } from 'react'
import Link from 'next/link';

export default function About() {
  useEffect
  return (
    <>
      {/*begin::Toolbar*/}
      <div className="toolbar py-5 py-lg-5" id="kt_toolbar">
        {/*begin::Container*/}
        <div id="kt_toolbar_container" className="container-xxl d-flex flex-stack flex-wrap">
          {/*begin::Page title*/}
          <div className="page-title d-flex flex-column me-3">
            {/*begin::Title*/}
            <h1 className="d-flex text-gray-900 fw-bold my-1 fs-3">About</h1>
            {/*end::Title*/}
            {/*begin::Breadcrumb*/}
            <ul className="breadcrumb breadcrumb-dot fw-semibold text-gray-600 fs-7 my-1">
              {/*begin::Item*/}
              <li className="breadcrumb-item text-gray-600">
              <Link href="/" className="text-gray-600 text-hover-primary">Home</Link>
              </li>
              {/*end::Item*/}
              {/*begin::Item*/}
              <li className="breadcrumb-item text-gray-600">About</li>
              {/*end::Item*/}
            </ul>
            {/*end::Breadcrumb*/}
          </div>
          {/*end::Actions*/}
        </div>
        {/*end::Container*/}
      </div>
      {/*end::Toolbar*/}

      {/*begin::Container*/}
      <div id="kt_content_container" className="d-flex flex-column-fluid align-items-start container-xxl">
        {/*begin::Post*/}
        <div className="content flex-row-fluid" id="kt_content">
          <div className="mb-18">
            {/*begin::Wrapper*/}
            <div className="mb-10">
              {/*begin::Top*/}
              <div className="text-center mb-15">
                {/*begin::Title*/}
                <h3 className="fs-2hx text-gray-900 mb-5">About</h3>
                {/*end::Title*/}
                {/*begin::Text*/}
                <div className="fs-5 text-gray-600 fw-semibold">
                  ezAAS Model Hub
                </div>
                {/*end::Text*/}
              </div>
              {/*end::Top*/}
              {/*begin::Overlay*/}
              <div className="overlay">
                {/*begin::Image*/}
                <iframe
                    className="embed-responsive-item rounded h-500px w-100"
                    // src="https://www.youtube.com/embed/3Km1DXxn0BQ?si=vYGDRr6XdbnEp0UY"
                    src="https://www.youtube.com/embed/n4IDBR2C1CY?si=jvDaO89Su0huplNn"
                    allowFullScreen={true}
                  />
                {/*end::Image*/}
              </div>
              {/*end::Container*/}
            </div>

            <div className="mb-10">
              {/*begin::Top*/}
              <div className="text-center mb-15">
                {/*begin::Title*/}
                <h3 className="fs-2hx text-gray-900 mb-5">Key Features and Benefits</h3>
                {/*end::Title*/}
              </div>
            </div>

            <div className="row g-10">
              {/*begin::Col*/}
              <div className="col-md-3">
                {/*begin::Publications post*/}
                <div className="card-xl-stretch me-md-6">
                  {/*begin::Body*/}
                  <div className="m-0">
                    {/*begin::Title*/}
                    <a className="fs-4 text-dark fw-bold text-hover-primary text-dark lh-base">
                      Integrated Management of AAS Templates
                    </a>
                    {/*end::Title*/}
                    {/*begin::Text*/}
                    <div className="fw-semibold fs-5 text-gray-600 text-dark mt-3 mb-5">
                      The repository consolidates all AAS templates (types) developed domestically into a single, unified storage system.
                    </div>
                    <div className="fw-semibold fs-5 text-gray-600 text-dark mt-3 mb-5">
                      Users can create various AAS instances using standardized templates and populate them with the required data to easily build and utilize compliant digital twins for manufacturing.
                    </div>
                    {/*end::Text*/}
                  </div>
                  {/*end::Body*/}
                </div>
                {/*end::Publications post*/}
              </div>
              {/*end::Col*/}

              {/*begin::Col*/}
              <div className="col-md-3">
                {/*begin::Publications post*/}
                <div className="card-xl-stretch me-md-6">
                  {/*begin::Body*/}
                  <div className="m-0">
                    {/*begin::Title*/}
                    <a className="fs-4 text-dark fw-bold text-hover-primary text-dark lh-base">
                      Compliance with International Standards
                    </a>
                    {/*end::Title*/}
                    {/*begin::Text*/}
                    <div className="fw-semibold fs-5 text-gray-600 text-dark mt-3 mb-5">
                      The system restricts the creation of non-compliant AAS instances and only supports versions that adhere to the official AAS standard.
                    </div>
                    <div className="fw-semibold fs-5 text-gray-600 text-dark mt-3 mb-5">
                      It automatically verifies compliance with the latest AAS Metamodel Specification (Version 3.0), allowing only validated instances to be registered and distributed.
                    </div>
                    <div className="fw-semibold fs-5 text-gray-600 text-dark mt-3 mb-5">
                      Compatibility with standard templates defined by the IDTA (Industrial Digital Twin Association) is verified to ensure high reliability and interoperability of the AAS-based digital twins.
                    </div>
                    {/*end::Text*/}
                  </div>
                  {/*end::Body*/}
                </div>
                {/*end::Publications post*/}
              </div>
              {/*end::Col*/}

              {/*begin::Col*/}
              <div className="col-md-3">
                {/*begin::Publications post*/}
                <div className="card-xl-stretch me-md-6">
                  {/*begin::Body*/}
                  <div className="m-0">
                    {/*begin::Title*/}
                    <a className="fs-4 text-dark fw-bold text-hover-primary text-dark lh-base">
                      Simplified AAS Instance Creation and Deployment
                    </a>
                    {/*end::Title*/}
                    {/*begin::Text*/}
                    <div className="fw-semibold fs-5 text-gray-600 text-dark mt-3 mb-5">
                      AAS instances can be automatically generated by simply inputting real asset data into pre-registered templates.
                    </div>
                    <div className="fw-semibold fs-5 text-gray-600 text-dark mt-3 mb-5">
                      The created instances can be immediately deployed and run on the repository server, enabling real-time integration into active manufacturing systems.
                    </div>
                    {/*end::Text*/}
                  </div>
                  {/*end::Body*/}
                </div>
                {/*end::Publications post*/}
              </div>
              {/*end::Col*/}

              {/*begin::Col*/}
              <div className="col-md-3">
                {/*begin::Publications post*/}
                <div className="card-xl-stretch me-md-6">
                  {/*begin::Body*/}
                  <div className="m-0">
                    {/*begin::Title*/}
                    <a className="fs-4 text-dark fw-bold text-hover-primary text-dark lh-base">
                      Scalability through API Support
                    </a>
                    {/*end::Title*/}
                    {/*begin::Text*/}
                    <div className="fw-semibold fs-5 text-gray-600 text-dark mt-3 mb-5">
                      A standardized RESTful API is provided, enabling external systems to query and retrieve AAS template and instance data.
                    </div>
                    <div className="fw-semibold fs-5 text-gray-600 text-dark mt-3 mb-5">
                      Flexible integration with external platforms and manufacturing IT systems is supported, ensuring high scalability and ecosystem compatibility for AAS-based digital twin applications.
                    </div>
                    {/*end::Text*/}
                  </div>
                  {/*end::Body*/}
                </div>
                {/*end::Publications post*/}
              </div>
              {/*end::Col*/}
            </div>
          </div>
        </div>
        {/*end::Post*/}
      </div>
      {/*end::Container*/}
      </>
  );
} 