import warnings
import os
# Pydantic V1 호환성 경고 완전 억제
warnings.filterwarnings("ignore", message="Core Pydantic V1 functionality isn't compatible with Python 3.14 or greater.")
warnings.filterwarnings("ignore", category=UserWarning, module="fastapi._compat")
os.environ["PYTHONWARNINGS"] = "ignore::UserWarning:fastapi._compat"

from fastapi import FastAPI, Request
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.middleware import Middleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from router import auth, aasBasyx, aasmodel, aassubmodel, publish, etc,  aasInstance
from config.config import get_config_value, get_section_dict

from starlette.middleware.base import BaseHTTPMiddleware

from starlette.responses import RedirectResponse
#from middleware.authMiddleware import AuthMiddleware

#from processor.jdbcProcess import setJavaEnvironment
import multiprocessing
import signal
import time

import os
import argparse

SYS_NAME = get_config_value('service_info', 'name')
SERVICE_INFO = get_section_dict("service_info")
MAX_REQUEST = get_config_value('fastapi', 'max_request')
MAX_REQUEST_RT = get_config_value('fastapi', 'max_request_interval_rt')


def create_app(port: int, max_requests: int):
    app = FastAPI(title=f"{SYS_NAME} BACKEND by Impix.")
    
    # 요청 수와 최대 요청 수 초기화
    app.state.request_count = 0
    app.state.MAX_REQUESTS = max_requests  # 요청 수 제한

    @app.middleware("http")
    async def count_requests(request: Request, call_next):
        app.state.request_count += 1
        
        # 정적 파일 요청 디버깅용 로그
        if request.url.path.startswith('/aas_files/') or request.url.path.startswith('/sm_files/'):
            print(f"[StaticFiles Request] Path: {request.url.path}, Method: {request.method}")
            # 파일 존재 여부 확인 시도 (config에서 경로 다시 읽기)
            if request.url.path.startswith('/aas_files/'):
                file_relative = request.url.path[len('/aas_files/aas'):].lstrip('/')
                file_path = get_config_value('file', 'fullpath')
                if file_path:
                    full_path = os.path.normpath(os.path.join(file_path, file_relative))
                    exists = os.path.exists(full_path)
                    print(f"[StaticFiles Request] File: {full_path}, Exists: {exists}")
            elif request.url.path.startswith('/sm_files/'):
                file_relative = request.url.path[len('/sm_files/sm'):].lstrip('/')
                file_path = get_config_value('file', 'sm_fullpath')
                if file_path:
                    full_path = os.path.normpath(os.path.join(file_path, file_relative))
                    exists = os.path.exists(full_path)
                    print(f"[StaticFiles Request] File: {full_path}, Exists: {exists}")
        
        response = await call_next(request)

        print(f"Request count for Process Port - {port} : {app.state.request_count} / {max_requests}")

        if app.state.request_count >= app.state.MAX_REQUESTS:
            print(f"Max requests reached for Process Service Port - {port} . Restarting server...")
            # 현재 프로세스를 종료하고 새로운 프로세스를 시작합니다.
            os.kill(os.getpid(), signal.SIGTERM)  # 현재 프로세스를 종료
        return response

    # 허용할 Origin 등록
    # 포트 번호를 포함한 전체 URL을 허용 목록에 추가
    # 주의: allow_credentials=True일 때는 "*"를 사용할 수 없으므로 명시적으로 모든 Origin을 나열
    origins = [
        SERVICE_INFO["host_f_domain"],  # https://dream.a2lab.ai:6200
        SERVICE_INFO["host_f_ip"],      # http://127.0.0.1:5000
        SERVICE_INFO["host_b_domain"],  # https://dreamapi.a2lab.ai:6200
        "https://ezmodel-hub.re.kr",  # 명시적으로 추가
        "https://ezmodel-hub.re.kr:6200",   # HTTP도 허용 (개발용)
        SERVICE_INFO["host_portal"],  # [2026-03-17] Portal 서브도메인 CORS 허용 (config.yaml의 service_info.host_portal)
        # "https://dreamapi.a2lab.ai:6200", # 백엔드 도메인
        "http://localhost:5000",         # 로컬 개발용
        "http://localhost:3000",         # Next.js 기본 포트
        "http://127.0.0.1:5000",        # 로컬 IP
        "http://127.0.0.1:3000",        # 로컬 IP Next.js
    ]

    # 미들웨어 제거
    # app.add_middleware(BaseHTTPMiddleware, dispatch=AuthMiddleware(app))
    # CORS 미들웨어 등록
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,  # credentials 사용 시 "*" 사용 불가
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
        allow_headers=["*"],
        expose_headers=["*"],
    ) 

    # 1. config.yaml에서 파일 경로와 URL 경로를 읽어옵니다.
    aas_file_path = get_config_value('file', 'fullpath') # 예: /home/datalake/aas_files/aas
    aas_file_url = get_config_value('file', 'mainpath') # 예: /aas_files/aas

    sm_file_path = get_config_value('file', 'sm_fullpath') # 예: /home/datalake/aas_files/sm
    sm_file_url = get_config_value('file', 'sm_mainpath') # 예: /aas_files/sm

    # 2. (선택 사항) 서버 시작 시 파일 디렉토리가 없으면 생성합니다.
    if aas_file_path:
        os.makedirs(aas_file_path, exist_ok=True)
    if sm_file_path:
        os.makedirs(sm_file_path, exist_ok=True)

    # 3. FastAPI 앱에 정적 파일 디렉토리를 "마운트"합니다.
    # 주의: 라우터 등록 전에 마운트해야 정적 파일 요청이 라우터로 가기 전에 처리됩니다.
    if aas_file_path and aas_file_url:
        # 경로 정규화 (Windows/Linux 호환)
        normalized_path = os.path.normpath(aas_file_path)
        path_exists = os.path.exists(normalized_path)
        print(f"[StaticFiles] Mounting {aas_file_url} -> {normalized_path}")
        print(f"[StaticFiles] Directory exists: {path_exists}")
        if path_exists:
            try:
                files_count = len([f for f in os.listdir(normalized_path) if os.path.isfile(os.path.join(normalized_path, f))])
                print(f"[StaticFiles] Files in directory: {files_count}")
            except:
                print(f"[StaticFiles] Cannot list files in directory")
        
        try:
            app.mount(aas_file_url, 
                      StaticFiles(directory=normalized_path), 
                      name="aas_files")
            print(f"[StaticFiles] Successfully mounted {aas_file_url}")
        except Exception as e:
            print(f"[StaticFiles] Error mounting {aas_file_url}: {str(e)}")

    if sm_file_path and sm_file_url:
        # 경로 정규화 (Windows/Linux 호환)
        normalized_path = os.path.normpath(sm_file_path)
        path_exists = os.path.exists(normalized_path)
        print(f"[StaticFiles] Mounting {sm_file_url} -> {normalized_path}")
        print(f"[StaticFiles] Directory exists: {path_exists}")
        
        try:
            app.mount(sm_file_url, 
                      StaticFiles(directory=normalized_path), 
                      name="sm_files")
            print(f"[StaticFiles] Successfully mounted {sm_file_url}")
        except Exception as e:
            print(f"[StaticFiles] Error mounting {sm_file_url}: {str(e)}")

    app.include_router(auth.router)
    from router import sso
    app.include_router(sso.router)
    app.include_router(aasmodel.router)
    app.include_router(aassubmodel.router)
    app.include_router(aasBasyx.router)
    app.include_router(aasInstance.router)
    app.include_router(publish.router)
    app.include_router(etc.router)

    return app


