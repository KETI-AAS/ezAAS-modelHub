import subprocess
import json
from typing import List, Optional
from fastapi.responses import JSONResponse
from fastapi import Form, File, UploadFile, BackgroundTasks
from pydantic import BaseModel
from app.aasSubModelModule import *
from app.etcModule import *

import jpype
from app.basyxAasenvironmentModule import start_jvm, generateAasFile, AASDownloadRequest
from starlette.responses import FileResponse
import zipfile
from zipfile import ZipFile
from app.aasUtils import clean_aas_metadata, clean_empty_structures
import os
import uuid
import shutil
from starlette.background import BackgroundTask
from config.config import get_config_value
import tempfile
import config.langConfig as LANG
import traceback




class SubmodelMergeRequest(BaseModel):
    aasJson: dict
    submodelIds: List[str] 

async def aasSubModelMergeEvent(userinfo, body: SubmodelMergeRequest):
    """
    SubModel Merge 
    """
    lang_code = userinfo.lang_code if  userinfo is not None  else "1"
        
    try:
        base_aas = body.aasJson
        submodel_ids = body.submodelIds

        # submodel List
        if "submodels" not in base_aas:
            base_aas["submodels"] = []

        if not base_aas.get("assetAdministrationShells"):
            return JSONResponse(status_code=400, content={"result": "error", "msg": LANG.Message("LANG10000001", lang_code),  "data": ""})

        aas = base_aas["assetAdministrationShells"][0]

        # 참조 submodel
        if "submodels" not in aas:
            aas["submodels"] = []

        # 중복 확인
        existing_submodel_ids = {sm.get("id") for sm in base_aas["submodels"]}

        existing_ref_ids = set()

        for ref in aas["submodels"]:
            if ref.get("keys") and isinstance(ref["keys"], list):
                existing_ref_ids.add(ref["keys"][0]["value"]) # submodel id


        # merge
        for submodel_id in submodel_ids:
            response = await aasSubModelDetailEvent(userinfo, submodel_id)

            if isinstance(response, JSONResponse) and response.status_code == 200:
                detail_data = json.loads(response.body.decode('utf-8'))

                if detail_data.get("result") == "ok" and detail_data.get("data"):
                    submodel_metadata = detail_data["data"][0]["metadata"]
                    submodel_id_val = submodel_metadata.get("id")

                    if submodel_id_val:
                        # submodels 배열에 추가
                        if submodel_id_val not in existing_submodel_ids:
                            base_aas["submodels"].append(submodel_metadata)
                            existing_submodel_ids.add(submodel_id_val)

                        # AAS의 참조에 추가
                        if submodel_id_val not in existing_ref_ids:
                            ref = {
                                "type": "ModelReference",
                                "keys": [
                                    {
                                        "type": "Submodel",
                                        "value": submodel_id_val
                                    }
                                ]
                            }
                            aas["submodels"].append(ref)
                            existing_ref_ids.add(submodel_id_val)

        return JSONResponse(status_code=200, content={"result": "ok", "msg": LANG.Message("LANG10000002", lang_code), "data": base_aas})

    except Exception as e:
        return JSONResponse(status_code=500, content={"result": "error", "msg": LANG.Message("LANG10000003", lang_code).format(str(e)) , "data": ""})


## 인스턴스 리스트 
## 일단 서브리스트는 제외
async def instanceListEvent(
    userinfo, 
    searchKey, 
    category_seq, 
    pageNumber=1, 
    pageSize=10, 
    pageMode=False, 
    create_user_seq: Optional[int] = None
):

    #print(f"\n======== [DEBUG] instanceListEvent CALLED (Seq: {create_user_seq}) ========")

    # userinfo 안전하게 파싱 (dict / object 호환)
    lang_code = "1"
    user_seq = 0
    user_group_seq = 0
    
    try:
        if userinfo:
            if isinstance(userinfo, dict):
                lang_code = userinfo.get("lang_code", "1")
            else:
                lang_code = getattr(userinfo, "lang_code", "1")
    except Exception:
        lang_code = "1"

    rstData = { "result" : "error", "msg" : LANG.Message("LANG10000004", lang_code) , "data" : ""}

    # SQL 실행을 위한 변수 준비
    user_seq = getattr(userinfo, "user_seq", 0) if not isinstance(userinfo, dict) else userinfo.get("user_seq", 0)
    user_group_seq = getattr(userinfo, "user_group_seq", 0) if not isinstance(userinfo, dict) else userinfo.get("user_group_seq", 0)

    sql = f"""
(    
select a.instance_seq, a.instance_name, a.description, a.verification, aasrepo.fncodenm(bb.status, {lang_code}, 'code') as status, a.create_user_seq, a.create_date, a.last_mod_user_seq, a.last_mod_date
	, b.aasmodel_seq
	, bb.aasmodel_id, bb.aasmodel_name, bb.aasmodel_id, bb.aasmodel_template_id, bb.description as aasmodel_description, bb."version" as aasmodel_version
	, CASE {lang_code}
        WHEN 1  THEN bb1.category_name
        WHEN 2  THEN bb1.category_name2
        WHEN 3  THEN bb1.category_name3
        WHEN 4  THEN bb1.category_name4
        WHEN 5  THEN bb1.category_name5
        ELSE bb1.category_name END as category_name
    , c.user_id
from aasrepo.aasinstance a
left join aasrepo.aasinstance_aasmodels b 
	on a.instance_seq = b.instance_seq
left join aasrepo.aasmodels bb
	on b.aasmodel_seq = bb.aasmodel_seq
join aasrepo.categories bb1 
	on bb.category_seq = bb1.category_seq
left join aasrepo.aas_codeinfo e1
	on bb1.refcode1 = e1.code
left join aasrepo.aas_codeinfo e2
	on e1.refcode1 = e2.code	
left join aasrepo.aas_codeinfo e3
	on e2.refcode1 = e3.code	    
left join aasrepo.users c 
	on a.create_user_seq = c.user_seq    
where coalesce(a.is_del, 'N') = 'N'
    and ( ( a.user_seq = {userinfo.user_seq} and {userinfo.user_group_seq} = 3)
       or ( {userinfo.user_group_seq} in (1, 2) )
    )
	and ('{category_seq}' =  case left('{category_seq}', 6) 
		when 'GRP100' then e3.code 
		when 'GRP200' then e2.code 
		when 'GRP300' then e1.code
		else bb1.category_seq::varchar end or '{category_seq}' = '')
	and lower(a.instance_name) like '%'|| lower('{searchKey}') ||'%'
    
    { f"and a.create_user_seq = {create_user_seq}" if create_user_seq is not None else "" }

order by a.create_date desc
)

"""

    try:
        rst = await async_postQueryPageData(sql, pageNumber, pageSize , "", "", None, True, False, pageMode)

        # 서버 생성 여부 확인 로직
        if isinstance(rst, dict) and rst.get("result") == "ok":
            data_container = rst.get("data")
            
            # 실제 행(Row) 리스트 찾기
            rows = []
            if isinstance(data_container, list):
                rows = data_container
            elif isinstance(data_container, dict):
                if "list" in data_container:
                    rows = data_container["list"]
                elif "rows" in data_container:
                    rows = data_container["rows"]
                elif "data" in data_container:
                    rows = data_container["data"]
                else:
                    # 키를 못 찾으면 디버깅용 출력
                    print(f"[DEBUG LIST] Cannot find list in dict. Keys: {list(data_container.keys())}")

            # 리스트가 존재하면 파일 체크 수행
            if rows and isinstance(rows, list):
                # 1. 파일 루트 경로 가져오기
                file_root = get_config_value('file', 'fullpath') 
                if not file_root: file_root = "./files"

                # print(f"[DEBUG LIST] Checking {len(rows)} items... (Root: {file_root})")

                # 2. 리스트를 순회하며 폴더 존재 여부 체크
                for row in rows:
                    if isinstance(row, dict):
                        instance_seq = row.get("instance_seq")
                        if instance_seq:
                            # 경로 생성
                            server_dir = os.path.join(file_root, "instance_server", str(instance_seq)).replace("\\", "/")
                            is_created = os.path.exists(server_dir)
                            
                            # 데이터에 플래그 추가 (True/False)
                            row["server_created"] = is_created
                            row["server_path"] = server_dir if is_created else ""
                            
                            # if is_created:
                            #    print(f"  -> Found Server: {server_dir}")

        return rst
        
    except Exception as e:
        print(f"[INSTANCE LIST ERROR] {e}") 
        traceback.print_exc()
        rstData["msg"] = str(e)
        return  JSONResponse(status_code=400, content=rstData)

