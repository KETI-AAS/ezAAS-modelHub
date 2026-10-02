"""Dedicated SSO transactions; connections are opened only for SSO requests."""
import uuid
from config.config import get_section_dict


async def connect():
    import psycopg
    from psycopg.rows import dict_row
    cfg = get_section_dict("postgres")
    return await psycopg.AsyncConnection.connect(
        host=cfg["host"], port=cfg["port"], dbname=cfg["database"],
        user=cfg["username"], password=cfg["password"],
        connect_timeout=cfg.get("timeout", 7), row_factory=dict_row,
        options="-c timezone=UTC -c statement_timeout=5000 -c lock_timeout=5000")


async def issue_code(user, token_hash, expires_at, code_hash, client, redirect, pkce, ttl):
    async with await connect() as conn:
        async with conn.cursor() as cur:
            await cur.execute("""
                SELECT user_seq FROM aasrepo.users
                WHERE user_seq::text = %s AND coalesce(status, 'Y') = 'Y'
                  AND (close_timestamp IS NULL OR close_timestamp >= CURRENT_TIMESTAMP)
            """, (user,))
            if await cur.fetchone() is None:
                return None
            await cur.execute("""
                INSERT INTO aasrepo.sso_sessions (session_id, user_seq, token_hash, expires_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (token_hash) DO UPDATE SET token_hash = EXCLUDED.token_hash
                WHERE sso_sessions.revoked_at IS NULL AND sso_sessions.expires_at > clock_timestamp()
                RETURNING session_id, expires_at
            """, (uuid.uuid4(), user, token_hash, expires_at))
            session = await cur.fetchone()
            if session is None:
                return None
            await cur.execute("""
                INSERT INTO aasrepo.sso_codes
                    (code_hash, session_id, client_id, redirect_uri, code_challenge, expires_at)
                SELECT %s, %s, %s, %s, %s,
                    LEAST(%s, clock_timestamp() + (%s * interval '1 second'))
                WHERE %s > clock_timestamp()
                RETURNING expires_at
            """, (code_hash, session["session_id"], client, redirect, pkce,
                  session["expires_at"], ttl, session["expires_at"]))
            row = await cur.fetchone()
            return row["expires_at"] if row else None


async def consume_code(code_hash, client, redirect, pkce):
    async with await connect() as conn:
        async with conn.cursor() as cur:
            # Lock before checking/consuming: concurrent exchange requests serialize.
            await cur.execute("""
                SELECT c.code_hash, s.session_id, s.user_seq, s.expires_at
                FROM aasrepo.sso_codes c JOIN aasrepo.sso_sessions s USING (session_id)
                WHERE c.code_hash = %s AND c.client_id = %s AND c.redirect_uri = %s
                  AND c.code_challenge = %s AND c.used_at IS NULL
                  AND c.expires_at > clock_timestamp() AND s.expires_at > clock_timestamp()
                  AND s.revoked_at IS NULL
                  AND EXISTS (SELECT 1 FROM aasrepo.users u WHERE u.user_seq::text = s.user_seq
                    AND coalesce(u.status, 'Y') = 'Y'
                    AND (u.close_timestamp IS NULL OR u.close_timestamp >= CURRENT_TIMESTAMP))
                FOR UPDATE OF c, s
            """, (code_hash, client, redirect, pkce))
            row = await cur.fetchone()
            if row is None:
                return None
            await cur.execute("""
                UPDATE aasrepo.sso_codes SET used_at = clock_timestamp()
                WHERE code_hash = %s AND used_at IS NULL AND expires_at > clock_timestamp()
                  AND EXISTS (SELECT 1 FROM aasrepo.sso_sessions s
                    WHERE s.session_id = sso_codes.session_id AND s.revoked_at IS NULL
                      AND s.expires_at > clock_timestamp())
                RETURNING code_hash
            """, (code_hash,))
            return row if await cur.fetchone() else None
