import os
import argparse
import multiprocessing
import signal
import time
import starlette.formparsers as _fp
import multipart.multipart as _mp

_LIMIT = 100 * 1024 * 1024  # 100MB

if hasattr(_mp, 'MAX_PART_SIZE'):
    _mp.MAX_PART_SIZE = _LIMIT

_OriginalInit = _fp.MultiPartParser.__init__

def _patched_init(self, headers, stream, *, max_files=1000, max_fields=1000, max_part_size=_LIMIT):
    _OriginalInit(self, headers, stream, max_files=max_files, max_fields=max_fields, max_part_size=max_part_size)

_fp.MultiPartParser.__init__ = _patched_init


os.environ['JAVA_HOME'] = '/usr/lib/jvm/java-11-openjdk-amd64'
os.environ['LD_LIBRARY_PATH'] = '/usr/lib/jvm/java-11-openjdk-amd64/lib/server'
from fastapi import FastAPI, Request
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware import Middleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from router import auth, aasBasyx, aasmodel, aassubmodel, publish, etc,  aasInstance
from config.config import get_config_value, get_section_dict

from starlette.middleware.base import BaseHTTPMiddleware

from starlette.responses import RedirectResponse
#from middleware.authMiddleware import AuthMiddleware
import os
from fastapi.staticfiles import StaticFiles

#from processor.jdbcProcess import setJavaEnvironment

from app.basyxAasenvironmentModule import start_jvm  

import starlette.formparsers
starlette.formparsers.MultiPartParser.max_part_size = 50 * 1024 * 1024



SYS_NAME = get_config_value('service_info', 'name')
SERVICE_INFO = get_section_dict("service_info")
MAX_REQUEST = get_config_value('fastapi', 'max_request')
MAX_REQUEST_RT = get_config_value('fastapi', 'max_request_interval_rt')


app = FastAPI(title=f"{SYS_NAME} BACKEND by Impix.")


# 허용할 Origin 등록
origins = [SERVICE_INFO["host_f_domain"], SERVICE_INFO["host_f_ip"], SERVICE_INFO["host_b_domain"], ""]

# 미들웨어 제거
# app.add_middleware(BaseHTTPMiddleware, dispatch=AuthMiddleware(app))
# CORS 미들웨어 등록
app.add_middleware(
    CORSMiddleware,
    
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
) 

app.include_router(auth.router)
from router import sso
app.include_router(sso.router)
app.include_router(aasmodel.router)
app.include_router(aassubmodel.router)
app.include_router(aasBasyx.router)
#app.include_router(aasBasyx.router, prefix="/basyx")
app.include_router(aasInstance.router)
app.include_router(publish.router)
app.include_router(etc.router)

# # 2025.11.18 주석처리 시작
# # 1. config.yaml에서 파일 경로와 URL 경로를 읽어옵니다.
# aas_file_path = get_config_value('file', 'fullpath') # 예: /home/datalake/aas_files/aas
# aas_file_url = get_config_value('file', 'mainpath') # 예: /aas_files/aas

# sm_file_path = get_config_value('file', 'sm_fullpath') # 예: /home/datalake/aas_files/sm
# sm_file_url = get_config_value('file', 'sm_mainpath') # 예: /aas_files/sm

# # 2. (선택 사항) 서버 시작 시 파일 디렉토리가 없으면 생성합니다.
# if aas_file_path:
#     os.makedirs(aas_file_path, exist_ok=True)
# if sm_file_path:
#     os.makedirs(sm_file_path, exist_ok=True)

# # 3. FastAPI 앱에 정적 파일 디렉토리를 "마운트"합니다.
# if aas_file_path and aas_file_url:
#     app.mount(aas_file_url, 
#               StaticFiles(directory=aas_file_path), 
#               name="aas_files")

# if sm_file_path and sm_file_url:
#     app.mount(sm_file_url, 
#               StaticFiles(directory=sm_file_path), 
#               name="sm_files")

# # 2025.11.18 주석처리 완료 ---



# 1. Config에서 설정값 읽기
aas_fullpath = get_config_value('file', 'fullpath') 
# 예: /aas_files/aas (DB에 저장된 경로의 앞부분과 일치해야 함)
aas_mainpath = get_config_value('file', 'mainpath') 

# 2. AAS 파일 디렉토리 마운트
if aas_fullpath:
    # 디렉토리가 없으면 생성
    os.makedirs(aas_fullpath, exist_ok=True)
    
    # URL 경로가 설정되어 있지 않으면 기본값 사용
    if not aas_mainpath:
        aas_mainpath = "/aas_files/aas"
    
    # 중요: 맨 앞에 슬래시(/)가 없으면 붙여줍니다.
    if not aas_mainpath.startswith("/"):
        aas_mainpath = "/" + aas_mainpath

    print(f"✅ Mounting StaticFiles: URL='{aas_mainpath}' -> Path='{aas_fullpath}'")
    
    # 마운트 실행: 브라우저가 {aas_mainpath}로 접근하면 {aas_fullpath} 폴더를 보여줌
    app.mount(aas_mainpath, StaticFiles(directory=aas_fullpath), name="aas_files")


# 3. SM(Submodel) 별도 경로 마운트 (필요한 경우)
sm_fullpath = get_config_value('file', 'sm_fullpath')
sm_mainpath = get_config_value('file', 'sm_mainpath')

if sm_fullpath:
    os.makedirs(sm_fullpath, exist_ok=True)
    if sm_mainpath:
        if not sm_mainpath.startswith("/"):
            sm_mainpath = "/" + sm_mainpath
        print(f"✅ Mounting SM Files : URL='{sm_mainpath}' -> Path='{sm_fullpath}'")
        app.mount(sm_mainpath, StaticFiles(directory=sm_fullpath), name="sm_files")


start_jvm()