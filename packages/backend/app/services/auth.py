"""Authentication and identity services.

In ``AUTH_MODE=development`` the backend provisions local identities
with Argon2id-hashed credentials. In production the OIDC provider
owns the authoritative identity record and password endpoints are
disabled.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core import security
from app.core.config import get_settings
from app.core.exceptions import ConflictError, UnauthorizedError, UnprocessableError
from app.core.security import new_opaque_token
from app.db.pool import Connection
from app.repositories import audit as audit_repo
from app.repositories import users as user_repo
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.common import UserPublic

logger = logging.getLogger(__name__)


def _dev_mode() -> bool:
    return get_settings().auth_mode == "development"


async def register(
    conn: Connection, request: RegisterRequest, *, user_agent: str | None, ip_address: str | None
) -> tuple[UserPublic, str]:
    if not _dev_mode():
        raise UnprocessableError(
            "registration is handled by the configured identity provider",
            code="auth_provider_registration",
        )
    existing = await user_repo.get_user_by_email(conn, request.email)
    if existing is not None:
        raise ConflictError("an account with this email already exists", code="user_already_exists")

    user = await user_repo.create_user(conn, email=request.email, display_name=request.display_name)
    await user_repo.create_credential(
        conn,
        user_id=user.id,
        email=request.email,
        password_hash=security.hash_password(request.password),
    )
    token, token_hash = new_opaque_token()
    expires_at = datetime.now(UTC) + timedelta(seconds=get_settings().session_ttl_seconds)
    await user_repo.create_session(
        conn,
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    await audit_repo.create_audit_event(
        conn, actor_id=user.id, action="user.registered", resource_type="user", resource_id=user.id
    )
    return user, token


async def login(
    conn: Connection, request: LoginRequest, *, user_agent: str | None, ip_address: str | None
) -> tuple[UserPublic, str]:
    if not _dev_mode():
        raise UnauthorizedError("login is handled by the configured identity provider")
    credential = await user_repo.get_credential_by_email(conn, request.email)
    if credential is None or not security.verify_password(
        request.password, credential["password_hash"]
    ):
        # Deliberately identical to a wrong-password response: no account
        # enumeration (FR-001).
        raise UnauthorizedError("invalid email or password", code="invalid_credentials")
    user = await user_repo.get_user_by_id(conn, credential["user_id"])
    if user is None:
        raise UnauthorizedError("invalid email or password", code="invalid_credentials")
    token, token_hash = new_opaque_token()
    expires_at = datetime.now(UTC) + timedelta(seconds=get_settings().session_ttl_seconds)
    await user_repo.create_session(
        conn,
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    return user, token


async def logout(conn: Connection, token_hash: str | None) -> None:
    if token_hash is not None:
        await user_repo.revoke_session(conn, token_hash)


async def me(conn: Connection, user_id: str) -> UserPublic:
    user = await user_repo.get_user_by_id(conn, user_id)
    if user is None:
        raise UnauthorizedError("session expired or invalid", code="session_expired")
    return user


async def request_password_reset(conn: Connection, email: str) -> None:
    """Issue a reset token when the account exists; never reveal existence."""
    if not _dev_mode():
        return
    user = await user_repo.get_user_by_email(conn, email)
    if user is None:
        return
    token, token_hash = new_opaque_token()
    expires_at = datetime.now(UTC) + timedelta(seconds=get_settings().reset_token_ttl_seconds)
    await user_repo.create_reset_token(
        conn, token_hash=token_hash, user_id=user.id, expires_at=expires_at
    )
    # In development the token is logged so the flow can be exercised
    # end to end. Production sends it over email via the identity provider.
    logger.info("password reset token for %s: %s", email, token)


async def confirm_password_reset(conn: Connection, token: str, new_password: str) -> None:
    if not _dev_mode():
        raise UnprocessableError(
            "password recovery is handled by the configured identity provider",
            code="auth_provider_reset",
        )
    record = await user_repo.get_reset_token(conn, security.hash_token(token))
    if record is None:
        raise UnprocessableError(
            "reset token is invalid, expired, or already used", code="invalid_reset_token"
        )
    await user_repo.update_password(conn, record["user_id"], security.hash_password(new_password))
    await user_repo.mark_reset_token_used(conn, record["token_hash"])
    await user_repo.revoke_user_sessions(conn, record["user_id"])


_ = Any
