"""Run routes: submission, status, logs, artifacts."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from starlette.responses import JSONResponse

from app.api.deps import (
    get_db,
    get_idempotency_key,
    get_optional_user,
    get_page_params,
    get_share_token,
    get_storage,
    require_authenticated_user,
)
from app.schemas.common import UserPublic
from app.schemas.runs import Run, RunCreate, RunList
from app.services import runs as run_service

router = APIRouter()


@router.post("/runs", status_code=202)
async def submit_run(
    request: RunCreate,
    idempotency_key: str | None = Depends(get_idempotency_key),
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> JSONResponse:
    response = await run_service.submit_run(
        conn, user_id=user.id, request=request, idempotency_key=idempotency_key
    )
    return JSONResponse(status_code=response.status_code, content=response.body)


@router.get("/runs")
async def list_runs(
    request: Request,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
    page=Depends(get_page_params),
) -> RunList:
    return await run_service.list_runs(
        conn,
        user_id=user.id,
        limit=page.limit,
        cursor=page.cursor,
        project_id=request.query_params.get("project_id"),
        status=request.query_params.get("status"),
    )


@router.get("/runs/{run_id}")
async def get_run(
    run_id: str,
    conn=Depends(get_db),
    user: UserPublic | None = Depends(get_optional_user),
    share_token: str | None = Depends(get_share_token),
) -> Run:
    return await run_service.get_run(
        conn, run_id=run_id, user_id=user.id if user else None, share_token=share_token
    )


@router.get("/runs/{run_id}/logs")
async def get_run_logs(
    run_id: str,
    request: Request,
    conn=Depends(get_db),
    user: UserPublic | None = Depends(get_optional_user),
    share_token: str | None = Depends(get_share_token),
    page=Depends(get_page_params),
) -> dict:
    logs = await run_service.get_run_logs(
        conn,
        run_id=run_id,
        user_id=user.id if user else None,
        share_token=share_token,
        limit=page.limit,
        cursor=page.cursor,
        level=request.query_params.get("level"),
    )
    return logs.model_dump(mode="json")


@router.get("/runs/{run_id}/artifacts")
async def list_run_artifacts(
    run_id: str,
    request: Request,
    conn=Depends(get_db),
    storage=Depends(get_storage),
    user: UserPublic | None = Depends(get_optional_user),
    share_token: str | None = Depends(get_share_token),
    page=Depends(get_page_params),
) -> dict:
    artifacts = await run_service.list_run_artifacts(
        conn,
        storage,
        run_id=run_id,
        user_id=user.id if user else None,
        share_token=share_token,
        limit=page.limit,
        cursor=page.cursor,
        kind=request.query_params.get("kind"),
    )
    return artifacts.model_dump(mode="json")
