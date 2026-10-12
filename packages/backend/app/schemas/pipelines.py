"""Pipeline schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import PipelineStatus, UtcDatetime


class Pipeline(BaseModel):
    id: str
    project_id: str
    name: str
    description: str | None = None
    status: PipelineStatus
    latest_version: str | None = None
    created_at: UtcDatetime
    updated_at: UtcDatetime


class PipelineCreate(BaseModel):
    project_id: str
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class PipelineVersion(BaseModel):
    id: str
    pipeline_id: str
    version: str
    definition: dict[str, Any]
    image_digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    parameters_schema: dict[str, Any]
    status: PipelineStatus
    created_at: UtcDatetime


class PipelineVersionCreate(BaseModel):
    version: str = Field(min_length=1)
    definition: dict[str, Any]
    image_digest: str = Field(pattern=r"^sha256:[0-9a-f]{64}$")
    parameters_schema: dict[str, Any] | None = None
    status: PipelineStatus = "draft"