## 인스턴스 상세 조회    
async def instanceInfoEvent(userinfo, instance_seq):
    lang_code = "1" if userinfo is None else userinfo.lang_code

    rstData = { "result" : "error", "msg" : LANG.Message("LANG10000005", lang_code) , "data" : ""}

    sql = f"""
    with base_tbl as (
        select a.instance_seq, a.instance_name, a.description, a.verification, aasrepo.fncodenm(bb.status, {lang_code}, 'code') as status, a.create_user_seq, a.create_date, a.last_mod_user_seq, a.last_mod_date
            , b.aasmodel_seq
            , jsonb_build_object (
                'assetAdministrationShells', b.metadata_aaset_administration_shells 
                , 'submodels', b.metadata_submodels 
                , 'conceptDescriptions', b.metadata_concept_descriptions
            ) as aasmodel_metadata
            , bb.aasmodel_id, bb.aasmodel_name, bb.aasmodel_template_id, bb.description as aasmodel_description, bb."version" as aasmodel_version
            , CASE {lang_code}
                WHEN 1  THEN bb1.category_name
                WHEN 2  THEN bb1.category_name2
                WHEN 3  THEN bb1.category_name3
                WHEN 4  THEN bb1.category_name4
                WHEN 5  THEN bb1.category_name5
                ELSE bb1.category_name END as category_name
            , c.user_name
        from aasrepo.aasinstance a
        left join aasrepo.aasinstance_aasmodels b 
            on a.instance_seq = b.instance_seq
        left join aasrepo.aasmodels bb
            on b.aasmodel_seq = bb.aasmodel_seq
        join aasrepo.categories bb1 
            on bb.category_seq = bb1.category_seq
        left join aasrepo.users c on coalesce(a.last_mod_user_seq, a.create_user_seq) = c.user_seq
        
        where coalesce(a.is_del, 'N') = 'N'
            and ( ( a.user_seq = {userinfo.user_seq} and {userinfo.user_group_seq} = 3)
            or ( {userinfo.user_group_seq} in (1, 2) )
            )
            and a.instance_seq = {instance_seq}
            
    ) , submodels_tbl as (
        select a.instance_seq, a.aasmodel_seq, row_number() over (order by c.create_date desc) as submodel_no
            , c.submodel_seq
            , jsonb_build_object (
                'assetAdministrationShells', c.metadata_aaset_administration_shells 
                , 'submodels', c.metadata_submodels 
                , 'conceptDescriptions', c.metadata_concept_descriptions
            ) as submodel_metadata
            , cc.submodel_id, cc.submodel_name, cc.submodel_semantic_id, cc.description as submodel_description, cc.submodel_version as submodel_version
            , aasrepo.fncodenm(cc.status, {lang_code}, 'code') as status
            , aasrepo.fncodenm(cc.category_seq::varchar , {lang_code}, 'category') 
        from base_tbl a
        join aasrepo.aasinstance_aasmodel_submodels c 
            on a.instance_seq = c.instance_seq and a.aasmodel_seq = c.aasmodel_seq
        left join aasrepo.submodels cc
            on c.submodel_seq = cc.submodel_seq
    )  

    select row_to_json(r) as rst
    from (
        select *
            , (	select array_agg(row_to_json(r)) as submodels from submodels_tbl r) as submodels
        from base_tbl r
    ) r
    """

    try:
        rst = await async_postQueryDataOne(sql)

        if rst["result"] != "ok" or rst["data"] == "":
            rstData["msg"] = rstData["msg"] + " : " + rst["msg"]
            return JSONResponse(status_code=400, content=rstData) 
        
        if isinstance(rst["data"], dict):
            # 1. 파일 목록 가져오기
            file_list_response = await fileListEvent('instance', instance_seq)
            
            # ▼▼▼ [디버깅 로그] 파일 리스트 응답 확인 ▼▼▼
            print(f"\n-------- [FILE DEBUG] Instance: {instance_seq} --------")
            print(f"[FILE DEBUG] Raw Response: {file_list_response}")

            # 2. 파일 맵 생성 (파일명 -> 다운로드 URL)
            file_map = {}
            
            # etcModule.py는 'files'라는 키로 리스트를 반환합니다.
            if file_list_response and "files" in file_list_response:
                for f in file_list_response["files"]:
                    # DB 쿼리 결과 컬럼: 'realpath', 'filename', 'link'
                    # link가 실제 다운로드 URL입니다.
                    if "link" in f and f["link"]:
                        # 1) realpath의 basename으로 매핑 (예: ketilogo.jpg)
                        if "realpath" in f and f["realpath"]:
                             file_map[os.path.basename(f["realpath"])] = f["link"]
                        # 2) filename으로도 매핑 (예: ketilogo.jpg)
                        if "filename" in f and f["filename"]:
                             file_map[f["filename"]] = f["link"]

            print(f"[FILE DEBUG] File Map: {file_map}")

            # 3. JSON을 순회하며 File 요소의 value를 URL로 교체
            def inject_file_urls(obj):
                if isinstance(obj, dict):
                    if obj.get("modelType") == "File":
                        file_value = obj.get("value")
                        # fileObject는 제외 (프론트엔드용)
                        if file_value and isinstance(file_value, str):
                            base_name = os.path.basename(file_value)
                            
                            # ▼▼▼ [디버깅 로그] 파일 매칭 시도 ▼▼▼
                            # print(f"[FILE DEBUG] Checking File element: '{file_value}' (base: '{base_name}')")
                            
                            if base_name in file_map:
                                print(f"   -> MATCHED! Replaced with: {file_map[base_name]}")
                                obj["value"] = file_map[base_name]
                            # else:
                            #     print(f"   -> NO MATCH found.")

                    for key, value in obj.items():
                        inject_file_urls(value)
                elif isinstance(obj, list):
                    for item in obj:
                        inject_file_urls(item)

            # 4. 메타데이터에 적용
            if "aasmodel_metadata" in rst["data"] and rst["data"]["aasmodel_metadata"]:
                inject_file_urls(rst["data"]["aasmodel_metadata"])

            if "submodels" in rst["data"] and rst["data"]["submodels"]:
                for submodel_info in rst["data"]["submodels"]:
                    if "submodel_metadata" in submodel_info and submodel_info["submodel_metadata"]:
                        inject_file_urls(submodel_info["submodel_metadata"])
            
            # 파일 리스트 정보도 응답에 포함
            if file_list_response:
                 rst["data"].update(file_list_response)
            
            print("------------------------------------------------\n")

        return rst
        
    except Exception as e:
        # 에러 로그 출력
        print(f"[INSTANCE INFO ERROR] {str(e)}")
        traceback.print_exc()
        rstData["msg"] = str(e)
        return  JSONResponse(status_code=400, content=rstData)

