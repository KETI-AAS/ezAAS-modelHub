import jpype
import base64
from jpype.types import *
from jpype import JClass, JProxy, JByte
from fastapi import UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Literal, Any
from processor.postgresProcess import *
import io
import time
import glob
import os
import base64
from  tools.jdbcTool import setJavaEnvironment
import json
import urllib.parse
import asyncio
from ftfy import fix_text
from zipfile import ZipFile
from io import BytesIO
import mimetypes
from config.config import get_config_value
import app.aasModelModule as aasModelModule
import app.aasSubModelModule as aasSubModelModule
import config.langConfig as LANG
import re
from app.aasUtils import clean_aas_metadata, clean_empty_structures
from typing import Any

# JSON 내부의 File 경로를 찾는 헬퍼 함수
def _find_file_paths_in_json(node: Any) -> set:
    """
    JSON 객체를 재귀적으로 탐색하여 'modelType': 'File' 요소의
    'value' 필드(파일 경로)에서 파일명(basename)을 추출합니다.
    """
    paths = set()
    if isinstance(node, dict):
        if node.get("modelType") == "File":
            val = node.get("value")
            if val and isinstance(val, str):
                # AASX는 경로가 아닌 파일명(basename)을 키로 사용합니다.
                # paths.add(os.path.basename(val.strip()))
                paths.add(val.strip())
        
        for v in node.values():
            paths.update(_find_file_paths_in_json(v))
            
    elif isinstance(node, list):
        for item in node:
            paths.update(_find_file_paths_in_json(item))
            
    return paths


def start_jvm():

    setJavaEnvironment()

    # JVM 시작: basyx 관련 jar 파일들이 들어있는 디렉토리
    jar_dir = "./basyx"
    all_jars = glob.glob(os.path.join(jar_dir, "*.jar"))

    if not jpype.isJVMStarted():
        jpype.startJVM(classpath=all_jars)


