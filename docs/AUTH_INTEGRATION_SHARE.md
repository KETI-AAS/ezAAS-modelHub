# 허브 로그인 코드 공유본
현재 저장소 소스 기준입니다. 운영 접속 테스트는 하지 않았습니다. 실제 비밀번호, JWT 서명 키, 클라이언트 시크릿, 사용자 토큰은 포함하지 않았으며 설정 파일은 제외했습니다. 처리용 변수명은 유지했습니다. 아래는 원본 코드 발췌로 독립 실행용이 아닙니다.
## 주소 및 연동 방식
- 허브: https://ezmodel-hub.re.kr
- 로그인 화면: https://ezmodel-hub.re.kr/login
- 로그인 API: POST https://ezmodel-hub.re.kr/api/login → 내부 http://backend:8000/login
- 쿠키 설정: POST https://ezmodel-hub.re.kr/api/auth/cookie
- 기존 Portal(별도 서비스, Capability 아님): https://portal.ezmodel-hub.re.kr
- 공유 쿠키 도메인(운영 문서): .ezmodel-hub.re.kr
- Capability: Portal과 별개의 서비스(사용자 확인). 주소 및 허브와의 도메인 관계는 미확인입니다.
근거: docs/DEPLOY_CHECKLIST.md:195–201, aas_repo_docker/conf.d/default.conf. 허브와 Portal은 같은 상위 도메인의 다른 호스트(origin)이며 하위 경로 구조가 아닙니다. .env.production은 현재 폴더에 없어 운영 환경변수 적용 여부는 미확인입니다.
## 인증 구조
POST /login → authLoginEvent → PostgreSQL 사용자 조회 → bcrypt 검증 → JWT 발급 → 프론트가 응답 data를 받아 /api/auth/cookie 호출 → token_message 쿠키 저장 → React 상태 반영 → 홈 또는 Portal 이동.
응답 data: { "target": "<인증 대상 설정값>", "payload": { "jwt_access_token": "<실제 토큰 삭제>" } }
Authorization은 Bearer 뒤에 JWT만 넣는 형식이 아니라 위 객체 전체의 JSON 문자열을 붙입니다. 쿠키에도 같은 객체를 저장합니다. verify_token은 target, JWT 서명·만료, 발급자, profile을 검증하여 사용자 정보를 반환합니다.
라우터에서 /me, /userinfo, /whoami는 찾지 못했습니다. /user/info/{user_seq}는 지정 사용자 조회로 /me와 다릅니다. 현재 사용자 정보는 JWT profile을 사용합니다. 프론트 jwtDecode는 서명 검증이 아닙니다.
쿠키 옵션: path=/, httpOnly=false, sameSite=lax, production에서 secure=true. domain은 production이고 NEXT_PUBLIC_COOKIE_DOMAIN이 있을 때만 설정됩니다. 일반 로그인 흐름에서 별도 서버 세션 생성은 확인되지 않습니다.
## 구현상 확인 사항
- 빈 아이디/비밀번호는 result=ok, data=""로 응답하지만 JWT는 발급되지 않으며 프론트 토큰 구조 검사에서 실패 처리됩니다.
- 프론트는 쿠키 설정 API 성공 여부를 검사하지 않고 상태 반영 및 이동을 진행합니다.
- 복귀 URL 검사는 startsWith 문자열 비교입니다.
- apiRequest에 쿠키/토큰 일부를 출력하는 디버그 로그가 있습니다. 실제 로그 값은 이 문서에 포함하지 않았습니다.
- SECRET_KEY 등은 설정에서 읽는 변수입니다. 실제 키 값과 설정 파일은 첨부하지 않았습니다. 구현 코드는 변경하지 않았습니다.

## 로그인 API

원본: aas_repo_back/router/auth.py:25
```python
# login 
@router.post("/login", tags=['인증'], summary='로그인', description="로그인처리")
async def authLogin(body: dict):
    user_id = ""
    user_pw = ""

    if 'id' in body:
        user_id = body['id'] 
    if 'pw' in body:
        user_pw = body['pw'] 
    
    return await authLoginEvent(user_id, user_pw)
```