##인스턴스 저장
async def instanceSaveEvent(userinfo, body: dict, attachments: Optional[List[UploadFile]] = None):

    lang_code = userinfo.lang_code if  userinfo is not None  else "1"
    attachments = attachments or []

    rstData = { "result" : "error", "msg" : LANG.Message("LANG10000006", lang_code) , "data" : ""}

    instance_seq = body["instance_seq"] if "instance_seq" in body else ""
    instance_name = body["instance_name"] if "instance_name" in body else ""
    description = body["description"] if "description" in body else ""
    verification = body["verification"] if "verification" in body else ""
    aasmodel_seq = body["aasmodel_seq"] if "aasmodel_seq" in body else ""
    submodels = body["submodels"] if "submodels" in body else []

    custom_args = []

    try:
        if aasmodel_seq  == "" or len(submodels) == 0 or instance_name == "" or verification == "":
            return JSONResponse(status_code=400, content={ "result" : "error", "msg" : LANG.Message("LANG10000007", lang_code) , "data" : ""}) 
        
        submodel_sql = ""
        submodel_seq_list = []
        
        # [디버깅] 메타데이터 처리 시작 로그
        print(f"-------- [SAVE START] Instance: {instance_name}, Seq: {instance_seq} --------")

        # AAS Metadata 정제
        if body.get("aasmodel_metadata"):
            try:
                aasmodel_json_parsed = json.loads(body["aasmodel_metadata"])
                
                # AAS Kind 보정
                if "assetAdministrationShells" in aasmodel_json_parsed and aasmodel_json_parsed["assetAdministrationShells"]:
                    aasmodel_json_parsed["assetAdministrationShells"][0]["assetInformation"]["assetKind"] = "Instance"
                for sm in aasmodel_json_parsed.get("submodels", []):
                    if sm.get("kind") == "Template":
                        sm["kind"] = "Instance"
                
                # 데이터 정제
                aasmodel_json_cleaned = clean_aas_metadata(aasmodel_json_parsed)
                aasmodel_json_cleaned = clean_empty_structures(aasmodel_json_cleaned)

                custom_args.append(json.dumps(aasmodel_json_cleaned.get("assetAdministrationShells", []), ensure_ascii=False))
                custom_args.append(json.dumps(aasmodel_json_cleaned.get("submodels", []), ensure_ascii=False))
                custom_args.append(json.dumps(aasmodel_json_cleaned.get("conceptDescriptions", []), ensure_ascii=False))
            except Exception as e:
                print(f"-------- [AAS METADATA CLEAN ERROR] --------: {e}")
                traceback.print_exc()
                raise e
        else:
            custom_args.append('[]')
            custom_args.append('[]')
            custom_args.append('[]')


        # Submodel Metadata 정제
        for submodel in submodels:
            sm_seq = submodel.get("submodel_seq")
            
            # sm_seq가 유효한지 확인 (문자열 변환 후 공백 체크)
            if sm_seq is not None and str(sm_seq).strip() != "":
                submodel_seq_list.append(sm_seq)
                
                if "submodel_metadata" in submodel and submodel["submodel_metadata"] and submodel["submodel_metadata"] != '{}':
                    if submodel_sql != "" :
                        submodel_sql += " union all "
                    
                    # SQL Injection 방지: safe_seq가 숫자인지 확인하거나 문자열로 감싸기
                    # str() 변환 후 사용
                    safe_seq = str(sm_seq).replace("'", "''") 
                    
                    try:
                        submodel_json_parsed = json.loads(submodel["submodel_metadata"])
                        
                        # Submodel 식별자(id) 추출
                        submodel_id = ""
                        if "submodels" in submodel_json_parsed and len(submodel_json_parsed["submodels"]) > 0:
                            submodel_id = submodel_json_parsed["submodels"][0].get("id", "")
                        
                        safe_submodel_id = str(submodel_id).replace("'", "''")

                        if safe_submodel_id != "":
                            submodel_sql += f""" 
                                SELECT COALESCE(
                                    (SELECT submodel_seq FROM aasrepo.submodels WHERE submodel_id = '{safe_submodel_id}' LIMIT 1),
                                    CASE 
                                        WHEN '{safe_seq}'::int4 > 0 THEN '{safe_seq}'::int4
                                        ELSE nextval('aasrepo.submodels_submodel_seq_seq')::int4 
                                    END
                                ) as submodel_seq, 
                                %s as metadata_aaset_administration_shells, 
                                %s as metadata_submodels, 
                                %s as metadata_concept_descriptions
                            """
                        else:
                            submodel_sql += f""" 
                                SELECT 
                                    CASE 
                                        WHEN '{safe_seq}'::int4 > 0 THEN '{safe_seq}'::int4
                                        ELSE nextval('aasrepo.submodels_submodel_seq_seq')::int4 
                                    END as submodel_seq, 
                                    %s as metadata_aaset_administration_shells, 
                                    %s as metadata_submodels, 
                                    %s as metadata_concept_descriptions
                            """
                        
                        # Submodel Kind 보정
                        for sm in submodel_json_parsed.get("submodels", []):
                            if sm.get("kind") == "Template":
                                sm["kind"] = "Instance"
                        
                        submodel_json_cleaned = clean_aas_metadata(submodel_json_parsed)
                        submodel_json_cleaned = clean_empty_structures(submodel_json_cleaned)

                        custom_args.append(json.dumps(submodel_json_cleaned.get("assetAdministrationShells", []), ensure_ascii=False))
                        custom_args.append(json.dumps(submodel_json_cleaned.get("submodels", []), ensure_ascii=False))
                        custom_args.append(json.dumps(submodel_json_cleaned.get("conceptDescriptions", []), ensure_ascii=False))
                    except Exception as e:
                        print(f"-------- [SUBMODEL CLEAN ERROR] -------- Seq: {safe_seq}, Error: {e}")
                        traceback.print_exc()
                        raise e
                

        if len(submodel_seq_list) != len(set(submodel_seq_list)):
            return JSONResponse(status_code=400, content={ "result" : "error", "msg" : LANG.Message("LANG10000008", lang_code) , "data" : ""})
       
        
        # Main SQL
        sql  = f"""
    with ins_instance as (
        INSERT INTO aasrepo.aasinstance (instance_seq, instance_name, description, verification, user_seq, create_user_seq, create_date, last_mod_user_seq, last_mod_date)
        SELECT { f'''nextval('aasrepo.aasinstance_instance_seq_seq'::regclass)''' if instance_seq == "" else instance_seq }, '{instance_name}', '{description}', '{verification}'
            , {userinfo.user_seq}, {userinfo.user_seq}, localtimestamp, {userinfo.user_seq}, localtimestamp
        ON CONFLICT(instance_seq) 
        do update SET 
        instance_name = EXCLUDED.instance_name, description = EXCLUDED.description, verification = EXCLUDED.verification, 
        user_seq = EXCLUDED.user_seq, last_mod_user_seq = EXCLUDED.last_mod_user_seq, last_mod_date = EXCLUDED.last_mod_date
        returning instance_seq
    ), del_aasmodel as (
        DELETE FROM aasrepo.aasinstance_aasmodels t
        USING ins_instance s
        WHERE t.instance_seq = s.instance_seq
        AND t.aasmodel_seq <> {aasmodel_seq}
    )
    , ins_aasmodel as (
        INSERT INTO aasrepo.aasinstance_aasmodels (instance_seq, aasmodel_seq, metadata_aaset_administration_shells, metadata_submodels, metadata_concept_descriptions, create_user_seq, create_date, last_mod_user_seq, last_mod_date)
        SELECT src.instance_seq, {aasmodel_seq}, %s, %s, %s, {userinfo.user_seq}, localtimestamp, {userinfo.user_seq}, localtimestamp
        FROM ins_instance AS src
        ON CONFLICT(instance_seq, aasmodel_seq) 
        do update SET instance_seq = EXCLUDED.instance_seq, aasmodel_seq = EXCLUDED.aasmodel_seq
        , metadata_aaset_administration_shells = EXCLUDED.metadata_aaset_administration_shells, metadata_submodels = EXCLUDED.metadata_submodels
        , metadata_concept_descriptions = EXCLUDED.metadata_concept_descriptions
        , last_mod_user_seq = EXCLUDED.last_mod_user_seq, last_mod_date = EXCLUDED.last_mod_date
        returning instance_seq, aasmodel_seq
    ), submodel_tbl as (
        { f"""
        select instance_seq, aasmodel_seq, null::int4 as submodel_seq
            , null::jsonb as metadata_aaset_administration_shells, null::jsonb as metadata_submodels, null::jsonb as metadata_concept_descriptions
            ,  0 as create_user_seq,  localtimestamp as create_date
        from  ins_aasmodel  
        """ if submodel_sql == "" else f"""
        select b.instance_seq, b.aasmodel_seq, src.submodel_seq
            , src.metadata_aaset_administration_shells::jsonb as metadata_aaset_administration_shells
            , src.metadata_submodels::jsonb as metadata_submodels
            , src.metadata_concept_descriptions::jsonb as metadata_concept_descriptions
            , {userinfo.user_seq} as create_user_seq,  localtimestamp as create_date
        from (
            {submodel_sql}
        ) as src
        , ins_aasmodel as b
        """ 
        }
    ), del_submodel as (
        DELETE FROM aasrepo.aasinstance_aasmodel_submodels t
        WHERE EXISTS (
            SELECT 1
            FROM submodel_tbl s
            WHERE t.instance_seq = s.instance_seq
                AND t.aasmodel_seq = s.aasmodel_seq
        )
        AND NOT EXISTS (
            SELECT 1
            FROM submodel_tbl s2
            WHERE s2.instance_seq = t.instance_seq
                AND s2.aasmodel_seq = t.aasmodel_seq
                AND s2.submodel_seq = t.submodel_seq
        )
    ), ins_submodel as (
        INSERT INTO aasrepo.aasinstance_aasmodel_submodels (
            instance_seq, aasmodel_seq, submodel_seq,
            metadata_aaset_administration_shells, metadata_submodels, metadata_concept_descriptions, create_user_seq, create_date
        )
        SELECT 
            instance_seq, aasmodel_seq, submodel_seq,
            metadata_aaset_administration_shells, metadata_submodels, metadata_concept_descriptions, create_user_seq, create_date
        FROM submodel_tbl
        where submodel_seq is not null
        ON CONFLICT (instance_seq, aasmodel_seq, submodel_seq) DO UPDATE
        SET 
            metadata_aaset_administration_shells = EXCLUDED.metadata_aaset_administration_shells
            , metadata_submodels = EXCLUDED.metadata_submodels
            , metadata_concept_descriptions = EXCLUDED.metadata_concept_descriptions
            , last_mod_user_seq = EXCLUDED.create_user_seq
            , last_mod_date = EXCLUDED.create_date
    )
"""

        # 파일 처리
        extracted_files = {}
        attachments_list = []
        if attachments and attachments[0] is not None:
            for attachment in attachments:
                if attachment.filename:
                    content = await attachment.read()
                    #unique_key = f"{uuid.uuid4().hex}_{attachment.filename}"
                    unique_filename = f"{uuid.uuid4().hex}_{attachment.filename}"
                    extracted_files[unique_filename] = (attachment.filename, unique_filename, content)
                    attachments_list.append({
                        'filename': attachment.filename,
                        'realpath': unique_filename.replace('\\', '/')
                    })

        if attachments_list:
            url_prefix = get_config_value('file', 'mainpath')
            sql += f""",
            insert_attachments AS (
                INSERT INTO aasrepo.aasinstance_attachments (instance_seq, filename, realpath)
                SELECT
                    ins.instance_seq,
                    f.filename,
                    %s || '/' || ins.instance_seq::text || '/' || f.realpath
                FROM ins_instance ins,
                     json_to_recordset(%s) AS f(filename text, realpath text)
                -- 기존 파일을 지우지 않고 새로 업로드된 파일만 업데이트
                ON CONFLICT (instance_seq, filename) DO UPDATE 
                SET realpath = EXCLUDED.realpath
                RETURNING instance_seq
            )
            """
            custom_args.extend([url_prefix, json.dumps(attachments_list)])

        sql += """
    select instance_seq
    from ins_instance
"""

        rst = await async_postQueryDataOne(sql, None, True, userinfo.user_seq, "INSTANCE", tuple(custom_args))

        # DB 에러 시 로그 출력
        if rst["result"] != "ok" or rst["data"] == "":
            print(f"-------- [DB ERROR] --------")
            print(f"Result: {rst}")
            rstData["msg"] = rstData["msg"] + " : " + rst["msg"]
            return JSONResponse(status_code=400, content=rstData) 
        
        instance_seq_result = rst['data']

        # 파일 저장 실행
        if attachments_list:
            upload_dir = get_config_value('file', 'fullpath')
            target_dir = os.path.join(upload_dir, 'instance', str(instance_seq_result)).replace('\\', '/')
            os.makedirs(target_dir, exist_ok=True)

            for unique_key, (original_name, unique_filename, content) in extracted_files.items():
                save_path = os.path.join(target_dir, unique_filename).replace('\\', '/')
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                with open(save_path, 'wb') as out_file:
                    out_file.write(content)

        # 검증 호출
        aasmodel = json.loads(body["aasmodel_metadata"]) if body["aasmodel_metadata"] else {}
        submodel_list = [s["submodel_metadata"] for s in body["submodels"] if "submodel_metadata" in s and s["submodel_metadata"] != ""]

        verification_result_data = await aasInstanceMergeVerification(userinfo, rst["data"], aasmodel, submodel_list)
        
        if verification_result_data["result"] == "ok" or (verification_result_data.get("data") and "PERFECT" in str(verification_result_data.get("data"))):
            verification_result = 'success'
        else:
            verification_result = 'fail'

        verification_sql = f"""
                                UPDATE aasrepo.aasinstance
                                   SET verification = '{verification_result}'
                                 WHERE instance_seq = {rst["data"]}
                             RETURNING instance_seq;
                            """
        await async_postQueryDataOne(verification_sql)

        return JSONResponse(status_code=200, content=rst)

    except Exception as e:
        # Exception 로그 출력
        print(f"-------- [INSTANCE SAVE EXCEPTION] --------")
        print(f"Error Message: {str(e)}")
        traceback.print_exc()
        rstData["msg"] = str(e)
        return JSONResponse(status_code=400, content=rstData)