async def aasModelImportEvent(userinfo, file, id, modelType="aasmodel"):
    """
    [수정] AASX 또는 JSON 파일을 가져와서 JSON 문자열과 첨부파일(AASX의 경우)로 반환합니다.
    """
    lang_code = userinfo.lang_code if  userinfo is not None  else "1"

    file_bytes = await file.read()
    filename = file.filename.lower() # 파일명 변수화
    content_type = file.content_type.lower() #MIME 타입 변수화

    result_dict = None  # 파싱된 JSON을 담을 딕셔너리
    attachments_dict = {}  # 추출된 첨부파일을 담을 딕셔너리
    status_code = 200 # JSON 경로는 기본 200


    # 1. 파일 타입에 따라 분기 처리
    if filename.endswith('.json') or 'application/json' in content_type:
        # 1-1. JSON 파일일 경우
        try:
            # 파이썬에서 직접 JSON 파싱
            json_string = file_bytes.decode('utf-8')
            json_string = json_string.replace('\ufeff', '')  # BOM 제거
            result_dict = json.loads(json_string)
            attachments_dict = {}  # Plain JSON 파일은 내부 첨부파일이 없음

        except Exception as e:
            # JSON 파싱 실패
            return JSONResponse(status_code=400, content={"result": "error", "msg": LANG.Message("LANG10000051", lang_code).format(str(e)), "data": ""})

    else:
        # 1-2. AASX 파일일 경우 (기존 Basyx 로직)
        try:
            # Spring의 MultipartFile 인터페이스 클래스를 가져옵니다.
            MultipartFile = jpype.JClass("org.springframework.web.multipart.MultipartFile")
            # JProxy를 통해 MultipartFile 인터페이스의 구현체를 생성합니다.
            multipart_file = JProxy(MultipartFile, inst=PyMultipartFile(file_bytes, file.content_type, file.filename, file.filename))

            # Java 컨트롤러 인스턴스를 생성합니다.
            # parseAASXFile 메서드는 HttpServletRequest나 AasEnvironment 같은 의존성을 사용하지 않으므로 None을 전달합니다.
            AasEnvController = jpype.JClass("org.eclipse.digitaltwin.basyx.aasenvironment.http.AasEnvironmentApiHTTPController")
            controller = AasEnvController(None, None)

            # parseAASXFile 메서드를 호출합니다.
            response = controller.parseAASXFile(multipart_file)

            # ResponseEntity<String>에서 JSON 결과와 상태 코드를 추출합니다.
            status_code = response.getStatusCodeValue()
            json_result_str = str(response.getBody())
            
            # FIXME: jpype가 Java의 실제 작업 완료를 기다리지 않는 문제로 추정됩니다.
            if status_code == 200 and (json_result_str is None or str(json_result_str).strip() == ""):
                for _ in range(20):
                    await asyncio.sleep(0.1) # asyncio.sleep 사용
                    json_result_str = str(response.getBody()) # 결과 재확인
                    if json_result_str is not None and str(json_result_str).strip() != "":
                        break
            
            if status_code != 200:
                 return JSONResponse(status_code=status_code, content={"result": "error", "msg": LANG.Message("LANG10000099", lang_code), "data": ""})

            if json_result_str is None or str(json_result_str).strip() == "":
                return JSONResponse(status_code=500, content={"result": "error", "msg": "AASX parsing returned empty result.", "data": ""})

            # Basyx가 반환한 JSON 문자열 파싱
            json_result_str = json_result_str.replace('\ufeff', '')
            result_dict = json.loads(json_result_str)

            # AASX 파일(zip)에서 첨부파일 추출
            attachments_dict = await extractAttachments(file_bytes, result_dict)

        except Exception as e:
            # Basyx/jpype 파싱 실패
            return JSONResponse(status_code=500, content={"result": "error", "msg": f"AASX/Package parsing error: {str(e)}", "data": ""})



    # 3. 공통 유효성 검사 및 정리
    if result_dict is None:
         return JSONResponse(status_code=400, content={"result": "error", "msg": "Failed to parse file content.", "data": ""})

    # 기존 'if status_code == 200:' 블록의 내용을 공통 로직으로 이동
    try:
        
        # json_result 문자열 대신 이미 파싱된 result_dict 사용
        # AAS 메타데이터를 정리합니다.
        result_dict = clean_aas_metadata(result_dict) # aasUtils에서 가져옴
        
        ### AAS모델은 ID 중복을 확인하며, 서브모델 AASX 추가 시 조건이 변경됩니다.
        if modelType == "aasmodel":
            shells = result_dict.get("assetAdministrationShells", [])

            if not shells:
                return JSONResponse(status_code=400, content={"result": "error", "msg": LANG.Message("LANG10000001", lang_code), "data": result_dict})
        
            aas_id = shells[0].get("id")

            if not id:
                id_chk_rst = await aasModelModule.duplicateAasmodelIdCheckEvent(aas_id) # XXX: DB 처리 오류 시에도 True를 반환하는 문제를 수정.
                
                if id_chk_rst:
                    return JSONResponse(status_code=400, content={"result": "error", "msg":  LANG.Message("LANG10000092", lang_code).format(aas_id) , "data": ""})
                    
            else:
                if aas_id != id:
                    return JSONResponse(status_code=400, content={"result": "error", "msg": LANG.Message("LANG10000093", lang_code).format(aas_id), "data": ""})
                
        elif modelType == "submodel":
            submodels = result_dict.get("submodels", [])

            if not submodels:
                return JSONResponse(status_code=400, content={"result": "error", "msg": LANG.Message("LANG10000094", lang_code), "data": result_dict})

            submodel_id = submodels[0]["id"]
            semantic_id = submodels[0]["semanticId"]

            # id와 semantic id를 확인합니다.
            if not submodel_id and not semantic_id:
                return JSONResponse(status_code=400, content={"result": "error", "msg": LANG.Message("LANG10000050", lang_code), "data": ""})
            elif not submodel_id:
                return JSONResponse(status_code=400, content={"result": "error", "msg": LANG.Message("LANG10000095", lang_code), "data": ""})
            elif not semantic_id:
                return JSONResponse(status_code=400, content={"result": "error", "msg": LANG.Message("LANG10000096", lang_code), "data": ""})

            semantic_id_value = None
            try:
                #keys = json_data["semanticId"]["keys"]
                keys = semantic_id["keys"] # list와 keys의 존재 여부를 확인합니다.
                if isinstance(keys, list) and keys: # list, keys exist 체크
                    semantic_id_value = keys[0].get("value", "")
            except Exception:
                semantic_id_value = None

            if not semantic_id_value:
                return JSONResponse(status_code=400, content={"result": "error", "msg": LANG.Message("LANG10000096", lang_code), "data": ""})

            if not id:
                id_chk_rst = await aasSubModelModule.duplicateSubModelIdCheckEvent(submodel_id, "")

                if id_chk_rst:
                    return JSONResponse(status_code=400, content={ "result" : "error", "msg" : LANG.Message("LANG10000097", lang_code).format(submodel_id), "data" : ""}) 
            else:
                if submodel_id != id:
                    return JSONResponse(status_code=400, content={ "result" : "error", "msg" : LANG.Message("LANG10000098", lang_code).format(id, submodel_id), "data" : ""})

    except Exception as e:
        return JSONResponse(status_code=500, content={"result": "error", "msg":  LANG.Message("LANG10000100", lang_code).format(str(e)) , "data": ""})

    
    # 4. 공통 응답 처리
    try:
        # json_result 대신 result_dict 사용
        env_json = clean_empty_structures(result_dict)

        # 2. Encode the extracted files into Base64 and get MIME type
        attachments_b64_with_type = {} # 새로운 딕셔너리 생성
        for filename, content in attachments_dict.items():
            mime_type, _ = mimetypes.guess_type(filename) # MIME 타입 추측
            attachments_b64_with_type[filename] = {
                "content": base64.b64encode(content).decode('utf-8'),
                "type": mime_type or "application/octet-stream" # MIME 타입 추가
        }
        
        # 3. Create a new data structure to send to the frontend
        response_data = {
            "metadata": env_json,
            "attachments": attachments_b64_with_type # 딕셔너리 사용
        }
        
    except Exception as e:
        return JSONResponse(status_code=500, content={"result": "error", "msg": LANG.Message("LANG10000100", lang_code).format(str(e)), "data": ""})
        
    return JSONResponse(status_code=200, content={"result": "ok", "msg": LANG.Message("LANG10000101", lang_code), "data": response_data})


