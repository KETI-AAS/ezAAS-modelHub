"""Opt-in Capability SSO. No changes to legacy login or cookies."""
import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlencode

from fastapi import HTTPException
from config.config import get_section_dict

NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}


def fail(status, message):
    raise HTTPException(status_code=status, detail=message, headers=NO_STORE)


def digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def challenge(verifier):
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).rstrip(b"=").decode("ascii")


def settings():
    cfg = get_section_dict("sso") or {}
    if cfg.get("enabled") is not True:
        fail(503, "SSO is disabled")
    client = cfg.get("client_id", "capability")
    secret = os.environ.get("CAPABILITY_SSO_CLIENT_SECRET", "")
    redirects = cfg.get("redirect_uris", [])
    ttl = cfg.get("code_ttl_seconds", 60)
    storage = cfg.get("storage", "postgres")
    if storage not in {"postgres", "memory"}:
        fail(503, "Invalid SSO storage mode")
    if (not isinstance(client, str) or not client or len(secret) < 32
            or secret.startswith("CHANGE_ME") or not isinstance(redirects, list)
            or not redirects or type(ttl) is not int or not 10 <= ttl <= 120):
        fail(503, "SSO configuration is incomplete")
    for uri in redirects:
        if not isinstance(uri, str):
            fail(503, "Invalid SSO callback configuration")
        parts = urlsplit(uri)
        local = parts.hostname in {"localhost", "127.0.0.1"} and cfg.get("allow_local_http") is True
        if (not parts.hostname or parts.username or parts.password or parts.query or parts.fragment
                or not (parts.scheme == "https" or (parts.scheme == "http" and local))):
            fail(503, "Invalid SSO callback configuration")
    return dict(client_id=client, secret=secret, redirects=redirects, ttl=ttl, storage=storage)


def validate_client(cfg, client_id, redirect_uri):
    if client_id != cfg["client_id"] or redirect_uri not in cfg["redirects"]:
        fail(400, "Invalid client or redirect URI")


def authenticate_hub(authorization):
    # Only an explicit bearer token is accepted; ambient cookies cannot issue codes.
    import jwt
    if not authorization or not authorization.startswith("Bearer "):
        fail(401, "Hub bearer token required")
    token = authorization[7:]
    if not token or len(token) > 16384:
        fail(401, "Invalid hub token")
    auth = get_section_dict("auth")
    service = get_section_dict("service_info")
    key = auth.get("JWT_SECRET_KEY", "")
    algorithm = auth.get("ALGORITHM")
    if not key or str(key).startswith("CHANGE_ME") or algorithm not in {"HS256", "HS384", "HS512"}:
        fail(503, "Hub signing configuration is not ready for SSO")
    try:
        payload = jwt.decode(token, key, algorithms=[algorithm], issuer=service["name"],
                             options={"require": ["exp", "iat", "iss", "profile"]})
        user = payload["profile"]["user_seq"]
        if isinstance(user, bool) or not str(user).isdigit() or int(user) <= 0:
            raise ValueError("Invalid user")
        expiry = datetime.fromtimestamp(payload["exp"], timezone.utc)
    except (jwt.InvalidTokenError, KeyError, TypeError, ValueError, OverflowError):
        fail(401, "Invalid or expired hub token")
    return str(user), digest(token), expiry


def repository(cfg):
    if cfg.get("storage", "postgres") == "memory":
        from processor import ssoMemoryProcess
        return ssoMemoryProcess
    from processor import ssoProcess
    return ssoProcess


async def issue(body, authorization, cfg):
    validate_client(cfg, body.client_id, body.redirect_uri)
    user, token_hash, expiry = authenticate_hub(authorization)
    code = secrets.token_urlsafe(32)
    result = await repository(cfg).issue_code(user, token_hash, expiry, digest(code), body.client_id,
                              body.redirect_uri, body.code_challenge, cfg["ttl"])
    if result is None:
        fail(401, "Hub user or session is no longer active")
    return {"code": code, "code_expires_at": result.isoformat(),
            "redirect_url": body.redirect_uri + "?" + urlencode({"code": code, "state": body.state})}


async def exchange(body, authorization, cfg):
    if not authorization or not authorization.startswith("Bearer "):
        fail(401, "Capability server authentication required")
    # Compare fixed-size digests; never persist or log the client secret.
    if not hmac.compare_digest(digest(authorization[7:]), digest(cfg["secret"])):
        fail(401, "Invalid Capability credentials")
    validate_client(cfg, body.client_id, body.redirect_uri)
    result = await repository(cfg).consume_code(digest(body.code), body.client_id, body.redirect_uri,
                                challenge(body.code_verifier))
    if result is None:
        fail(400, "Invalid, expired or already used code")
    return {"hub_user_id": result["user_seq"], "hub_session_id": str(result["session_id"]),
            "expires_at": result["expires_at"].isoformat()}
