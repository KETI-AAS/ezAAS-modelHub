// src/providers/AuthProvider.tsx
"use client";

import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ROUTES, canAccessPath } from "@/constants/routes";
import type { AuthTokenData, TokenPayload, TokenProfile } from "@/types/auth";
import { showToast } from "@/utils/toast";
import { signUp, loginWithCredentials } from "@/api/index";
import { jwtDecode } from "jwt-decode";
import { useLanguage } from "./LanguageContext";

interface AuthContextType {
  user: TokenProfile | null;
  isAuthenticated: boolean;
  authToken: AuthTokenData | undefined;
  login: (email: string, password: string, redirectUrl?: string) => Promise<string | void>;
  logout: () => Promise<void>;
  loginWithSocial: (social: "google" | "naver") => void;
  signUpWithCredential: (email: string, password: string) => Promise<void>;
  language: ReturnType<typeof useLanguage>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({
  tokenMessage,
  children,
}: {
  tokenMessage: string;
  children: React.ReactNode;
}) => {
  const [authToken, setAuthToken] = useState<AuthTokenData | undefined>(() => {
    let authToken: AuthTokenData | undefined;
    try {
      authToken = JSON.parse(tokenMessage);
      if (typeof authToken?.target !== "string" || !authToken.target.startsWith("AASREPO")) {
        authToken = undefined;
      }
    } catch (error) {
    } finally {
      return authToken;
    }
  });
  const [payload, setPayload] = useState<TokenPayload | undefined>(() => {
    return authToken
      ? jwtDecode<TokenPayload>(authToken.payload.jwt_access_token)
      : undefined;
  });
  const [user, setUser] = useState<TokenProfile | null>(() => {
    return payload ? payload.profile : null;
  });

  const router = useRouter();
  const pathname = usePathname();
  const language = useLanguage();

  const isAuthenticated = !!user;
  const allowRender = canAccessPath(pathname, user?.user_group_seq);

  // 로그인 함수 (서버에 토큰 전달)
  // const login = async (email: string, password: string) => {
  //   const token = await loginWithCredentials(email, password);
  //   await fetch("/api/login", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ token }),
  //   });

  //   setAuthToken(token);
  //   const payload = jwtDecode<TokenPayload>(token.payload.jwt_access_token);
  //   setPayload(payload);
  //   setUser(payload.profile);

  //   router.replace(ROUTES.HOME);
  // };

  /**
   * 로그인 함수
   * @param email 사용자 이메일
   * @param password 사용자 비밀번호
   * @param redirectUrl (선택) Portal에서 전달된 복귀 URL
   *
   * [2026-03-17 Portal 연동 수정]
   * - redirectUrl 파라미터 추가: Portal→Hub 로그인 후 Portal로 복귀하기 위함
   * - 보안: redirectUrl이 Portal 도메인(https://portal.ezmodel-hub.re.kr)으로 시작하는 경우에만 리다이렉트
   *   → 오픈 리다이렉트 취약점 방지
   */
  const login = async (email: string, password: string, redirectUrl?: string) => {
  try {
    const token = await loginWithCredentials(email, password);

    // 1. 데이터 구조 안전성 체크
    if (!token || !token.payload || !token.payload.jwt_access_token) {
      console.error("Invalid token structure received:", token);
      return showToast.error("로그인 정보가 올바르지 않습니다.");
    }

    // 쿠키 설정을 위한 API 호출
    await fetch("/api/auth/cookie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    setAuthToken(token);

    // 2. 안전하게 토큰 디코딩
    const payload = jwtDecode<TokenPayload>(token.payload.jwt_access_token);
    setPayload(payload);
    setUser(payload.profile);

    // 3. Portal 복귀 URL이 있으면 cross-origin 이동, 그 외에는 홈으로 이동
    // 보안: 반드시 허용된 Portal 도메인으로 시작하는지 검증 (오픈 리다이렉트 방지)
    // NEXT_PUBLIC_PORTAL_URL은 .env.production에서 설정 (예: https://portal.ezmodel-hub.re.kr)
    const ALLOWED_REDIRECT_ORIGIN = process.env.NEXT_PUBLIC_PORTAL_URL || "";
    if (ALLOWED_REDIRECT_ORIGIN && redirectUrl && redirectUrl.startsWith(ALLOWED_REDIRECT_ORIGIN)) {
      window.location.href = redirectUrl;  // cross-origin 이동 (router.replace 불가)
    } else {
      router.replace(ROUTES.HOME);
    }
  } catch (error) {
    console.error("Login process failed:", error);
    showToast.error("로그인 중 오류가 발생했습니다.");
  }
};

  // 로그아웃 함수 (서버에 쿠키 삭제 요청)
  const logout = useCallback(async () => {
    await fetch("/api/logout", { method: "POST" });
    setAuthToken(undefined);
    setUser(null);
    setPayload(undefined);
    // 로그아웃 후 전체 페이지를 다시 로드하여 서버 쿠키도 완전히 삭제
    window.location.href = ROUTES.LOGIN;
  }, []);

  // 소셜 로그인 (팝업으로 열기)
  const loginWithSocial = (social: "google" | "naver") => {
    const left = window.screen.width / 2 - 800 / 2;
    const top = window.screen.height / 2 - 600 / 2;
    const socialUrl = `${process.env.NEXT_PUBLIC_AAS_API_BASE}${process.env.NEXT_PUBLIC_AAS_API_PORT}/${social}/login`;

    window.open(
      socialUrl,
      "_blank",
      `width=800,height=600,left=${left},top=${top}`
    );
  };

  // postMessage로 소셜 토큰 받아서 처리
  // useEffect(() => {
  //   const loginMessage = (event: MessageEvent) => {
  //     if (event.data?.type === "login") {
  //       const token = event.data.token;
  //       if (!token) return;

  //       console.log("[DEBUG] Login: Sending token to /api/login:", token);
  //       fetch("/api/login", {
  //         method: "POST",
  //         headers: { "Content-Type": "application/json" },
  //         body: JSON.stringify({ token }),
  //       }).then((response) => {
  //         console.log("[DEBUG] Login: Response status:", response.status);
  //         console.log("[DEBUG] Login: Response headers:", response.headers);
  //         return response.json();
  //       }).then((data) => {
  //         console.log("[DEBUG] Login: Response data:", data);
  //         setAuthToken(token);
  //         const payload = jwtDecode<TokenPayload>(
  //           token.payload.jwt_access_token
  //         );
  //         setPayload(payload);
  //         setUser(payload.profile);

  //         router.replace(ROUTES.HOME);
  //       });
  //     }
  //   };

  //   window.addEventListener("message", loginMessage);
  //   return () => window.removeEventListener("message", loginMessage);
  // }, []);

  useEffect(() => {
    const loginMessage = (event: MessageEvent) => {
      if (event.data?.type === "login") {
        const token = event.data.token;
        if (!token) return;

        console.log("[DEBUG] Login: Sending token to /api/auth/cookie:", token);
        fetch("/api/auth/cookie", { 
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).then((response) => {
          console.log("[DEBUG] Login: Response status:", response.status);
          return response.json();
        }).then((data) => {

          console.log("[DEBUG] Login: Response data:", data);
          
          setAuthToken(token);
          const payload = jwtDecode<TokenPayload>(
            token.payload.jwt_access_token
          );
          setPayload(payload);
          setUser(payload.profile);

          router.replace(ROUTES.HOME);
        }).catch((err) => {
          console.error("SNS Cookie setting failed:", err);
        });
      }
    };

    window.addEventListener("message", loginMessage);
    return () => window.removeEventListener("message", loginMessage);
  }, [router]); 



  useEffect(() => {
    // 로그인 페이지에서는 세션 만료 체크를 하지 않음
    if (pathname === ROUTES.LOGIN) {
      return;
    }

    if (payload) {
      const timeUntilLogout = payload.exp * 1000 - Date.now();

      if (timeUntilLogout <= 0) {
        logout();
      } else {
        const timeUntil30MLogout = setTimeout(
          () => {
            showToast.warning("로그인 유효 시간이 30분 남았습니다.", {
              duration: Infinity,
            });
          },
          timeUntilLogout - 30 * 60 * 1000
        );

        const timeUntil5MLogout = setTimeout(
          () => {
            showToast.warning("로그인 유효 시간이 5분 남았습니다.", {
              duration: Infinity,
            });
          },
          timeUntilLogout - 5 * 60 * 1000
        );

        const timeout = setTimeout(() => {
          logout();
          showToast.warning("로그인 유효 시간이 만료되어 로그아웃되었습니다.", {
            duration: Infinity,
          });
        }, timeUntilLogout);

        return () => {
          clearTimeout(timeUntil30MLogout);
          clearTimeout(timeUntil5MLogout);
          clearTimeout(timeout);
        };
      }
    }
    // payload가 없어도 로그인 페이지에서는 logout 호출하지 않음
  }, [payload, pathname, logout]);

  // 회원가입
  const signUpWithCredential = async (email: string, password: string) => {
    try {
      await signUp(email, password);
      router.replace(ROUTES.LOGIN);
    } catch (error) {}
  };

  // 권한 미충족 시 리디렉션
  useEffect(() => {
    if (!isAuthenticated) {
      if (allowRender === "forbidden" && pathname !== ROUTES.HOME) {
        router.replace(ROUTES.HOME);
        return;
      } else {
        return;
      }
    }

    // 로그인한 경우 메인페이지 이동
    if (pathname === ROUTES.LOGIN && isAuthenticated) {
      router.replace(ROUTES.HOME);
      return;
    }

    if (allowRender === "forbidden" && pathname !== ROUTES.UNAUTHORIZED) {
      router.replace(ROUTES.UNAUTHORIZED);
      return;
    }

    if (allowRender === "allow") return;
  }, [pathname, isAuthenticated, allowRender]);

  if (pathname === ROUTES.LOGIN && isAuthenticated) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        authToken,
        login,
        logout,
        loginWithSocial,
        signUpWithCredential,
        language,
      }}
    >
      {allowRender === "allow" && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
