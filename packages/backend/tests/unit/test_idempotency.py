"""Unit tests: idempotency canonicalisation."""

from __future__ import annotations

from typing import Any, cast

import pytest

from app.core.exceptions import BadRequestError, ConflictError
from app.services import idempotency
from app.services.idempotency import request_hash

CONN = cast(Any, None)


def test_request_hash_is_deterministic() -> None:
    payload = {"b": 1, "a": {"x": [1, 2, 3]}}
    assert request_hash(payload) == request_hash(payload)


def test_request_hash_ignores_key_order() -> None:
    assert request_hash({"a": 1, "b": 2}) == request_hash({"b": 2, "a": 1})


def test_request_hash_differs_for_different_payloads() -> None:
    assert request_hash({"a": 1}) != request_hash({"a": 2})


@pytest.mark.parametrize("key", [None, "short", "x" * 129])
def test_require_idempotency_key_rejects_invalid_values(key) -> None:
    with pytest.raises(BadRequestError, match="Idempotency-Key"):
        idempotency.require_idempotency_key(key)


def test_require_idempotency_key_accepts_boundary_lengths() -> None:
    assert idempotency.require_idempotency_key("x" * 8) == "x" * 8
    assert idempotency.require_idempotency_key("x" * 128) == "x" * 128


@pytest.mark.asyncio
async def test_check_replays_matching_response_and_rejects_reuse(monkeypatch) -> None:
    async def get_record(conn, key, user_id):
        return {
            "request_hash": request_hash({"value": 1}),
            "response_status": 201,
            "response_body": {"ok": True},
        }

    monkeypatch.setattr(idempotency.shared_repo, "get_idempotency_record", get_record)
    replay = await idempotency.check(CONN, "key", "user", {"value": 1})
    assert replay is not None and replay.status_code == 201 and replay.body == {"ok": True}
    with pytest.raises(ConflictError, match="different request"):
        await idempotency.check(CONN, "key", "user", {"value": 2})


@pytest.mark.asyncio
async def test_check_returns_none_when_record_is_absent(monkeypatch) -> None:
    async def no_record(*args):
        return None

    monkeypatch.setattr(idempotency.shared_repo, "get_idempotency_record", no_record)
    assert await idempotency.check(CONN, "key", "user", {}) is None


@pytest.mark.asyncio
async def test_record_and_cleanup_delegate_to_repository(monkeypatch) -> None:
    calls = {}

    async def create(*args, **kwargs):
        calls.update(kwargs)

    async def delete(*args):
        return 3

    monkeypatch.setattr(idempotency.shared_repo, "create_idempotency_record", create)
    monkeypatch.setattr(idempotency.shared_repo, "delete_expired_idempotency", delete)
    monkeypatch.setattr(
        idempotency, "get_settings", lambda: type("Settings", (), {"idempotency_ttl_seconds": 60})()
    )
    await idempotency.record(
        CONN,
        key="key",
        user_id="user",
        payload={"x": 1},
        response=idempotency.IdempotentResponse(200, {"ok": 1}),
    )
    assert calls["request_hash"] == request_hash({"x": 1})
    assert calls["response_status"] == 200
    assert await idempotency.cleanup_expired(CONN) == 3
