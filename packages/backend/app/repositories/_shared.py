"""Shared repository helpers."""

from __future__ import annotations

import uuid
from collections.abc import Mapping, Sequence
from typing import Any, TypeVar

from psycopg.types.json import Jsonb
from pydantic import BaseModel

from app.core.pagination import CursorPosition, decode_cursor, encode_cursor

T = TypeVar("T", bound=BaseModel)


def to_jsonb(value: Any) -> Jsonb | None:
    """Adapt a Python mapping/sequence for a ``jsonb`` column.

    Psycopg does not adapt ``dict``/``list`` automatically, so every
    ``jsonb`` parameter must be wrapped. ``None`` is passed through so
    nullable columns keep their semantics.
    """
    if value is None:
        return None
    return Jsonb(value)


def clean(row: Mapping[str, Any]) -> dict[str, Any]:
    """Normalise a DB row for Pydantic validation (UUID -> str)."""
    return {
        key: (str(value) if isinstance(value, uuid.UUID) else value) for key, value in row.items()
    }


def to_model(model_cls: type[T], row: Mapping[str, Any] | None) -> T | None:
    if row is None:
        return None
    return model_cls.model_validate(clean(row))


def to_models(model_cls: type[T], rows: Sequence[Mapping[str, Any]]) -> list[T]:
    return [model_cls.model_validate(clean(row)) for row in rows]


def cursor_where(cursor: str | None, alias: str = "") -> tuple[str, list[Any]]:
    """SQL fragment for keyset pagination over (created_at DESC, id ASC)."""
    prefix = f"{alias}." if alias else ""
    if cursor is None:
        return "", []
    position = decode_cursor(cursor)
    if position is None:
        return "", []
    return (
        f"(({prefix}created_at < %s) OR ({prefix}created_at = %s AND {prefix}id > %s))",
        [position.created_at, position.created_at, position.id],
    )


def next_cursor(item: BaseModel) -> str:
    return encode_cursor(
        CursorPosition(created_at=item.model_dump()["created_at"], id=item.model_dump()["id"])
    )


def paginate(items: list[T], limit: int) -> tuple[list[T], str | None, bool]:
    """Split a limit+1 result list into a page."""
    has_more = len(items) > limit
    page = items[:limit]
    cursor = next_cursor(page[-1]) if has_more and page else None
    return page, cursor, has_more


def coerce_uuid(value: str | uuid.UUID) -> uuid.UUID:
    return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