##인스턴스 삭제
async def instanceDelEvent(userinfo, instance_seq = ""):
    
    lang_code = userinfo.lang_code if  userinfo is not None  else "1"

    rstData = { "result" : "error", "msg" : LANG.Message("LANG10000009", lang_code) , "data" : ""}

    if instance_seq == "" :
        return JSONResponse(status_code=400, content={ "result" : "error", "msg" : LANG.Message("LANG10000010", lang_code), "data" : ""})

    try:
        # 권한에 따른 삭제 조건 변경
        # System Manager(1) 또는 Template Manager(2)는 모든 글 삭제 가능
        # User(3)는 본인 글(user_seq 일치)만 삭제 가능
        
        auth_condition = ""
        if int(userinfo.user_group_seq) == 3: # User
            auth_condition = f"and user_seq = {userinfo.user_seq}"
        
        # (Manager(1), Approvedor(2)는 auth_condition이 빈 문자열이므로 모든 글 삭제 가능)

        sql = f"""
        with main_tbl as (
            select *
            from aasrepo.aasinstance
            where instance_seq = {instance_seq}
                {auth_condition} -- [수정] 동적 권한 조건 적용
                and coalesce(is_del, 'N') = 'N'
        )
        , del_instance as (
            update aasrepo.aasinstance
            set is_del = 'Y'
            where instance_seq = {instance_seq}
                {auth_condition} -- [수정] 동적 권한 조건 적용
        )
        select instance_name
        from main_tbl
        """
    
        rst = await async_postQueryDataOne(sql, None, True, userinfo.user_seq, "INSTANCE")

        if rst["result"] != "ok" or rst["msg"] == "":
            return JSONResponse(status_code=400, content=rstData) 

        rst["msg"] = LANG.Message("LANG10000011", lang_code).format(rst["msg"])

        return JSONResponse(status_code=200, content=rst) 
    
    except Exception as e:
        rstData["msg"] = str(e)
        return JSONResponse(status_code=400, content=rstData) 

