"""Authentication routes."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Request, Response

from app.api.deps import (
    get_client_ip,
    get_db,
    get_settings,
    get_user_agent,
    require_authenticated_user,
)
from app.core import security
from app.core.exceptions import UnprocessableError
from app.core.security import hash_token, new_opaque_token
from app.repositories import audit as audit_repo
from app.repositories import users as user_repo
from app.schemas.auth import (
    DevelopmentTokenRequest,
    DevelopmentTokenResponse,
    LoginRequest,
    LoginResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
)
from app.schemas.common import UserPublic
from app.services import auth as auth_service

router = APIRouter()


def _set_session_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=settings.auth_cookie_name,
        value=token,
        httponly=True,
        samesite=settings.auth_cookie_samesite,
        secure=settings.effective_cookie_secure,
        domain=settings.auth_cookie_domain,
        max_age=settings.session_ttl_seconds,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.auth_cookie_name,
        path="/",
        domain=settings.auth_cookie_domain,
    )


def _expires_at() -> str:
    return (datetime.now(UTC) + timedelta(seconds=get_settings().session_ttl_seconds)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )


@router.post("/auth/login")
async def login(
    request: LoginRequest,
    response: Response,
    http_request: Request,
    conn=Depends(get_db),
    user_agent=Depends(get_user_agent),
    ip_address=Depends(get_client_ip),
) -> LoginResponse:
    user, token = await auth_service.login(
        conn, request, user_agent=user_agent, ip_address=ip_address
    )
    _set_session_cookie(response, token)
    return LoginResponse(
        access_token=token,
        token_type="Bearer",
        expires_at=_expires_at(),
        user=user,
    )


@router.post("/auth/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    conn=Depends(get_db),
) -> Response:
    token = request.cookies.get(get_settings().auth_cookie_name)
    await auth_service.logout(conn, hash_token(token) if token else None)
    _clear_session_cookie(response)
    return response


@router.post("/auth/register", status_code=201)
async def register(
    request: RegisterRequest,
    response: Response,
    http_request: Request,
    conn=Depends(get_db),
    user_agent=Depends(get_user_agent),
    ip_address=Depends(get_client_ip),
) -> LoginResponse:
    user, token = await auth_service.register(
        conn, request, user_agent=user_agent, ip_address=ip_address
    )
    _set_session_cookie(response, token)
    return LoginResponse(
        access_token=token,
        token_type="Bearer",
        expires_at=_expires_at(),
        user=user,
    )


@router.post("/auth/password-reset")
async def password_reset(
    request: PasswordResetRequest,
    conn=Depends(get_db),
) -> dict[str, str]:
    await auth_service.request_password_reset(conn, request.email)
    return {"status": "ok"}


@router.post("/auth/password-reset/confirm")
async def password_reset_confirm(
    request: PasswordResetConfirm,
    conn=Depends(get_db),
) -> dict[str, str]:
    await auth_service.confirm_password_reset(conn, request.token, request.new_password)
    return {"status": "ok"}


@router.get("/me")
async def me(user: UserPublic = Depends(require_authenticated_user)) -> UserPublic:
    return user


@router.post("/auth/token")
async def development_token(
    request: DevelopmentTokenRequest,
    response: Response,
    http_request: Request,
    conn=Depends(get_db),
    user_agent=Depends(get_user_agent),
    ip_address=Depends(get_client_ip),
) -> DevelopmentTokenResponse:
    """Development-only endpoint to mint a session token for a user.

    Creates the user if they don't exist, or logs them in if they do.
    Only available in AUTH_MODE=development.
    """
    if not get_settings().auth_mode == "development":
        raise UnprocessableError(
            "development token endpoint is only available in development mode",
            code="development_only",
        )

    # Try to get existing user
    user = await user_repo.get_user_by_email(conn, request.email)
    if user is None:
        # Create new user
        user = await user_repo.create_user(
            conn, email=request.email, display_name=request.display_name or request.email
        )
        # Create a credential with a default password for development login
        await user_repo.create_credential(
            conn,
            user_id=user.id,
            email=request.email,
            password_hash=security.hash_password("demopassword123"),
        )
    else:
        # Update display name if provided
        if request.display_name and user.display_name != request.display_name:
            await user_repo.update_user(conn, user.id, display_name=request.display_name)
            user = await user_repo.get_user_by_id(conn, user.id)

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
        conn, actor_id=user.id, action="user.dev_token", resource_type="user", resource_id=user.id
    )

    return DevelopmentTokenResponse(
        access_token=token,
        expires_at=expires_at.strftime("%Y-%m-%dT%H:%M:%SZ"),
        user=UserPublic.model_validate(user),
    )