# java 환경 변수 설정
#setJavaEnvironment() 


def run_server(host: str, port: int, max_requests: int):
    import uvicorn
    from app.basyxAasenvironmentModule import start_jvm 
    start_jvm() 
    app = create_app(port, max_requests)
    #uvicorn.run(app, host=host, port=port, reload=False)
    config = uvicorn.Config(app, host=host, port=port, reload=False)
    server = uvicorn.Server(config)
    server.run()

def start_new_process(host: str, port: int, max_requests: int):
    print(f"{SYS_NAME} Backend Server Starting new Uvicorn service on port: {port} with MAX_REQUESTS: {max_requests}")
    process = multiprocessing.Process(target=run_server, args=(host, port, max_requests))
    process.start()
    return process

if __name__ == "__main__":
    ## 시작 포트
    ## nginx에서는 8080 또는 대표로 접속
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', type=str, default='192.168.123.100') # 
    parser.add_argument('--port', type=int, default='8081') # 
    parser.add_argument('--workers', type=int, default='2') # 
    args = parser.parse_args()

    host = args.host
    start_port = args.port
    workers =  args.workers

    processes = []
    max_requests_list = []

    for i in range(workers):
        max_requests_list.append(MAX_REQUEST + i*(MAX_REQUEST*MAX_REQUEST_RT))

    #print(host, start_port, workers, max_requests_list)
    
    for i in range(workers):  # 2개의 FastAPI 인스턴스 생성
        process = start_new_process(host, start_port + i, max_requests_list[i])
        processes.append(process)

    while True:
        for process in processes:
            if not process.is_alive():
                # 프로세스가 종료되면 새로운 프로세스를 시작합니다.
                index = processes.index(process)
                processes[index] = start_new_process(host, start_port + index, max_requests_list[index])
        time.sleep(1)  # 상태 확인 간격