async def aasModelValidateEvent(userinfo, file):
    """
    AASX 파일의 유효성을 검사합니다.
    """
    lang_code = userinfo.lang_code if  userinfo is not None  else "1"

    file_bytes = await file.read()

    # Spring의 MultipartFile 인터페이스 클래스를 가져옵니다.
    MultipartFile = jpype.JClass("org.springframework.web.multipart.MultipartFile")
    # JProxy를 통해 MultipartFile 인터페이스의 구현체를 생성합니다.
    multipart_file = JProxy(MultipartFile, inst=PyMultipartFile(file_bytes, file.content_type, file.filename, file.filename))
    
    # fat jar에 포함된 Java 클래스를 로드합니다.
    AasEnvController = jpype.JClass("org.eclipse.digitaltwin.basyx.aasenvironment.http.AasEnvironmentApiHTTPController")
    controller = AasEnvController(None, None)

    # validateEnvironment 메서드 호출: ResponseEntity<Boolean> 반환
    response = controller.validateEnvironment(multipart_file)

    # ResponseEntity<Boolean>에서 결과와 상태 코드 추출
    result_boolean = response.getBody()
    status_code = response.getStatusCodeValue()

    result_boolean = bool(result_boolean.booleanValue())

    if status_code != 200:
        return JSONResponse(status_code=status_code, content={"result": "error", "msg": LANG.Message("LANG10000102", lang_code), "data": result_boolean})
    else:
        return JSONResponse(status_code=200, content={"result": "ok", "msg": LANG.Message("LANG10000103", lang_code), "data": result_boolean})


class PyMultipartFile:
    """
    Python에서 Java의 MultipartFile 인터페이스를 구현하기 위한 클래스입니다.
    """
    def __init__(self, file_bytes, content_type, name, original_filename):
        # file_bytes: 파일 내용
        # content_type: 파일의 MIME 타입
        # name: 파일 이름
        # original_filename: 원본 파일명
        self.file_bytes = file_bytes
        self.content_type = content_type
        self.name = name
        self.original_filename = original_filename

    def getName(self): return self.name
    def getOriginalFilename(self): return self.original_filename
    def getContentType(self): return self.content_type
    def isEmpty(self): return len(self.file_bytes) == 0
    def getSize(self): return len(self.file_bytes)
    def getBytes(self): return self.file_bytes

    def getInputStream(self):
        converted = [b if b < 128 else b - 256 for b in self.file_bytes]
        java_bytes = jpype.JArray(JByte)(converted)
        return jpype.JClass("java.io.ByteArrayInputStream")(java_bytes)

    def transferTo(self, dest): pass

class AASDownloadRequest(BaseModel):
    name: str
    source: Literal["json", "db"] = "json" 
    model_key: Optional[str] = None 
    jsonData: Optional[dict] = None       

async def aasModelDownloadEvent(userinfo, body: AASDownloadRequest, format: str, modelType: str):
    """
    파일을 다운로드합니다.
    """
    result = await generateAasFile(userinfo, body, format, modelType)

    if isinstance(result, dict) and result.get("result") == "error":
        return JSONResponse(status_code=500, content=result)

    content_type = {
        "json": "application/json",
        "xml": "application/xml",
        "aasx": "application/asset-administration-shell-package+xml"
    }.get(format, "application/json")
    
    filename = body.name
    filename = urllib.parse.quote(f"{filename}.{format}") # 파일명을 인코딩합니다.

    return StreamingResponse(io.BytesIO(result),
                             media_type=content_type,
                             headers={"Content-Disposition": f"attachment; filename={filename}.{format}"})



# AASX 구조를 위한 JSON 변환 및 첨부파일 맵핑 헬퍼
def prepare_aasx_structure(node: Any, available_files: dict) -> tuple[Any, dict]:
    """
    JSON을 탐색하여:
    1. 'File' 타입 요소의 value를 '/aasx/files/파일명'으로 변경 (AAS Explorer 호환용)
    2. 해당 파일이 available_files(DB에서 조회한 파일들)에 있다면 attachments_dict에 추가
    
    Returns:
        modified_node: 경로가 수정된 JSON 객체
        attachments: AASX 생성용 파일 딕셔너리 {'aasx/files/filename': base64_content}
    """
    attachments = {}

    if isinstance(node, dict):
        # Dict 복사본 생성 (원본 보존)
        new_node = node.copy()
        
        # File 타입 처리
        if new_node.get("modelType") == "File":
            val = new_node.get("value")
            if val and isinstance(val, str):
                # URL이나 절대경로에서 파일명만 추출 (예: 프론트엔드에서 넘어온 URL의 맨 끝 UUID_파일명)
                filename_from_val = os.path.basename(val.strip())
                # URL 파라미터가 붙어있을 경우 제거
                filename_from_val = urllib.parse.unquote(filename_from_val).split('?')[0]
                
                matched_file = None
                
                # 딕셔너리 키(원본 파일명)로 바로 매칭 (새로 추가한 파일의 경우)
                if filename_from_val in available_files:
                    matched_file = available_files[filename_from_val]
                else:
                    # 물리적 경로(realpath) 기준으로 전체 탐색 (수정 모드에서 기존 파일의 URL 대응)
                    for file_info in available_files.values():
                        realpath = file_info.get('realpath')
                        if realpath:
                            # DB에 저장된 실제 경로의 파일명 추출
                            basename_in_db = os.path.basename(realpath.strip('/'))
                            # 프론트엔드가 보낸 파일명과 DB의 실제 물리적 파일명이 일치하는지 확인
                            if basename_in_db == filename_from_val or urllib.parse.unquote(basename_in_db) == filename_from_val:
                                matched_file = file_info
                                break
                        
                        # 프론트엔드 URL 문자열 안에 원본 파일명이 포함되어 있는지 검사
                        if file_info.get('filename') and file_info.get('filename') in filename_from_val:
                            matched_file = file_info
                            break

                # 매칭된 파일이 발견되면 JSON 경로 변경 및 압축 대상에 추가
                if matched_file:
                    # AASX 패키지 내 이름 충돌 방지를 위해 UUID가 포함된 이름(realpath 기반) 사용
                    safe_filename = os.path.basename(matched_file.get('realpath', matched_file['filename']).strip('/'))
                    
                    target_path = f"/aasx/files/{safe_filename}"
                    new_node["value"] = target_path
                    
                    zip_inner_path = f"aasx/files/{safe_filename}"
                    content_bytes = matched_file["content"]
                    attachments[zip_inner_path] = base64.b64encode(content_bytes).decode("utf-8")
        
        # 탐색 (값 수정)
        for k, v in new_node.items():
            child_node, child_attachments = prepare_aasx_structure(v, available_files)
            new_node[k] = child_node
            attachments.update(child_attachments)
            
        return new_node, attachments

    elif isinstance(node, list):
        new_list = []
        for item in node:
            child_node, child_attachments = prepare_aasx_structure(item, available_files)
            new_list.append(child_node)
            attachments.update(child_attachments)
        return new_list, attachments

    else:
        return node, attachments


