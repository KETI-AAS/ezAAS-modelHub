# feat/local-config-setup → main 병합 검토

> **전략**: A안 (cherry-pick) — main에서 새 브랜치 생성 후 확정된 커밋만 선별 적용  
> **현재 브랜치**: `feat/local-config-setup` | **기준**: `main`  
> **총 커밋**: 35개 | **총 파일**: 63개

---

## 상태 범례

| 기호 | 의미 |
|------|------|
| `[ ]` | 미검토 |
| `[✅]` | main 포함 확정 |
| `[❌]` | main 제외 확정 |
| `[⚠️]` | 파일/hunk 단위 분리 필요 → 아래 섹션 참조 |

---

## 혼재 커밋 처리 방법

> 하나의 커밋에 "포함할 변경"과 "제외할 변경"이 섞인 경우

### 케이스 1 — 파일 단위 분리 (특정 파일만 제외)
```bash
git cherry-pick -n <SHA>        # 스테이징만 하고 커밋 안 함
git restore --staged <제외파일>  # 스테이징에서 제거
git restore <제외파일>           # 워킹트리도 원복
git commit -m "..."             # 나머지만 커밋
```

### 케이스 2 — hunk 단위 분리 (같은 파일 내 일부 줄만 제외)
```bash
git cherry-pick -n <SHA>
git add -p <해당파일>  # 인터랙티브 스테이징 (y/n/s 로 hunk 선택)
git checkout -- <해당파일>  # 스테이징 안 된 변경 버림
git commit -m "..."
```

### 케이스 3 — 특정 파일의 특정 버전만 가져오기
```bash
git checkout <SHA> -- <파일경로>  # 해당 커밋 시점의 파일로 덮어쓰기
git add <파일경로>
git commit -m "..."
```

---

## 1. 명확히 포함 — 바로 결정 가능

### 버그픽스

---

**`[ ✅  ]` `be47bb2` → `b2e1abf` → `5c6263a` — multipart 50MB 패치 (3개 커밋, 연속)**

- **변경 파일**: `main.py`, `main_nginx.py`
- **실제 변경**: FastAPI의 multipart 파서 `max_part_size` 기본값(1MB)을 52428800(50MB)으로 패치.  
  `starlette.formparsers.MultiPartParser.max_part_size` 를 앱 시작 시 monkey-patch.
- **판단 근거**: 파일 업로드 실패 버그 수정. 순수 기능 버그픽스. Portal/서버 무관.
- **주의**: 3개 커밋이 같은 파일 반복 수정. cherry-pick 시 최신 커밋(`5c6263a`) 하나만 해도 되나 확인 필요.  
  → 또는 3개 순서대로 cherry-pick (충돌 없음).

---

**`[ ✅ ]` `ee8673e` — Backend: userinfo dict/object 호환 + meta_search SQL 리팩터링**

- **변경 파일**: `aasInstanceModule.py`, `aasModelModule.py`
- **실제 변경**:
  - `aasInstanceModule.py`: userinfo를 dict/object 양쪽으로 받을 수 있도록 `isinstance` 분기 추가.  
    기존엔 특정 호출 경로에서 dict로 넘어오면 `AttributeError` 발생.  
    + `server_created`/`server_path` 플래그 추가 (프론트 버튼 상태 판별용).  
    + f-string 중첩 제거 (`submodel_tbl_sql` 변수 분리).
  - `aasModelModule.py`: `meta_search_sql`, `create_user_filter` 변수 추출 (f-string 중첩 해소).
- **판단 근거**: AttributeError 실제 발생 버그 수정. SQL 가독성 개선은 동반 리팩터링.  
  주석이 많이 추가되었으나 버그 원인 설명 주석이라 허용 범위.
- **포함 시 주의**: `userinfo.user_seq` 직접 참조(`submodel_tbl_sql` 내)가 남아있음 — dict 전달 시 깨질 수 있음. 확인 필요.

---

**`[ ✅ ]` `1a645a8` — jdbcTool: JAVA_HOME fallback**

- **변경 파일**: `tools/jdbcTool.py`
- **실제 변경**: `os.getcwd()` 기반 JDK 경로 → `__file__` 기반 절대경로로 수정.  
  로컬 jdk 폴더 없으면 시스템 `JAVA_HOME` 환경변수로 폴백.
