import asyncio
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, AsyncMock

from test_sso import sso, section, token, SECRET, URI, VERIFIER, CONFIG, FastAPI, TestClient, router
from processor.ssoMemoryProcess import MemoryStore


class MemoryStorageTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2030, 1, 1, tzinfo=timezone.utc)
        self.store = MemoryStore(clock=lambda: self.now)
        self.expiry = self.now + timedelta(minutes=5)

    def issue(self, code="hash", expiry=None):
        return asyncio.run(self.store.issue_code("42", "token-hash", expiry or self.expiry,
                           code, "capability", URI, "challenge", 60))

    def consume(self, code="hash", client="capability", redirect=URI, pkce="challenge"):
        return asyncio.run(self.store.consume_code(code, client, redirect, pkce))

    def test_only_one_concurrent_exchange_succeeds(self):
        self.issue()
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(lambda _: self.consume(), range(16)))
        self.assertEqual(sum(result is not None for result in results), 1)
        self.assertIsNone(self.consume())

    def test_bad_bindings_do_not_consume_code(self):
        self.issue()
        for kwargs in [{"client": "wrong"}, {"redirect": URI + ".evil"}, {"pkce": "wrong"}]:
            self.assertIsNone(self.consume(**kwargs))
        self.assertEqual(self.consume()["user_seq"], "42")

    def test_code_expiry(self):
        self.issue()
        self.now += timedelta(seconds=60)
        self.assertIsNone(self.consume())
        self.assertEqual(self.store.codes, {})

    def test_session_bounds_code_expiry(self):
        expiry = self.now + timedelta(seconds=10)
        self.assertEqual(self.issue(expiry=expiry), expiry)
        self.now = expiry
        self.assertIsNone(self.consume())
        self.assertEqual(self.store.sessions, {})

    def test_same_token_reuses_session(self):
        self.issue("a"); self.issue("b")
        a = self.consume("a"); b = self.consume("b")
        self.assertEqual(a["session_id"], b["session_id"])
        self.assertEqual(a["expires_at"], self.expiry)

    def test_restart_loses_state(self):
        self.issue()
        self.store = MemoryStore(clock=lambda: self.now)
        self.assertIsNone(self.consume())

    def test_capacity_preserves_existing_code(self):
        self.store.capacity = 1
        self.issue("a")
        with self.assertRaises(RuntimeError):
            self.issue("b")
        self.assertIsNotNone(self.consume("a"))

    def test_expired_jwt_cannot_create_session(self):
        self.assertIsNone(self.issue(expiry=self.now - timedelta(seconds=1)))
        self.assertEqual(self.store.sessions, {})


class MemoryEndpointTests(unittest.TestCase):
    def test_real_exchange_without_any_database_call(self):
        app = FastAPI(); app.include_router(router)
        def memory_config(name):
            return {**CONFIG, "storage": "memory"} if name == "sso" else section(name)
        with patch.object(sso, "get_section_dict", side_effect=memory_config), \
             patch.dict(os.environ, {"CAPABILITY_SSO_CLIENT_SECRET": SECRET}), \
             patch("processor.ssoMemoryProcess._store", MemoryStore()) as store, \
             patch("processor.ssoProcess.connect", new_callable=AsyncMock) as db:
            db.side_effect = AssertionError("No DB calls allowed")
            with TestClient(app) as client:
                bearer = token()
                response = client.post("/sso/codes", headers={"Authorization": "Bearer " + bearer},
                    json={"client_id": "capability", "redirect_uri": URI,
                          "state": "s" * 32, "code_challenge": sso.challenge(VERIFIER)})
                self.assertEqual(response.status_code, 200)
                code = response.json()["code"]
                self.assertNotIn(code, repr(store.codes))
                self.assertNotIn(bearer, repr(store.sessions))
                body = {"client_id": "capability", "redirect_uri": URI,
                        "code": code, "code_verifier": VERIFIER}
                # Invalid PKCE must fail, leaving the code usable for its legitimate client.
                bad = client.post("/sso/exchange", headers={"Authorization": "Bearer " + SECRET},
                                  json={**body, "code_verifier": "z" * 64})
                self.assertEqual(bad.status_code, 400)
                good = client.post("/sso/exchange", headers={"Authorization": "Bearer " + SECRET}, json=body)
                self.assertEqual(good.status_code, 200)
                self.assertEqual(good.json()["hub_user_id"], "42")
                repeat = client.post("/sso/exchange", headers={"Authorization": "Bearer " + SECRET}, json=body)
                self.assertEqual(repeat.status_code, 400)
                db.assert_not_called()

    def test_unknown_storage_is_rejected(self):
        cfg = {**CONFIG, "storage": "typo"}
        with patch.object(sso, "get_section_dict", return_value=cfg), \
             patch.dict(os.environ, {"CAPABILITY_SSO_CLIENT_SECRET": SECRET}):
            with self.assertRaises(Exception) as err:
                sso.settings()
            self.assertEqual(err.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
