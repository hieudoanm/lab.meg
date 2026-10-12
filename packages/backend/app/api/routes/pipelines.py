"""Pipeline routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import (
    get_db,
    get_page_params,
    require_authenticated_user,
)
from app.schemas.common import UserPublic
from app.schemas.pipelines import Pipeline, PipelineCreate, PipelineVersion, PipelineVersionCreate
from app.services import pipelines as pipeline_service

router = APIRouter()


@router.post("/pipelines", status_code=201)
async def create_pipeline(
    request: PipelineCreate,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> Pipeline:
    return await pipeline_service.create_pipeline(conn, user_id=user.id, request=request)


@router.get("/pipelines")
async def list_pipelines(
    project_id: str,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
    page=Depends(get_page_params),
) -> dict:
    items, next_cursor, has_more = await pipeline_service.list_pipelines(
        conn, project_id=project_id, user_id=user.id, limit=page.limit, cursor=page.cursor
    )
    return {
        "items": [item.model_dump(mode="json") for item in items],
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


@router.post("/pipelines/{pipeline_id}/versions", status_code=201)
async def create_pipeline_version(
    pipeline_id: str,
    request: PipelineVersionCreate,
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
) -> PipelineVersion:
    return await pipeline_service.create_pipeline_version(
        conn, pipeline_id=pipeline_id, user_id=user.id, request=request
    )
