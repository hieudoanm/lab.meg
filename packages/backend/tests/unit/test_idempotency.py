"""Unit tests: idempotency canonicalisation."""

from __future__ import annotations

from app.services.idempotency import request_hash


def test_request_hash_is_deterministic() -> None:
    payload = {"b": 1, "a": {"x": [1, 2, 3]}}
    assert request_hash(payload) == request_hash(payload)


def test_request_hash_ignores_key_order() -> None:
    assert request_hash({"a": 1, "b": 2}) == request_hash({"b": 2, "a": 1})


def test_request_hash_differs_for_different_payloads() -> None:
    assert request_hash({"a": 1}) != request_hash({"a": 2})
