"""FastAPI application factory.

The API process never performs scientific computation: request
handlers validate, authorise, and persist; computation is
dispatched to Celery workers through the transactional outbox
(docs §05, non-negotiable rules).
"""

from __future__ import annotations

import uuid
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.deps import get_settings
from app.core.config import Settings
from app.core.exceptions import ApiError, error_payload
from app.core.logging import configure_logging
from app.db.migrate import run_migrations
from app.db.pool import close_pool, get_pool, init_pool
from app.storage.factory import create_storage


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assign every request a trace id propagated to logs and errors."""

    async def dispatch(self, request: Request, call_next: Any) -> Any:
        trace_id = f"trace_{uuid.uuid4().hex[:8]}"
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = trace_id
        return response


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:
    settings: Settings = get_settings()
    configure_logging()
    await init_pool(settings)
    if settings.auto_migrate:
        pool = get_pool()
        async with pool.connection() as conn:
            await run_migrations(conn)
    try:
        storage = create_storage(settings)
        await storage.ensure_bucket()
    except Exception:  # noqa: BLE001 - storage may be temporarily unavailable
        pass
    yield
    await close_pool()


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is not None:
        import app.core.config as config_module

        config_module._settings = settings
    app = FastAPI(
        title="MEG Lab API",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id"],
    )

    @app.exception_handler(ApiError)
    async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
        trace_id = getattr(request.state, "trace_id", "trace_unknown")
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(exc, trace_id),
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        trace_id = getattr(request.state, "trace_id", "trace_unknown")
        details = [
            {"loc": list(error.get("loc", [])), "msg": error.get("msg", "")}
            for error in exc.errors()
        ]
        from app.core.exceptions import UnprocessableError

        error = UnprocessableError("request validation failed", code="validation_failed")
        error.details = details
        return JSONResponse(
            status_code=422,
            content=error_payload(error, trace_id),
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        trace_id = getattr(request.state, "trace_id", "trace_unknown")
        from app.core.exceptions import InternalError

        error = InternalError("an unexpected error occurred")
        return JSONResponse(
            status_code=500,
            content=error_payload(error, trace_id),
        )

    from app.api.routes import (
        auth,
        datasets,
        internal,
        pipelines,
        projects,
        recordings,
        runs,
        usage,
    )

    api_prefix = get_settings().api_prefix
    app.include_router(auth.router, prefix=api_prefix)
    app.include_router(internal.router)
    for module in (datasets, pipelines, projects, recordings, runs, usage):
        app.include_router(module.router, prefix=api_prefix)
    return app


app = create_app()
