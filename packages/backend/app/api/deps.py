"""FastAPI dependencies: settings, DB, storage, auth, pagination."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC
from typing import Annotated

from fastapi import Depends, Header, Query, Request
from starlette.responses import Response

from app.core.config import Settings, get_settings
from app.core.exceptions import UnauthorizedError
from app.core.pagination import PageParams
from app.core.security import decode_access_jwt, hash_token
from app.db.pool import Connection, get_connection
from app.repositories import users as user_repo
from app.schemas.common import UserPublic
from app.storage.factory import create_storage
from app.storage.local import FileStorage
from app.storage.s3 import S3Storage


def get_app_settings() -> Settings:
    return get_settings()


async def get_db() -> AsyncIterator[Connection]:
    @asynccontextmanager
    async def _conn() -> AsyncIterator[Connection]:
        async with get_connection() as connection:
            yield connection

    async with _conn() as connection:
        yield connection


def get_storage(
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> FileStorage | S3Storage:
    return create_storage(settings)


async def get_current_user(
    request: Request,
    conn: Annotated[Connection, Depends(get_db)],
) -> UserPublic | None:
    """Resolve the caller from the session cookie or a Bearer token."""
    token = _extract_token(request)
    if token is None:
        return None

    claims = decode_access_jwt(token)
    if claims is not None:
        user = await user_repo.get_user_by_id(conn, claims["sub"])
        if user is not None:
            return user

    session = await user_repo.get_session(conn, hash_token(token))
    if session is None:
        return None
    if session.get("revoked_at") is not None:
        return None
    from datetime import datetime

    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        return None
    user = await user_repo.get_user_by_id(conn, session["user_id"])
    return user


def _extract_token(request: Request) -> str | None:
    authorization = request.headers.get("authorization")
    if authorization and authorization.startswith("Bearer "):
        return authorization[len("Bearer ") :].strip()
    return request.cookies.get(get_settings().auth_cookie_name)


def get_share_token(
    request: Request,
    x_share_token: Annotated[str | None, Header()] = None,
    share_token: Annotated[str | None, Query()] = None,
) -> str | None:
    return x_share_token or share_token


def get_page_params(
    request: Request,
    settings: Annotated[Settings, Depends(get_app_settings)],
) -> PageParams:
    limit = request.query_params.get("limit", settings.page_default_limit)
    cursor = request.query_params.get("cursor")
    try:
        parsed = PageParams(limit=int(limit), cursor=cursor)
    except ValueError:
        parsed = PageParams(limit=settings.page_default_limit, cursor=cursor)
    parsed.limit = min(parsed.limit, settings.page_max_limit)
    return parsed


def get_idempotency_key(
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> str | None:
    return idempotency_key


def get_user_agent(request: Request) -> str | None:
    return request.headers.get("user-agent")


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = request.client
    return client.host if client else None


def require_authenticated_user(
    user: Annotated[UserPublic | None, Depends(get_current_user)],
) -> UserPublic:
    if user is None:
        raise UnauthorizedError()
    return user


async def get_optional_user(
    user: Annotated[UserPublic | None, Depends(get_current_user)],
) -> UserPublic | None:
    """Resolve an authenticated caller without rejecting anonymous reads."""
    return user


def get_trace_id(request: Request) -> str:
    trace_id = getattr(request.state, "trace_id", None)
    return trace_id or "trace_unknown"


_ = Response
