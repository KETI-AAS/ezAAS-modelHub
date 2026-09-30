/**
 * 파일명: src/app/login/LoginContent.tsx
 *
 * [2026-03-17 Portal 연동 신규 생성]
 * 기존 login/page.tsx의 클라이언트 로직을 분리한 컴포넌트.
 * page.tsx가 서버 컴포넌트로 전환되면서 searchParams(redirect_url)를 읽기 위해 분리됨.
 *
 * - redirectUrl prop: Portal에서 Hub 로그인으로 리다이렉트 시 전달되는 복귀 URL
 *   예) ?redirect_url=https://portal.ezmodel-hub.re.kr/instances/123
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { showToast } from "@/utils/toast";

import { useAuth } from "@/contexts/AuthContext";
import { modals } from "@mantine/modals";
import SendResetLinkForm from "@/components/feature/login/SendResetLinkForm";

interface LoginContentProps {
  redirectUrl: string;  // Portal 복귀 URL (없으면 빈 문자열)
}

export default function LoginContent({ redirectUrl }: LoginContentProps) {
  const { login, loginWithSocial } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onChangeEmail = (e) => {
    setEmail(e.target.value);
  };
  const onChangePassword = (e) => {
    setPassword(e.target.value);
  };

  const onClickLogin = () => {
    if (email == "") {
      return showToast.error("Please enter email");
    }
    if (password == "") {
      return showToast.error("Please enter password");
    }
    // redirectUrl을 login()에 전달하여 로그인 성공 후 Portal로 복귀할 수 있도록 함
    login(email, password, redirectUrl);
  };

  return (
    <>
      <div className="d-flex flex-column flex-root">
        {/* begin::Authentication - Sign-in */}
        <div className="d-flex flex-column flex-lg-row flex-column-fluid">
          {/* begin::Body*/}
          <div className="d-flex flex-column flex-lg-row-fluid w-lg-50 p-10 order-2 order-lg-1">
            {/* begin::Form*/}
            <div className="d-flex flex-center flex-column flex-lg-row-fluid">
              {/* begin::Wrapper*/}
              <div className="w-lg-500px p-10">
                {/* begin::Form*/}
                {/* begin::Heading*/}
                <div className="text-center mb-11">
                  {/* begin::Title*/}
                  <h1 className="text-gray-900 fw-bolder mb-3">LOG IN</h1>
                  {/* end::Title*/}
                  {/* begin::Subtitle*/}
                  <div className="text-gray-500 fw-semibold fs-6">
                    KETI ezAAS Model Hub
                  </div>
                  {/* end::Subtitle=*/}
                </div>
                {/* begin::Heading*/}
                {/* begin::Login options*/}
                <div className="row g-3 mb-9" style={{display:'none'}}>
                  <div className="col-md-12">
                    <button
                      className="btn btn-flex btn-outline btn-text-gray-700 btn-active-color-primary bg-state-light flex-center text-nowrap w-100"
                      onClick={() => {
                        loginWithSocial("google");
                      }}
                    >
                      <img
                        alt="Logo"
                        src="assets/media/svg/brand-logos/google-icon.svg"
                        className="h-15px me-3"
                      />
                      Sign in with Google
                    </button>
                  </div>
                  {/* end::Col*/}
                  {/* begin::Col*/}
                  <div className="col-md-6">
                    {/* begin::Google link=*/}
                    {/* <button
                      className="btn btn-flex btn-outline btn-text-gray-700 btn-active-color-primary bg-state-light flex-center text-nowrap w-100"
                      onClick={() => {
                        loginWithSocial("naver");
                      }}
                    >
                      <img
                        alt="Logo"
                        src="assets/media/svg/brand-logos/naver_icon.svg"
                        className="theme-light-show h-15px me-3"
                      />
                      Sign in with naver
                    </button> */}
                    {/* end::Google link=*/}
                  </div>
                  {/* end::Col*/}
                </div>
                {/* end::Login options*/}
                {/* begin::Separator*/}
                <div className="separator separator-content my-14" style={{display:'none'}}>
                  <span className="w-125px text-gray-500 fw-semibold fs-7">
                    Or with email
                  </span>
                </div>
                {/* end::Separator*/}
                {/* begin::Input group=*/}
                <div className="fv-row mb-8">
                  {/* begin::Email*/}
                  <input
                    type="text"
                    placeholder="Email"
                    name="email"
                    autoComplete="off"
                    className="form-control bg-transparent"
                    onChange={onChangeEmail}
                    onKeyDown={(e) => {
                      if (e.key == "Enter") {
                        onClickLogin();
                      }
                    }}
                  />
                  {/* end::Email*/}
                </div>
                {/* end::Input group=*/}
                <div className="fv-row mb-3">
                  {/* begin::Password*/}
                  <input
                    type="password"
                    placeholder="Password"
                    name="password"
                    autoComplete="off"
                    className="form-control bg-transparent"
                    onChange={onChangePassword}
                    onKeyDown={(e) => {
                      if (e.key == "Enter") {
                        onClickLogin();
                      }
                    }}
                  />
                  {/* end::Password*/}
                  {/* begin::Sign up*/}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <a
                      className="menu-title"
                      style={{
                        cursor: "pointer",
                      }}
                      onClick={(e) => {
                        e.preventDefault();

                        modals.open({
                          closeOnClickOutside: false,
                          closeOnEscape: false,
                          children: <SendResetLinkForm />,
                        });
                      }}
                    >
                      Forgot?
                    </a>
                  </div>
                </div>

                {/* end::Input group=*/}
                {/* begin::Wrapper*/}
                <div className="d-flex flex-stack flex-wrap gap-3 fs-base fw-semibold mb-8">
                  <div></div>
                  {/* begin::Link*/}
                  {/* <a className="link-primary">패스워드 찾기 ?</a>*/}
                  {/* end::Link*/}
                </div>
                {/* end::Wrapper*/}
                {/* begin::Submit button*/}
                <div className="d-grid mb-10">
                  <button
                    className="btn btn-primary"
                    onClick={(e) => {
                      onClickLogin();
                    }}
                  >
                    {/* begin::Indicator label*/}
                    <span className="indicator-label">LOG IN</span>
                    {/* end::Indicator label*/}
                    {/* begin::Indicator progress*/}
                    <span className="indicator-progress">
                      Please wait...
                      <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                    </span>
                    {/* end::Indicator progress*/}
                  </button>
                </div>
                {/* end::Submit button*/}
                {/* begin::Sign up*/}
                <div className="text-gray-500 text-center fw-semibold fs-6">
                  Not a Member yet?
                  <Link href={ROUTES.SIGNUP} className="menu-title">
                    Sign up
                  </Link>
                </div>
                {/* end::Sign up*/}
                {/* end::Form*/}
              </div>
              {/* end::Wrapper*/}
            </div>
            {/* end::Form*/}
            {/* begin::Footer*/}

            {/* end::Footer*/}
          </div>
          {/* end::Body*/}
          {/* begin::Aside*/}
          <div
            className="d-flex flex-lg-row-fluid w-lg-50 bgi-size-cover bgi-position-center order-1 order-lg-2"
            style={{ backgroundImage: "url(/assets/media/aas/auth-bg.png)" }}
          >
            {/* begin::Content*/}
            <div className="d-flex flex-column flex-center py-7 py-lg-15 px-5 px-md-15 w-100">
              {/* begin::Logo*/}
              <a href={ROUTES.HOME} className="mb-0 mb-lg-12">
                <img
                  alt="Logo"
                  src="assets/media/logos/keti_logo_w.png"
                  className="h-60px h-lg-75px"
                />
              </a>
              {/* end::Logo*/}
              {/* begin::Title*/}
              <h1 className="d-none d-lg-block text-white fs-2qx fw-bolder text-center mb-7">
                KETI ezAAS Model Hub
              </h1>
              {/* end::Title*/}
              {/* begin::Text*/}
              <div className="d-none d-lg-block text-white fs-base text-center">
                ezAAS Model Hub for Industrial Digital Twin
              </div>
              {/* end::Text*/}
            </div>
            {/* end::Content*/}
          </div>
          {/* end::Aside*/}
        </div>
        {/* end::Authentication - Sign-in*/}
      </div>
    </>
  );
}
