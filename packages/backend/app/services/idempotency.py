"""Idempotency for state-changing requests.

Identical retries replay the stored response verbatim; the same
key with a different request body is a 409 conflict (API spec §11, §14).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import BadRequestError, ConflictError
from app.db.pool import Connection
from app.repositories import shared as shared_repo


@dataclass
class IdempotentResponse:
    status_code: int
    body: dict[str, Any]


def require_idempotency_key(key: str | None) -> str:
    """Validate the ``Idempotency-Key`` header required by mutating routes."""
    if key is None or not (8 <= len(key) <= 128):
        raise BadRequestError(
            "Idempotency-Key header is required and must be 8-128 characters",
            code="idempotency_key_required",
        )
    return key


def request_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return f"sha256:{hashlib.sha256(canonical.encode()).hexdigest()}"


async def check(
    conn: Connection, key: str, user_id: str, payload: dict[str, Any]
) -> IdempotentResponse | None:
    """Return a stored response to replay, or None on a fresh request."""
    record = await shared_repo.get_idempotency_record(conn, key, user_id)
    if record is None:
        return None
    if record["request_hash"] != request_hash(payload):
        raise ConflictError(
            "idempotency key was used with a different request",
            code="idempotency_key_reuse",
        )
    return IdempotentResponse(
        status_code=int(record["response_status"]),
        body=record["response_body"] or {},
    )


async def record(
    conn: Connection,
    *,
    key: str,
    user_id: str,
    payload: dict[str, Any],
    response: IdempotentResponse,
) -> None:
    expires_at = datetime.now(UTC) + timedelta(seconds=get_settings().idempotency_ttl_seconds)
    await shared_repo.create_idempotency_record(
        conn,
        key=key,
        user_id=user_id,
        request_hash=request_hash(payload),
        response_status=response.status_code,
        response_body=response.body,
        expires_at=expires_at,
    )


async def cleanup_expired(conn: Connection) -> int:
    return await shared_repo.delete_expired_idempotency(conn)