- **판단 근거**: 실행 디렉토리에 따라 경로가 틀려지는 버그 수정. 순수 버그픽스.

---

**`[ ✅ ]` `8928229` — Cookie route: HTTPS detection**

- **변경 파일**: `aas_repo_front/src/app/api/auth/cookie/route.ts`
- **실제 변경**: `x-forwarded-proto` 헤더 값으로 실제 HTTPS 여부 감지 후 `Secure` 쿠키 플래그 설정.  
  기존엔 고정값 또는 잘못된 감지로 HTTPS 환경에서 쿠키가 거부되는 문제.
- **판단 근거**: 운영 환경 로그인 불가 버그 수정. Portal 무관.

---

**`[  ]` `736a7e7` — Frontend TS 오류 + 빌드 설정 수정**

- **변경 파일**: 프론트 10개 파일
- **실제 변경**:
  - `routes.ts`: `RouteParam` 타입 추가 (TS2345 오류 수정)
  - `instance/page.tsx`: format 파라미터 타입 수정, `source` 필드 제거, `tableColumns` 타입 수정
  - `AASTreeModal.tsx`, `ModelForm.tsx`: `import _ from 'lodash'` → `import set from 'lodash/set'` (트리 쉐이킹)
  - `AASTreeModal.tsx`: `AASTree` dynamic import (SSR 하이드레이션 오류 수정)
  - `ClientLayout.tsx`: ReactQueryDevtools 제거 (프로덕션 불필요)
  - `next.config.mjs`: deprecated `swcMinify` 옵션 제거
  - `tailwind.config.js`: ESM → CJS 호환 수정
  - `package.json`: `--turbo` 플래그 제거 (불안정성 워크어라운드)
- **판단 근거**: TS 빌드 오류, SSR 버그, 번들 최적화. 순수 버그픽스.

---

**`[✅  ]` `c179903` — 보안: 프론트 console.log 제거**

- **변경 파일**: 프론트 11개 파일 (`api/index.ts`, `apiRequest.ts`, `AuthContext.tsx` 등)
- **실제 변경**: JWT 토큰, 쿠키 데이터를 출력하는 `console.log` 전체 제거.
- **판단 근거**: 시크릿 노출 보안 수정. 즉시 포함 필요.

---

**`[ ✅ ]` `b359363` — 보안: loggerTool 시크릿 마스킹**

- **변경 파일**: `aas_repo_back/tools/loggerTool.py`
- **실제 변경**: `_sanitize()` 함수 추가. password, token, key 등 민감 키워드를 `***` 로 마스킹 후 로그/DB 저장.
- **판단 근거**: 시크릿 노출 보안 수정. 즉시 포함 필요.

---

**`[ ✅ ]` `d81b48b` — Footer copyright 연도 수정**

- **변경 파일**: `Footer.tsx`
- **실제 변경**: copyright 연도 업데이트.
- **판단 근거**: 단순 UI 수정.

---

**`[ ✅ ]` `2013c46` — front gitignore: next-env.d.ts, yarn.lock 제외**

- **변경 파일**: `aas_repo_front/.gitignore`
- **실제 변경**: `.gitignore`에 자동생성 파일 패턴 추가.
- **판단 근거**: 저장소 관리 수정. 부작용 없음.

---

### Docker 빌드 수정

---

**`[  ]` `5ac9383` → `d706321` → `c551ec0` → `e127822` — Docker: yarn + node:20 전환 (4개 커밋)**

- **변경 파일**: `aas_repo_front/Dockerfile`
- **실제 변경**: `npm` → `yarn`, `node:18` → `node:20` 전환.  
  corepack 비활성화/재활성화, `--ignore-engines` 옵션 추가.  
  이유: `@tanstack` 패키지가 Node >= 22 요구, yarn lockfile 충돌 해결.
- **판단 근거**: Docker 빌드 실패 수정. 운영 배포에 필수.

---

**`[  ]` `ec9a384` — 보안: redirect 강화 + Docker non-root + Next.js CVE 패치**

