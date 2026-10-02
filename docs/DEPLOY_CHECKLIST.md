# 배포 체크리스트 (Deployment Checklist)

> **Zero Leakage 정책**: 🔒 표시 파일은 절대 Git에 커밋하지 않습니다.
> 서버에서 직접 생성·관리해야 하며, `.gitignore`로 추적이 차단되어 있습니다.
>
> **설정 단일화 원칙**: 환경당 설정 파일은 정확히 하나입니다.
> 프론트엔드는 `.env.development`(로컬) / `docker-compose-hub.yml environment:`(운영),
> 백엔드는 `config.local.yaml`(로컬) / `config.prod.yaml`(운영).
> 그 외 `.env` 파일은 불필요하므로 운영 서버에 생성하지 않습니다.

---

## 목차

1. [환경 구분 한눈에 보기](#1-환경-구분-한눈에-보기)
2. [설정 파일 단일화 구조](#2-설정-파일-단일화-구조)
3. [파일별 역할 및 설정 위치](#3-파일별-역할-및-설정-위치)
4. [핵심 설정값 상세 가이드](#4-핵심-설정값-상세-가이드)
5. [배포 워크플로우](#5-배포-워크플로우)
6. [배포 전 Quick-Check](#6-배포-전-quick-check)
7. [비밀값 교체 절차](#7-비밀값-교체-절차)
8. [별도 커밋 대상 (소스 PR)](#8-별도-커밋-대상-소스-pr)

---

## 1. 환경 구분 한눈에 보기

| 구분 | 로컬 (Local) | 운영 (Production) |
|---|---|---|
| **인프라** | 로컬 프로세스 (Docker 없음) | NAS → Traefik → Docker 컨테이너 |
| **SSL 종료** | 없음 (HTTP) | NAS에서 처리. Traefik은 HTTP만 수신 |
| **라우팅** | 없음 (직접 포트 접속) | Traefik 라벨 기반 자동 라우팅 |
| **백엔드 시작** | `start.local.ps1` → `APP_ENV=local` | Docker `CMD python main_nginx.py --workers 4` → `APP_ENV=prod` |
| **백엔드 설정** | 🔒 `config/config.local.yaml` **(1개)** | 🔒 `config/config.prod.yaml` **(1개)** |
| **프론트 설정** | 🔒 `aas_repo_front/.env.development` **(1개)** | `docker-compose.yml` → `environment: RUNTIME_*` **(1개 블록)** |
| **DB 비밀번호** | `config.local.yaml` → `postgres.password` | 🔒 `aas_repo_docker/.env` → `POSTGRES_PASSWORD` |
| **npm build** | `npm run dev` (호스트 직접 실행) | Docker 빌드 스테이지 내부에서 자동 실행. **호스트 불필요** |
| **pip install** | 로컬 venv에서 수동 | Docker 빌드 스테이지 내부에서 자동 실행. **호스트 불필요** |

---

## 2. 설정 파일 단일화 구조

### 2-1. 단일화 근거 및 위험 분석

#### 백엔드 `.env` 파일 제거 근거

운영 서버에는 기존에 `/home/ezmodel-hub/aas_repo_back/.env` 파일이 `DATABASE_URL`, `SECRET_KEY`를 담아
`docker-compose-hub.yml`의 `env_file:`로 주입되고 있었습니다.

**코드 분석 결과:** 백엔드 소스 코드의 어떤 모듈도 `os.environ.get('DATABASE_URL')` 또는
`os.environ.get('SECRET_KEY')`를 읽지 않습니다.

- `tools/cryptoTool.py:10` → `get_config_value('auth', 'JWT_SECRET_KEY')` — YAML에서 읽음
- `tools/loggerTool.py:35` → `get_section_dict('postgres')` — YAML에서 읽음
- DB 접속: `psycopg.connect(host=..., password=...)` — YAML 파싱 값을 직접 전달

**결론:** `.env` 파일은 Docker에 주입은 되지만 애플리케이션이 사용하지 않는 **데드 코드**입니다.
`docker-compose.yml`에서 `env_file:` 행을 제거하고, 운영 서버에 `.env` 파일을 생성하지 않습니다.

#### 프론트엔드 `.env.production` 제거 근거

운영 컨테이너는 `docker-entrypoint.sh`가 `RUNTIME_*` 환경변수를 읽어 `public/env-config.js`를 생성합니다.
브라우저는 `window.__ENV__`를 통해 런타임 설정을 읽으므로 빌드 시점의 `.env.production`이 필요 없습니다.
해당 파일은 `git rm --cached`로 추적 해제되었으며 `.gitignore`에 등록되어 있습니다.

### 2-2. 단일화 후 환경별 설정 파일 구조

```
[로컬 개발]
aas_repo_back/
└── config/config.local.yaml    ← 백엔드 전체 설정 (1개)

aas_repo_front/
└── .env.development             ← 프론트 전체 설정 (1개)

[운영 배포]
aas_repo_back/
└── config/config.prod.yaml     ← 백엔드 전체 설정 (1개)
                                   (.env 없음 — 불필요)

aas_repo_docker/
└── docker-compose.yml          ← RUNTIME_* 환경변수 블록 포함
└── .env                        ← POSTGRES_PASSWORD만 관리 (DB 컨테이너 전용)
```

### 2-3. 단일화 잠재 위험 및 대책

| 위험 | 발생 조건 | 대책 |
|---|---|---|
| 새 YAML 키가 운영에 누락됨 | `config.local.yaml`에 키 추가 후 `config.prod.yaml` 업데이트 누락 | `config.yaml` 템플릿을 항상 먼저 수정하고, 두 환경 파일에 동시 적용 |
| `.env.development` 값이 운영 빌드에 혼입 | 호스트에서 `NODE_ENV=production npm run build` 실행 시 | 운영 빌드는 항상 Docker 내부에서만 수행 (호스트 `npm run build` 금지) |
| `RUNTIME_*` 미설정으로 빈 URL | `docker-compose.yml` `environment:` 블록 누락 | 섹션 4-6의 7개 변수 체크리스트 참고 |
| POSTGRES_PASSWORD 불일치 | `.env`와 `config.prod.yaml postgres.password` 값 상이 | 두 값을 항상 동일하게 유지. DB 비밀번호 변경 시 두 파일 동시 수정 |

---

## 3. 파일별 역할 및 설정 위치

### 3-1. 백엔드 설정

| 파일 | Git 추적 | 환경 | 역할 |
|---|---|---|------|
| `aas_repo_back/config/config.yaml` | ✅ 커밋 가능 | 공통 | 구조 템플릿. 실제 값 없음. 새 키 추가 시 이 파일 먼저 수정. |
| 🔒 `aas_repo_back/config/config.local.yaml` | ❌ 제외 | Local | DB·OAuth·JWT·SMTP 등 모든 민감값 |
| 🔒 `aas_repo_back/config/config.prod.yaml` | ❌ 제외 | Prod | 운영 DB·JWT·CORS extra origins·SMTP 등 |
| `aas_repo_back/config/config.py` | ✅ 커밋 가능 | 공통 | `APP_ENV` 미설정 시 즉시 `RuntimeError`. 무음 폴백 없음. |
| `aas_repo_back/Dockerfile` | ✅ 커밋 가능 | Prod | `CMD python main_nginx.py --workers 4` |
| `aas_repo_back/start.local.ps1` | ✅ 커밋 가능 | Local | `APP_ENV=local` 로컬 기동 |
| `aas_repo_back/start.prod.ps1` | ✅ 커밋 가능 | Prod | `APP_ENV=prod` 운영 기동 (Docker 외 직접 실행 시) |
| `aas_repo_back/start.ps1` | ✅ 커밋 가능 | Local | `start.local.ps1` 하위 호환 별칭 |
| ~~`aas_repo_back/.env`~~ | ❌ **생성 금지** | — | **불필요** — 애플리케이션 코드가 읽지 않음. 생성하지 말 것. |

### 3-2. 프론트엔드 설정

| 파일 | Git 추적 | 환경 | 역할 |
|---|---|---|------|
| 🔒 `aas_repo_front/.env.development` | ❌ 제외 | Local | 로컬 개발용 `NEXT_PUBLIC_*` 변수 (빌드 타임 주입) |
| ~~`aas_repo_front/.env.production`~~ | ❌ **생성 금지** | — | **불필요** — 운영은 `RUNTIME_*`로 대체됨 |
| `aas_repo_front/docker-entrypoint.sh` | ✅ 커밋 가능 | Prod | 컨테이너 기동 시 `RUNTIME_*` → `public/env-config.js` 생성 |
| 🔒 `aas_repo_front/public/env-config.js` | ❌ 제외 | Prod | `docker-entrypoint.sh`가 자동 생성. 직접 편집 금지. |
| `aas_repo_front/src/utils/runtimeConfig.ts` | ✅ 커밋 가능 | 공통 | `getRuntimeConfig()` — 클라이언트는 `window.__ENV__`, SSR은 `process.env` |
| `aas_repo_front/Dockerfile` | ✅ 커밋 가능 | Prod | 빌드 스테이지(`npm run build`) + 실행 스테이지 분리. **호스트 빌드 불필요** |

### 3-3. Docker / 인프라 설정

| 파일 | Git 추적 | 환경 | 역할 |
|---|---|---|------|
| `aas_repo_docker/docker-compose.yml` | ✅ 커밋 가능 | Prod | Traefik 라벨 + 서비스 오케스트레이션. `RUNTIME_*` 환경변수 블록 포함. |
| `aas_repo_docker/traefik.yml` | ✅ 커밋 가능 | Prod | Traefik 정적 설정. `entryPoints`, `trustedIPs`, `providers.docker` 정의. |
| 🔒 `aas_repo_docker/.env` | ❌ 제외 | Prod | `POSTGRES_PASSWORD` 실제 값 (DB 컨테이너 전용) |
| `aas_repo_docker/.env.example` | ✅ 커밋 가능 | Prod | `.env` 생성 가이드용 템플릿 |
| ~~`aas_repo_docker/conf.d/`~~ | ❌ **삭제 예정** | — | Nginx 설정 디렉토리 — Traefik 전환 후 불필요 |
| ~~`aas_repo_docker/ssl/`~~ | ❌ **삭제 예정** | — | NAS가 SSL을 처리하므로 불필요 |
| ~~`aas_repo_docker/certbot/`~~ | ❌ **삭제 예정** | — | NAS가 인증서를 관리하므로 불필요 |

---

## 4. 핵심 설정값 상세 가이드

### 4-1. 데이터베이스 비밀번호

| 항목 | 내용 |
|---|---|
| **값 위치 1** | 🔒 `aas_repo_docker/.env` → `POSTGRES_PASSWORD=<값>` (DB 컨테이너 초기화용) |
| **값 위치 2** | 🔒 `config.prod.yaml` → `postgres.password: <값>` (백엔드 접속용) |
| **주의** | 두 값은 반드시 동일해야 합니다. 변경 시 두 파일 동시 수정. |
| **변경 절차** | `.env` 및 YAML 수정 → `docker compose down && docker compose up -d` |
| **최초 생성 후 변경 시** | DB 데이터 디렉토리(`data/`) 재설정 필요 |

### 4-2. 백엔드 DB 접속 정보 (YAML)

| 항목 | 내용 |
|---|---|
| **값 위치** | 🔒 `config.prod.yaml` → `postgres.host`, `port`, `database`, `username`, `password` |
| **참조 코드** | `tools/loggerTool.py`, `processor/postgresProcess.py` → `get_section_dict('postgres')` |
| **Docker 내부 host** | 컨테이너 이름 `pg16` 사용 (예: `host: pg16`) |

### 4-3. JWT / 인증 시크릿

| 항목 | 내용 |
|---|---|
| **값 위치** | 🔒 `config.prod.yaml` → `auth.JWT_SECRET_KEY`, `auth.password_secret_key` |
| **참조 코드** | `tools/cryptoTool.py:10` → `get_config_value('auth', 'JWT_SECRET_KEY')` |
| **주의** | 값 변경 시 기존 모든 세션 즉시 무효화됨. 사전 공지 필요. |

### 4-4. OAuth 클라이언트 시크릿

| 항목 | 내용 |
|---|---|
| **값 위치** | 🔒 `config.prod.yaml` → `social_google.GOOGLE_CLIENT_SECRET`, `social_naver.NAVER_CLIENT_SECRET` |
| **참조 코드** | `app/authModule.py` |
| **주의** | 과거 원격 저장소 커밋 이력이 있으면 즉시 재발급 필요 |

### 4-5. CORS 허용 Origin

| 항목 | 내용 |
|---|---|
| **값 위치** | 🔒 `config.prod.yaml` → `service_info.cors_extra_origins` |
| **참조 코드** | `main_nginx.py` → `get_config_value('service_info', 'cors_extra_origins')` |
| **필수 값 (운영)** | `https://ezmodel-hub.re.kr`, `https://portal.ezmodel-hub.re.kr` |

```yaml
# config.prod.yaml 에 반드시 추가
service_info:
  cors_extra_origins:
    - "https://ezmodel-hub.re.kr"
    - "https://portal.ezmodel-hub.re.kr"
```

### 4-6. 프론트엔드 API 주소 (런타임)

| 변수 | 로컬 값 (`.env.development`) | 운영 값 (`docker-compose.yml environment:`) | 설명 |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` / `RUNTIME_SITE_URL` | `http://localhost:5000` | `https://ezmodel-hub.re.kr` | 사이트 대표 URL |
| `NEXT_PUBLIC_AAS_API_BASE` / `RUNTIME_AAS_API_BASE` | `http://localhost` | `https://ezmodel-hub.re.kr/api` | 브라우저 → NAS → Traefik → 백엔드 |
| `NEXT_PUBLIC_AAS_API_PORT` / `RUNTIME_AAS_API_PORT` | `8100` | `` (빈 값) | Traefik 경유 시 포트 불필요 |
| `NEXT_PUBLIC_AAS_API_BASE_SERVER` / `RUNTIME_AAS_API_BASE_SERVER` | `http://localhost` | `http://backend` | SSR → 컨테이너 내부 백엔드 직접 통신 |
| `NEXT_PUBLIC_AAS_API_PORT_SERVER` / `RUNTIME_AAS_API_PORT_SERVER` | `8100` | `8000` | 컨테이너 내부 포트 |
| `NEXT_PUBLIC_PORTAL_URL` / `RUNTIME_PORTAL_URL` | `http://localhost:3000` | `https://portal.ezmodel-hub.re.kr` | Portal 서비스 URL |
| `NEXT_PUBLIC_COOKIE_DOMAIN` / `RUNTIME_COOKIE_DOMAIN` | `localhost` | `.ezmodel-hub.re.kr` | 서브도메인 쿠키 공유 |

> **로컬 키 이름**: `NEXT_PUBLIC_*` (Next.js 빌드 타임 주입)
> **운영 키 이름**: `RUNTIME_*` (`docker-entrypoint.sh`가 `window.__ENV__`로 런타임 주입)

### 4-7. Traefik 신뢰 프록시 설정 (`traefik.yml`)

| 항목 | 내용 |
|---|---|
| **필수 이유** | NAS가 SSL 종료 후 HTTP로 전달. `X-Forwarded-Proto: https` 헤더를 Traefik이 신뢰해야 함. |
| **미설정 시** | `cookie/route.ts`의 `isSecure` 판정이 `false` → `secure` 쿠키 미설정 → 로그인 불가 |
| **설정 위치** | `traefik.yml` → `entryPoints.web.forwardedHeaders.trustedIPs` |
| **필수 값** | NAS의 LAN IP 또는 서브넷 (예: `192.168.1.0/24`) + Docker 내부 서브넷 (`172.16.0.0/12`) |

```yaml
# aas_repo_docker/traefik.yml
entryPoints:
  web:
    address: ":80"
    forwardedHeaders:
      trustedIPs:
        - "192.168.1.0/24"   # NAS LAN 서브넷 (실제 값으로 교체)
        - "172.16.0.0/12"    # Docker 내부 네트워크
        - "127.0.0.1"
providers:
  docker:
    exposedByDefault: false
    network: traefik-proxy
api:
  dashboard: true
  insecure: false
```

### 4-8. SMTP (이메일 발송)

| 항목 | 내용 |
|---|---|
| **값 위치** | 🔒 `config.prod.yaml` → `mail.email_password` |
| **영향 범위** | 이메일 인증, 비밀번호 재설정 메일 발송 |

---

## 5. 배포 워크플로우

### 5-1. 개발자 직접 수행 vs. Docker 자동 처리

| 단계 | 담당 | 설명 |
|---|---|---|
| 코드 수정 | 개발자 | 로컬 IDE에서 편집 |
| `git commit` / `git push` | 개발자 | 원격 저장소 반영 |
| 서버에서 `git pull` | 개발자 | 운영 서버 최신화 |
| 서버 시크릿 파일 확인 | 개발자 (1회) | `config.prod.yaml`, `aas_repo_docker/.env` 존재 여부 확인 |
| `docker network create traefik-proxy` | 개발자 (최초 1회) | 공유 네트워크 생성 — 이미 존재하면 스킵 |
| `docker compose build` | 개발자 | 변경된 이미지만 재빌드 |
| `docker compose up -d` | 개발자 | 컨테이너 기동 |
| `npm install` (프론트) | **Docker 자동** | Dockerfile 빌드 스테이지 내부 |
| `npm run build` (프론트) | **Docker 자동** | Dockerfile 빌드 스테이지 내부. **호스트에서 실행 금지** |
| `pip install -r requirements.txt` (백엔드) | **Docker 자동** | Dockerfile 빌드 스테이지 내부 |
| `env-config.js` 생성 | **Docker 자동** | `docker-entrypoint.sh`가 컨테이너 시작 시 생성 |
| Traefik 라우팅 등록 | **Traefik 자동** | Docker 이벤트 감지 후 라벨 기반 자동 등록 (~100ms) |

> **핵심 원칙**: 운영 서버 호스트에서 `npm run build`, `npm install`, `pip install`을 절대 실행하지 않습니다.
> 모든 빌드는 Docker 멀티스테이지 빌드 내부에서 처리됩니다.

### 5-2. 최초 서버 설정 (1회만 수행)

```bash
# ① 공유 네트워크 생성 (Hub + Portal이 함께 사용)
docker network create traefik-proxy

# ② 서버 시크릿 디렉토리 및 파일 생성
mkdir -p /home/ezmodel-hub/aas_repo_back/config
# config.prod.yaml 생성 (config.yaml 템플릿 참고하여 운영 값 입력)
cp aas_repo_back/config/config.yaml /home/ezmodel-hub/aas_repo_back/config/config.prod.yaml
nano /home/ezmodel-hub/aas_repo_back/config/config.prod.yaml   # 운영 값 입력

# ③ Docker .env 생성 (POSTGRES_PASSWORD만 관리)
cp aas_repo_docker/.env.example aas_repo_docker/.env
nano aas_repo_docker/.env   # 실제 비밀번호 입력

# ④ config.prod.yaml 내 postgres.password 를 .env 의 POSTGRES_PASSWORD 와 동일하게 설정
```

### 5-3. 정규 배포 순서 (코드 변경 시마다)

```bash
# [개발 PC] 코드 수정 → 커밋 → 푸시
git add <변경된 파일>
git commit -m "[Fix] ..."
git push origin feat/local-config-setup

# [운영 서버]
cd /home/ezmodel-hub/ezmodelhub_3th

# ① 최신 코드 반영
git pull origin feat/local-config-setup

# ② 변경된 서비스만 재빌드 (변경 없으면 캐시 사용)
docker compose build

# ③ 컨테이너 재기동 (무중단: 서비스별 순차 재시작)
docker compose up -d

# ④ 기동 확인
docker compose ps
docker compose logs --tail=50 backend
docker compose logs --tail=50 aas_repo_front
```

### 5-4. 로컬 개발 순서 (참고)

```powershell
# 백엔드 (PowerShell)
cd aas_repo_back
.\start.local.ps1       # APP_ENV=local 자동 설정, venv 활성화, uvicorn 기동

# 프론트엔드 (별도 터미널)
cd aas_repo_front
npm run dev             # .env.development 자동 읽음, localhost:5000 기동
```

---

## 6. 배포 전 Quick-Check

```bash
# ① 시크릿 파일이 Git에 포함되지 않았는지 확인 (결과가 비어야 정상)
git ls-files | grep -E '\.env|config\.(local|prod)\.yaml'

# ② 스테이징 diff에 비밀값 없는지 확인 (결과가 비어야 정상)
git diff --cached | grep -iE 'password|secret|token|client_secret'

# ③ traefik-proxy 네트워크 존재 확인
docker network ls | grep traefik-proxy
# 없으면: docker network create traefik-proxy

# ④ 서버 시크릿 파일 존재 확인
ls /home/ezmodel-hub/aas_repo_back/config/config.prod.yaml
ls aas_repo_docker/.env

# ⑤ Traefik trustedIPs에 NAS IP가 설정되어 있는지 확인
grep -A5 "trustedIPs" aas_repo_docker/traefik.yml

# ⑥ 컨테이너 기동 후 Traefik이 라우터를 인식했는지 확인 (Traefik 대시보드 또는 API)
curl http://localhost:8080/api/http/routers 2>/dev/null | python3 -m json.tool | grep '"name"'

# ⑦ 프론트 런타임 설정이 올바르게 주입되었는지 확인
docker exec aas_repo_front cat /app/public/env-config.js

# ⑧ X-Forwarded-Proto 헤더가 올바르게 전달되는지 확인 (쿠키 secure 플래그)
curl -s -I https://ezmodel-hub.re.kr/api/auth/cookie | grep -i "set-cookie"
# secure 속성이 있어야 정상
```

---

## 7. 비밀값 교체 절차

| 비밀값 | 과거 노출 위치 | 조치 |
|---|---|---|
| `POSTGRES_PASSWORD: CHANGE_ME_SECRET` | `docker-compose.yml:25` (커밋 이력) | **즉시 교체** — `aas_repo_docker/.env` + `config.prod.yaml postgres.password` 동시 변경 후 DB 재기동 |
| Google/Naver OAuth 시크릿 | `config/config.local.yaml` | 원격 푸시 이력 있으면 콘솔에서 즉시 재발급 |
| JWT `JWT_SECRET_KEY` | `config/config.local.yaml` | 교체 시 전체 세션 만료됨 (사전 공지 필요) |
| SMTP 앱 비밀번호 | `config/config.local.yaml` | 이메일 서비스 콘솔에서 재발급 |

---

## 8. 별도 커밋 대상 (소스 PR)

이 체크리스트의 설정 커밋에서 의도적으로 **제외**된 소스 변경 사항입니다.
팀 리뷰 후 별도 PR로 머지해야 합니다.

| 파일 | 변경 내용 | 상태 |
|---|---|---|
| `aas_repo_back/tools/loggerTool.py` | `_sanitize()` 추가 — 토큰·패스워드 자동 마스킹 | ✅ 커밋 완료 (`b359363`) |
| `aas_repo_back/main_nginx.py` | CORS Origin 하드코딩 제거 → YAML 참조로 전환 | ✅ 커밋 완료 (`6480651`) |
| `aas_repo_docker/docker-compose.yml` | Nginx 서비스 제거 → Traefik 라벨 기반 재작성 | 미완 — 운영 Traefik 전환 시 수행 |
| `aas_repo_docker/traefik.yml` | 신규 생성 — Traefik 정적 설정 | 미완 — 운영 Traefik 전환 시 수행 |
