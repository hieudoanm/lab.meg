"""Unit tests: cursor pagination."""

from __future__ import annotations

from datetime import UTC, datetime

from app.core.pagination import (
    CursorPosition,
    decode_cursor,
    encode_cursor,
)


def test_cursor_round_trip() -> None:
    position = CursorPosition(
        created_at=datetime(2026, 5, 1, 9, 12, tzinfo=UTC),
        id="8c1d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f",
    )
    cursor = encode_cursor(position)
    decoded = decode_cursor(cursor)
    assert decoded is not None
    assert decoded.created_at == position.created_at
    assert decoded.id == position.id


def test_cursor_is_opaque() -> None:
    position = CursorPosition(
        created_at=datetime(2026, 5, 1, tzinfo=UTC),
        id="abc",
    )
    cursor = encode_cursor(position)
    assert "abc" not in cursor


def test_decode_invalid_cursor_returns_none() -> None:
    assert decode_cursor("not-a-cursor!!!") is None
    assert decode_cursor("") is None