- **변경 파일**: `front/Dockerfile`, `docker-entrypoint.sh`, `package.json`, `AuthContext.tsx`
- **실제 변경**:
  - `AuthContext.tsx`: `redirectUrl.startsWith(portal)` → `URL.origin` 비교 (오픈 리다이렉트 우회 방지)  
    → Portal URL이 없으면 `isAllowedRedirect=false` → 기존 동작과 동일. Portal 없어도 안전.
  - `Dockerfile`: non-root `appuser` 생성, `npm ci --ignore-scripts` (악성 postinstall 차단)
  - `docker-entrypoint.sh`: `escape_js()` 추가 (RUNTIME_* 환경변수 JS 인젝션 방지), `set -eu`
  - `package.json`: `next ^15.2.2 → ^15.5.0` (CVE-2025-29927 패치), `eslint-config-next` 동반 업
- **판단 근거**: 4개 파일 모두 보안/안정성 수정. Portal 없어도 동작. 포함 강력 권장.

---

## 2. 검토 필요 — 직접 확인 후 결정

### 런타임 설정 분리 (Portal 연동과 묶여있지만 범용 인프라)

---

**`[  ]` `d402850` — [Security][Config][Infra] 대형 커밋 (21개 파일) ⚠️ 파일별 분리 필요**

> 이 커밋 전체를 cherry-pick하면 안 됩니다. 파일별로 판단하세요.

| 파일 | 변경 내용 | 판단 방향 | 주의사항 |
|------|-----------|-----------|---------|
| `.gitignore` (루트) | `.env`, `jdk/` 등 민감 파일 제외 패턴 추가 | `[  ]` 포함 권장 | |
| `aas_repo_back/.env` | **삭제** — `.env`를 git에서 제거 | `[  ]` 포함 권장 | main에 `.env`가 커밋되어 있는지 먼저 확인 |
| `aas_repo_back/.gitignore` | `.env`, `nohup.out`, `config.prod.yaml` 등 제외 | `[  ]` 포함 권장 | |
| `aas_repo_back/nohup.out` | **삭제** — 실수로 커밋된 로그 파일 | `[  ]` 포함 권장 | |
| `aas_repo_back/Dockerfile` | CMD를 `main_nginx.py`로 통일 (기존: `uvicorn main:app`) | `[  ]` 포함 권장 | |
| `aas_repo_back/config/config.py` | **⚠️ APP_ENV 없으면 RuntimeError** → 기존 서버가 APP_ENV 미설정이면 시작 불가 | `[  ]` **위험 — 반드시 확인** | main의 `config.py` 현재 상태 확인 필요. 기존 배포 APP_ENV 설정 여부 확인 |
| `aas_repo_back/config/config.yaml` | **삭제** — gitignore로 이동 | `[  ]` **위험 — 반드시 확인** | main에서 `config.yaml`로 운영 중이면 삭제 시 기존 배포 깨짐 |
| `aas_repo_back/start.local.ps1` | 신규: 로컬 전용 시작 스크립트 (preflight 포함) | `[  ]` 포함 가능 | 로컬 편의용 스크립트, 운영에 영향 없음 |
| `aas_repo_back/start.prod.ps1` | 신규: 운영 전용 시작 스크립트 (4 workers) | `[  ]` 포함 가능 | |
| `aas_repo_back/start.ps1` | 2줄 수정 — APP_ENV 분기 추가 (하지만 `e7853ad`와 별개) | `[  ]` 검토 필요 | |
| `aas_repo_docker/.env.example` | 신규: 서버 관리자용 .env 템플릿 | `[  ]` 포함 권장 | |
| `aas_repo_docker/.gitignore` | `.env`, `data/`, `ssl/` 등 제외 | `[  ]` 포함 권장 | |
| `aas_repo_docker/docker-compose.yml` | `POSTGRES_PASSWORD: ipx...` → `${POSTGRES_PASSWORD}` 변수화, `APP_ENV=prod` 추가 | `[  ]` 포함 권장 | 하드코딩 패스워드 제거 — 보안 수정 |
| `aas_repo_docker/docker-compose_bak.yml` | 동일한 패스워드 변수화 | `[  ]` 포함 권장 | |
| `aas_repo_front/.env.development` | **삭제** — gitignore 이동 | `[  ]` 검토 필요 | main에서 이 파일로 로컬 개발 중이면 삭제 전 별도 보관 |
| `aas_repo_front/.env.production` | **삭제** — gitignore 이동 | `[  ]` 검토 필요 | 운영 서버가 이 파일을 git에서 받아 사용 중이면 위험 |
| `aas_repo_front/.gitignore` | `.env.*`, `env-config.js` 제외 | `[  ]` 포함 권장 | |
| `aas_repo_front/Dockerfile` | `CMD` → `ENTRYPOINT ["./docker-entrypoint.sh"]` | `[  ]` 포함 권장 | `docker-entrypoint.sh`와 쌍으로 포함해야 함 |
| `aas_repo_front/docker-entrypoint.sh` | 신규: 컨테이너 시작 시 `window.__ENV__` 주입 (`env-config.js` 생성) | `[  ]` 포함 권장 | `runtimeConfig.ts`와 쌍으로 필요 |
| `aas_repo_front/src/utils/runtimeConfig.ts` | 신규: `getRuntimeConfig()` — `window.__ENV__` (클라이언트) / `process.env` (SSR) 통합 접근 | `[  ]` 포함 권장 | 67bb61a, 65f2968의 기반 파일. 이게 없으면 저 커밋들도 안 됨 |
| `DEPLOY_CHECKLIST.md` | 배포 가이드 문서 | `[❌]` 제외 | 브랜치 전용 작업 문서 |

