// src/api/apiRequest.ts
import { ROUTES } from "@/constants/routes";
import { showToast } from "@/utils/toast";
import { redirect } from "next/navigation";

interface ApiRequestParams {
  url: string;
  options?: RequestInit;
  messages?: {
    loading?: string;
    success?: string;
    error?: string;
  };
  responseType?: "json" | "blob";
  errorThrow?: boolean;
  withToast?: boolean;
}

export async function apiRequest({
  url,
  options = {},
  messages = {},
  responseType = "json",
  errorThrow = true,
  withToast = false,
}: ApiRequestParams): Promise<any> {
  const isServer = typeof window === "undefined";

  // Base URL
  const BASE_URL = isServer
    ? `${process.env.NEXT_PUBLIC_AAS_API_BASE_SERVER}:${process.env.NEXT_PUBLIC_AAS_API_PORT_SERVER}`
    // : `${process.env.NEXT_PUBLIC_AAS_API_BASE}:${process.env.NEXT_PUBLIC_AAS_API_PORT}`;
    : process.env.NEXT_PUBLIC_AAS_API_PORT 
      ? `${process.env.NEXT_PUBLIC_AAS_API_BASE}:${process.env.NEXT_PUBLIC_AAS_API_PORT}` 
      : process.env.NEXT_PUBLIC_AAS_API_BASE;
  const fullUrl = `${BASE_URL}/${url}`;

  // 기본 설정
  options.headers = {
    ...(options.headers || {}),
  };

  if (isServer) {
    // 서버 환경: 쿠키에서 토큰 추출해 Authorization 헤더 설정
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const token = cookieStore.get("token_message")?.value;

      if (token) {
        options.headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn("Unable to attach Authorization header on server", err);
    }
  } else {
    // 클라이언트 환경: 쿠키에서 토큰 추출하여 Authorization 헤더로 설정
    try {
      console.log("[DEBUG] Client: All cookies:", document.cookie);
      
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token_message="))
        ?.split("=")[1];

      if (token) {
        const decodedToken = decodeURIComponent(token);
        console.log("[DEBUG] Client: Decoded token:", decodedToken.substring(0, 100) + "...");
        
        // 토큰이 JSON 형태인지 확인하고 파싱
        try {
          const tokenData = JSON.parse(decodedToken);
          options.headers["Authorization"] = `Bearer ${JSON.stringify(tokenData)}`;
          console.log("[DEBUG] Client: Token found and set in Authorization header");
        } catch (parseErr) {
          console.warn("[DEBUG] Client: Token is not valid JSON, using as is:", parseErr);
          options.headers["Authorization"] = `Bearer ${decodedToken}`;
        }
      } else {
        console.log("[DEBUG] Client: No token_message cookie found");
      }
    } catch (err) {
      console.warn("[DEBUG] Client: Unable to extract token from cookies", err);
    }
    
    // 쿠키 자동 포함 (백업용)
    options.credentials = "include";
  }

  const toastId =
    !isServer && withToast
      ? showToast.loading(messages.loading || "Loading...")
      : undefined;

  try {
    const response = await fetch(fullUrl, options);
    // console.log(response);

    if (!response.ok) {
      // 401: 인증 만료
      if (response.status === 401) {
        await fetch(
          `${isServer ? process.env.NEXT_PUBLIC_SITE_URL : ""}/api/logout`,
          { method: "POST" }
        );
        if (isServer) {
          redirect(ROUTES.LOGIN);
        } else {
          window.location.replace(ROUTES.LOGIN);
        }
      }

      const json = await response.json();
      if (!errorThrow) return json;

      throw new Error(json.msg || messages.error || "API Error", {
        cause: {
          status: response.status,
          json,
        },
      });
    }

    // 응답 결과 파싱
    const result =
      responseType === "blob" ? await response.blob() : await response.json();

    if ("result" in result && result.result !== "ok") {
      if (!errorThrow) return result;

      throw new Error(result.msg || messages.error || "API Error", {
        cause: { status: response.status, json: result },
      });
    }

    if (!isServer && withToast) {
      showToast.success(messages.success || (result.msg ?? "Success"), {
        id: toastId,
      });
    }

    return responseType === "blob" ? result : (result.data ?? result);
  } catch (error: any) {
    console.log(error);

    if (!isServer) {
      if (toastId) {
        showToast.error(error.message, { id: toastId });
      } else {
        showToast.error(error.message);
      }
      throw error;
    }

    if (isServer && error.message === "NEXT_REDIRECT") {
      throw error; // let Server Component handle redirect
    }
  }
}
