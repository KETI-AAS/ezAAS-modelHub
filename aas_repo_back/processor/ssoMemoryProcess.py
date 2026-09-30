"""Process-local prototype storage. Never use with multiple workers/replicas."""
from datetime import datetime, timedelta, timezone
from threading import Lock
from uuid import uuid4


class MemoryStore:
    def __init__(self, clock=None, capacity=10000):
        self.clock = clock or (lambda: datetime.now(timezone.utc))
        self.capacity = capacity
        self.sessions = {}
        self.codes = {}
        self.lock = Lock()

    def _cleanup(self, now):
        self.codes = {key: value for key, value in self.codes.items() if value["expires_at"] > now}
        self.sessions = {key: value for key, value in self.sessions.items() if value["expires_at"] > now}

    async def issue_code(self, user, token_hash, expires_at, code_hash, client, redirect, pkce, ttl):
        # No await within the lock: atomic across requests and threads in this process.
        with self.lock:
            now = self.clock()
            self._cleanup(now)
            if expires_at <= now:
                return None
            session = self.sessions.get(token_hash)
            if len(self.codes) >= self.capacity or (session is None and len(self.sessions) >= self.capacity):
                raise RuntimeError("Prototype SSO storage is full")
            if session is None:
                session = {"session_id": str(uuid4()), "user_seq": user, "expires_at": expires_at}
                self.sessions[token_hash] = session
            expiry = min(session["expires_at"], now + timedelta(seconds=ttl))
            self.codes[code_hash] = {"token_hash": token_hash, "client_id": client,
                                     "redirect_uri": redirect, "code_challenge": pkce,
                                     "expires_at": expiry}
            return expiry

    async def consume_code(self, code_hash, client, redirect, pkce):
        with self.lock:
            now = self.clock()
            self._cleanup(now)
            code = self.codes.get(code_hash)
            if code is None or (code["client_id"], code["redirect_uri"], code["code_challenge"]) != (client, redirect, pkce):
                return None
            session = self.sessions.get(code["token_hash"])
            if session is None or session["expires_at"] <= now:
                return None
            del self.codes[code_hash]
            return dict(session)


_store = MemoryStore()


async def issue_code(*args):
    return await _store.issue_code(*args)


async def consume_code(*args):
    return await _store.consume_code(*args)