---

**`[  ]` `30ed1e7` — Frontend entrypoint 수정 + layout.tsx script 추가 ⚠️ 파일별 분리 필요**

- **변경 파일**: `.gitignore`, `DEPLOY_CHECKLIST.md`, `docker-entrypoint.sh`, `package.json`, `layout.tsx`
- **파일별 판단**:

  | 파일 | 변경 내용 | 판단 |
  |------|-----------|------|
  | `docker-entrypoint.sh` | heredoc 오류 수정 → `window.__ENV__` 정상 주입 | `[  ]` 포함 필요 — d402850의 버그 수정 |
  | `layout.tsx` | `<script src="/env-config.js" />` 추가 | `[  ]` 포함 필요 — 없으면 브라우저에서 `window.__ENV__` 로드 안 됨 |
  | `package.json` | `dev:turbo`, `dev:webpack` 스크립트 추가 | `[  ]` 포함 가능 (개발 편의) |
  | `.gitignore` | `.jar` → `*.jar` 패턴 수정 | `[  ]` 포함 권장 |
  | `DEPLOY_CHECKLIST.md` | 문서 업데이트 | `[❌]` 제외 |

---

**`[  ]` `67bb61a` — process.env → getRuntimeConfig() 전환 (API base URL)**

- **변경 파일**: `apiRequest.ts`, `AuthContext.tsx`, `useQueryCustom.ts`
- **실제 변경**: `process.env.NEXT_PUBLIC_AAS_API_BASE/PORT` 직접 참조 → `getRuntimeConfig()` 사용.  
  이유: `.env.production` 없이 빌드하면 `process.env.*`가 `undefined`로 구워져서 API 호출 전부 실패.  
  `getRuntimeConfig()`는 런타임에 `window.__ENV__`를 읽어 정상 동작.
- **판단 근거**: Portal과 무관한 인프라 수정. `.env.production` 없는 환경에서 API 호출 깨지는 버그 수정.
- **의존성**: `d402850`의 `runtimeConfig.ts` + `30ed1e7`의 `layout.tsx` 가 없으면 동작 안 함.

---

**`[  ]` `65f2968` — PORTAL_URL도 getRuntimeConfig()로 전환**

- **변경 파일**: `Header.tsx`
- **실제 변경**: `process.env.NEXT_PUBLIC_PORTAL_URL` → `getRuntimeConfig().PORTAL_URL`  
  이유: 동일 — build-time 바인딩 → runtime 주입으로 변경.
- **판단 근거**: Portal URL이 없는 환경에서는 포털 버튼 자체가 미노출 (`isAuthenticated` 조건부 렌더링).  
  Portal 없어도 부작용 없음.
- **의존성**: `runtimeConfig.ts` 필요.

---

### Portal 연동

---

**`[  ]` `7f5e555` — Auth/Header: portal redirect 시 JWT 토큰 + profile null 체크**