async def instanceModelListEvent(userinfo, ty,  category_seq = ""):

    lang_code = "1" if userinfo is None else userinfo.lang_code

    rstData = { "result" : "error", "msg" : LANG.Message("LANG10000012", lang_code).format(ty) if ty != "" else "" , "data" : ""}

    sql  = f"""

    with min_tbl as (
        select aasmodel_id, min(aasmodel_seq) as min_aasmodel_seq
        from aasrepo.aasmodels
        group by aasmodel_id
        order by min_aasmodel_seq desc
    )

    select 
    	 dense_rank() over ( order by aa.min_aasmodel_seq desc) as group_seq
    	, row_number() over (partition by aa.aasmodel_id  order by a.aasmodel_seq desc) as in_seq
    	, a.aasmodel_seq, a.aasmodel_name,  a.aasmodel_id, a."version", a.aasmodel_template_id, a.description, a.category_seq
        ,  CASE {lang_code}
                WHEN 1  THEN b.category_name
                WHEN 2  THEN b.category_name2
                WHEN 3  THEN b.category_name3
                WHEN 4  THEN b.category_name4
                WHEN 5  THEN b.category_name5
                ELSE b.category_name END as category_name
    from aasrepo.aasmodels a
    left join min_tbl aa on a.aasmodel_id = aa.aasmodel_id
    join  aasrepo.categories b on  a.category_seq = b.category_seq
    left join aasrepo.aas_codeinfo e1
        on b.refcode1 = e1.code
    left join aasrepo.aas_codeinfo e2
        on e1.refcode1 = e2.code	
    left join aasrepo.aas_codeinfo e3
        on e2.refcode1 = e3.code		    
    where ('{category_seq}' =  case left('{category_seq}', 6)
                                when 'GRP100' then e3.code 
                                when 'GRP200' then e2.code 
                                when 'GRP300' then e1.code
	                            else b.category_seq::varchar end or '{category_seq}' = '')
	    and a.status in ('published')

""" if ty == "aasmodel" else  f"""

    with min_tbl as (
        select submodel_id, min(submodel_seq) as min_submodel_seq
        from aasrepo.submodels
        group by submodel_id
        order by min_submodel_seq desc
    )

    select 
        dense_rank() over ( order by aa.min_submodel_seq desc) as group_seq
    	, row_number() over (partition by aa.submodel_id  order by a.submodel_seq desc) as in_seq
    	, a.submodel_seq, a.submodel_name,  a.submodel_id, a.submodel_version as version, a.submodel_semantic_id,  a.description, a.category_seq
        ,  CASE {lang_code}
                WHEN 1  THEN b.category_name
                WHEN 2  THEN b.category_name2
                WHEN 3  THEN b.category_name3
                WHEN 4  THEN b.category_name4
                WHEN 5  THEN b.category_name5
                ELSE b.category_name END as category_name
    from aasrepo.submodels a
    left join min_tbl aa on a.submodel_id = aa.submodel_id
    join  aasrepo.categories b on  a.category_seq = b.category_seq
    left join aasrepo.aas_codeinfo e1
        on b.refcode1 = e1.code
    left join aasrepo.aas_codeinfo e2
        on e1.refcode1 = e2.code	
    left join aasrepo.aas_codeinfo e3
        on e2.refcode1 = e3.code		    
    where ('{category_seq}' =  case left('{category_seq}', 6)
	                            when 'GRP100' then e3.code 
                                when 'GRP200' then e2.code 
                                when 'GRP300' then e1.code
	                            else b.category_seq::varchar end or '{category_seq}' = '')
	    and  a.status in ('published')

"""

    try:

        rst = await async_postQueryDataSet(sql)

        if rst["result"] != "ok" :
            return JSONResponse(status_code=400, content=rstData) 

        return JSONResponse(status_code=200, content=rst) 
    except Exception as e:
        rstData["msg"] = str(e)
        return JSONResponse(status_code=400, content=rstData) 

    