# [generateAasFile] AASX Export 시 파일 매핑
async def generateAasFile(userinfo, body: AASDownloadRequest, format: str, modelType: str) -> bytes | dict:

    source = getattr(body, "source", None) or "db"
    lang_code = userinfo.lang_code if  userinfo is not None  else "1"

    db_result = None
    attachments_json = None 

    try:
        ByteArrayOutputStream = jpype.JClass("java.io.ByteArrayOutputStream")
        
        if body.source == "json": 
            if body.jsonData is None:
                return {"result": "error", "msg": LANG.Message("LANG10000104", lang_code)}
            try:
                db_result = body.jsonData 
                json_str = normalize_text(body.jsonData) 
                json_str = json.dumps(json_str)
            except Exception as e:
                return {"result": "error", "msg": LANG.Message("LANG10000105", lang_code).format(str(e))}
        
        elif body.source == "db": 
            if not body.model_key:
                return {"result": "error", "msg": LANG.Message("LANG10000106", lang_code)}
            try:
                if not str(body.model_key).isdigit():
                    return {"result" : "error", "msg" : LANG.Message("LANG10000107", lang_code), "data" : ""}
                          
                # 1. 메타데이터 조회
                db_result = await aasModelMetadata(body.model_key, modelType)
                if not db_result:
                    return { "result" : "error", "msg" : LANG.Message("LANG10000108", lang_code), "data" : ""}
                
                # 데이터 정제 및 정규화
                db_result = clean_empty_structures(db_result)
                db_result = normalize_text(db_result)

                # Instance: submodels 참조 추가 및 idShort 복구
                if modelType == "instance" and isinstance(db_result, dict):
                    shells = db_result.get("assetAdministrationShells", [])
                    if shells and isinstance(shells, list) and len(shells) > 0:
                        shell = shells[0]

                        try:
                            raw_sql = f"SELECT metadata_aaset_administration_shells FROM aasrepo.aasinstance_aasmodels WHERE instance_seq = {body.model_key};"
                            raw_rst = await async_postQueryDataOne(raw_sql)
                            
                            if raw_rst and raw_rst.get("result") == "ok" and raw_rst.get("data"):
                                raw_data = raw_rst["data"]
                                if isinstance(raw_data, dict) and "metadata_aaset_administration_shells" in raw_data:
                                    raw_shells = raw_data["metadata_aaset_administration_shells"]
                                    if raw_shells and isinstance(raw_shells, list) and len(raw_shells) > 0:
                                        original_refs = raw_shells[0].get("submodels")
                                        if original_refs is not None:
                                            shell["submodels"] = original_refs
                        except Exception as e:
                            print(f"[ORDER RESTORE ERROR] {e}")



                        # idShort 복구
                        if "idShort" not in shell or not shell["idShort"]:
                            try:
                                sql_name = f"SELECT instance_name FROM aasrepo.aasinstance WHERE instance_seq = {body.model_key};"
                                rst_name = await async_postQueryDataOne(sql_name)
                                if rst_name and rst_name.get("result") == "ok" and rst_name.get("data"):
                                    shell["idShort"] = rst_name["data"].get("instance_name", "Instance")
                                else:
                                    shell["idShort"] = "Instance"
                            except Exception:
                                shell["idShort"] = "Instance"
                        
                        # submodels 참조 배열 추가
                        submodels_list = db_result.get("submodels", [])
                        
                        if submodels_list and isinstance(submodels_list, list):
                            if "submodels" not in shell:
                                shell["submodels"] = []

                            ui_ordered_ids = []
                            try:
                                raw_sql = f"SELECT metadata_aaset_administration_shells FROM aasrepo.aasinstance_aasmodels WHERE instance_seq = {body.model_key};"
                                raw_rst = await async_postQueryDataOne(raw_sql)
                                if raw_rst and raw_rst.get("result") == "ok" and raw_rst.get("data"):
                                    raw_shells = raw_rst["data"].get("metadata_aaset_administration_shells")
                                    if isinstance(raw_shells, list) and len(raw_shells) > 0:
                                        orig_refs = raw_shells[0].get("submodels", [])
                                        for ref in orig_refs:
                                            if ref.get("keys") and len(ref["keys"]) > 0:
                                                ui_ordered_ids.append(str(ref["keys"][0].get("value")).strip())
                            except Exception as e:
                                print(f"[UI ORDER TRACE ERROR] {e}")

                            existing_refs = set()
                            for ref in shell["submodels"]:
                                if isinstance(ref, dict) and "keys" in ref and len(ref["keys"]) > 0:
                                    existing_refs.add(ref["keys"][0].get("value"))

                            for sm in submodels_list:
                                sm_id = sm.get("id")
                                if sm_id:
                                    if sm_id not in existing_refs:
                                        shell["submodels"].append({
                                            "type": "ModelReference",
                                            "keys": [{
                                                "type": "Submodel",
                                                "value": sm_id
                                            }]
                                        })
                                        existing_refs.add(sm_id)

                            if ui_ordered_ids:
                                def get_ui_sort_index(ref):
                                    try:
                                        ref_id = str(ref["keys"][0].get("value")).strip()
                                        return ui_ordered_ids.index(ref_id)
                                    except (KeyError, IndexError, ValueError):
                                        return 9999  
                                
                                shell["submodels"].sort(key=get_ui_sort_index)

                
                # 최종 JSON 객체 (기본값)
                final_json_obj = db_result

                if format == "aasx":
                    # 방식: DB에서 관련 파일 모두 조회 -> 파일명(basename) 기준으로 JSON value 수정 및 매핑

                    aas_model_keys = []
                    sub_model_keys = []
                    
                    # 2. 관련된 모든 모델/서브모델 Key 수집
                    if modelType == "aasmodel":
                        aas_model_keys.append(body.model_key)
                    elif modelType == "instance":
                        try:
                            base_aas_key = await aasModelKey(body.model_key)
                            if base_aas_key:
                                aas_model_keys.append(base_aas_key)
                        except Exception: pass 

                        try:
                            sql_sm_keys = f"""
                                SELECT DISTINCT submodel_seq
                                FROM aasrepo.aasinstance_aasmodel_submodels 
                                WHERE instance_seq = {body.model_key}
                                  AND submodel_seq IS NOT NULL AND submodel_seq > 0;
                            """
                            rst_sm_keys = await async_postQueryDataSet(sql_sm_keys)
                            if rst_sm_keys.get("result") == "ok" and rst_sm_keys.get("data"):
                                for row in rst_sm_keys["data"]:
                                    sub_model_keys.append(row["submodel_seq"]) 
                        except Exception: pass 
                    
                    # 3. DB에서 실제 파일 바이너리를 모두 조회하여 메모리에 로드 (파일명 기준 맵 생성)
                    #    { 'image.jpg': { 'content': bytes, ... }, 'manual.pdf': { ... } }
                    all_available_files = {} 

                    # 3-1. AAS Model Files 조회
                    unique_aas_keys = list(set(aas_model_keys))
                    for key in unique_aas_keys:
                        try:
                            files = await aasModelFileContent(key)
                            if files:
                                for f in files:
                                    all_available_files[f['filename']] = f
                        except Exception: pass

                    # 3-2. Submodel Files 조회
                    unique_sub_keys = list(set(sub_model_keys))
                    for key in unique_sub_keys:
                        try:
                            files = await subModelFileContent(key)
                            if files:
                                for f in files:
                                    all_available_files[f['filename']] = f
                        except Exception: pass

                    # 3-3. Instance Files 조회
                    if modelType == "instance":
                        try:
                            files = await instanceFileContent(body.model_key)
                            if files:
                                for f in files:
                                    all_available_files[f['filename']] = f
                        except Exception: pass

                    # 4. [중요] JSON 경로 변환 및 AASX 첨부파일 맵 생성
                    # 이 함수가 JSON의 "value": "http://..." 부분을 "value": "/aasx/files/..."로 바꾸고
                    # 실제 파일 데이터를 attachments_dict에 담아줍니다.
                    modified_json, attachments_dict = prepare_aasx_structure(db_result, all_available_files)
                    
                    final_json_obj = modified_json
                    
                    if attachments_dict:
                        attachments_json = json.dumps(attachments_dict)
                    

                # JSON 객체를 문자열로 변환
                json_str = json.dumps(final_json_obj)
                        
            except Exception as e:
                # 에러 디버깅용 출력
                import traceback
                traceback.print_exc()
                return {"result": "error", "msg": LANG.Message("LANG10000110", lang_code).format(str(e))}
        else:
            return {"result": "error", "msg": LANG.Message("LANG10000110", lang_code)}
    except Exception as e:
        return {"result": "error", "msg": LANG.Message("LANG10000111", lang_code).format(str(e))}
    
    try:
        file_bytes = json_str.encode("utf-8")  
    except Exception as e:
        return {"result": "error", "msg": LANG.Message("LANG10000112", lang_code).format(str(e))}
        
    try:
        MultipartFile = JClass("org.springframework.web.multipart.MultipartFile")
        multipart_file = JProxy(MultipartFile, inst=PyMultipartFile(file_bytes, "application/json", "json", "json"))
    except Exception as e:
        return {"result": "error", "msg": LANG.Message("LANG10000113", lang_code).format(str(e))}
    
    try:
        AasRepository = JClass("org.eclipse.digitaltwin.basyx.aasrepository.AasRepository")
        SubmodelRepository = JClass("org.eclipse.digitaltwin.basyx.submodelrepository.SubmodelRepository")
        ConceptDescriptionRepository = JClass("org.eclipse.digitaltwin.basyx.conceptdescriptionrepository.ConceptDescriptionRepository")
        
        aasRepo = JProxy(AasRepository, { "getAas": lambda id: None, "createAas": lambda aas: None, "updateAas": lambda aas: None })
        submodelRepo = JProxy(SubmodelRepository, { "getSubmodel": lambda id: None, "createSubmodel": lambda submodel: None, "updateSubmodel": lambda submodel: None })
        conceptRepo = JProxy(ConceptDescriptionRepository, { "getConceptDescription": lambda id: None, "createConceptDescription": lambda cd: None, "updateConceptDescription": lambda cd: None })
    except Exception as e:
        return {"result": "error", "msg": LANG.Message("LANG10000114").format(str(e))}
    
    try:
        DefaultAASEnvironment = JClass("org.eclipse.digitaltwin.basyx.aasenvironment.base.DefaultAASEnvironment")
        aas_env = DefaultAASEnvironment(aasRepo, submodelRepo, conceptRepo)
    except Exception as e:
        return {"result": "error", "msg": LANG.Message("LANG10000115").format(str(e))}
    
    try:
        ControllerClass = JClass("org.eclipse.digitaltwin.basyx.aasenvironment.http.AasEnvironmentApiHTTPController")
        controller = ControllerClass(None, aas_env)
    except Exception as e:
        return {"result": "error", "msg": LANG.Message("LANG10000116").format(str(e))}
    
    try:
        JavaString = jpype.JClass("java.lang.String")
        attachments_java_str = JavaString(attachments_json or "")
        # Basyx 라이브러리 호출하여 AASX 생성
        response = controller.downloadAASXFile(multipart_file, format, attachments_java_str) 

        status_code = response.getStatusCodeValue()
        resource = response.getBody()
    except Exception as e:
        return {"result": "error", "msg": LANG.Message("LANG10000117").format(str(e))}
    
    if resource is None or status_code != 200:
        return {"result": "error", "msg": LANG.Message("LANG10000118").format(status_code)}
    
    try:
        input_stream = resource.getInputStream()
        buffer = jpype.JArray(JByte)(1024)
        output_stream = ByteArrayOutputStream()
        while True:
            read = input_stream.read(buffer)
            if read == -1:
                break
            output_stream.write(buffer, 0, read)
        
        return bytes(output_stream.toByteArray())
    except Exception as e:
        return {"result": "error", "msg": LANG.Message("LANG10000119").format(str(e))}

