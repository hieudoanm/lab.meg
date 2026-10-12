"""Unit tests for request and authentication dependencies."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest
from starlette.requests import Request

from app.api.deps import (
    _extract_token,
    get_client_ip,
    get_current_user,
    get_page_params,
    get_share_token,
    get_trace_id,
    require_authenticated_user,
)
from app.core.config import Settings
from app.core.exceptions import UnauthorizedError
from app.schemas.common import UserPublic

CONN = cast(Any, None)


def _request(
    *,
    headers: list[tuple[bytes, bytes]] | None = None,
    query: bytes = b"",
    cookies: str | None = None,
) -> Request:
    raw_headers = headers or []
    if cookies is not None:
        raw_headers = [*raw_headers, (b"cookie", cookies.encode())]
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": raw_headers,
        "query_string": query,
        "client": ("127.0.0.1", 1234),
        "server": ("localhost", 8000),
        "scheme": "http",
    }
    return Request(scope)


def test_extract_token_prefers_bearer_header() -> None:
    request = _request(
        headers=[(b"authorization", b"Bearer bearer-token")],
        cookies="meg-lab_session=cookie-token",
    )
    assert _extract_token(request) == "bearer-token"


def test_extract_token_reads_session_cookie_and_missing_token() -> None:
    assert _extract_token(_request(cookies="meg-lab_session=cookie-token")) == "cookie-token"
    assert _extract_token(_request()) is None


def test_get_share_token_prefers_header() -> None:
    request = _request()
    assert get_share_token(request, "header-token", "query-token") == "header-token"
    assert get_share_token(request, None, "query-token") == "query-token"


def test_get_page_params_clamps_and_handles_invalid_values() -> None:
    settings = Settings(page_default_limit=20, page_max_limit=50)
    assert get_page_params(_request(query=b"limit=100"), settings).limit == 50
    assert get_page_params(_request(query=b"limit=bad&cursor=abc"), settings).limit == 20
    assert get_page_params(_request(query=b"limit=10&cursor=abc"), settings).cursor == "abc"


def test_require_authenticated_user_rejects_anonymous() -> None:
    with pytest.raises(UnauthorizedError):
        require_authenticated_user(None)


def test_require_authenticated_user_returns_user() -> None:
    user = UserPublic(id="user-1", email="user@example.com", display_name="User")
    assert require_authenticated_user(user) is user


@pytest.mark.asyncio
async def test_current_user_resolves_jwt_and_session_paths(monkeypatch) -> None:
    user = UserPublic(id="user-1", email="user@example.com", display_name="User")

    async def by_id(conn, user_id):
        return user if user_id == "user-1" else None

    monkeypatch.setattr("app.api.deps.decode_access_jwt", lambda token: {"sub": "user-1"})
    monkeypatch.setattr("app.api.deps.user_repo.get_user_by_id", by_id)
    assert (
        await get_current_user(_request(headers=[(b"authorization", b"Bearer token")]), CONN)
        == user
    )

    monkeypatch.setattr("app.api.deps.decode_access_jwt", lambda token: None)

    async def session(conn, token_hash):
        return {
            "user_id": "user-1",
            "revoked_at": None,
            "expires_at": datetime.now(UTC) + timedelta(minutes=1),
        }

    monkeypatch.setattr("app.api.deps.user_repo.get_session", session)
    assert await get_current_user(_request(cookies="meg-lab_session=token"), CONN) == user


@pytest.mark.asyncio
async def test_current_user_rejects_revoked_and_expired_sessions(monkeypatch) -> None:
    monkeypatch.setattr("app.api.deps.decode_access_jwt", lambda token: None)

    async def revoked(*args):
        return {
            "user_id": "user-1",
            "revoked_at": "now",
            "expires_at": datetime.now(UTC) + timedelta(minutes=1),
        }

    monkeypatch.setattr(
        "app.api.deps.user_repo.get_session",
        revoked,
    )
    assert await get_current_user(_request(cookies="meg-lab_session=token"), CONN) is None

    async def expired(*args):
        return {
            "user_id": "user-1",
            "revoked_at": None,
            "expires_at": datetime.now(UTC) - timedelta(minutes=1),
        }

    monkeypatch.setattr("app.api.deps.user_repo.get_session", expired)
    assert await get_current_user(_request(cookies="meg-lab_session=token"), CONN) is None


def test_request_metadata_dependencies() -> None:
    request = _request(headers=[(b"x-forwarded-for", b" 10.0.0.1, 10.0.0.2")])
    assert get_client_ip(request) == "10.0.0.1"
    request.state.trace_id = "trace-1"
    assert get_trace_id(request) == "trace-1"
    assert get_trace_id(_request()) == "trace_unknown"
