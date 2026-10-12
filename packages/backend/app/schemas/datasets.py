"""Dataset, upload session, and dataset version schemas."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import (
    AcquisitionSystem,
    DatasetSourceType,
    DatasetStatus,
    FileRole,
    RecordingFormat,
    UtcDatetime,
)


class FileDeclaration(BaseModel):
    name: str = Field(min_length=1)
    size_bytes: int = Field(ge=0)
    checksum_sha256: str | None = Field(default=None, pattern=r"^sha256:[0-9a-f]{64}$")
    media_type: str | None = None
    role: FileRole


class DatasetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source_type: DatasetSourceType
    recording_format: RecordingFormat
    acquisition_system: AcquisitionSystem | None = None
    files: list[FileDeclaration] = Field(min_length=1)


class Dataset(BaseModel):
    id: str
    project_id: str
    name: str
    source_type: DatasetSourceType
    status: DatasetStatus
    latest_version: str | None = None
    created_at: UtcDatetime
    updated_at: UtcDatetime
    archived_at: UtcDatetime | None = None


class DatasetList(BaseModel):
    items: list[Dataset]
    next_cursor: str | None = None
    has_more: bool


class DatasetVersion(BaseModel):
    id: str
    dataset_id: str
    version: str
    status: DatasetStatus
    manifest: dict[str, Any]
    checksum: str | None = None
    recording_ids: list[str] | None = None
    created_at: UtcDatetime


class DatasetCompleteRequest(BaseModel):
    files: list[FileDeclaration] = Field(min_length=1)


class UploadTarget(BaseModel):
    name: str
    object_key: str
    upload_url: str
    method: str
    headers: dict[str, str] | None = None
    expires_at: UtcDatetime


class UploadSession(BaseModel):
    id: str
    dataset_id: str
    project_id: str
    status: str
    expected_size_bytes: int | None = None
    checksum_sha256: str | None = None
    files: list[UploadTarget] = Field(default_factory=list)
    expires_at: UtcDatetime
    created_at: UtcDatetime