# AAS 모델의 JSON 데이터를 조회합니다.
async def aasModelMetadata(model_key, model_type):
    if model_type == 'aasmodel':
        sql = f"""
                SELECT jsonb_build_object (
                        'assetAdministrationShells', a.metadata_aaset_administration_shells 
                        , 'submodels', a.metadata_submodels 
                        , 'conceptDescriptions', a.metadata_concept_descriptions
                    ) as metadata
                  FROM aasrepo.aasmodels a
                 WHERE a.aasmodel_seq = {model_key};
                """
    elif model_type == 'submodel':
        sql = f"""
                SELECT 
                    jsonb_build_object (
                        'assetAdministrationShells', a.metadata_aaset_administration_shells 
                        , 'submodels', a.metadata_submodels 
                        , 'conceptDescriptions', a.metadata_concept_descriptions
                    ) as metadata
                  FROM aasrepo.submodels a
                 WHERE submodel_seq = {model_key};
                """
    else:
        sql = f"""
                SELECT aasrepo.fn_instance_merge(instance_seq) metadata
                  FROM aasrepo.aasinstance
                 WHERE instance_seq = {model_key};
                """
    rstData = await async_postQueryDataOne(sql)
    return rstData["data"]


async def aasModelKey(model_key):
    sql = f"SELECT aasmodel_seq FROM aasrepo.aasinstance_aasmodels WHERE instance_seq = {model_key};"
    rstData = await async_postQueryDataOne(sql)
    return rstData["data"]

