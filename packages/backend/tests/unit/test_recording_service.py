"""Unit tests for recording metadata and bounded signal services."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

import pytest

from app.core.exceptions import ConflictError, UnprocessableError
from app.schemas.recordings import Channel, Recording, SensorConfiguration
from app.scientific.adapters import BoundedWindow
from app.services import recordings
from app.storage.base import StorageBackend

CONN = cast(Any, None)
NOW = datetime.now(UTC)
RECORDING = Recording(
    id="recording-1",
    dataset_version_id="version-1",
    name="Recording",
    format="fif",
    acquisition_system="squid",
    duration_s=10,
    sampling_frequency_hz=100,
    n_channels=1,
    coordinate_frame="head",
    created_at=NOW,
)
CHANNEL = Channel(
    id="channel-1",
    recording_id="recording-1",
    name="MEG 0001",
    type="mag",
    unit="tesla",
    status="good",
)


@pytest.mark.asyncio
async def test_recording_metadata_lists_and_sensor_geometry(monkeypatch) -> None:
    async def joined(*args, **kwargs):
        return {"project_id": "project-1"}

    async def access(*args, **kwargs):
        return None

    async def get_recording(*args, **kwargs):
        return RECORDING

    async def channels(*args, **kwargs):
        return [CHANNEL], 1, "next", True

    async def events(*args, **kwargs):
        return [], 0, None, False

    config = SensorConfiguration(
        id="sensor-1",
        recording_id="recording-1",
        sensor_type="magnetometer",
        coordinate_frame="head",
        time_varying=False,
        sensors=[],
        created_at=NOW,
    )

    async def sensor(*args, **kwargs):
        return config

    monkeypatch.setattr(recordings, "_recording_project", joined)
    monkeypatch.setattr(recordings, "require_project_access", access)
    monkeypatch.setattr(recordings.recording_repo, "get_recording_by_id", get_recording)
    monkeypatch.setattr(recordings.recording_repo, "list_channels", channels)
    monkeypatch.setattr(recordings.recording_repo, "list_event_sets", events)
    monkeypatch.setattr(recordings.recording_repo, "get_sensor_configuration", sensor)
    assert (
        await recordings.get_recording(
            CONN, recording_id="recording-1", user_id=None, share_token="share"
        )
        == RECORDING
    )
    assert (
        await recordings.list_channels(
            CONN,
            recording_id="recording-1",
            user_id=None,
            share_token=None,
            limit=10,
            cursor=None,
            channel_type=None,
            status=None,
            channel_ids=None,
        )
    ).items == [CHANNEL]
    assert (
        await recordings.list_event_sets(
            CONN,
            recording_id="recording-1",
            user_id=None,
            share_token=None,
            limit=10,
            cursor=None,
            source=None,
        )
    ).total == 0
    assert (
        await recordings.get_sensor_configuration(
            CONN, recording_id="recording-1", user_id=None, share_token=None
        )
        == config
    )


@pytest.mark.asyncio
async def test_recording_signal_window_validates_and_reads(monkeypatch) -> None:
    async def joined(*args, **kwargs):
        return {"project_id": "project-1"}

    async def access(*args, **kwargs):
        return None

    async def get_recording(*args, **kwargs):
        return RECORDING

    async def channels(*args, **kwargs):
        return [CHANNEL], 1, None, False

    monkeypatch.setattr(recordings, "_recording_project", joined)
    monkeypatch.setattr(recordings, "require_project_access", access)
    monkeypatch.setattr(recordings.recording_repo, "get_recording_by_id", get_recording)
    monkeypatch.setattr(recordings.recording_repo, "list_channels", channels)

    async def window(*args, **kwargs):
        return BoundedWindow(
            times_s=[0, 1],
            data=[[1, 2]],
            decimation=1,
            effective_sampling_frequency_hz=100,
            truncated=False,
        )

    monkeypatch.setattr(recordings, "_read_bounded_window", window)
    result = await recordings.signal_window(
        CONN,
        cast(StorageBackend, None),
        recording_id="recording-1",
        user_id=None,
        share_token=None,
        tmin_s=0,
        tmax_s=1,
        resolution="full",
        channel_ids=None,
    )
    assert result.channel_names == ["MEG 0001"]
    with pytest.raises(UnprocessableError, match="less"):
        await recordings.signal_window(
            CONN,
            cast(StorageBackend, None),
            recording_id="recording-1",
            user_id=None,
            share_token=None,
            tmin_s=2,
            tmax_s=1,
            resolution="full",
            channel_ids=None,
        )
    with pytest.raises(UnprocessableError, match="unknown"):
        await recordings.signal_window(
            CONN,
            cast(StorageBackend, None),
            recording_id="recording-1",
            user_id=None,
            share_token=None,
            tmin_s=0,
            tmax_s=1,
            resolution="full",
            channel_ids=["unknown"],
        )


@pytest.mark.asyncio
async def test_recording_missing_geometry_and_assets(monkeypatch) -> None:
    async def joined(*args, **kwargs):
        return {"project_id": "project-1"}

    async def access(*args, **kwargs):
        return None

    async def no_sensor(*args, **kwargs):
        return None

    monkeypatch.setattr(recordings, "_recording_project", joined)
    monkeypatch.setattr(recordings, "require_project_access", access)
    monkeypatch.setattr(recordings.recording_repo, "get_sensor_configuration", no_sensor)
    with pytest.raises(ConflictError, match="geometry"):
        await recordings.get_sensor_configuration(
            CONN, recording_id="recording-1", user_id=None, share_token=None
        )

    async def rows(*args, **kwargs):
        return [
            {
                "object_key": "nested/file.fif",
                "size_bytes": 1,
                "checksum": None,
                "media_type": None,
                "role": "recording",
            }
        ]

    monkeypatch.setattr(recordings.dataset_repo, "list_file_assets", rows)
    assets = await recordings._recording_assets(CONN, "recording-1")
    assert assets[0]["name"] == "file.fif"
