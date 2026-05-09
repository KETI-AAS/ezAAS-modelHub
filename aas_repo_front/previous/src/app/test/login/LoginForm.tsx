"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get("redirect");

  useEffect(() => {
    // 이미 인증된 사용자는 리디렉션
    if (isAuthenticated) {
      router.push(redirect || "/");
    }
  }, [isAuthenticated, router, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("사용자 이름과 비밀번호를 입력해주세요");
      return;
    }

    const success = await login(username, password);

    if (success) {
      router.push(redirect || "/");
    } else {
      setError("로그인에 실패했습니다. 사용자 이름과 비밀번호를 확인해주세요.");
    }
  };

  return (
    <div className="d-flex flex-column flex-root">
      <div className="d-flex flex-column flex-lg-row flex-column-fluid">
        <div className="d-flex flex-column flex-lg-row-auto w-xl-600px positon-xl-relative bg-light">
          <div className="d-flex flex-center flex-column flex-column-fluid">
            <div className="w-lg-500px p-10 p-lg-15 mx-auto">
              <form className="form w-100" onSubmit={handleSubmit}>
                <div className="text-center mb-10">
                  <h1 className="text-dark mb-3">로그인</h1>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <div className="fv-row mb-10">
                  <label className="form-label fs-6 fw-bolder text-dark">
                    사용자 이름
                  </label>
                  <input
                    className="form-control form-control-lg form-control-solid"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="fv-row mb-10">
                  <div className="d-flex flex-stack mb-2">
                    <label className="form-label fw-bolder text-dark fs-6 mb-0">
                      비밀번호
                    </label>
                  </div>
                  <input
                    className="form-control form-control-lg form-control-solid"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="text-center">
                  <button
                    type="submit"
                    className="btn btn-lg btn-primary w-100 mb-5"
                  >
                    로그인
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
