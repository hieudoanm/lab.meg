"""Recording inspection routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from starlette.requests import Request

from app.api.deps import (
    get_db,
    get_optional_user,
    get_page_params,
    get_share_token,
    get_storage,
)
from app.schemas.common import (
    UserPublic,
)
from app.schemas.recordings import (
    ChannelList,
    EventSetList,
    Recording,
    SensorConfiguration,
    SignalWindow,
)
from app.services import recordings as recording_service

router = APIRouter()


@router.get("/recordings/{recording_id}")
async def get_recording(
    recording_id: str,
    conn=Depends(get_db),
    user: UserPublic | None = Depends(get_optional_user),
    share_token: str | None = Depends(get_share_token),
) -> Recording:
    return await recording_service.get_recording(
        conn, recording_id=recording_id, user_id=user.id if user else None, share_token=share_token
    )


@router.get("/recordings/{recording_id}/channels")
async def list_channels(
    recording_id: str,
    request: Request,
    conn=Depends(get_db),
    user: UserPublic | None = Depends(get_optional_user),
    share_token: str | None = Depends(get_share_token),
    page=Depends(get_page_params),
) -> ChannelList:
    return await recording_service.list_channels(
        conn,
        recording_id=recording_id,
        user_id=user.id if user else None,
        share_token=share_token,
        limit=page.limit,
        cursor=page.cursor,
        channel_type=request.query_params.get("type"),
        status=request.query_params.get("status"),
        channel_ids=_csv_list(request.query_params.get("channel_ids")),
    )


@router.get("/recordings/{recording_id}/events")
async def list_event_sets(
    recording_id: str,
    request: Request,
    conn=Depends(get_db),
    user: UserPublic | None = Depends(get_optional_user),
    share_token: str | None = Depends(get_share_token),
    page=Depends(get_page_params),
) -> EventSetList:
    return await recording_service.list_event_sets(
        conn,
        recording_id=recording_id,
        user_id=user.id if user else None,
        share_token=share_token,
        limit=page.limit,
        cursor=page.cursor,
        source=request.query_params.get("source"),
    )


@router.get("/recordings/{recording_id}/signals")
async def signal_window(
    recording_id: str,
    request: Request,
    conn=Depends(get_db),
    storage=Depends(get_storage),
    user: UserPublic | None = Depends(get_optional_user),
    share_token: str | None = Depends(get_share_token),
) -> SignalWindow:
    tmin_s = request.query_params.get("tmin_s")
    tmax_s = request.query_params.get("tmax_s")
    if tmin_s is None or tmax_s is None:
        from app.core.exceptions import BadRequestError

        raise BadRequestError("tmin_s and tmax_s are required", code="signal_params_missing")
    resolution = request.query_params.get("resolution", "medium")
    return await recording_service.signal_window(
        conn,
        storage,
        recording_id=recording_id,
        user_id=user.id if user else None,
        share_token=share_token,
        tmin_s=float(tmin_s),
        tmax_s=float(tmax_s),
        resolution=resolution,
        channel_ids=_csv_list(request.query_params.get("channel_ids")),
    )


@router.get("/recordings/{recording_id}/sensors")
async def get_sensors(
    recording_id: str,
    conn=Depends(get_db),
    user: UserPublic | None = Depends(get_optional_user),
    share_token: str | None = Depends(get_share_token),
) -> SensorConfiguration:
    return await recording_service.get_sensor_configuration(
        conn, recording_id=recording_id, user_id=user.id if user else None, share_token=share_token
    )


def _csv_list(value: str | None) -> list[str] | None:
    if value is None or value == "":
        return None
    return [item.strip() for item in value.split(",") if item.strip()]
