"""Shared schema primitives and canonical enums (OpenAPI §components)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Generic, Literal, TypeVar

from pydantic import BaseModel, PlainSerializer

# All API timestamps are UTC and serialise with a trailing "Z" (ISO 8601).
UtcDatetime = Annotated[
    datetime,
    PlainSerializer(
        lambda v: v.astimezone(UTC).isoformat().replace("+00:00", "Z"),
        return_type=str,
        when_used="json",
    ),
]

Visibility = Literal["private", "public", "link"]
ProjectRole = Literal["owner", "editor", "viewer"]
DatasetStatus = Literal["uploading", "validating", "ready", "failed"]
DatasetSourceType = Literal["upload", "import", "sample"]
RecordingFormat = Literal["fif", "ctf", "kit", "bin", "bids"]
AcquisitionSystem = Literal["squid", "opm"]
ChannelType = Literal["mag", "grad", "eeg", "eog", "ecg", "stim", "misc", "opm"]
ChannelStatus = Literal["good", "bad"]
Unit = Literal["tesla", "tesla_per_metre", "volt", "amperes", "dimensionless", "other"]
CoordinateFrame = Literal["head", "device", "opm"]
SensorType = Literal["magnetometer", "gradiometer", "opm_scalar", "opm_vector", "aux"]
PipelineStatus = Literal["draft", "published", "archived"]
RunStatus = Literal["queued", "running", "succeeded", "failed", "cancelled"]
ResourceType = Literal["core_hours", "storage_bytes"]
ArtifactKind = Literal["original", "derived", "report", "manifest"]
EventSource = Literal["acquisition", "annotation", "derived"]
SampleConvention = Literal["onset", "first_sample", "mid_sample", "trigger"]
ShareScope = Literal["project", "dataset", "run"]
LogLevel = Literal["debug", "info", "warn", "error"]
UploadSessionStatus = Literal["pending", "completed", "expired", "aborted"]
FileRole = Literal[
    "recording",
    "events",
    "channels",
    "coordsystem",
    "calibration",
    "crosstalk",
    "header",
    "companion",
    "metadata",
]
Resolution = Literal["full", "high", "medium", "low", "summary"]


class Error(BaseModel):
    code: str
    message: str
    details: list[dict[str, Any]] | None = None
    trace_id: str


class ErrorResponse(BaseModel):
    error: Error


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None
    has_more: bool


class HealthLive(BaseModel):
    status: Literal["ok"]


class HealthReady(BaseModel):
    status: Literal["ok", "degraded", "not_ready"]
    dependencies: dict[str, str]


class SignedUrlResponse(BaseModel):
    url: str
    expires_at: UtcDatetime


class UserPublic(BaseModel):
    id: str
    email: str
    display_name: str | None = None


class PageParams(BaseModel):
    limit: int = 20
    cursor: str | None = None
