"""Recording inspection: metadata, channels, events, bounded signals, sensors."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import Any, cast

from app.core.config import get_settings
from app.core.exceptions import UnprocessableError
from app.db.pool import Connection
from app.repositories import datasets as dataset_repo
from app.repositories import recordings as recording_repo
from app.schemas.common import Resolution
from app.schemas.recordings import (
    ChannelList,
    EventSetList,
    Recording,
    SensorConfiguration,
    SignalWindow,
)
from app.scientific.adapters import (
    compute_decimation,
    open_adapter,
)
from app.services.tenancy import require_project_access
from app.storage.base import StorageBackend


async def _recording_project(conn: Connection, recording_id: str) -> dict[str, Any]:
    joined = await recording_repo.get_recording_with_project(conn, recording_id)
    if joined is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("recording not found")
    return joined


async def get_recording(
    conn: Connection,
    *,
    recording_id: str,
    user_id: str,
    share_token: str | None,
) -> Recording:
    joined = await _recording_project(conn, recording_id)
    await require_project_access(
        conn=conn,
        project_id=joined["project_id"],
        user_id=user_id,
        share_token=share_token,
    )
    recording = await recording_repo.get_recording_by_id(conn, recording_id)
    if recording is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("recording not found")
    return recording


async def list_channels(
    conn: Connection,
    *,
    recording_id: str,
    user_id: str,
    share_token: str | None,
    limit: int,
    cursor: str | None,
    channel_type: str | None,
    status: str | None,
    channel_ids: list[str] | None,
) -> ChannelList:
    joined = await _recording_project(conn, recording_id)
    await require_project_access(
        conn=conn,
        project_id=joined["project_id"],
        user_id=user_id,
        share_token=share_token,
    )
    items, total, next_cursor, has_more = await recording_repo.list_channels(
        conn,
        recording_id=recording_id,
        limit=limit,
        cursor=cursor,
        channel_type=channel_type,
        status=status,
        channel_ids=channel_ids,
    )
    return ChannelList(
        recording_id=recording_id,
        items=items,
        total=total,
        next_cursor=next_cursor,
        has_more=has_more,
    )


async def list_event_sets(
    conn: Connection,
    *,
    recording_id: str,
    user_id: str,
    share_token: str | None,
    limit: int,
    cursor: str | None,
    source: str | None,
) -> EventSetList:
    joined = await _recording_project(conn, recording_id)
    await require_project_access(
        conn=conn,
        project_id=joined["project_id"],
        user_id=user_id,
        share_token=share_token,
    )
    items, total, next_cursor, has_more = await recording_repo.list_event_sets(
        conn,
        recording_id=recording_id,
        limit=limit,
        cursor=cursor,
        source=source,
    )
    return EventSetList(
        recording_id=recording_id,
        items=items,
        total=total,
        next_cursor=next_cursor,
        has_more=has_more,
    )


async def get_sensor_configuration(
    conn: Connection,
    *,
    recording_id: str,
    user_id: str,
    share_token: str | None,
) -> SensorConfiguration:
    joined = await _recording_project(conn, recording_id)
    await require_project_access(
        conn=conn,
        project_id=joined["project_id"],
        user_id=user_id,
        share_token=share_token,
    )
    config = await recording_repo.get_sensor_configuration(conn, recording_id)
    if config is None:
        # Geometry is never inferred when absent; the API contract
        # uses 409 to signal "no sensor geometry for this recording".
        from app.core.exceptions import ConflictError

        raise ConflictError(
            "sensor geometry is not available for this recording",
            code="sensor_geometry_unavailable",
        )
    return config


async def signal_window(
    conn: Connection,
    storage: StorageBackend,
    *,
    recording_id: str,
    user_id: str,
    share_token: str | None,
    tmin_s: float,
    tmax_s: float,
    resolution: str,
    channel_ids: list[str] | None,
) -> SignalWindow:
    settings = get_settings()
    joined = await _recording_project(conn, recording_id)
    await require_project_access(
        conn=conn,
        project_id=joined["project_id"],
        user_id=user_id,
        share_token=share_token,
    )
    recording = await recording_repo.get_recording_by_id(conn, recording_id)
    if recording is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("recording not found")

    if not (tmin_s < tmax_s):
        raise UnprocessableError("tmin_s must be less than tmax_s", code="signal_window_invalid")
    if tmin_s < 0 or tmax_s > recording.duration_s:
        raise UnprocessableError(
            f"window [{tmin_s}, {tmax_s}) is outside the recording time base "
            f"[0, {recording.duration_s}]",
            code="signal_window_out_of_range",
        )
    if tmax_s - tmin_s > settings.max_signal_window_s:
        raise UnprocessableError(
            f"window duration exceeds the {settings.max_signal_window_s}s server limit",
            code="signal_window_too_large",
        )

    all_channels = await recording_repo.list_channels(
        conn,
        recording_id=recording_id,
        limit=settings.max_channel_count + 1,
        cursor=None,
        channel_type=None,
        status=None,
        channel_ids=None,
    )
    available_names = [channel.name for channel in all_channels[0]]
    if channel_ids:
        unknown = [name for name in channel_ids if name not in available_names]
        if unknown:
            raise UnprocessableError(
                f"unknown channels: {', '.join(unknown[:5])}",
                code="unknown_channel",
            )
        selected = channel_ids
    else:
        selected = available_names

    window = await _read_bounded_window(
        conn,
        storage,
        recording=recording,
        selected=selected,
        tmin_s=tmin_s,
        tmax_s=tmax_s,
        resolution=resolution,
        max_samples=settings.max_signal_samples,
    )
    first_unit = next(
        (channel.unit for channel in all_channels[0] if channel.name in selected),
        None,
    )
    return SignalWindow(
        recording_id=recording_id,
        tmin_s=tmin_s,
        tmax_s=tmax_s,
        sampling_frequency_hz=recording.sampling_frequency_hz,
        effective_sampling_frequency_hz=window.effective_sampling_frequency_hz,
        resolution=cast(Resolution, resolution),
        decimation=window.decimation,
        channel_names=selected,
        unit=first_unit,
        times_s=window.times_s,
        data=window.data,
        truncated=window.truncated,
        max_samples=settings.max_signal_samples,
    )


async def _read_bounded_window(
    conn: Connection,
    storage: StorageBackend,
    *,
    recording: Recording,
    selected: list[str],
    tmin_s: float,
    tmax_s: float,
    resolution: str,
    max_samples: int,
) -> Any:
    """Download declared assets, open the format adapter, read one bounded window."""
    assets = await _recording_assets(conn, recording.id)
    workdir = Path(tempfile.mkdtemp(prefix="meglab-signals-"))
    try:
        for asset in assets:
            object_key = asset["object_key"]
            payload = await storage.get_object(object_key)
            target = workdir / asset["name"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
        adapter = open_adapter(
            recording.format, workdir, recording.acquisition_system, storage, assets
        )
        try:
            decimation, _truncated = compute_decimation(
                recording.sampling_frequency_hz,
                tmax_s - tmin_s,
                resolution,
                max_samples,
            )
            return adapter.read_window(tmin_s, tmax_s, selected, decimation, max_samples)
        finally:
            adapter.close()
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


async def _recording_assets(conn: Connection, recording_id: str) -> list[dict[str, Any]]:
    rows = await dataset_repo.list_file_assets(conn, recording_id)
    return [
        {
            "name": Path(row["object_key"]).name,
            "object_key": row["object_key"],
            "size_bytes": row["size_bytes"],
            "checksum_sha256": row["checksum"],
            "media_type": row["media_type"],
            "role": row["role"],
        }
        for row in rows
    ]
