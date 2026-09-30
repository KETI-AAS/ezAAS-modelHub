-- Apply manually to the Hub database before enabling SSO. Never run on startup.
BEGIN;
CREATE TABLE aasrepo.sso_sessions (
    session_id uuid PRIMARY KEY,
    user_seq text NOT NULL,
    token_hash char(64) NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at timestamptz
);
CREATE INDEX sso_sessions_expiry_idx ON aasrepo.sso_sessions (expires_at);
CREATE TABLE aasrepo.sso_codes (
    code_hash char(64) PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES aasrepo.sso_sessions(session_id) ON DELETE CASCADE,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    code_challenge varchar(43) NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at timestamptz
);
CREATE INDEX sso_codes_expiry_idx ON aasrepo.sso_codes (expires_at);
CREATE INDEX sso_codes_session_idx ON aasrepo.sso_codes (session_id);
COMMIT;
