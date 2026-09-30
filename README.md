# AAS Repository

> **팀 개발환경 셋업은 [`docs/SETUP.md`](./docs/SETUP.md) 를 먼저 읽으세요.**
> JDK 와 BaSyx JAR 은 용량 때문에 git 에 없고, `config.yaml` 은 시크릿이라 직접 만들어야 합니다.
> 이 레포는 개발사 레포(`jdsense/ezmodelhub_3th`)에서 히스토리를 그대로 가져와 분리한 사본입니다.

Asset Administration Shell (AAS) Repository 시스템 - 모노레포 구조

## 📁 프로젝트 구조

```
aas_repo/
├── aas_repo_back/     # FastAPI 백엔드 서버
├── aas_repo_front/    # Next.js 프론트엔드 애플리케이션
└── aas_repo_docker/   # Nginx, Docker 설정 및 배포 파일
```

## 🏗️ 시스템 아키텍처

### Backend (aas_repo_back)
- **기술 스택**: Python 3.13.1, FastAPI, PostgreSQL
- **주요 기능**: AAS 인스턴스, 모델, 서브모델 관리
- **API 서버**: FastAPI 기반 RESTful API

### Frontend (aas_repo_front)
- **기술 스택**: Next.js 15+, React 19, TypeScript, Tailwind CSS
- **주요 기능**: AAS Repository 관리 웹 인터페이스
- **UI 프레임워크**: Metronic UI

### Nginx & Docker (aas_repo_docker)
- **기능**: 리버스 프록시, SSL/TLS 설정, Docker 기반 서비스 배포

## 🚀 빠른 시작

### 통합 실행 (권장)

모든 서비스를 한 번에 실행:

**Windows:**
```powershell
.\start.ps1
```

**macOS/Linux:**
```bash
chmod +x start.sh
./start.sh
```

이 스크립트는 백엔드와 프론트엔드를 자동으로 시작합니다:
- 백엔드: http://localhost:8000
- 프론트엔드: http://localhost:5000 (Production mode)

### 개별 실행

각 하위 디렉토리의 README.md를 참고하세요:
- [백엔드 설정](./aas_repo_back/README.md)
- [프론트엔드 설정](./aas_repo_front/README.md)

## 📦 설치

```bash
# 전체 프로젝트 클론
git clone https://github.com/Lee-Gwanghoon/ezmodel-hub.git
cd aas_repo

# 백엔드 설정
cd aas_repo_back
./setup_environment.sh  # Linux/Mac
# 또는 setup_environment.bat # Windows

# 프론트엔드 설정
cd ../aas_repo_front
npm install

# 또는
cd ../aas_repo_front
yarn install
```

## 🛠️ 개발

### Backend 실행
```bash
cd aas_repo_back
source venv/bin/activate  # Linux/Mac
# 또는 venv\Scripts\activate # Windows
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Frontend 실행

**Development 모드 (포트: 5000):**
```bash
cd aas_repo_front
npm run dev
# 또는
yarn dev
```

**Production 모드:**
```bash
cd aas_repo_front
npm run build
npm run start  # 포트: 5000
```

> **참고**: start.ps1 또는 start.sh 스크립트는 자동으로 Production 모드로 실행합니다.

## 📝 라이센스

Copyright (c) 2025