- **변경 파일**: `Header.tsx`, `AuthContext.tsx`
- **실제 변경**:
  - `AuthContext.tsx`: portal redirect URL 있을 때 `?token=<jwt>` 붙여서 이동 (로그인 후 / 세션 복원 후 두 경로 모두).
  - `Header.tsx`: `profile?.user_seq` → `profile &&` null 체크 래핑 (undefined user_seq로 Link 렌더링 방지).
- **판단 방향**: 두 변경이 한 파일(AuthContext)에 혼재.
  - `profile` null 체크 → 순수 버그픽스. 포함 필요.
  - JWT token append → Portal redirect 전용. `ALLOWED_REDIRECT_ORIGIN` 비어있으면 완전히 inactive.
  - 파일 분리는 어렵고, Portal URL 없으면 로직 자체가 실행 안 됨 → **포함해도 무해**.
- **결론**: `[  ]` 포함 권장 (Portal 없는 환경에서도 부작용 없음)

---

**`[  ]` `2f81817` — Portal deploy-status client + instance list 통합**

- **변경 파일**: `aasInstanceModule.py` (수정), `portalClient.py` (신규)
- **실제 변경**:
  - `portalClient.py` 신규: Portal BE에 배포 상태 일괄 조회 (`POST /api/hub/instances/deploy-status`).  
    **config.yaml에 `portal.base_url` / `portal.service_api_key` 없으면 즉시 `return {}` — 허브 응답 절대 차단 안 함.**
  - `aasInstanceModule.py`: 인스턴스 목록 조회 후 `deploy_map` 붙임.  
    Portal 없으면 4개 컬럼(`deploy_job_status` 등)이 전부 `null`로 반환됨.
- **판단 방향**: Portal 없어도 graceful degradation. 단, 인스턴스 목록 응답에 null 컬럼 4개가 추가됨.  
  프론트엔드에서 이 컬럼들을 어떻게 쓰는지 확인 필요 (null이면 UI 오류 없는지).
- **결론**: `[  ]` 검토 후 결정 — Portal 없는 운영 환경에서 영향도 확인 필요

---

**`[  ]` `6480651` — main_nginx: CORS origins → config YAML 외부화**

- **변경 파일**: `aas_repo_back/main_nginx.py`
- **실제 변경**: 하드코딩된 운영 도메인 (`https://ezmodel-hub.re.kr`, `:6200` 등) 제거.  
  `config.yaml`의 `service_info.cors_extra_origins` 목록을 읽어서 spread.  
  `SERVICE_INFO` 접근을 `["key"]` → `.get("key")` 로 변경 (KeyError 방지).  
  `None` 값 필터링 추가.
- **판단 근거**: 하드코딩 도메인 제거는 좋은 변경. Portal 없어도 동작 (미설정 시 빈 리스트).  
  단, 기존 `config.yaml`에 `cors_extra_origins`가 없으면 추가해야 함.
- **결론**: `[  ]` 포함 권장

---

**`[  ]` `77d42ae` — Java 17 경로 + CORS portal origin + Traefik stripprefix ⚠️ 혼재 커밋**

- **변경 파일**: `back/Dockerfile`, `main.py`, `docker-compose-hub.yml`
- **파일별 내용**:

  | 파일 | 변경 내용 | 판단 |
  |------|-----------|------|
  | `back/Dockerfile` | JAVA_HOME/LD_LIBRARY_PATH를 java-11 → java-17로 수정 | `[  ]` **포함 필요** — Java 17 없으면 JVM 시작 실패 |
  | `main.py` | 동일하게 java-11 → java-17. CORS에 `host_portal`, `cors_extra_origins` 추가. None 필터링 | `[  ]` 포함 권장 — Java 경로는 필수. CORS portal 추가는 6480651과 동일 패턴 |
  | `docker-compose-hub.yml` | Traefik `/aas_files` stripprefix 미들웨어 제거 (FastAPI가 full path 마운트) | `[  ]` Traefik 사용 시에만 의미 있음. Traefik 포함 여부에 따라 결정 |

- **cherry-pick 방법**: `docker-compose-hub.yml` 제외하고 싶으면 `cherry-pick -n` 후 파일 restore.

