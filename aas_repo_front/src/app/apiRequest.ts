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

  const BASE_URL = isServer
    ? `${process.env.NEXT_PUBLIC_AAS_API_BASE_SERVER}:${process.env.NEXT_PUBLIC_AAS_API_PORT_SERVER}`
    : process.env.NEXT_PUBLIC_AAS_API_PORT
      ? `${process.env.NEXT_PUBLIC_AAS_API_BASE}:${process.env.NEXT_PUBLIC_AAS_API_PORT}`
      : process.env.NEXT_PUBLIC_AAS_API_BASE;

  const fullUrl = `${BASE_URL}/${url}`;

  options.headers = {
    ...(options.headers || {}),
  };

  if (isServer) {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const token = cookieStore.get("token_message")?.value;
      if (token) {
        (options.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn("Unable to attach Authorization header on server", err);
    }
  } else {
    try {
      const token = document.cookie
        .split("; ")
        .find((row) => row.startsWith("token_message="))
        ?.split("=")[1];

      if (token) {
        const decodedToken = decodeURIComponent(token);
        try {
          const tokenData = JSON.parse(decodedToken);
          (options.headers as Record<string, string>)["Authorization"] = `Bearer ${JSON.stringify(tokenData)}`;
        } catch {
          (options.headers as Record<string, string>)["Authorization"] = `Bearer ${decodedToken}`;
        }
      }
    } catch (err) {
      console.warn("Unable to extract token from cookies", err);
    }
    options.credentials = "include";
  }

  const toastId =
    !isServer && withToast
      ? showToast.loading(messages.loading || "Loading...")
      : undefined;

  try {
    const response = await fetch(fullUrl, options);

    if (!response.ok) {
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
        cause: { status: response.status, json },
      });
    }

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
    if (!isServer) {
      if (toastId) {
        showToast.error(error.message, { id: toastId });
      } else {
        showToast.error(error.message);
      }
      throw error;
    }

    if (isServer && error.message === "NEXT_REDIRECT") {
      throw error;
    }
  }
}
