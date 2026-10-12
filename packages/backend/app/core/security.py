"""Identity, sessions, and tokens.

Two credential forms are accepted on protected routes:

- the ``meg-lab_session`` cookie holding an opaque session token whose
  SHA-256 digest is stored in the ``sessions`` table, and
- ``Authorization: Bearer`` carrying either an opaque session token or a
  signed JWT (machine/CLI clients).

Passwords are only stored when ``AUTH_MODE=development`` (local dev
identity, hashed with Argon2id). In production the external OIDC
provider owns the authoritative identity record.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

from app.core.config import get_settings

_ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except VerificationError:
        return False


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hash_token(token: str) -> str:
    return sha256_hex(token.encode())


def new_opaque_token() -> tuple[str, str]:
    """Return ``(token, token_hash)`` for a new opaque credential."""
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)


def encode_access_jwt(user_id: str, ttl_seconds: int | None = None) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(seconds=ttl_seconds or settings.session_ttl_seconds)
    claims: dict[str, Any] = {
        "sub": user_id,
        "iat": now,
        "exp": expires,
        "typ": "access",
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def decode_access_jwt(token: str) -> dict[str, Any] | None:
    settings = get_settings()
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        return None
    if claims.get("typ") != "access" or not claims.get("sub"):
        return None
    return claims


def is_password_reset_token(token: str) -> bool:
    return len(token) >= 32
