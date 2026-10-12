"""Unit tests: identity, sessions, and tokens (FR-001)."""

from __future__ import annotations

from app.core import security


def test_password_hash_round_trip() -> None:
    password_hash = security.hash_password("correct horse battery staple")
    assert security.verify_password("correct horse battery staple", password_hash)
    assert not security.verify_password("wrong password", password_hash)


def test_token_hash_is_stable_and_non_reversible() -> None:
    token = "a" * 43
    hashed = security.hash_token(token)
    assert hashed == security.hash_token(token)
    assert token not in hashed
    assert len(hashed) == 64


def test_opaque_tokens_are_unique() -> None:
    token_a, hash_a = security.new_opaque_token()
    token_b, hash_b = security.new_opaque_token()
    assert token_a != token_b
    assert hash_a != hash_b


def test_jwt_round_trip() -> None:
    token = security.encode_access_jwt("user-123")
    claims = security.decode_access_jwt(token)
    assert claims is not None
    assert claims["sub"] == "user-123"


def test_jwt_rejects_garbage() -> None:
    assert security.decode_access_jwt("not.a.jwt") is None
