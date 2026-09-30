# Capability SSO integration (opt-in)

This is a custom code-exchange API, not a complete OAuth/OIDC authorization server.
Existing `/login`, Google/Naver callbacks, JWT contents, cookies and frontend are unchanged.
No SSO table is accessed by existing features. Missing/disabled `sso` configuration returns
503 only on the new endpoints. No migrations run at application startup.

## Enable in a private deployment

1. Apply `aas_repo_back/db/migrations/001_sso.sql` once to the Hub PostgreSQL DB.
   It adds only `aasrepo.sso_sessions` and `aasrepo.sso_codes`. Existing tables are not altered.
   The actual production schema was not available; validate on a staging database first.
2. Copy the `sso` section from `config.example.yaml` into the runtime `config.yaml`.
3. Set the exact Capability callback URL and `enabled: true`.
4. Inject a random server-only `CAPABILITY_SSO_CLIENT_SECRET` (at least 32 characters)
   into both backend processes. In Docker, explicitly forward this variable into the backend
   container; a host `.env` alone does not inject it. Do not put it in frontend variables.
5. Use HTTPS. Local HTTP callbacks require `allow_local_http: true` and a localhost/127.0.0.1 host.

## Flow and API contract

Capability starts a login transaction, storing a random `state` and PKCE verifier in its
server-side browser session. It sends state plus S256 challenge and its registered callback
to the Hub integration client. State is 32-256 URL-safe characters; the verifier is 43-128
unreserved ASCII characters. A challenge is unpadded base64url(SHA256(verifier)), 43 characters.
Capability must compare returned state with the original browser transaction before exchange.
Never accept an unsolicited callback as a new login.

After existing Hub login succeeds (normal or social), the integration client explicitly calls:

`POST /api/sso/codes` (direct backend path `/sso/codes`)

Header: `Authorization: Bearer <raw Hub JWT>`
This NEW endpoint accepts the raw JWT from `token.payload.jwt_access_token`, not the legacy
JSON-wrapped bearer header. Existing endpoints retain their old header format.
Ambient cookies are deliberately not accepted by this endpoint.

```json
{
  "client_id": "capability",
  "redirect_uri": "https://capability.example.com/auth/hub/callback",
  "state": "<random browser transaction state>",
  "code_challenge": "<S256 challenge>"
}
```

Response: `code`, `code_expires_at`, `redirect_url`. The client navigates to `redirect_url`.
The existing Hub frontend does NOT automatically call this API or navigate to Capability;
that UI connection is a separate opt-in integration, avoiding changes to current login.

Capability validates state, then its SERVER sends:

`POST /api/sso/exchange` (direct backend path `/sso/exchange`)

Header: `Authorization: Bearer <CAPABILITY_SSO_CLIENT_SECRET>`

```json
{
  "client_id": "capability",
  "redirect_uri": "https://capability.example.com/auth/hub/callback",
  "code": "<received one-time code>",
  "code_verifier": "<original server-stored PKCE verifier>"
}
```

Response:
```json
{
  "hub_user_id": "42",
  "hub_session_id": "<UUID>",
  "expires_at": "<UTC ISO-8601 session expiry>"
}
```

`hub_user_id` is the stable `users.user_seq`, not an email/login name. Capability maps it to
its own user, creates its own random cookie session, and stores only that session's hash.
Capability expiry must not exceed `expires_at`. No JWT or client secret goes into redirect URLs.
Use no-store responses and prevent callback query strings/codes from entering access logs.

## Storage and expiry

Sessions are created lazily on the FIRST SSO code request, not during existing login.
A SHA-256 fingerprint of the existing JWT reuses the same Hub SSO session; raw JWTs and codes
are never stored. Legacy JWTs lack a unique login ID, so identical JWTs cannot be distinguished
as separate logins. Session expiry equals the verified JWT expiry. Code expiry is the earlier
of that expiry and the configured 10-120 second code lifetime (default 60).
Exchange checks client credentials, exact callback, PKCE, user status, session and code expiry.
Code consumption is transactional with PostgreSQL row locks and a conditional update;
only one exchange succeeds. A lost successful response requires a NEW code, not a retry.

Logout synchronization is NOT implemented. `revoked_at` is reserved for future invalidation;
existing Hub logout does not update it. Do not describe this release as single logout.
Expired records should be cleaned periodically (delete expired sessions cascades to their codes).
Do not log request bodies or authorization headers for these endpoints.

## Verification

Run `python -m unittest discover -s tests -p "test_sso*.py" -v` from repository root.
Tests use a separate FastAPI app and mocked storage; they do not touch production data.
Before rollout, run the migration and a simultaneous double-exchange test on staging PostgreSQL.

References: [PKCE RFC 7636](https://www.rfc-editor.org/rfc/rfc7636),
[PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html).

## No-database SSO prototype

Add this section to the runtime `config/config.yaml` (or change the existing section):

```yaml
sso:
  enabled: true
  storage: memory
  client_id: capability
  redirect_uris:
    - http://localhost:3000/auth/hub/callback
  code_ttl_seconds: 60
  allow_local_http: true
```

The URL above is an EXAMPLE, not an established Capability route. Set the exact callback
used by your Capability backend. Set the server-only `CAPABILITY_SSO_CLIENT_SECRET` as before,
and use a valid Hub JWT. Do not copy `CHANGE_ME` signing keys into a running demo.
No migration or PostgreSQL connection is needed for either SSO endpoint in memory mode.
The default is still `postgres`, and missing `sso` config still disables the feature.

**Existing Hub username/password and social login still use their original DB.** Memory
mode removes DB dependence from SSO issuance/exchange only; it does not add a fake login
or disable JWT verification. The tests demonstrate the complete SSO exchange without DB
using signed test JWTs and the real memory store.

Run one backend process (`--workers 1`), no replicas/load-balanced workers. Restart or
auto-reload clears all sessions/codes. Do not change modes during an in-flight login.
Memory mode validates the JWT but cannot check account suspension/deletion in PostgreSQL.
Code, PKCE and session expiration and single-use consumption still apply. Expired records
are removed on requests; capacity is capped at 10,000 sessions and codes. Full capacity
returns 503 instead of silently dropping valid codes. Raw JWTs/codes are never retained.

To return to DB storage, apply the SQL migration and set `storage: postgres`.
