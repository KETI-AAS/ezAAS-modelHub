from fastapi import APIRouter, Depends, UploadFile, File, Form, Body, Request
from pydantic import BaseModel
from app.aasSubModelModule import *
from typing import Annotated, Union, Optional, Any
from starlette.formparsers import MultiPartParser
from middleware.authMiddleware import verify_token
from app.aasInstanceModule import *
import json

router = APIRouter(prefix="/instance")

## Submodel 추가(사용안함)
@router.post("/submodel/merge", tags=["AAS_SubModel"], summary="AAS SubModel merge", description="AAS Instance에 Submodel 추가")
async def aasSubModelMerge(header:Annotated[dict, Depends(verify_token)], body: SubmodelMergeRequest):
    return await aasSubModelMergeEvent(header, body)


@router.get("/server/{instance_seq}", tags=['INSTANCE'], summary='AAS Instance 서버 패키지 다운로드')
async def download_instance_server(
    header: Annotated[dict, Depends(verify_token)],
    instance_seq: Union[int, str],
    background_tasks: BackgroundTasks # FastAPI로부터 주입받음
):
    # 서비스 함수 호출 시 background_tasks를 인자로 전달
    return await downloadInstanceServerEvent(header, instance_seq, background_tasks)


# AAS Instance ALL List
@router.get("/list/{category}/{pageNumber}/{pageSize}", tags=['INSTANCE'], summary='INSTANCE', description="INSTANCE LIST")
async def instanceList(
    header: Annotated[dict, Depends(verify_token)], 
    category: str = "all", 
    searchKey: str = "", 
    pageNumber: int = 1, 
    pageSize: int = 10, 
    p: str = "",
    create_user_seq: Optional[int] = None
):

    if category == "all":
        category = ""

    pageMode = False
    if p == "p":
        pageMode = True

    # instanceListEvent에 create_user_seq 전달
    return await instanceListEvent(header, category, searchKey, pageNumber, pageSize, pageMode, create_user_seq)


# AAS Instance Detail
@router.get("/{instance_seq}", tags=['INSTANCE'], summary='INSTANCE', description="INSTANCE DETAIL")
async def instanceInfo(header:Annotated[dict, Depends(verify_token)], instance_seq: int = 0):
    return await instanceInfoEvent(header, instance_seq)


# AAS Instance Save
# @router.post("/data", tags=['INSTANCE'], summary='INSTANCE', description="INSTANCE SAVE")
# async def instanceSave(
#     header: Annotated[dict, Depends(verify_token)],
#     body: bytes = Form(...),
#     attachments: list[UploadFile] = File(default=None)
# ):
#     body_dict = json.loads(body.decode('utf-8'))
#     return await instanceSaveEvent(header, body_dict, attachments)

@router.post("/data", tags=['INSTANCE'], summary='INSTANCE', description="INSTANCE SAVE")
async def instanceSave(
    header: Annotated[dict, Depends(verify_token)],
    request: Request
):
    content_type = request.headers.get("content-type", "")
    
    if "multipart/form-data" in content_type:
        parser = MultiPartParser(request.headers, request.stream())
        form = await parser.parse()
        
        body_raw = form.get("body")
        body_dict = json.loads(body_raw if isinstance(body_raw, str) else body_raw.decode('utf-8'))
        attachments = form.getlist("attachments") or None
    else:
        # JSON only
        body_dict = await request.json()
        attachments = None
    
    return await instanceSaveEvent(header, body_dict, attachments)







# AAS Instance Delete
@router.delete("/data", tags=['INSTANCE'], summary='INSTANCE', description="INSTANCE DELETE")
async def instanceDelete(header:Annotated[dict, Depends(verify_token)], instance_seq: Union[int, str]): # [수정] 함수명 중복 방지 (instanceSave -> instanceDelete)
    return await instanceDelEvent(header, instance_seq)


# AAS Instance Target AASMODEL List
@router.get("/list/{ty}/{category_seq}", tags=['INSTANCE'], summary='INSTANCE', description="INSTANCE AAS/SUB MODEL LIST")
async def instanceModelList(header:Annotated[dict, Depends(verify_token)], ty: str = "INSTANCE", category_seq: Union [int, str] = "all"):

    if category_seq == "all":
        category_seq = ""

    return await instanceModelListEvent(header, ty, category_seq)


# AAS Instance 전체 json 조회
@router.get("/detail/{instance_seq}", tags=['INSTANCE'], summary='AAS Instance 상세조회')
async def aasInstanceDetail(header:Annotated[dict, Depends(verify_token)], instance_seq: Union [int, str] = ""):
    return await aasInstanceDetailEvent(header, instance_seq)


# AAS Instance 검증 (KETI API)
@router.post("/verification", tags=['INSTANCE'], summary='AAS Instance 검증')
async def aasInstanceVerification(header:Annotated[dict, Depends(verify_token)], body: dict):
    return await aasInstanceVerificationEvent(header, body)


# @router.get("/server/{instance_seq}", tags=['INSTANCE'], summary='AAS Instance 서버 패키지 다운로드')
# async def download_instance_server(
#     header: Annotated[dict, Depends(verify_token)],
#     instance_seq: Union[int, str]
# ):
#     return await downloadInstanceServerEvent(header, instance_seq)