async def aasModelFileContent(model_key):
    sql = f"SELECT filename, realpath FROM aasrepo.aasmodel_attachments WHERE aasmodel_seq = {model_key}"
    rstData = await async_postQueryDataSet(sql)
    result = []
    url_prefix = get_config_value("file", "mainpath")
    file_root = get_config_value("file", "fullpath")
    url_prefix_clean = ""
    if url_prefix:
        url_prefix_clean = url_prefix.strip('/') 
    for row in rstData["data"]:
        final_path = ""
        try:
            filename = row.get("filename")
            realpath_db = row.get("realpath")
            if not realpath_db: continue
            relative_path = realpath_db.strip('/')
            if url_prefix_clean and relative_path.startswith(url_prefix_clean):
                relative_path = relative_path[len(url_prefix_clean):]
                relative_path = relative_path.lstrip('/')
            final_path = os.path.join(file_root, relative_path).replace("\\", "/")
            if not os.path.exists(final_path): continue
            with open(final_path, "rb") as f:
                content = f.read()
            result.append({
                "filename": filename,
                "content": content,
                "realpath": realpath_db
            })
        except Exception: continue
    return result

    
# AAS 모델의 JSON 데이터를 조회합니다.
async def aasModelMetadata(model_key, model_type):
    
    if model_type == 'aasmodel':
        sql = f"""
                SELECT jsonb_build_object (
                        'assetAdministrationShells', a.metadata_aaset_administration_shells 
                        , 'submodels', a.metadata_submodels 
                        , 'conceptDescriptions', a.metadata_concept_descriptions
                    ) as metadata
                  FROM aasrepo.aasmodels a
                 WHERE a.aasmodel_seq = {model_key};
                """
    elif model_type == 'submodel':
        sql = f"""
                SELECT 
                    jsonb_build_object (
                        'assetAdministrationShells', a.metadata_aaset_administration_shells 
                        , 'submodels', a.metadata_submodels 
                        , 'conceptDescriptions', a.metadata_concept_descriptions
                    ) as metadata
                  FROM aasrepo.submodels a
                 WHERE submodel_seq = {model_key};
                """
    else:
        # Instance일 경우 DB의 SQL 함수 fn_instance_merge를 호출합니다.
        sql = f"""
                SELECT aasrepo.fn_instance_merge(instance_seq) metadata
                  FROM aasrepo.aasinstance
                 WHERE instance_seq = {model_key};
                """
    rstData = await async_postQueryDataOne(sql)
    return rstData["data"]

