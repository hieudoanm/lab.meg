"""Unit tests for authentication and usage service branches."""

from __future__ import annotations

from typing import Any, cast

import pytest

from app.core.exceptions import ConflictError, UnauthorizedError, UnprocessableError
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.common import UserPublic
from app.services import auth, usage

CONN = cast(Any, None)
USER = UserPublic(id="user-1", email="user@example.com", display_name="User")


@pytest.mark.asyncio
async def test_register_login_logout_and_me(monkeypatch) -> None:
    monkeypatch.setattr(auth, "_dev_mode", lambda: True)
    monkeypatch.setattr(auth.security, "hash_password", lambda value: f"hash:{value}")
    monkeypatch.setattr(auth.security, "verify_password", lambda password, hashed: True)
    monkeypatch.setattr(auth, "new_opaque_token", lambda: ("token", "token-hash"))

    async def no_user(*args, **kwargs):
        return None

    async def create_user(*args, **kwargs):
        return USER

    async def credential(*args, **kwargs):
        return {"user_id": USER.id, "password_hash": "hash"}

    async def get_user(*args, **kwargs):
        return USER

    async def noop(*args, **kwargs):
        return None

    monkeypatch.setattr(auth.user_repo, "get_user_by_email", no_user)
    monkeypatch.setattr(auth.user_repo, "create_user", create_user)
    monkeypatch.setattr(auth.user_repo, "get_credential_by_email", credential)
    monkeypatch.setattr(auth.user_repo, "get_user_by_id", get_user)
    monkeypatch.setattr(auth.user_repo, "create_credential", noop)
    monkeypatch.setattr(auth.user_repo, "create_session", noop)
    monkeypatch.setattr(auth.user_repo, "revoke_session", noop)
    monkeypatch.setattr(auth.audit_repo, "create_audit_event", noop)
    assert await auth.register(
        CONN,
        RegisterRequest(email=USER.email, password="password123", display_name="User"),
        user_agent=None,
        ip_address=None,
    ) == (USER, "token")
    assert await auth.login(
        CONN,
        LoginRequest(email=USER.email, password="password123"),
        user_agent=None,
        ip_address=None,
    ) == (USER, "token")
    await auth.logout(CONN, "hash")
    assert await auth.me(CONN, USER.id) == USER


@pytest.mark.asyncio
async def test_auth_rejects_provider_mode_and_invalid_credentials(monkeypatch) -> None:
    monkeypatch.setattr(auth, "_dev_mode", lambda: False)
    request = RegisterRequest(email="a@b.com", password="password123", display_name="A")
    with pytest.raises(UnprocessableError):
        await auth.register(CONN, request, user_agent=None, ip_address=None)
    with pytest.raises(UnauthorizedError):
        await auth.login(
            CONN,
            LoginRequest(email="a@b.com", password="password123"),
            user_agent=None,
            ip_address=None,
        )
    with pytest.raises(UnprocessableError):
        await auth.confirm_password_reset(CONN, "token", "password123")

    monkeypatch.setattr(auth, "_dev_mode", lambda: True)

    async def existing_user(*args, **kwargs):
        return USER

    async def no_credential(*args, **kwargs):
        return None

    monkeypatch.setattr(auth.user_repo, "get_user_by_email", existing_user)
    with pytest.raises(ConflictError):
        await auth.register(
            CONN,
            RegisterRequest(email=USER.email, password="password123", display_name="User"),
            user_agent=None,
            ip_address=None,
        )
    monkeypatch.setattr(auth.user_repo, "get_credential_by_email", no_credential)
    with pytest.raises(UnauthorizedError):
        await auth.login(
            CONN,
            LoginRequest(email=USER.email, password="password123"),
            user_agent=None,
            ip_address=None,
        )


@pytest.mark.asyncio
async def test_usage_page_and_quotas(monkeypatch) -> None:
    async def list_usage(*args, **kwargs):
        return [{"resource_type": "storage_bytes", "amount": 2}], "next", True

    async def project_ids(*args, **kwargs):
        return ["p1", "p2"]

    async def storage(*args, **kwargs):
        return 5

    async def totals(*args, **kwargs):
        return {"core_hours": 1.5}

    monkeypatch.setattr(usage.shared_repo, "list_usage_for_user", list_usage)
    page = await usage.list_usage(CONN, user_id="user-1", limit=10, cursor=None)
    assert page.items[0]["amount"] == 2
    monkeypatch.setattr(usage.project_repo, "list_project_ids_for_user", project_ids)
    monkeypatch.setattr(usage.shared_repo, "storage_bytes_for_project", storage)
    monkeypatch.setattr(usage.shared_repo, "usage_totals_for_user", totals)
    assert await usage.quotas(CONN, user_id="user-1") == {
        "storage_bytes": 10.0,
        "core_hours": 1.5,
    }


@pytest.mark.asyncio
async def test_password_reset_is_opaque_and_atomic(monkeypatch) -> None:
    monkeypatch.setattr(auth, "_dev_mode", lambda: True)
    monkeypatch.setattr(auth, "new_opaque_token", lambda: ("reset-token", "reset-hash"))
    monkeypatch.setattr(auth.security, "hash_token", lambda value: f"hash:{value}")
    monkeypatch.setattr(auth.security, "hash_password", lambda value: f"password:{value}")

    async def find_user(*args, **kwargs):
        return USER

    async def create_reset(*args, **kwargs):
        return None

    monkeypatch.setattr(auth.user_repo, "get_user_by_email", find_user)
    monkeypatch.setattr(auth.user_repo, "create_reset_token", create_reset)
    await auth.request_password_reset(CONN, USER.email)

    class Transaction:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

    class Connection:
        def transaction(self):
            return Transaction()

    async def consume(*args, **kwargs):
        return {"user_id": USER.id}

    async def update(*args, **kwargs):
        return None

    monkeypatch.setattr(auth.user_repo, "consume_reset_token", consume)
    monkeypatch.setattr(auth.user_repo, "update_password", update)
    monkeypatch.setattr(auth.user_repo, "revoke_user_sessions", update)
    await auth.confirm_password_reset(cast(Any, Connection()), "reset-token", "new-password")
