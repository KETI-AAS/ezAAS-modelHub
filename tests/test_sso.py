"""Run: python -m unittest discover -s tests -p test_sso.py -v"""
import asyncio
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "aas_repo_back"))
import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app import ssoModule as sso
from router.sso import router

KEY = "test-only-signing-key-never-use-in-production-0123456789"
SECRET = "test-only-client-secret-never-use-in-production-0123456789"
URI = "https://capability.example.com/auth/hub/callback"
VERIFIER = "x" * 64
CONFIG = {"enabled": True, "client_id": "capability", "redirect_uris": [URI], "code_ttl_seconds": 60}


def section(name):
    return {"sso": CONFIG, "auth": {"JWT_SECRET_KEY": KEY, "ALGORITHM": "HS256"},
            "service_info": {"name": "test-hub"}}.get(name, {})


def token(user=42, minutes=10, issuer="test-hub", key=KEY):
    now = datetime.now(timezone.utc)
    return jwt.encode({"iss": issuer, "iat": now, "exp": now + timedelta(minutes=minutes),
                       "profile": {"user_seq": user}}, key, algorithm="HS256")


class SSOTests(unittest.TestCase):
    def setUp(self):
        app = FastAPI()
        app.include_router(router)
        self.client = TestClient(app)
        self.config = patch.object(sso, "get_section_dict", side_effect=section)
        self.env = patch.dict(os.environ, {"CAPABILITY_SSO_CLIENT_SECRET": SECRET})
        self.config.start(); self.env.start()
        self.addCleanup(self.config.stop); self.addCleanup(self.env.stop)
        self.expiry = datetime.now(timezone.utc) + timedelta(minutes=10)
        self.issue_db = patch("processor.ssoProcess.issue_code", new_callable=AsyncMock)
        self.consume_db = patch("processor.ssoProcess.consume_code", new_callable=AsyncMock)
        self.issue = self.issue_db.start(); self.consume = self.consume_db.start()
        self.addCleanup(self.issue_db.stop); self.addCleanup(self.consume_db.stop)
        self.issue.return_value = self.expiry
        self.consume.return_value = {"user_seq": "42", "session_id": "test-session", "expires_at": self.expiry}
        self.issue_body = {"client_id": "capability", "redirect_uri": URI,
                           "state": "s" * 32, "code_challenge": sso.challenge(VERIFIER)}
        self.exchange_body = {"client_id": "capability", "redirect_uri": URI,
                              "code": "c" * 43, "code_verifier": VERIFIER}

    def issue_request(self, bearer=None, **changes):
        return self.client.post("/sso/codes", json={**self.issue_body, **changes},
                                headers={"Authorization": "Bearer " + (bearer or token())})

    def exchange_request(self, secret=SECRET, **changes):
        return self.client.post("/sso/exchange", json={**self.exchange_body, **changes},
                                headers={"Authorization": "Bearer " + secret})

    def test_issue_hashes_code_and_token(self):
        bearer = token()
        response = self.issue_request(bearer)
        self.assertEqual(response.status_code, 200)
        data = response.json(); args = self.issue.call_args.args
        self.assertEqual(args[0], "42")
        self.assertEqual(args[1], sso.digest(bearer))
        self.assertEqual(args[3], sso.digest(data["code"]))
        self.assertNotIn(bearer, str(args))
        self.assertNotIn(data["code"], str(args))
        self.assertIn("state=" + self.issue_body["state"], data["redirect_url"])
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_disabled_never_accesses_database(self):
        with patch.object(sso, "get_section_dict", return_value={}):
            self.assertEqual(self.issue_request().status_code, 503)
            self.assertEqual(self.exchange_request().status_code, 503)
        self.issue.assert_not_called(); self.consume.assert_not_called()

    def test_invalid_hub_tokens_rejected(self):
        for bearer in [token(minutes=-1), token(issuer="other"), token(key="other" * 10), token(user=0), "broken"]:
            with self.subTest(bearer_type="invalid"):
                self.assertEqual(self.issue_request(bearer).status_code, 401)
        self.issue.assert_not_called()

    def test_cookie_alone_cannot_issue(self):
        self.client.cookies.set("token_message", token())
        response = self.client.post("/sso/codes", json=self.issue_body)
        self.assertEqual(response.status_code, 401); self.issue.assert_not_called()

    def test_exact_client_and_callback(self):
        for changes in [{"client_id": "other"}, {"redirect_uri": URI + ".evil"},
                        {"redirect_uri": "https://evil.example.com/callback"}]:
            self.assertEqual(self.issue_request(**changes).status_code, 400)
        self.issue.assert_not_called()

    def test_pkce_and_state_required(self):
        self.assertEqual(self.issue_request(code_challenge="short").status_code, 422)
        self.assertEqual(self.issue_request(state="").status_code, 422)
        self.assertEqual(self.exchange_request(code_verifier="short").status_code, 422)
        self.issue.assert_not_called(); self.consume.assert_not_called()

    def test_exchange_requires_server_secret(self):
        self.assertEqual(self.exchange_request(secret="wrong").status_code, 401)
        self.consume.assert_not_called()

    def test_exchange_returns_identity_and_session(self):
        response = self.exchange_request()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"hub_user_id": "42", "hub_session_id": "test-session",
                                           "expires_at": self.expiry.isoformat()})
        self.assertEqual(self.consume.call_args.args,
                         (sso.digest("c" * 43), "capability", URI, sso.challenge(VERIFIER)))
        self.assertEqual(response.headers["cache-control"], "no-store")

    def test_invalid_used_or_expired_code_fails(self):
        self.consume.return_value = None
        self.assertEqual(self.exchange_request().status_code, 400)

    def test_revoked_or_inactive_user_cannot_issue(self):
        self.issue.return_value = None
        self.assertEqual(self.issue_request().status_code, 401)

    def test_db_failure_hides_details(self):
        self.issue.side_effect = RuntimeError("private-db-detail")
        response = self.issue_request()
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("private-db-detail", response.text)

    def test_placeholder_secret_refuses_to_start_sso(self):
        with patch.dict(os.environ, {"CAPABILITY_SSO_CLIENT_SECRET": "CHANGE_ME_" + "x" * 50}):
            self.assertEqual(self.issue_request().status_code, 503)
        self.issue.assert_not_called()

    def test_pkce_rfc7636_vector(self):
        self.assertEqual(sso.challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
                         "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")


if __name__ == "__main__":
    unittest.main()
