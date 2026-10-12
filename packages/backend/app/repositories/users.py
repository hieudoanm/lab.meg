"""User, credential, session, and password-reset repositories."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from psycopg.rows import dict_row

from app.db.pool import Connection
from app.repositories._shared import clean, to_model
from app.schemas.auth import MeResponse
from app.schemas.common import UserPublic


async def create_user(
    conn: Connection,
    *,
    email: str,
    display_name: str | None,
) -> UserPublic:
    row = await conn.execute(
        "INSERT INTO users (email, display_name) VALUES (%s, %s) RETURNING *",
        (email, display_name),
    )
    return to_model(UserPublic, await row.fetchone())  # type: ignore[return-value]


async def get_user_by_id(conn: Connection, user_id: str) -> UserPublic | None:
    row = await conn.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    return to_model(UserPublic, await row.fetchone())


async def get_user_by_email(conn: Connection, email: str) -> UserPublic | None:
    row = await conn.execute("SELECT * FROM users WHERE lower(email) = lower(%s)", (email,))
    return to_model(UserPublic, await row.fetchone())


async def update_user(
    conn: Connection,
    user_id: str,
    *,
    display_name: str | None = None,
) -> UserPublic:
    fields = []
    params = []
    if display_name is not None:
        fields.append("display_name = %s")
        params.append(display_name)
    if not fields:
        user = await get_user_by_id(conn, user_id)
        if user is None:
            raise ValueError(f"User {user_id} not found")
        return user
    params.append(user_id)
    query = f"UPDATE users SET {', '.join(fields)}, updated_at = now() WHERE id = %s RETURNING *"
    row = await conn.execute(query, tuple(params))
    user = to_model(UserPublic, await row.fetchone())
    if user is None:
        raise ValueError(f"User {user_id} not found")
    return user


async def create_credential(
    conn: Connection,
    *,
    user_id: str,
    email: str,
    password_hash: str,
) -> None:
    await conn.execute(
        """
        INSERT INTO auth_credentials (user_id, email, password_hash)
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id) DO UPDATE
            SET email = EXCLUDED.email,
                password_hash = EXCLUDED.password_hash,
                updated_at = now()
        """,
        (user_id, email, password_hash),
    )


async def get_credential_by_email(conn: Connection, email: str) -> dict[str, Any] | None:
    row = await conn.execute(
        "SELECT * FROM auth_credentials WHERE lower(email) = lower(%s)",
        (email,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def update_password(conn: Connection, user_id: str, password_hash: str) -> None:
    await conn.execute(
        "UPDATE auth_credentials SET password_hash = %s, updated_at = now() WHERE user_id = %s",
        (password_hash, user_id),
    )


async def create_session(
    conn: Connection,
    *,
    user_id: str,
    token_hash: str,
    expires_at: datetime,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> None:
    await conn.execute(
        """
        INSERT INTO sessions (user_id, token_hash, expires_at, user_agent, ip_address)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user_id, token_hash, expires_at, user_agent, ip_address),
    )


async def get_session(conn: Connection, token_hash: str) -> dict[str, Any] | None:
    row = await conn.execute(
        """
        SELECT s.*, u.email AS user_email, u.display_name AS user_display_name
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = %s
        """,
        (token_hash,),
    )
    result = await row.fetchone()
    if result is None:
        return None
    return clean(result)


async def revoke_session(conn: Connection, token_hash: str) -> None:
    await conn.execute(
        "UPDATE sessions SET revoked_at = now() WHERE token_hash = %s",
        (token_hash,),
    )


async def revoke_user_sessions(conn: Connection, user_id: str) -> None:
    await conn.execute(
        "UPDATE sessions SET revoked_at = now() WHERE user_id = %s AND revoked_at IS NULL",
        (user_id,),
    )


async def create_reset_token(
    conn: Connection,
    *,
    token_hash: str,
    user_id: str,
    expires_at: datetime,
) -> None:
    await conn.execute(
        "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
        (token_hash, user_id, expires_at),
    )


async def consume_reset_token(conn: Connection, token_hash: str) -> dict[str, Any] | None:
    """Atomically claim one live reset token for a password change."""
    row = await conn.execute(
        """
        UPDATE password_reset_tokens
        SET used_at = now()
        WHERE token_hash = %s AND used_at IS NULL AND expires_at > now()
        RETURNING *
        """,
        (token_hash,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def get_reset_token(conn: Connection, token_hash: str) -> dict[str, Any] | None:
    """Read a live reset token without claiming it."""
    row = await conn.execute(
        """
        SELECT * FROM password_reset_tokens
        WHERE token_hash = %s AND used_at IS NULL AND expires_at > now()
        """,
        (token_hash,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def delete_expired_sessions(conn: Connection) -> int:
    row = await conn.execute(
        "DELETE FROM sessions WHERE expires_at < now() OR revoked_at < now() - interval '7 days'"
    )
    return row.rowcount or 0


async def user_with_membership(conn: Connection, user_id: str) -> MeResponse | None:
    row = await conn.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    result = await row.fetchone()
    return to_model(MeResponse, result)


_ = dict_row
