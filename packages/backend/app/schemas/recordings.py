"""Recording, channel, event, signal, and sensor schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import (
    AcquisitionSystem,
    ChannelStatus,
    ChannelType,
    CoordinateFrame,
    EventSource,
    RecordingFormat,
    Resolution,
    SampleConvention,
    SensorType,
    Unit,
    UtcDatetime,
)


class Recording(BaseModel):
    id: str
    dataset_version_id: str
    name: str
    format: RecordingFormat
    acquisition_system: AcquisitionSystem
    device_serial: str | None = None
    manufacturer: str | None = None
    duration_s: float
    sampling_frequency_hz: float
    n_channels: int = Field(ge=1)
    maxfilter_sss_applied: bool | None = None
    head_position_indicator: dict[str, Any] | None = None
    coordinate_frame: CoordinateFrame
    bad_channel_names: list[str] | None = None
    created_at: UtcDatetime


class Channel(BaseModel):
    id: str
    recording_id: str
    name: str
    group_name: str | None = None
    type: ChannelType
    unit: Unit
    unit_mul: float = 1.0
    status: ChannelStatus
    coil_type: str | None = None
    position_mm: list[float] | None = None
    orientation: list[float] | None = None
    opm_scalar: bool | None = None
    opm_vector: bool | None = None


class ChannelList(BaseModel):
    recording_id: str
    items: list[Channel]
    total: int
    next_cursor: str | None = None
    has_more: bool


class Event(BaseModel):
    sample: int
    time_s: float
    code: str | None = None
    value: int | None = None
    description: str | None = None


class EventSet(BaseModel):
    id: str
    recording_id: str
    name: str
    source: EventSource
    sample_convention: SampleConvention
    event_count: int = Field(ge=0)
    description: str | None = None
    events: list[Event] | None = None
    metadata: dict[str, Any]
    created_at: UtcDatetime


class EventSetList(BaseModel):
    recording_id: str
    items: list[EventSet]
    total: int
    next_cursor: str | None = None
    has_more: bool


class SignalWindow(BaseModel):
    recording_id: str
    tmin_s: float
    tmax_s: float
    sampling_frequency_hz: float
    effective_sampling_frequency_hz: float
    resolution: Resolution
    decimation: int = Field(ge=1)
    channel_names: list[str]
    unit: Unit | None = None
    times_s: list[float]
    data: list[list[float]]
    truncated: bool = False
    max_samples: int = 200000


class Sensor(BaseModel):
    name: str
    type: SensorType
    channel_names: list[str] | None = None
    position_mm: list[float] | None = None
    orientation: list[float] | None = None
    calibration: float | None = None


class SensorConfiguration(BaseModel):
    id: str
    recording_id: str
    sensor_type: SensorType
    coordinate_frame: CoordinateFrame
    length_unit: str = "mm"
    positions_json: dict[str, Any] | None = None
    orientations_json: dict[str, Any] | None = None
    calibrations_json: dict[str, Any] | None = None
    movement_ref: str | None = None
    time_varying: bool
    sensors: list[Sensor]
    created_at: UtcDatetime