# Instance 전체조회
async def aasInstanceDetailEvent(userinfo, instance_seq : Union [int, str] = ''):

    lang_code = userinfo.lang_code if  userinfo is not None  else "1"

    rstData = { "result" : "error", "msg" : LANG.Message("LANG10000013", lang_code) , "data" : ""}

    sql = f"""
        SELECT aasrepo.fn_instance_merge(instance_seq) metadata, *
          FROM aasrepo.aasinstance
         WHERE instance_seq = {instance_seq}
           AND ( 
           ( user_seq = {userinfo.user_seq} and {userinfo.user_group_seq} = 3)
            or ( {userinfo.user_group_seq} in (1, 2) )
            )
          ;
    """

    try:
        rst = await async_postQueryDataSet(sql)

        if rst["result"] != "ok" and len(rst["data"]) == 0:
            return JSONResponse(status_code=400, content={ "result" : "ok", "msg" : LANG.Message("LANG10000013", lang_code) , "data" : ""}) 

        return JSONResponse(status_code=200, content=rst) 
        
    except Exception as e:
        rstData["msg"] = str(e)
        return JSONResponse(status_code=400, content=rstData)

async def aasInstanceVerificationEvent(userinfo, body):

    lang_code = userinfo.lang_code if  userinfo is not None  else "1"
    rstData = { "result" : "error", "msg" : f"Instance verification failed." , "data" : ""} # 기본 오류
 
    instance_seq = body["instance_seq"] if "instance_seq" in body else ""
    aasmodel = body["aasmodel"] if "aasmodel" in body else ""
    # 'submodels'는 InstanceForm.tsx 로직에 따라 무시합니다 (이미 'aasmodel'에 병합됨).
    
    if aasmodel == "" or not isinstance(aasmodel, dict):
        return JSONResponse(status_code=400, content={ "result" : "error", "msg" : LANG.Message("LANG10000015", lang_code) , "data" : ""}) 

    try:
        # InstanceForm.tsx가 이미 'aasmodel'에 데이터를 병합했으므로,
        # 'aasInstanceMergeVerification' 호출을 제거하고 'verificationEvent'를 직접 호출합니다.
        
        # 1. 메타데이터 정리 (필수)
        #    프론트엔드에서 값만 변경했을 수 있으므로, 백엔드에서 구조를 정리합니다.
        cleaned_aasmodel = clean_aas_metadata(aasmodel)
        cleaned_aasmodel = clean_empty_structures(cleaned_aasmodel) # 빈 구조도 정리
        
        # 2. 검증 이벤트 호출을 위한 ID 추출
        target_id = ""
        if cleaned_aasmodel.get("assetAdministrationShells") and \
           isinstance(cleaned_aasmodel["assetAdministrationShells"], list) and \
           len(cleaned_aasmodel["assetAdministrationShells"]) > 0 and \
           cleaned_aasmodel["assetAdministrationShells"][0]:
            target_id = cleaned_aasmodel["assetAdministrationShells"][0].get("id", "")

        # 3. 검증 이벤트 직접 호출
        rst = await verificationEvent(
            userinfo, 
            cleaned_aasmodel, 
            'instance',  # 'instance' 타입은 KETI 'metamodel' API를 호출합니다.
            instance_seq, 
            target_id
        )

        # 검증 결과 DB 업데이트 로직
        final_verification_status = 'fail' # 기본값 실패로 설정

        # [디버깅] 터미널에서 값을 직접 확인
        print(f"-------- [DEBUG CHECK] --------")
        print(f"rst type: {type(rst)}")
        print(f"rst content: {rst}")

        # 성공 조건: result가 ok/success 이거나 data에 PERFECT가 포함된 경우
        if rst["result"] in ["ok", "success"] or (rst.get("data") and "PERFECT" in str(rst.get("data"))):
            final_verification_status = 'success'
        
        # [중요] DB 업데이트 실행
        verification_sql = f"""
            UPDATE aasrepo.aasinstance
               SET verification = '{final_verification_status}'
                 , last_mod_date = localtimestamp 
                 , last_mod_user_seq = {userinfo.user_seq}
             WHERE instance_seq = {instance_seq}
        """
        await async_postQueryDataOne(verification_sql)


        # 응답 반환 로직
        if final_verification_status == 'fail':
            # 실패 시
            return JSONResponse(status_code=500, content={"result": "error", "msg": rst["msg"], "data": rst.get("data", "")})
        else:
            # 성공 시
            return JSONResponse(status_code=200, content={"result": "ok", "msg": LANG.Message("LANG10000014", lang_code), "data": rst.get("data", "")})

    except Exception as e:
        print(f"-------- [DEBUG EXCEPTION] --------")
        print(f"Error: {str(e)}")
        rstData["msg"] = str(e) # 실제 예외 메시지 반환
        return JSONResponse(status_code=400, content=rstData)