## 계정 조회 및 비밀번호 검증

원본: aas_repo_back/app/authModule.py:33
```python
async def authLoginEvent(id, pw):
    rstData = { "result" : "error", "msg" : LANG.Message("LANG10000055") , "data" : ""}
    
    if id == "" or id is None or pw == "" or pw is None:
        return JSONResponse(status_code=200, content={ "result" : "ok", "msg" : "Login Sucess!!" , "data" : "" }) 

    try:

        sql = f"""
            select a.user_seq, a.user_id, a.pw_hash, a.user_name, coalesce(a.status, 'Y') as status
                , b.socialaccount_seq as user_social_seq, b.social_id as user_social_id, b.socialprovider_seq as  user_social_provider_seq, null as user_social_provider
                , c.group_seq as user_group_seq, d.group_name as user_group_name
            from aasrepo.users a
            left join aasrepo.socialaccounts b on a.user_seq = b.user_seq
            left join aasrepo.users_group c on a.user_seq = c.user_seq
            left join aasrepo.groups d on c.group_seq = d.group_seq
            where a.user_id = %s
                and coalesce(a.close_timestamp, localtimestamp) >= localtimestamp
            limit 1
        """
        
        rst = await async_postQueryDataSet(sql, None, True, 0, (id, ))

        if rst["result"] != "ok" or len(rst["data"]) == 0:
            return JSONResponse(status_code=200, content=rstData) 
        
        ## 비활성화
        if rst["data"][0]["status"] == "N":
            return JSONResponse(status_code=200, content={ "result" : "error", "msg" : LANG.Message("LANG10000056") , "data" : ""}) 
        
        ##소셜 로그인 유저는 소셜로 로그인 해라는 메시지 리던
        if rst["data"][0]["user_social_seq"] != "" or rst["data"][0]["user_social_seq"] is None:
            return JSONResponse(status_code=200, content={ "result" : "error", "msg" : LANG.Message("LANG10000057") , "data" : ""}) 
        
        hashed_password = rst["data"][0]["pw_hash"]
        token_data =  rst["data"][0]

        token_data.pop("pw_hash", None)
        token_data.pop("status", None)
        
        user_photo_url = ""
        token_data["user_photo_url"] = user_photo_url

        if not check_password(pw, hashed_password):
            return JSONResponse(status_code=200, content={ "result" : "error", "msg" : LANG.Message("LANG10000058") , "data" : ""}) 
        
        #정상일경우 토큰 생성
        encrypt_token = create_access_token(token_data["user_seq"], token_data["user_id"], token_data["user_name"]
                                                , token_data["user_social_seq"], token_data["user_social_id"]
                                                , token_data["user_social_provider_seq"], token_data["user_social_provider"]
                                                , token_data["user_group_seq"], token_data["user_group_name"], user_photo_url)
        


        token = create_full_token(encrypt_token, token_data)
        #print("token", token)

        return JSONResponse(status_code=200, content={ "result" : "ok", "msg" : LANG.Message("LANG10000059") , "data" : token }) 

    except Exception as e:
        return JSONResponse(status_code=500, content=rstData)  
```

## 비밀번호 검증 및 JWT 발급

