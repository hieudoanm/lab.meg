"""Cursor pagination.

Cursors are opaque base64url-encoded sort positions over
``(created_at DESC, id ASC)``. Scoping is always applied in the SQL WHERE
clause before pagination, so a tampered cursor can never widen access.
"""

from __future__ import annotations

import base64
import json
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class PageParams(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    cursor: str | None = None

    @field_validator("limit")
    @classmethod
    def clamp_limit(cls, v: int, info: object) -> int:
        settings_limit = getattr(info, "_max", None)  # pragma: no cover
        return v if settings_limit is None else min(v, settings_limit)


class CursorPosition(BaseModel):
    created_at: datetime
    id: Any


def encode_cursor(position: CursorPosition) -> str:
    raw = json.dumps(
        {"created_at": position.created_at.isoformat(), "id": str(position.id)},
        separators=(",", ":"),
    ).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def decode_cursor(cursor: str) -> CursorPosition | None:
    try:
        padding = "=" * (-len(cursor) % 4)
        raw = base64.urlsafe_b64decode(cursor + padding)
        payload = json.loads(raw)
        return CursorPosition(
            created_at=datetime.fromisoformat(payload["created_at"]),
            id=payload["id"],
        )
    except ValueError, KeyError, TypeError, json.JSONDecodeError:
        return None


class Page(BaseModel):
    """Envelope for every paginated list response."""

    items: list[Any]
    next_cursor: str | None
    has_more: bool
