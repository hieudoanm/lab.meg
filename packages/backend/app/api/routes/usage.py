"""Usage, quota, and health routes."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from starlette.responses import JSONResponse, Response

from app.api.deps import get_db, get_page_params, require_authenticated_user
from app.db.pool import get_pool
from app.schemas.common import HealthLive, HealthReady, Page, UserPublic
from app.services import usage as usage_service

router = APIRouter()


@router.get("/usage")
async def list_usage(
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
    page=Depends(get_page_params),
) -> Page:
    return await usage_service.list_usage(
        conn, user_id=user.id, limit=page.limit, cursor=page.cursor
    )


@router.get("/quotas")
async def quotas(
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> dict[str, float]:
    return await usage_service.quotas(conn, user_id=user.id)


@router.get("/health/live")
async def health_live() -> HealthLive:
    return HealthLive(status="ok")


@router.get("/health/ready")
async def health_ready() -> Response:
    dependencies: dict[str, str] = {}
    try:
        pool = get_pool()
        async with pool.connection() as conn:
            await conn.execute("SELECT 1")
        dependencies["postgres"] = "ok"
    except Exception:  # noqa: BLE001 - readiness must never raise
        dependencies["postgres"] = "unavailable"

    from app.core.config import get_settings as _settings
    from app.storage.factory import create_storage

    try:
        storage = create_storage(_settings())
        await storage.ensure_bucket()
        dependencies["storage"] = "ok"
    except Exception:  # noqa: BLE001
        dependencies["storage"] = "unavailable"

    try:
        import redis.asyncio as aioredis

        from app.core.config import get_settings as _s

        client = aioredis.from_url(_s().redis_url)
        await client.ping()
        await client.aclose()
        dependencies["redis"] = "ok"
    except Exception:  # noqa: BLE001
        dependencies["redis"] = "unavailable"

    ready = all(value == "ok" for value in dependencies.values())
    status: Literal["ok", "degraded"] = "ok" if ready else "degraded"
    response = HealthReady(status=status, dependencies=dependencies)
    status_code = 200 if ready else 503
    return JSONResponse(status_code=status_code, content=response.model_dump(mode="json"))


@router.get("/healthz")
async def healthz() -> HealthLive:
    return await health_live()


@router.get("/readyz")
async def readyz() -> Response:
    return await health_ready()