async def aasInstanceMergeVerification(userinfo, instance_seq: str, aasmodel: dict, submodels: list):
    """
    aasmodel, submodels 합쳐서 KETI API 검증
    """

    lang_code = userinfo.lang_code if  userinfo is not None  else "1"

    # 메타데이터 정리를 함수 맨 위로 이동하여,
    # 'aasmodel'에 대한 모든 로직이 실행되기 전에 데이터를 정제합니다.
    if not aasmodel:
        return {"result": "error", "msg": LANG.Message("LANG10000015", lang_code), "data": ""}
    
    # 먼저 aasmodel을 정리합니다.
    cleaned_aasmodel = clean_aas_metadata(aasmodel)

    # 'aasmodel' 대신 'cleaned_aasmodel'을 사용합니다.
    if "submodels" not in cleaned_aasmodel:
        cleaned_aasmodel["submodels"] = []

    if not cleaned_aasmodel.get("assetAdministrationShells"):
        return {"result": "error", "msg": LANG.Message("LANG10000001", lang_code), "data": ""}

    # cleaned_aasmodel에서 쉘을 가져옵니다.
    aas = cleaned_aasmodel["assetAdministrationShells"][0]
    if "submodels" not in aas:
        aas["submodels"] = []

    existing_submodel_ids = {sm.get("id") for sm in cleaned_aasmodel["submodels"]}
    existing_ref_ids = {
        ref["keys"][0]["value"]
        for ref in aas["submodels"]
        if ref.get("keys") and isinstance(ref["keys"], list) and len(ref["keys"]) > 0
    }

    for submodel_metadata in submodels:

        # submodels 리스트의 각 항목이 문자열화된 JSON일 수 있으므로 파싱
        if isinstance(submodel_metadata, str):
            try: # JSON 파싱 오류 방지
                submodel_metadata = json.loads(submodel_metadata)
            except json.JSONDecodeError:
                continue # 파싱 실패 시 이 서브모델은 건너뜁니다.
        elif not isinstance(submodel_metadata, dict):
             continue

        # 병합되는 서브모델도 정제합니다.
        submodel_metadata = clean_aas_metadata(submodel_metadata)
        
        submodel_id_val = None
        # 'submodels' 배열 자체가 서브모델 정의를 포함하고 있는지 확인
        if submodel_metadata.get("submodels") and isinstance(submodel_metadata["submodels"], list) and len(submodel_metadata["submodels"]) > 0:
            # 'id'는 서브모델 정의 내부에 있습니다.
            sm_def = submodel_metadata["submodels"][0]
            submodel_id_val = sm_def.get("id")
        
        if not submodel_id_val:
            continue # 유효한 서브모델 ID를 찾을 수 없으면 건너뜁니다.


        if submodel_id_val not in existing_submodel_ids:
            # 래퍼가 아닌, 위에서 추출한 실제 서브모델 객체(sm_def)를 추가합니다.
            cleaned_aasmodel["submodels"].append(sm_def) 
            
            # 서브모델 래퍼에 포함된 ConceptDescription들도 메인 목록 병합
            if submodel_metadata.get("conceptDescriptions"):
                if "conceptDescriptions" not in cleaned_aasmodel:
                    cleaned_aasmodel["conceptDescriptions"] = []
                cleaned_aasmodel["conceptDescriptions"].extend(submodel_metadata["conceptDescriptions"])

            existing_submodel_ids.add(submodel_id_val)

        if submodel_id_val not in existing_ref_ids:
            ref = {
                "type": "ModelReference",
                "keys": [{"type": "Submodel", "value": submodel_id_val}]
            }
            aas["submodels"].append(ref) # 'aas'는 'cleaned_aasmodel'의 쉘을 참조
            existing_ref_ids.add(submodel_id_val)

    # 메타데이터 정리 후 검증
    #cleaned_aasmodel = clean_aas_metadata(aasmodel)

    return await verificationEvent(userinfo, cleaned_aasmodel, 'instance', instance_seq, "")



# ▼ 실제 도커 빌드를 수행할 백그라운드 함수
def execute_docker_build(save_dir, docker_filename, image_name, instance_seq):
    """
    도커 빌드 후 자동으로 컨테이너를 실행합니다.
    - AAS 포트: 20000 + seq (예: 20183)
    - OPC UA 포트: 4000 + seq (예: 4183)
    """
    container_name = f"aas-sim-container-{instance_seq}"
    
    try:
        # 1. 도커 빌드 실행
        print(f"[BACKGROUND DOCKER BUILD] Starting for: {image_name}")
        subprocess.run(["docker", "build", "-f", docker_filename, "-t", image_name, "."], 
                       #cwd=save_dir, capture_output=True, text=True, shell=True, check=True)
                       cwd=save_dir, capture_output=True, text=True, shell=False, check=True)
        print(f"[BACKGROUND DOCKER SUCCESS] Image built: {image_name}")

        # 2. 기존 실행 중인 동일 컨테이너 제거 (충돌 방지)
        print(f"[DOCKER CLEANUP] Removing old container if exists: {container_name}")
        #subprocess.run(["docker", "stop", container_name], shell=True, capture_output=True)
        #subprocess.run(["docker", "rm", container_name], shell=True, capture_output=True)
        subprocess.run(["docker", "stop", container_name], shell=False, capture_output=True)
        subprocess.run(["docker", "rm", container_name], shell=False, capture_output=True)

        # 3. 포트 자동 할당 계산
        # 예시 : 인스턴스 시퀀스가 183이면 AAS는 20183, OPC UA는 4183 포트 사용
        aas_port = 20000 + int(instance_seq)
        opc_port = 4000 + int(instance_seq)

        # 4. 도커 실행 (docker run)
        run_command = [
            "docker", "run", "-d",
            "--name", container_name,
            "-p", f"{aas_port}:20000", # AAS 서버 포트 매핑
            "-p", f"{opc_port}:4840",   # OPC UA 시뮬레이터 포트 매핑
            "--restart", "always",      # 서버 재부팅 시 자동 실행
            image_name
        ]
        
        #subprocess.run(run_command, shell=True, check=True, capture_output=True)
        subprocess.run(run_command, shell=False, check=True, capture_output=True)
        print(f"-------- [DOCKER DEPLOY SUCCESS] --------")
        print(f"Container: {container_name}")
        print(f"AAS Endpoint: http://localhost:{aas_port}")
        print(f"OPC UA Endpoint: opc.tcp://localhost:{opc_port}")
        print(f"------------------------------------------")

    except subprocess.CalledProcessError as e:
        print(f"[DOCKER ERROR] Command failed: {e.cmd}")
        print(f"Error Message: {e.stderr}")
    except Exception as e:
        print(f"[DOCKER EXCEPTION] Error: {str(e)}")


