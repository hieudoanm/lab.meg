"""Unit tests for authentication route orchestration."""

from __future__ import annotations

from typing import Any, cast

import pytest
from starlette.requests import Request
from starlette.responses import Response

from app.api.routes import auth as routes
from app.schemas.auth import (
    DevelopmentTokenRequest,
    LoginRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
)
from app.schemas.common import UserPublic

CONN = cast(Any, None)
USER = UserPublic(id="user-1", email="user@example.com", display_name="User")


def _request(cookie: str | None = None) -> Request:
    headers = [(b"cookie", cookie.encode())] if cookie else []
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/",
            "headers": headers,
            "query_string": b"",
            "client": ("127.0.0.1", 1),
            "server": ("localhost", 80),
            "scheme": "http",
        }
    )


@pytest.mark.asyncio
async def test_auth_routes_login_register_reset_and_me(monkeypatch) -> None:
    async def login(*args, **kwargs):
        return USER, "token"

    async def register(*args, **kwargs):
        return USER, "token"

    async def noop(*args, **kwargs):
        return None

    monkeypatch.setattr(routes.auth_service, "login", login)
    monkeypatch.setattr(routes.auth_service, "register", register)
    monkeypatch.setattr(routes.auth_service, "request_password_reset", noop)
    monkeypatch.setattr(routes.auth_service, "confirm_password_reset", noop)
    response = Response()
    result = await routes.login(
        LoginRequest(email=USER.email, password="password123"),
        response,
        _request(),
        CONN,
        None,
        None,
    )
    assert result.user == USER and response.raw_headers
    result = await routes.register(
        RegisterRequest(email=USER.email, password="password123", display_name="User"),
        Response(),
        _request(),
        CONN,
        None,
        None,
    )
    assert result.access_token == "token"
    assert await routes.password_reset(PasswordResetRequest(email=USER.email), CONN) == {
        "status": "ok"
    }
    assert await routes.password_reset_confirm(
        PasswordResetConfirm(token="token", new_password="password123"), CONN
    ) == {"status": "ok"}
    assert await routes.me(USER) == USER


@pytest.mark.asyncio
async def test_auth_logout_and_development_token(monkeypatch) -> None:
    async def noop(*args, **kwargs):
        return None

    monkeypatch.setattr(routes.auth_service, "logout", noop)
    response = Response()
    assert await routes.logout(_request("meg-lab_session=token"), response, CONN) is response

    monkeypatch.setattr(routes, "new_opaque_token", lambda: ("token", "hash"))
    monkeypatch.setattr(routes.security, "hash_password", lambda value: "hash")

    async def no_user(*args, **kwargs):
        return None

    async def create_user(*args, **kwargs):
        return USER

    monkeypatch.setattr(routes.user_repo, "get_user_by_email", no_user)
    monkeypatch.setattr(routes.user_repo, "create_user", create_user)
    monkeypatch.setattr(routes.user_repo, "create_credential", noop)
    monkeypatch.setattr(routes.user_repo, "create_session", noop)
    monkeypatch.setattr(routes.audit_repo, "create_audit_event", noop)
    result = await routes.development_token(
        DevelopmentTokenRequest(email=USER.email),
        Response(),
        _request(),
        CONN,
        None,
        None,
    )
    assert result.user == USER