---

### 인프라 / Docker

---

**`[  ]` `7ce0ffe` — Backend preflight 환경 검증 + JVM 절대경로 수정 ⚠️ 혼재**

- **변경 파일**: `back/.gitignore`, `basyxAasenvironmentModule.py`, `start.sh`, `tests/preflight.py`, `jdbcTool.py`

  | 파일 | 변경 내용 | 판단 |
  |------|-----------|------|
  | `basyxAasenvironmentModule.py` | `start_jvm()` jar 경로를 `os.getcwd()` → `__file__` 기반 절대경로. JAR 없으면 `RuntimeError` | `[  ]` **포함 필요** — 실행 디렉토리 의존 버그 수정 |
  | `jdbcTool.py` | `setJavaEnvironment()` 동일하게 절대경로 기반으로 수정 (1a645a8의 후속) | `[  ]` 포함 권장 |
  | `tests/preflight.py` | 신규: 컨테이너 시작 전 6단계 환경 검증 (APP_ENV, config YAML, pip, JAR, JVM, PostgreSQL) | `[  ]` 포함 권장 (Docker 독립 유틸) |
  | `start.sh` | 신규: Linux 서버 기동 스크립트 (DB TCP probe + exec python) | `[  ]` 포함 가능 |
  | `back/.gitignore` | `*.jar` 패턴 추가 | `[  ]` 포함 권장 |

---

**`[  ]` `84035a9` — Docker: Traefik 설정 + preflight init-container**

- **변경 파일**: `aas_repo_docker/.env.hub.example`, `docker-compose-hub.yml`, `traefik.yml`
- **실제 변경**:
  - `docker-compose-hub.yml` **신규 파일**: Traefik 기반 전체 스택 구성.  
    Portainer, PostgreSQL, hub-be-preflight, hub-be, hub-fe 포함.  
    **도메인 `ezmodel-hub.re.kr` 하드코딩. NAS(SSL 종료) → Traefik(HTTP :80) 구조 전제.**
  - `traefik.yml` **신규 파일**: NAS LAN 서브넷 `192.168.1.0/24` 하드코딩 (교체 필요 주석 있음).
  - `.env.hub.example`: 환경변수 템플릿.
- **핵심 질문**: **이 Traefik 설정이 `ezmodel-hub.re.kr` 서버 전용인가, 다른 서버에서도 쓸 수 있는 범용인가?**
  - 범용이면 포함 (도메인은 .env로 분리 후)
  - 특정 서버 전용이면 제외
  - 현재 `docker-compose-hub.yml`에 패스워드 `CHANGE_ME_SECRET` 하드코딩 되어있음 → **포함 전 반드시 제거 필요**

---

**`[  ]` `3bcb101` — Docker: runtime API /api proxy 라우팅**

- **변경 파일**: `aas_repo_docker/docker-compose-hub.yml`
- **실제 변경**: `docker-compose-hub.yml`에서 Traefik을 통한 `/api` 프록시 라우팅 설정.
- **판단**: Traefik 포함 여부에 따라 함께 결정.

---

**`[  ]` `3aabd00` — Docker: postgres port 5432 외부 노출**

- **변경 파일**: `aas_repo_docker/docker-compose-hub.yml`
- **실제 변경**: postgres 컨테이너에 `ports: 5432:5432` 추가.
- **판단**: 로컬 개발 또는 외부 DB 접근 목적. **운영 환경에서는 보안상 노출 안 하는 게 맞음.**  
  → 로컬 전용이면 제외 권장.

---

### 배포 스크립트

---

**`[  ]` `6e121a9` — 로고 업데이트 + portal deploy helper 추가 ⚠️ 혼재**

- **변경 파일**: `deploy-portal.sh` (신규), `ezAAS_logo.svg`, `Header.tsx`, `LoginContent.tsx`, `signup.tsx`

  | 파일 | 변경 내용 | 판단 |
  |------|-----------|------|
  | `ezAAS_logo.svg` | 로고 교체 | `[  ]` 포함 가능 |
  | `Header.tsx`, `LoginContent.tsx`, `signup.tsx` | 로고 적용 | `[  ]` 로고와 쌍으로 포함 가능 |
  | `deploy-portal.sh` | Portal 서버 배포 스크립트 신규 | `[  ]` Portal 서버가 있으면 포함, 없으면 제외 |

