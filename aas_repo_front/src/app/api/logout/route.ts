// app/api/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/logout
 * 인증 쿠키(token_message) 삭제
 *
 * [2026-03-17 Portal 연동 수정]
 * 쿠키 삭제 시 설정(cookie/route.ts)과 동일한 옵션을 사용해야 브라우저가 올바르게 쿠키를 삭제함.
 * domain, httpOnly, secure, sameSite 값이 설정 시와 다르면 쿠키가 삭제되지 않는 문제가 있었음.
 */
export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ success: true });

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    path: "/",
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax" as const,
    ...(isProduction && process.env.NEXT_PUBLIC_COOKIE_DOMAIN
      ? { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN }
      : {}),
    expires: new Date(0),
  };

  // Overwrite cookie with empty value and past expiry to delete it
  res.cookies.set("token_message", "", cookieOptions);

  return res;
}