# AAS 인스턴스 모델 키를 조회합니다.
async def aasModelKey(model_key):
    
    sql = f"""
            SELECT aasmodel_seq
                FROM aasrepo.aasinstance_aasmodels
                WHERE instance_seq = {model_key};
            """
    rstData = await async_postQueryDataOne(sql)
    return rstData["data"]


async def aasModelFileContent(model_key):
    sql = f"""
        SELECT filename, realpath
          FROM aasrepo.aasmodel_attachments
         WHERE aasmodel_seq = {model_key}
    """
    rstData = await async_postQueryDataSet(sql)

    result = []
    # 1. 설정값 미리 가져오기
    url_prefix = get_config_value("file", "mainpath")  # 예: '/aas_files/aas' 또는 'aas_files/aas'
    file_root = get_config_value("file", "fullpath")   # 예: '/app/files'
    
    url_prefix_clean = ""
    if url_prefix:
        # url_prefix의 앞/뒤 슬래시를 모두 제거하여 'aas_files/aas' 같은 순수 경로만 남김
        url_prefix_clean = url_prefix.strip('/') 
        
    print(f"\n[DEBUG] 파일 읽기 시작 (Root: {file_root}, Prefix: {url_prefix_clean})")

    for row in rstData["data"]:
        final_path = "" # 최종 경로 변수 초기화
        try:
            filename = row.get("filename")
            realpath_db = row.get("realpath") # DB에 저장된 원본 경로
            
            if not realpath_db:
                print(f"[DEBUG] 건너뛰기: DB realpath가 비어있습니다. (파일: {filename})")
                continue

            # 2. DB 경로의 앞/뒤 슬래시 제거
            relative_path = realpath_db.strip('/')
            
            # 3. DB 경로가 정리된 url_prefix로 시작하는지 확인
            if url_prefix_clean and relative_path.startswith(url_prefix_clean):
                # 'aas_files/aas/123/file.pdf' -> '/123/file.pdf'
                relative_path = relative_path[len(url_prefix_clean):]
                # '/123/file.pdf' -> '123/file.pdf'
                relative_path = relative_path.lstrip('/')
            
            # 4. file_root와 최종 상대 경로 결합
            # relative_path가 '123/file.pdf' 같은 형태가 됨
            final_path = os.path.join(file_root, relative_path).replace("\\", "/")

            print(f"[DEBUG] 파일 처리: DB='{realpath_db}'  ->  Final='{final_path}'")

            # 5. 파일 존재 여부 명시적 확인 (중요)
            if not os.path.exists(final_path):
                print(f"[파일 없음] 경로를 찾을 수 없습니다: {final_path}")
                continue  # 파일이 없으면 이 파일은 건너뛰기

            # 6. 파일 읽기
            with open(final_path, "rb") as f:
                content = f.read()


            result.append({
                "filename": filename,
                "content": content,
                "realpath": realpath_db # 프론트엔드 비교를 위해 DB 원본 경로 전달
            })
            
            # print(f"[파일 읽기 성공] {final_path} (Size: {len(content)} bytes)")


        except Exception as e:
            # open() 실패 또는 기타 예외 처리
            print(f"[파일 읽기 실패] Path='{final_path}', DBPath='{realpath_db}', Error: {str(e)}")
            continue
    return result


# 서브모델 첨부파일 조회를 위한 함수
async def subModelFileContent(model_key):
    sql = f"""
        SELECT filename, realpath
          FROM aasrepo.submodel_attachments  -- [수정] 테이블명
         WHERE submodel_seq = {model_key}   -- [수정] 컬럼명
    """
    rstData = await async_postQueryDataSet(sql)

    result = []
    # 1. 설정값 미리 가져오기
    url_prefix = get_config_value("file", "mainpath")  # 예: '/aas_files/aas' 또는 'aas_files/aas'
    file_root = get_config_value("file", "fullpath")   # 예: '/app/files'
    
    url_prefix_clean = ""
    if url_prefix:
        # url_prefix의 앞/뒤 슬래시를 모두 제거하여 'aas_files/aas' 같은 순수 경로만 남김
        url_prefix_clean = url_prefix.strip('/') 
        
    print(f"\n[DEBUG] 파일 읽기 시작 (Root: {file_root}, Prefix: {url_prefix_clean})")

    for row in rstData["data"]:
        final_path = "" # 최종 경로 변수 초기화
        try:
            filename = row.get("filename")
            realpath_db = row.get("realpath") # DB에 저장된 원본 경로
            
            if not realpath_db:
                print(f"[DEBUG] 건너뛰기: DB realpath가 비어있습니다. (파일: {filename})")
                continue

            # 2. DB 경로의 앞/뒤 슬래시 제거
            relative_path = realpath_db.strip('/')
            
            # 3. DB 경로가 정리된 url_prefix로 시작하는지 확인
            if url_prefix_clean and relative_path.startswith(url_prefix_clean):
                # 'aas_files/aas/123/file.pdf' -> '/123/file.pdf'
                relative_path = relative_path[len(url_prefix_clean):]
                # '/123/file.pdf' -> '123/file.pdf'
                relative_path = relative_path.lstrip('/')
            
            # 4. file_root와 최종 상대 경로 결합
            # relative_path가 '123/file.pdf' 같은 형태가 됨
            final_path = os.path.join(file_root, relative_path).replace("\\", "/")

            print(f"[DEBUG] 파일 처리: DB='{realpath_db}'  ->  Final='{final_path}'")

            # 5. 파일 존재 여부 확인 (중요)
            if not os.path.exists(final_path):
                print(f"[파일 없음] 경로를 찾을 수 없습니다: {final_path}")
                continue  # 파일이 없으면 이 파일은 건너뛰기

            # 6. 파일 읽기
            with open(final_path, "rb") as f:
                content = f.read()


            result.append({
                "filename": filename,
                "content": content,
                "realpath": realpath_db # 프론트엔드 비교를 위해 DB 원본 경로 전달
            })
            
            # print(f"[파일 읽기 성공] {final_path} (Size: {len(content)} bytes)")


        except Exception as e:
            # open() 실패 또는 기타 예외 처리
            print(f"[파일 읽기 실패] Path='{final_path}', DBPath='{realpath_db}', Error: {str(e)}")
            continue

    return result