# background_tasks
async def downloadInstanceServerEvent(userinfo: dict, instance_seq: str, background_tasks: BackgroundTasks) -> JSONResponse:
    """
    [서버 생성 및 시뮬레이터 통합 Docker 빌드 자동화]
    - 파일명 규칙: {seq}_{instance_name}_model.json 적용
    - 운영환경: Debian/Ubuntu 계열(apt-get) 호환 Dockerfile 생성
    """
    print(f"-------- [SERVER & SIMULATOR DOCKER CREATE START] Seq: {instance_seq} --------")
    
    # 1. 인스턴스 정보 조회 및 안전한 파일명 생성
    try:
        safe_seq = str(instance_seq).strip()
        # DB에서 인스턴스 이름 가져오기
        sql = f"SELECT row_to_json(r) as data FROM (SELECT instance_seq, instance_name FROM aasrepo.aasinstance WHERE instance_seq = {safe_seq}) r"
        rst = await async_postQueryDataOne(sql)
        
        if rst.get("result") != "ok" or not rst.get("data"):
            return JSONResponse(status_code=400, content={"result": "error", "msg": "Instance not found"})
        
        db_data = rst.get("data")
        if isinstance(db_data, str): db_data = json.loads(db_data)
        
        # 시퀀스_인스턴스네임 규칙 적용 및 특수문자 제거
        raw_name = db_data.get("instance_name", "model")
        instance_name = "".join(c for c in raw_name if c.isalnum() or c in ('_', '-')).strip()
        model_filename = f"{safe_seq}_{instance_name}_model.json" 
    except Exception as e:
        return JSONResponse(status_code=400, content={"result": "error", "msg": f"DB Error: {str(e)}"})

    # 2. 경로 설정 (config 설정 참조)
    file_root = get_config_value('file', 'fullpath') or "./files"
    save_dir = os.path.join(file_root, "instance_server", safe_seq).replace("\\", "/")
    os.makedirs(save_dir, exist_ok=True)

    # 주요 파일명 정의
    config_filename = "config.json"
    entrypoint_filename = "entrypoint.sh"
    docker_filename = f"Dockerfile_{safe_seq}"
    image_name = f"aas-sim-server-{safe_seq}"

    try:
        # A. AAS 모델 파일 생성 (요청된 파일명으로 저장)
        request_body = AASDownloadRequest(name="model", source="db", model_key=safe_seq)
        model_bytes = await generateAasFile(userinfo, request_body, "json", "instance")
        with open(os.path.join(save_dir, model_filename), "wb") as f:
            f.write(model_bytes)

        # B. 시뮬레이터 소스 파일 복사 (app 폴더에서 복사)
        current_dir = os.path.dirname(os.path.abspath(__file__)) 
        for sim_file in ["opcua_server.py", "model_parser.py"]:
            src_path = os.path.join(current_dir, sim_file)
            if os.path.exists(src_path):
                shutil.copy(src_path, save_dir)
                print(f"[COPY SUCCESS] {sim_file} copied to {save_dir}")
            else:
                # 파일이 없으면 빌드가 불가능하므로 예외 발생
                raise FileNotFoundError(f"{sim_file} 파일을 {current_dir}에서 찾을 수 없습니다.")

        # C. FA³ST 설정 생성 (컨테이너 내부 경로 /app/models/model.json 고정)
        faaast_config = {
            "endpoints": [{"@class": "de.fraunhofer.iosb.ilt.faaast.service.endpoint.http.HttpEndpoint", "port": 20000, "corsEnabled": True}],
            "persistence": {
                "@class": "de.fraunhofer.iosb.ilt.faaast.service.persistence.memory.PersistenceInMemory", 
                "initialModelFile": "/app/models/model.json" 
            },
            "assetConnections": [{
                "@class": "de.fraunhofer.iosb.ilt.faaast.service.assetconnection.opcua.OpcUaAssetConnection", 
                "host": "opc.tcp://localhost:4840" 
            }]
        }
        with open(os.path.join(save_dir, config_filename), "w", encoding="utf-8") as f:
            json.dump(faaast_config, f, ensure_ascii=False, indent=2)

        # D. 통합 실행 스크립트 생성 (Python + Java)
        entrypoint_content = f"""#!/bin/sh
# OPC UA 시뮬레이터 실행
python3 /app/sim/opcua_server.py & 
# FA3ST AAS 런타임 실행
#java -jar /app/faaast-service.jar --config.path=/app/config.json
#java -jar /app/starter.jar --config.path=/app/config.json
java -jar /app/starter.jar --config /app/config.json

"""
        with open(os.path.join(save_dir, entrypoint_filename), "w", encoding="utf-8", newline='\n') as f:
            f.write(entrypoint_content)

        # E. Dockerfile 생성 (Ubuntu/Debian 호환 및 파일명 매핑)
        dockerfile_content = f"""FROM fraunhoferiosb/faaast-service:latest
USER root

# 운영서버(Ubuntu) 환경에 맞춰 apt-get 사용
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install asyncua --break-system-packages

WORKDIR /app
RUN mkdir -p /app/sim /app/models

# 시뮬레이터 소스 복사
COPY opcua_server.py model_parser.py /app/sim/

# 호스트의 동적 파일명을 컨테이너 내부의 고정된 model.json으로 이름 변경하여 복사
COPY {model_filename} /app/models/model.json 

COPY {config_filename} /app/
COPY {entrypoint_filename} /app/
RUN chmod +x /app/{entrypoint_filename}

EXPOSE 20000 4840
ENTRYPOINT ["/app/{entrypoint_filename}"]
"""
        with open(os.path.join(save_dir, docker_filename), "w", encoding="utf-8") as f:
            f.write(dockerfile_content)

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=400, content={"result": "error", "msg": f"빌드 준비 실패: {str(e)}"})

    # 4. 백그라운드 도커 빌드 시작
    background_tasks.add_task(execute_docker_build, save_dir, docker_filename, image_name, safe_seq)

    return JSONResponse(status_code=200, content={
        "result": "ok",
        "msg": "Simulator integrated server build & run started.",
        "data": {"instance_seq": safe_seq, "image": image_name}
    })