# 팀 개발환경 셋업

이 레포는 외부 개발사 레포(`jdsense/ezmodelhub_3th`)에서 **히스토리를 그대로 가져와 분리한 사본**입니다.
커밋 이력 118개는 전부 보존되어 있고, 원본 레포와의 연결은 끊겨 있습니다.
앞으로의 변경은 이 레포에서만 관리합니다.

---

## 1. 필요한 것

| 항목 | 버전 | 비고 |
|---|---|---|
| Python | 3.13 | 백엔드 |
| Node.js | 20 이상 | 프론트엔드 (Next.js 15, React 19) |
| PostgreSQL | 16 | `aas_repo_docker/docker-compose.yml` 로 띄워도 됨 |
| JDK | 17 | AASX 변환용 JVM. **레포에 없음 — 아래 3-1 참고** |
| BaSyx JAR | 2.0.0-SNAPSHOT | **레포에 없음 — 아래 3-2 참고** |

---

## 2. 클론

```bash
git clone https://github.com/Lee-Gwanghoon/ezmodel-hub.git
cd ezmodel-hub
```

---

## 3. git 에 없는 파일 채우기

`.gitignore` 로 제외된 것들입니다. 없으면 백엔드가 뜨긴 해도 AASX 관련 기능이 실패합니다.

### 3-1. JDK (약 296MB)

`aas_repo_back/jdk/windows/openjdk-17.0.2/` 위치에 JDK 17 을 놓습니다.

- 팀 공유 드라이브의 압축본을 풀거나
- [Adoptium Temurin 17 (Windows x64)](https://adoptium.net/temurin/releases/?version=17) 를 받아서 배치

이미 시스템에 JDK 17 이 설치되어 있다면 `JAVA_HOME` 만 잡혀 있어도 됩니다.

### 3-2. BaSyx JAR (약 86MB)

`aas_repo_back/basyx/basyx.aasenvironment.component-2.0.0-SNAPSHOT-shaded.jar`

받는 방법은 [`aas_repo_back/basyx/README.md`](../aas_repo_back/basyx/README.md) 참고.

### 3-3. 백엔드 설정

```bash
cd aas_repo_back
cp config/config.example.yaml config/config.yaml
```

`config.yaml` 안의 `CHANGE_ME` 를 실제 값으로 채웁니다.
**실제 값은 git 에 없습니다** — 팀 내부 시크릿 채널에서 받으세요.

채워야 하는 항목:

| 섹션 | 키 |
|---|---|
| `postgres` | `password` |
| `auth` | `JWT_SECRET_KEY`, `password_secret_key` |
| `social_google` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| `social_naver` | `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` |
| `mail` | `email_address`, `email_password` |
| `csv` | `passKey` |

> 환경별로 `config.local.yaml`, `config.prod.yaml` 을 따로 둘 수 있습니다. 전부 `.gitignore` 대상입니다.

### 3-4. 프론트엔드 설정

`aas_repo_front/.env.development` 는 **로컬 기본값이 이미 커밋되어 있어 그대로 동작합니다.**
본인 환경이 다르면 그 파일을 고치지 말고 `.env.local` 을 만들어 덮어쓰세요 (`.env.local` 은 무시됨).

운영 배포는 `cp .env.production.example .env.production` 후 도메인을 채웁니다.

---

## 4. 실행

### 백엔드

```powershell
cd aas_repo_back
.\setup_environment.bat      # 최초 1회 — venv 생성 + 의존성 설치
.\start.ps1                  # http://localhost:8000
```

macOS / Linux:

```bash
cd aas_repo_back
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt      # macOS 는 requirements_mac.txt
python main_nginx.py --host 0.0.0.0 --port 8000 --workers 1
```

### 프론트엔드

```bash
cd aas_repo_front
npm install
npm run dev                  # http://localhost:5000
```

### PostgreSQL (선택)

```bash
cd aas_repo_docker
docker compose up -d postgres
```

---

## 5. 브랜치

| 브랜치 | 내용 |
|---|---|
| `main` | 기준선. 개발사 레포의 최신 main 상태 |
| `feat/cherry-pick-confirmed` | 반영 확정된 변경 모음 |
| `feat/env-local-dev-prod` | 로컬/개발/운영 환경 분리 |
| `feat/local-config-setup` | 로컬 설정 셋업 |
| `feat/portal-cookie-sharing-and-login-redirect` | Portal 쿠키 공유 · 로그인 리다이렉트 |
| `vendor/IMPIX-TH.KIM`, `vendor/feat-add-element` | 개발사 작업 브랜치 보존본. 건드리지 말 것 |

작업은 `main` 에서 브랜치를 따서 진행하고 PR 로 병합합니다.

---

## 6. 커밋하면 안 되는 것

`.gitignore` 가 막고 있지만, 강제로 추가하지 마세요.

- `aas_repo_back/config/config.yaml` 및 `config.*.yaml` — **시크릿**
- `aas_repo_back/.env` — **시크릿**
- `aas_repo_back/jdk/` (296MB), `aas_repo_back/basyx/*.jar` (86MB) — 바이너리
- `venv/`, `node_modules/`, `.next/`, `*.tsbuildinfo` — 의존성 · 빌드 산출물
- `*.log`, `nohup.out`, `hs_err_pid*.log` — 로그 · JVM 크래시 덤프
- `.omc/`, `.claude/settings.local.json` — 개인 툴링 상태

새로 무시할 것이 생기면 루트 `.gitignore` 에 사유와 함께 추가해 주세요.

---

## 7. 참고 문서

- [`BRANCH_REVIEW.md`](./BRANCH_REVIEW.md) — 브랜치별 변경 검토
- [`UPLOAD_FLOW_REPORT.md`](./UPLOAD_FLOW_REPORT.md) — 업로드 플로우 분석
- [`DEPLOY_CHECKLIST.md`](./DEPLOY_CHECKLIST.md) — 배포 체크리스트