# 인스턴스 첨부파일 조회를 위한함수
async def instanceFileContent(model_key):
    sql = f"""
        SELECT filename, realpath
          FROM aasrepo.aasinstance_attachments
         WHERE instance_seq = {model_key}
    """
    rstData = await async_postQueryDataSet(sql)

    result = []
    
    # 1. 설정값 가져오기
    url_prefix = get_config_value("file", "mainpath")  # 예: '/aas_files/aas'
    file_root = get_config_value("file", "fullpath")   # 예: 'D:/home/datalake/aas_files/aas'
    
    url_prefix_clean = ""
    if url_prefix:
        url_prefix_clean = url_prefix.strip('/') 
        
    print(f"\n[DEBUG] 인스턴스 파일 읽기 시작 (Root: {file_root}, Prefix: {url_prefix_clean})")

    for row in rstData["data"]:
        final_path = ""
        try:
            filename = row.get("filename")
            realpath_db = row.get("realpath")
            
            if not realpath_db:
                continue

            # 2. DB 경로 정리 (앞뒤 슬래시 제거)
            relative_path = realpath_db.strip('/')
            
            # 3. Prefix 제거 (예: aas_files/aas/190/img.jpg -> 190/img.jpg)
            if url_prefix_clean and relative_path.startswith(url_prefix_clean):
                relative_path = relative_path[len(url_prefix_clean):]
                relative_path = relative_path.lstrip('/')
            
            # 4. 1차 경로 시도 (DB 경로 기반)
            final_path = os.path.join(file_root, relative_path).replace("\\", "/")

            # 5. 파일이 없으면 'instance' 폴더를 삽입하여 2차 시도
            if not os.path.exists(final_path):
                # DB 경로 예시: 190/ketilogo.jpg
                # 실제 경로 예시 : .../aas/instance/190/ketilogo.jpg 인 경우를 대비
                
                # 경로에 이미 'instance'가 포함되어 있지 않은 경우에만 시도
                if "/instance/" not in final_path.lower():
                    path_with_instance = os.path.join(file_root, 'instance', relative_path).replace("\\", "/")
                    if os.path.exists(path_with_instance):
                        print(f"[DEBUG] 경로 보정 성공 (Instance 폴더 추가): {path_with_instance}")
                        final_path = path_with_instance
            
            # 6. 최종 확인
            if not os.path.exists(final_path):
                print(f"[파일 없음] 경로를 찾을 수 없습니다: {final_path}")
                continue

            # 7. 파일 읽기
            with open(final_path, "rb") as f:
                content = f.read()

            result.append({
                "filename": filename,
                "content": content,
                "realpath": realpath_db 
            })

        except Exception as e:
            print(f"[파일 읽기 실패] Path='{final_path}', Error: {str(e)}")
            continue

    return result


# 유니코드 텍스트를 입력받아, 문자 깨짐이나 비정상적인 표현을 자동으로 고쳐주는 함수
def normalize_text(obj):
    if isinstance(obj, str):
        return fix_text(obj) 
    elif isinstance(obj, dict):
        return {k: normalize_text(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [normalize_text(item) for item in obj]
    else:
        return obj


async def extractAttachments(file_bytes: bytes, env_json: dict) -> dict[str, bytes]:
    """
    basyx-java-server-sdk의 FileElementPathCollector를 참고하여,
    Submodel의 submodelElements 모델 타입이 'File'인 경우(Supplemental Files 확인) 첨부 파일을 추출합니다.
    """

    file_paths = set()
    

    def collect_paths(node: Any):
        if isinstance(node, dict):
            if node.get("modelType") == "File":
                val = node.get("value") or ""
                val = val.strip()
                if val:
                    file_paths.add(val.lstrip("/"))
            # 하위 노드를 재귀적으로 탐색합니다.
            for v in node.values():
                collect_paths(v)
        elif isinstance(node, list):
            for item in node:
                collect_paths(item)

    collect_paths(env_json)

    # 해당 경로의 파일만 추출합니다.
    attachments = {}
    with ZipFile(BytesIO(file_bytes)) as zip_file:
        for entry in zip_file.infolist():
            fname = entry.filename
            if fname in file_paths:
                with zip_file.open(entry) as f:
                    attachments[fname] = f.read()

    return attachments