원본: aas_repo_back/tools/cryptoTool.py:43
```python
def check_password(password, hashed_password):
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))



##토큰 생성(유효기간 일단 하루로 연장)
def create_access_token(user_seq: Union [int, str], user_id: str, user_name: str, user_social_seq: Union [int, str], user_social_id: str
                        , user_social_provider_seq: Union [int, str], user_social_provider: str, user_group_seq: Union [int, str], user_group_name: str, user_photo_url: str=""
                        , expires_delta: int = EXPIRES_DELTA):
    """사용자 정보를 포함하여 JWT 액세스 토큰 생성"""

    lang_code = LANG_CODE

    sql = f"""
    select refcode1 as lang
    from aasrepo.aas_codeinfo
    where code = 'SYS000'
    limit 1

    """

    rst = postQueryDataOne(sql)
    
    ##기본언어가져오기
    if rst["data"] != "":
        lang_code = rst["data"]
    
    payload = {
        "iss": SYSTEM_NAME, 
        "exp": datetime.datetime.utcnow()  + datetime.timedelta(seconds=expires_delta),  # 만료 시간 설정
        "iat": datetime.datetime.utcnow() ,  # 발급 시간 (Issued At)
        
        "profile" : {
            "user_seq": user_seq,
            "user_id": user_id,
            "user_name": user_name,
            "user_social_seq": user_social_seq if user_social_seq else "",
            "user_social_id": user_social_id if user_social_id else "",
            "user_social_provider_seq": user_social_provider_seq if user_social_provider_seq else "",
            "user_social_provider": user_social_provider if user_social_provider else "",
            "user_group_seq": user_group_seq if user_group_seq else "",
            "user_group_name": user_group_name if user_group_name else "",
            "user_photo_url": user_photo_url if user_photo_url else "",
            "lang_code" : str(lang_code), 
        } 
    }

    encoded_jwt = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

##더미 토큰생성
##print(create_access_token(1, 'admin', 'admin', "", "", "", "", "", "", ""))

def create_full_token(encrypt_token, userprofile):
    lang_code = LANG_CODE

    sql = f"""
    select refcode1 as lang
    from aasrepo.aas_codeinfo
    where code = 'SYS000'
    limit 1

    """

    rst = postQueryDataOne(sql)
    
    ##기본언어가져오기
    if rst["data"] != "":
        lang_code = rst["data"]

    userprofile["lang_code"] = str(lang_code)

    return {
                "target" : get_config_value('auth', 'target') ,
                "payload" : {
                    "jwt_access_token" : encrypt_token,
                    #"user" : {
                    #    "profile" : userprofile
                    #}
                }
        }
```

## JWT 검증

원본: aas_repo_back/tools/cryptoTool.py:160
```python
def verify_access_token(token):
    """JWT 액세스 토큰 검증 및 디코딩"""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM) ###정상적인 경우 딕셔너리 반환
    except jwt.ExpiredSignatureError:
        return "Token has expired"
    except jwt.InvalidTokenError:
        return "Invalid token"

```

## 인증 의존성 및 사용자 모델

