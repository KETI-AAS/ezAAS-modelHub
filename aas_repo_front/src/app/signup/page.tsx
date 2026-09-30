/*
 * 파일명: src/app/login.tsx
 * 작성자: 김태훈
 * 작성일: 2024-03-15
 * 최종수정일: 2024-03-29
 *
 * 저작권: (c) 2025 IMPIX. 모든 권리 보유.
 *
 * 설명: KETI ezAAS Model Hub의 메인 페이지입니다.
 * 이 페이지는 다음과 같은 주요 기능을 제공합니다:
 * - AAS 템플릿, 서브모델, 인스턴스에 대한 통계 및 빠른 접근
 * - 통합 검색 기능
 * - KETI ezAAS Model Hub 소개 및 주요 기능 설명
 * - 제품 소개 비디오
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { IconCheck, IconExclamationCircle, IconX } from "@tabler/icons-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/constants/routes";
import { showToast } from "@/utils/toast";

export default function Login() {
  const { signUpWithCredential, loginWithSocial } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 이메일 유효성 검사 함수 추가
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const onChangeEmail = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    if (!isValidEmail(value)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  };

  const onChangePassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };

  const onChangeConfirmPassword = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
  };

  const checkPasswordConditions = (password: string) => {
    return [
      { valid: /.{8,}/.test(password), label: "At least 8 characters" },
      { valid: /[A-Za-z]/.test(password), label: "Contains a letter" },
      { valid: /[0-9]/.test(password), label: "Contains a number" },
      { valid: /[!@#$%^&*]/.test(password), label: "Contains a symbol" },
    ];
  };

  const passwordChecks = checkPasswordConditions(password);

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      showToast.error("Please fill in all fields.");
      return;
    }

    if (!isValidEmail(email)) {
      showToast.error("Please enter a valid email address.");

      setEmailError("Please enter a valid email address.");
      return;
    } else {
      setEmailError("");
    }

    if (passwordChecks.some((check) => !check.valid)) {
      showToast.error(
        "Password must be at least 8 characters long and include letters, numbers, and symbols."
      );
      return;
    }

    if (password !== confirmPassword) {
      showToast.error("Passwords do not match.");
      return;
    }

    signUpWithCredential(email, password);
  };

  const matchError = confirmPassword && password !== confirmPassword;

  return (
    <>
      <div className="d-flex flex-column flex-root">
        <div className="d-flex flex-column flex-lg-row flex-column-fluid">
          <div className="d-flex flex-column flex-lg-row-fluid w-lg-50 p-10 order-2 order-lg-1">
            <div className="d-flex flex-center flex-column flex-lg-row-fluid">
              <div className="w-lg-500px p-10">
                <div className="form w-100">
                  <div className="text-center mb-11">
                    <h1 className="text-gray-900 fw-bolder mb-3">Sign Up</h1>
                  </div>

                  <div className="row g-3 mb-9" style={{display:'none'}}>
                    {/* begin::Col*/}
                    <div className="col-md-12">
                      {/* begin::Google link=*/}
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
                      {/* end::Google link=*/}
                    </div>
                    {/* end::Col*/}
                    {/* begin::Col*/}
                    <div className="col-md-6" style={{display:"none"}}>
                      {/* begin::Google link=*/}
                      <button
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
                      </button>
                      {/* end::Google link=*/}
                    </div>
                    {/* end::Col*/}
                  </div>

                  <div className="separator separator-content my-14" style={{display:'none'}}>
                    <span className="w-125px text-gray-500 fw-semibold fs-7">
                      Or with email
                    </span>
                  </div>

                  <div className="fv-row mb-8">
                    <input
                      type="text"
                      placeholder="Email"
                      name="email"
                      autoComplete="off"
                      className="form-control bg-transparent"
                      value={email}
                      onChange={onChangeEmail}
                      onKeyDown={(e) => {
                        if (e.key == "Enter") {
                          handleSignUp();
                        }
                      }}
                    />
                    {emailError && (
                      <div className="small mt-1">
                        <span className={"text-danger"}>
                          <IconX size={"1.25rem"} />
                        </span>
                        <span className="mx-1">{emailError}</span>
                      </div>
                    )}
                  </div>

                  <div className="fv-row mb-8" data-kt-password-meter="true">
                    <div className="mb-1">
                      <div className="position-relative mb-3">
                        <input
                          className="form-control bg-transparent"
                          type="password"
                          placeholder="Password"
                          name="password"
                          autoComplete="off"
                          value={password}
                          onChange={onChangePassword}
                          onKeyDown={(e) => {
                            if (e.key == "Enter") {
                              handleSignUp();
                            }
                          }}
                        />
                        <span className="btn btn-sm btn-icon position-absolute translate-middle top-50 end-0 me-n2">
                          <i className="ki-duotone ki-eye-slash fs-2"></i>
                          <i className="ki-duotone ki-eye fs-2 d-none"></i>
                        </span>
                      </div>
                      <div className="d-flex align-items-center mb-2">
                        {[
                          ...Array(
                            passwordChecks.filter((c) => c.valid).length
                          ),
                        ].map((_, i) => (
                          <div
                            key={i}
                            className="flex-grow-1 bg-active-success rounded h-5px me-2 active"
                          ></div>
                        ))}
                        {[
                          ...Array(
                            4 - passwordChecks.filter((c) => c.valid).length
                          ),
                        ].map((_, i) => (
                          <div
                            key={i}
                            className="flex-grow-1 bg-secondary rounded h-5px me-2"
                          ></div>
                        ))}
                      </div>
                      <ul className="text mb-0 px-1 small">
                        {passwordChecks.map((check, i) => (
                          <li style={{ listStyle: "none" }} key={i}>
                            <span
                              className={
                                check.valid ? "text-success" : "text-danger"
                              }
                            >
                              {check.valid ? (
                                <IconCheck size={"1.25rem"} />
                              ) : (
                                <IconX size={"1.25rem"} />
                              )}
                            </span>
                            <span className={`mx-1`}>{check.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="fv-row mb-8">
                    <input
                      placeholder="Repeat Password"
                      name="confirm-password"
                      type="password"
                      autoComplete="off"
                      className="form-control bg-transparent"
                      value={confirmPassword}
                      onChange={onChangeConfirmPassword}
                      onKeyDown={(e) => {
                        if (e.key == "Enter") {
                          handleSignUp();
                        }
                      }}
                    />
                    {matchError && (
                      <div className="text-danger mt-1 small">
                        Passwords do not match.
                      </div>
                    )}
                  </div>

                  <div className="d-grid mb-10">
                    <button
                      id="kt_sign_up_submit"
                      className="btn btn-primary"
                      onClick={handleSignUp}
                    >
                      <span className="indicator-label">Sign up</span>
                      <span className="indicator-progress">
                        Please wait...
                        <span className="spinner-border spinner-border-sm align-middle ms-2"></span>
                      </span>
                    </button>
                  </div>

                  <div className="text-gray-500 text-center fw-semibold fs-6">
                    Already have an Account?
                    <Link
                      href={ROUTES.LOGIN}
                      className="link-primary fw-semibold"
                    >
                      Log in
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="d-flex flex-lg-row-fluid w-lg-50 bgi-size-cover bgi-position-center order-1 order-lg-2"
            style={{ backgroundImage: "url(../assets/media/aas/auth-bg.png)" }}
          >
            <div className="d-flex flex-column flex-center py-7 py-lg-15 px-5 px-md-15 w-100">
              <a href={ROUTES.HOME} className="mb-0 mb-lg-12">
                <img
                  alt="Logo"
                  src="../assets/media/logos/keti_logo_w.png"
                  className="h-60px h-lg-75px"
                />
              </a>
              <h1 className="d-none d-lg-block text-white fs-2qx fw-bolder text-center mb-7">
                KETI ezAAS Model Hub
              </h1>
              <div className="d-none d-lg-block text-white fs-base text-center">
                ezAAS Model Hub for Industrial Digital Twin
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
