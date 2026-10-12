"""Dataset routes: upload sessions and idempotent finalisation."""

from __future__ import annotations

from fastapi import APIRouter, Depends
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
from app.schemas.datasets import Dataset, DatasetCompleteRequest, DatasetCreate, DatasetList
from app.services import datasets as dataset_service

router = APIRouter()


@router.get("/datasets")
async def list_datasets(
    conn=Depends(get_db),
    user: UserPublic = Depends(require_authenticated_user),
    page=Depends(get_page_params),
) -> DatasetList:
    items, next_cursor, has_more = await dataset_service.list_datasets_for_user(
        conn, user_id=user.id, limit=page.limit, cursor=page.cursor
    )
    return DatasetList(items=items, next_cursor=next_cursor, has_more=has_more)


@router.post("/projects/{project_id}/datasets", status_code=201)
async def create_dataset(
    project_id: str,
    request: DatasetCreate,
    idempotency_key: str | None = Depends(get_idempotency_key),
    conn=Depends(get_db),
    storage=Depends(get_storage),
    user: UserPublic = Depends(require_authenticated_user),
) -> JSONResponse:
    response = await dataset_service.create_dataset(
        conn,
        storage,
        project_id=project_id,
        user_id=user.id,
        request=request,
        idempotency_key=idempotency_key,
    )
    return JSONResponse(status_code=response.status_code, content=response.body)


@router.post("/datasets/{dataset_id}/complete", status_code=200)
async def complete_dataset(
    dataset_id: str,
    request: DatasetCompleteRequest,
    idempotency_key: str | None = Depends(get_idempotency_key),
    conn=Depends(get_db),
    storage=Depends(get_storage),
    user: UserPublic = Depends(require_authenticated_user),
) -> JSONResponse:
    response = await dataset_service.complete_dataset(
        conn,
        storage,
        dataset_id=dataset_id,
        user_id=user.id,
        request=request,
        idempotency_key=idempotency_key,
    )
    return JSONResponse(status_code=response.status_code, content=response.body)


@router.get("/datasets/{dataset_id}")
async def get_dataset(
    dataset_id: str,
    conn=Depends(get_db),
    user: UserPublic | None = Depends(get_optional_user),
    share_token: str | None = Depends(get_share_token),
) -> Dataset:
    return await dataset_service.get_dataset(
        conn, dataset_id=dataset_id, user_id=user.id if user else None, share_token=share_token
    )
