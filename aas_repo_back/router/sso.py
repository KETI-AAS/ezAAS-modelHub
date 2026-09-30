"""New endpoints only. Existing /login and social callbacks are unchanged."""
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from app import ssoModule

router = APIRouter(prefix="/sso", tags=["Capability SSO"])


class CodeRequest(BaseModel):
    client_id: str = Field(min_length=1, max_length=128)
    redirect_uri: str = Field(min_length=1, max_length=2048)
    state: str = Field(min_length=32, max_length=256, pattern=r"^[A-Za-z0-9_-]+$")
    code_challenge: str = Field(min_length=43, max_length=43, pattern=r"^[A-Za-z0-9_-]+$")


class ExchangeRequest(BaseModel):
    client_id: str = Field(min_length=1, max_length=128)
    redirect_uri: str = Field(min_length=1, max_length=2048)
    code: str = Field(min_length=43, max_length=43, pattern=r"^[A-Za-z0-9_-]+$")
    code_verifier: str = Field(min_length=43, max_length=128, pattern=r"^[A-Za-z0-9._~-]+$")


async def execute(operation, body, authorization, cfg):
    try:
        data = await operation(body, authorization, cfg)
        return JSONResponse(content=data, headers=ssoModule.NO_STORE)
    except HTTPException:
        raise
    except Exception:
        # Do not leak DB details, bearer tokens or codes through errors/logs.
        raise HTTPException(503, "SSO temporarily unavailable", headers=ssoModule.NO_STORE)


@router.post("/codes")
async def issue_code(body: CodeRequest, authorization: str = Header(default=""),
                     cfg: dict = Depends(ssoModule.settings)):
    return await execute(ssoModule.issue, body, authorization, cfg)


@router.post("/exchange")
async def exchange_code(body: ExchangeRequest, authorization: str = Header(default=""),
                        cfg: dict = Depends(ssoModule.settings)):
    return await execute(ssoModule.exchange, body, authorization, cfg)
