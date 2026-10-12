"""Focused tests for configuration, identifiers, and API error envelopes."""

from __future__ import annotations

import uuid

import pytest

from app.core.config import Settings, get_settings, reset_settings_cache
from app.core.exceptions import (
    ApiError,
    BadRequestError,
    UnauthorizedError,
    error_payload,
)
from app.core.ids import new_run_id, new_uuid


def test_error_payload_includes_optional_details_only_when_present() -> None:
    error = BadRequestError("invalid input", code="invalid_input", details=[{"field": "name"}])
    assert error_payload(error, "trace-1") == {
        "error": {
            "code": "invalid_input",
            "message": "invalid input",
            "trace_id": "trace-1",
            "details": [{"field": "name"}],
        }
    }
    assert "details" not in error_payload(BadRequestError("bad"), "trace-2")["error"]


def test_api_error_preserves_headers_and_subclass_defaults() -> None:
    error = UnauthorizedError()
    assert error.status_code == 401
    assert error.code == "unauthorized"
    assert error.headers == {"WWW-Authenticate": "Bearer"}
    assert str(ApiError("boom")) == "boom"


def test_identifier_helpers_use_uuid_and_canonical_run_format(monkeypatch) -> None:
    expected = uuid.UUID("12345678-1234-5678-1234-567812345678")
    monkeypatch.setattr("app.core.ids.uuid.uuid4", lambda: expected)
    monkeypatch.setattr("app.core.ids.secrets.token_hex", lambda n: "deadbeef")
    assert new_uuid() == expected
    assert new_run_id() == "run_deadbeef"


def test_settings_production_hardening_rejects_insecure_values() -> None:
    with pytest.raises(RuntimeError, match="MEG_AUTH_MODE"):
        Settings(app_env="production").require_production_hardening()
    with pytest.raises(RuntimeError, match="OIDC provider"):
        Settings(app_env="production", auth_mode="oidc").require_production_hardening()
    with pytest.raises(RuntimeError, match="MEG_SESSION_SECRET"):
        Settings(
            app_env="production",
            auth_mode="oidc",
            auth_provider_issuer="https://issuer.example",
            auth_provider_client_id="client",
        ).require_production_hardening()


def test_settings_cookie_security_and_cached_settings(monkeypatch) -> None:
    assert Settings(app_env="production").effective_cookie_secure is True
    assert Settings(auth_cookie_secure=False).effective_cookie_secure is False
    reset_settings_cache()
    first = get_settings()
    second = get_settings()
    assert first is second
    reset_settings_cache()
