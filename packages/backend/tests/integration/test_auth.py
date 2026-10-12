"""Authentication lifecycle integration tests."""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime, timedelta

import psycopg
import pytest
from psycopg.rows import dict_row


@pytest.mark.asyncio
async def test_password_reset_token_can_only_be_consumed_once(db_conn, settings) -> None:
    from app.core import security
    from app.core.exceptions import UnprocessableError
    from app.repositories import users as user_repo
    from app.services import auth as auth_service

    user = await user_repo.create_user(
        db_conn, email="reset@example.com", display_name="Reset User"
    )
    await user_repo.create_credential(
        db_conn,
        user_id=user.id,
        email=user.email or "reset@example.com",
        password_hash=security.hash_password("old-password"),
    )
    token, token_hash = security.new_opaque_token()
    await user_repo.create_reset_token(
        db_conn,
        token_hash=token_hash,
        user_id=user.id,
        expires_at=datetime.now(UTC) + timedelta(minutes=5),
    )
    await db_conn.commit()

    async def confirm() -> str:
        conn = await psycopg.AsyncConnection.connect(
            conninfo=settings.database_url,
            row_factory=dict_row,
            autocommit=False,
            options="-c timezone=UTC",
        )
        try:
            await auth_service.confirm_password_reset(conn, token, "new-password")
            return "ok"
        except UnprocessableError:
            return "rejected"
        finally:
            await conn.close()

    results = await asyncio.gather(confirm(), confirm())
    assert sorted(results) == ["ok", "rejected"]
