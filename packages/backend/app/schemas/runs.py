"""Run, log, artifact, and experiment manifest schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import ArtifactKind, LogLevel, UtcDatetime
from app.schemas.common import RunStatus as RunState


class ResourceLimits(BaseModel):
    cpu_cores: float | None = None
    memory_bytes: int | None = None
    disk_bytes: int | None = None
    wall_clock_limit_s: int | None = None


class RunCreate(BaseModel):
    project_id: str
    pipeline_version_id: str
    dataset_version_id: str
    parameters: dict[str, Any]
    sensor_configuration_id: str | None = None
    resource_limits: ResourceLimits | None = None


class ExperimentManifest(BaseModel):
    schema_version: str = "1.0"
    run_id: str
    inputs: list[dict[str, Any]]
    pipeline: dict[str, Any]
    parameters: dict[str, Any]
    environment: dict[str, Any]
    sensor_configuration_id: str | None = None
    outputs: list[dict[str, Any]]
    status: RunState


class Run(BaseModel):
    id: str = Field(pattern=r"^run_[0-9a-f]{8}$")
    project_id: str
    pipeline_version_id: str
    dataset_version_id: str
    sensor_configuration_id: str | None = None
    status: RunState
    parameters: dict[str, Any]
    idempotency_key: str | None = None
    error_classification: str | None = None
    resource_limits: ResourceLimits | None = None
    manifest: ExperimentManifest | None = None
    initiated_by: str
    started_at: UtcDatetime | None = None
    finished_at: UtcDatetime | None = None
    created_at: UtcDatetime


class RunStatus(BaseModel):
    id: str = Field(pattern=r"^run_[0-9a-f]{8}$")
    status: RunState
    pipeline_version_id: str
    dataset_version_id: str
    progress_percent: float | None = None
    error_classification: str | None = None
    started_at: UtcDatetime | None = None
    finished_at: UtcDatetime | None = None
    created_at: UtcDatetime


class RunList(BaseModel):
    items: list[RunStatus]
    next_cursor: str | None = None
    has_more: bool


class LogLine(BaseModel):
    sequence: int | None = None
    timestamp: UtcDatetime
    level: LogLevel
    source: str | None = None
    message: str


class LogList(BaseModel):
    run_id: str
    items: list[LogLine]
    next_cursor: str | None = None
    has_more: bool


class Artifact(BaseModel):
    id: str
    run_id: str
    object_key: str
    checksum: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    size_bytes: int = Field(ge=0)
    media_type: str
    kind: ArtifactKind
    download_url: str | None = None
    metadata: dict[str, Any]
    created_at: UtcDatetime


class ArtifactList(BaseModel):
    run_id: str
    items: list[Artifact]
    next_cursor: str | None = None
    has_more: bool