원본: aas_repo_back/middleware/authMiddleware.py:1
```python
from fastapi import HTTPException, Request
from pydantic import BaseModel
import datetime
import json
import urllib.parse
from typing import Union, Optional

from jose import jwt, JWTError
from config.config import get_section_dict, get_config_value
from tools.cryptoTool import verify_access_token

DEBUG_FLAG = get_config_value("debug", "mode")

AUTH = get_section_dict("auth")


class Token(BaseModel):
    payload: str
    target: str

class Payload(BaseModel):
    jwt_access_token: str

class NomalUser(BaseModel):
    user_seq: Union[int, str]
    user_id: str
    user_name: str
    user_social_seq: Union[int, str]
    user_social_id: str
    user_social_provider_seq: Union[int, str]
    user_social_provider: str
    user_group_seq: Union[int, str]
    user_group_name: str
    user_photo_url: str
    lang_code: str

class TokenPayload(BaseModel):
    iss: str
    exp: int
    iat: int
    profile: NomalUser

VALIDATE_RESULT_EMPTY_TOKEN = "Token is empty"
VALIDATE_RESULT_TOKEN_EXPIRED = "Validity of the token has expired"
VALIDATE_RESULT_INVALID_SIGNATURE = "Signature information of token is incorrect"
VALIDATE_RESULT_UNSUPPORTED_TOKEN = "token of unsupported format"
VALIDATE_RESULT_UNAUTHORIZED_ERROR = "Unauthorized access target."

def get_token_from_request(request: Request) -> Optional[Token]:
    """
    HttpOnly 쿠키 사용으로 로직 변경
    서버 컴포넌트 사용 시 쿠키 세팅이 불가능하여 헤더로 전달
    클라이언트 컴포넌트 사용 시 헤더 세팅이 불가능하여 쿠키로 전달
    
    헤더: Authorization: Bearer <payload>
    쿠키: token_message (URL 인코딩된 JSON 문자열)
    """
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return json.loads(auth_header.removeprefix("Bearer ").strip())

    cookie_raw = request.cookies.get("token_message")
    if cookie_raw:
        return json.loads(urllib.parse.unquote(cookie_raw))

    return None

def verify_token(request: Request) -> NomalUser:
    """
    토큰 검증 후 유효한 사용자 정보를 반환 (토큰 검증이 필수인 경우 사용)
    """
    try:
        # 디버그 모드일땐 토큰 패스쓰루
        # if DEBUG_FLAG == 1:
        #     return NomalUser (
        #         user_seq=1, user_id='admin'
        #             , user_name='관리자'
        #             , user_social_seq="", user_social_id=""
        #             , user_social_provider_seq="", user_social_provider=""
        #             , user_group_seq=1, user_group_name='관리자'
        #             , user_photo_url = "", lang_code = "1"

        #     )
        
        # 토큰 존재 여부 확인
        token_json = get_token_from_request(request)
        if token_json is None:
            raise HTTPException(status_code=401, detail=VALIDATE_RESULT_EMPTY_TOKEN)

        # 타겟 유효성 검사
        if token_json["target"] != AUTH["target"]:
            raise HTTPException(status_code=401, detail=VALIDATE_RESULT_UNAUTHORIZED_ERROR)
        
        # 토큰 검증
        payload = verify_access_token(token_json["payload"]["jwt_access_token"])
        if not isinstance(payload, dict):
            raise HTTPException(status_code=401, detail=VALIDATE_RESULT_INVALID_SIGNATURE)

        payload = TokenPayload(**payload)

        # 만료시간 확인
        now = datetime.datetime.utcnow()
        exp = datetime.datetime.utcfromtimestamp(payload.exp)
        if (exp - now).total_seconds() < 0:
            raise HTTPException(status_code=401, detail=VALIDATE_RESULT_TOKEN_EXPIRED)

        # 발급자 확인
        if payload.iss != get_config_value("service_info", "name"):
            raise HTTPException(status_code=401, detail=VALIDATE_RESULT_INVALID_SIGNATURE)

        # 사용자 정보 포함 여부 확인
        profile = payload.profile
        if profile is None:
            raise HTTPException(status_code=401, detail=VALIDATE_RESULT_INVALID_SIGNATURE)

        return profile

    except JWTError:
        raise HTTPException(status_code=401, detail=VALIDATE_RESULT_INVALID_SIGNATURE)
    except Exception as e:
        print(str(e))
        raise HTTPException(status_code=401, detail=VALIDATE_RESULT_INVALID_SIGNATURE)

def verify_token_optional(request: Request) -> Optional[NomalUser]:
    """
    토큰 검증이 필수가 아닌 경우 사용
    """
    try:
        return verify_token(request)
    except HTTPException:
        return None
```

## 인증 적용 API 예시

원본: aas_repo_back/router/auth.py:95
```python

@router.get('/user/info/{user_seq}', tags=['사용자'], summary='사용자', description="사용자 정보")
async def userInfo(header:Annotated[dict, Depends(verify_token)], user_seq:str = ''):
```

## 쿠키 생성

원본: aas_repo_front/src/app/api/auth/cookie/route.ts:1
```typescript
import { NextRequest, NextResponse } from "next/server";
import type { AuthTokenData } from "@/types/auth";

/**
 * POST /api/auth/cookie
 * 클라이언트로부터 전달받은 token 정보를 쿠키로 설정
 *
 * [2026-03-17 Portal 연동 수정]
 * - httpOnly: false → Portal(portal.ezmodel-hub.re.kr) JS에서 쿠키를 읽을 수 있도록 변경
 * - domain: ".ezmodel-hub.re.kr" → Hub/Portal 서브도메인 간 쿠키 공유
 * - sameSite: "lax" 고정 → 같은 eTLD+1 내에서 안정적으로 동작
 * - secure: isProduction 기반 → NODE_ENV로 판단 (x-forwarded-proto 의존 제거)
 */
export async function POST(req: NextRequest) {
  const { token }: { token: AuthTokenData } = await req.json();

  const response = NextResponse.json({ success: true });

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    path: "/",
    httpOnly: false,  // Portal JS에서 쿠키 접근 허용 (서브도메인 간 토큰 공유 목적)
    secure: isProduction,  // 프로덕션(HTTPS) 환경에서만 secure 플래그 활성화
    sameSite: "lax" as const,  // 같은 eTLD+1(.ezmodel-hub.re.kr) 내 안정적 전송
    ...(isProduction && process.env.NEXT_PUBLIC_COOKIE_DOMAIN && { domain: process.env.NEXT_PUBLIC_COOKIE_DOMAIN }),  // 프로덕션: 서브도메인 간 쿠키 공유 (.env.production의 NEXT_PUBLIC_COOKIE_DOMAIN)
  };

  response.cookies.set("token_message", JSON.stringify(token), cookieOptions);

  return response;
}
```

