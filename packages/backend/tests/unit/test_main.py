"""Tests for application construction, middleware, and exception handlers."""

from __future__ import annotations

from typing import Any, cast

import pytest
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from starlette.responses import Response

from app import main
from app.core.config import get_settings
from app.core.exceptions import ApiError, NotFoundError


def request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "query_string": b"",
            "headers": [],
        }
    )


def test_create_app_registers_routes_and_settings() -> None:
    app = main.create_app(get_settings())
    assert len(app.routes) > 5
    assert any(m.cls is main.RequestContextMiddleware for m in app.user_middleware)


@pytest.mark.asyncio
async def test_request_context_middleware_adds_trace_header() -> None:
    middleware = main.RequestContextMiddleware(cast(Any, lambda *args: None))

    async def call_next(request: Request) -> Response:
        assert request.state.trace_id.startswith("trace_")
        return Response("ok")

    response = await cast(Any, middleware.dispatch)(request(), call_next)
    assert response.headers["X-Request-Id"].startswith("trace_")


@pytest.mark.asyncio
async def test_application_exception_handlers_return_api_payloads() -> None:
    app = main.create_app(get_settings())
    api_handler = app.exception_handlers[ApiError]
    response = await cast(Any, api_handler)(request(), NotFoundError("missing"))
    assert response.status_code == 404
    assert response.body

    validation_handler = app.exception_handlers[RequestValidationError]
    validation = cast(
        Any,
        RequestValidationError(
            [{"type": "missing", "loc": ("query", "name"), "msg": "Field required"}]
        ),
    )
    response = await cast(Any, validation_handler)(request(), validation)
    assert response.status_code == 422

    generic_handler = app.exception_handlers[Exception]
    response = await cast(Any, generic_handler)(request(), RuntimeError("boom"))
    assert response.status_code == 500