---

**`[  ]` `12a6722` + `11df033` + `93325f3` — deploy helper 스크립트 수정 (3개 커밋)**

- **변경 파일**: `deploy-hub.sh`, `deploy-portal.sh`
- **실제 변경**: `deploy-hub.sh` restart/recreate 액션 분리, `--action` 필수 옵션화. 경로 수정.
- **판단**: main에 `deploy-hub.sh`가 있어야 의미 있음. Hub 운영 배포 스크립트이므로 포함 여부 결정 필요.

---

### 로컬 설정 (제외 권장)

---

**`[❌]` `e7853ad` — start.ps1: APP_ENV=local 설정**

- **변경 파일**: `aas_repo_back/start.ps1`
- **실제 변경**: 스크립트 맨 위에 `$env:APP_ENV = "local"` 설정.
- **판단**: **로컬 전용 값. main에 커밋되면 안 됨.** start.ps1의 다른 변경이 있다면 이 줄만 제외하고 cherry-pick.

---

**`[❌]` `808423f` — DEPLOY_CHECKLIST.md 문서**

- **변경 파일**: `DEPLOY_CHECKLIST.md`
- **판단**: 브랜치 작업 중 생성한 내부 문서. main에 넣어도 해는 없지만 필요 없음.

---

## 3. 반드시 확인해야 할 핵심 질문

작업 시작 전 아래 4가지를 먼저 확인하세요. 이 답에 따라 여러 커밋의 포함 여부가 바뀝니다.

### Q1. main 브랜치의 `config.yaml` 현재 상태는?
```bash
git show main:aas_repo_back/config/config.yaml 2>&1 | head -5
```
- 있으면 → `d402850`의 config.yaml 삭제를 cherry-pick 하기 전 운영 서버에서 수동 마이그레이션 필요
- 없으면 → 그대로 적용 가능

### Q2. main 브랜치의 `config.py`에서 APP_ENV 처리 방식은?
```bash
git show main:aas_repo_back/config/config.py | head -30
```
- `APP_ENV` fallback이 있으면 → `d402850`의 config.py 적용 시 기존 서버 시작 불가 위험
- 이미 RuntimeError 방식이면 → 적용 가능

### Q3. Traefik + `docker-compose-hub.yml`을 main에 포함할 것인가?
- 이 서버 전용 인프라라면 → `84035a9`, `3bcb101`, `77d42ae`(docker-compose 부분) 제외
- 범용 배포 설정이라면 → 포함 (단, 패스워드 하드코딩 제거 후)

### Q4. Portal이 없는 환경에서도 `2f81817` (deploy_status) 포함할 것인가?
- null 컬럼 4개가 인스턴스 목록 응답에 추가됨
- 프론트엔드에서 이 컬럼들을 다루는 코드가 있는지 확인
- Portal 연동 없는 환경에서 null 처리가 안 되어 있으면 UI 오류 가능성

---

## 4. cherry-pick 실행 (결정 완료 후)

```bash
# 1. main 기준 새 브랜치 생성
git checkout main
git checkout -b feat/merge-to-main

# 2. 단순 포함 커밋 (오래된 → 최신 순서, 결정된 것만 채울 것)
git cherry-pick <SHA>  # 오래된 것부터

# 3. 파일 분리 필요 커밋 (예: d402850에서 config.yaml 제외)
git cherry-pick -n d402850
git restore --staged aas_repo_back/config/config.yaml
git restore aas_repo_back/config/config.yaml
git restore --staged DEPLOY_CHECKLIST.md
git restore DEPLOY_CHECKLIST.md
git commit -m "..."

# 4. hunk 분리 필요 커밋 (예: 77d42ae에서 docker-compose-hub.yml 제외)
git cherry-pick -n 77d42ae
git restore --staged aas_repo_docker/docker-compose-hub.yml
git restore aas_repo_docker/docker-compose-hub.yml
git commit -m "..."
```

---

## 5. 최종 포함 목록 (결정 후 채울 것)

```
# 오래된 → 최신 순서로 정렬해서 채울 것
```

---

*마지막 업데이트: 2026-04-23*