## 프론트 로그인 요청

원본: aas_repo_front/src/api/index.ts:44
```typescript
export async function loginWithCredentials(
  id: string,
  pw: string
): Promise<AuthTokenData> {
  const url = "login";

  const options = {
    method: "POST",
    body: JSON.stringify({ id, pw }),
    headers: { "Content-Type": "application/json" },
  };
  return apiRequest({ url, options });
}

```

## 공통 API 요청 및 응답 처리

원본: aas_repo_front/src/app/apiRequest.ts:1
```typescript
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
  const serverBase = process.env.NEXT_PUBLIC_AAS_API_BASE_SERVER || "http://backend";
  const serverPort = process.env.NEXT_PUBLIC_AAS_API_PORT_SERVER || "8000";
  const clientBase = process.env.NEXT_PUBLIC_AAS_API_BASE || "/api";
  const clientPort = process.env.NEXT_PUBLIC_AAS_API_PORT;

  let BASE_URL = "";
  if (isServer) {
    if (process.env.NODE_ENV === "production") {
      // 운영 서버(Docker)에서는 docker-compose.yml 및 nginx 설정과 동일하게 내부망 주소를 강제합니다.
      // (운영 서버 .env 파일의 hub-be:8100 오기입으로 인한 500 에러 방지)
      BASE_URL = "http://backend:8000";
    } else {
      // 로컬 개발 환경에서는 환경변수 또는 127.0.0.1:8000 사용
      BASE_URL = process.env.NEXT_PUBLIC_AAS_API_BASE_SERVER 
        ? (process.env.NEXT_PUBLIC_AAS_API_PORT_SERVER ? `${process.env.NEXT_PUBLIC_AAS_API_BASE_SERVER}:${process.env.NEXT_PUBLIC_AAS_API_PORT_SERVER}` : process.env.NEXT_PUBLIC_AAS_API_BASE_SERVER)
        : "http://127.0.0.1:8000";
    }
  } else {
    BASE_URL = process.env.NEXT_PUBLIC_AAS_API_PORT 
      ? `${clientBase}:${clientPort}` 
      : clientBase;
  }
  
  // Clean up BASE_URL if it has a trailing slash, and remove leading slash from url
  BASE_URL = BASE_URL.replace(/\/$/, "");
  const cleanUrl = url.replace(/^\//, "");
  
  const fullUrl = BASE_URL === "/api" ? `${BASE_URL}/${cleanUrl}` : `${BASE_URL}/${cleanUrl}`;

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
        const decodedToken = decodeURIComponent(token);
        try {
          const tokenData = JSON.parse(decodedToken);
          options.headers["Authorization"] = `Bearer ${JSON.stringify(tokenData)}`;
        } catch (parseErr) {
          options.headers["Authorization"] = `Bearer ${decodedToken}`;
        }
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

    if (isServer) {
      throw error; // Re-throw other server-side errors so Next.js error boundary catches them instead of rendering a blank page
    }
  }
}
```

## 초기 사용자 상태 복원

원본: aas_repo_front/src/contexts/AuthContext.tsx:26
```tsx
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
      if (!authToken?.target.startsWith("AASREPO")) {
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
```

## 로그인 성공 후 저장 및 이동

원본: aas_repo_front/src/contexts/AuthContext.tsx:89
```tsx
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
```

## 로그인 버튼 처리

원본: aas_repo_front/src/app/login/LoginContent.tsx:39
```tsx

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
```

