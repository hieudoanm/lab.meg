"""Unit tests for dataset creation and upload-session orchestration."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

import pytest

from app.schemas.datasets import (
    Dataset,
    DatasetCreate,
    DatasetVersion,
    FileDeclaration,
    UploadSession,
)
from app.services import datasets
from app.storage.base import PresignedUrl, StorageBackend

CONN = cast(Any, None)
NOW = datetime.now(UTC)
DATASET = Dataset(
    id="dataset-1",
    project_id="project-1",
    name="Sample",
    source_type="sample",
    status="validating",
    created_at=NOW,
    updated_at=NOW,
)
VERSION = DatasetVersion(
    id="version-1",
    dataset_id="dataset-1",
    version="1.0.0",
    status="validating",
    manifest={},
    created_at=NOW,
)
SESSION = UploadSession(
    id="session-1",
    dataset_id="dataset-1",
    project_id="project-1",
    status="pending",
    expires_at=NOW,
    created_at=NOW,
)


class Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None


class Connection:
    def transaction(self):
        return Transaction()


class Storage:
    async def presign_put(self, *args, **kwargs):
        return PresignedUrl(url="https://example.test/upload", method="PUT", expires_at=NOW)


@pytest.mark.asyncio
async def test_create_sample_dataset_and_completed_session(monkeypatch) -> None:
    async def noop(*args, **kwargs):
        return None

    async def create_dataset(*args, **kwargs):
        return DATASET

    async def next_version(*args, **kwargs):
        return "1.0.0"

    async def create_version(*args, **kwargs):
        return VERSION

    async def create_session(*args, **kwargs):
        return SESSION

    async def get_session(*args, **kwargs):
        return SESSION.model_copy(update={"status": "completed"})

    monkeypatch.setattr(datasets, "require_project_access", noop)
    monkeypatch.setattr(datasets, "check", noop)
    monkeypatch.setattr(datasets, "record", noop)
    monkeypatch.setattr(datasets.dataset_repo, "create_dataset", create_dataset)
    monkeypatch.setattr(datasets.dataset_repo, "next_version_label", next_version)
    monkeypatch.setattr(datasets.dataset_repo, "create_dataset_version", create_version)
    monkeypatch.setattr(datasets.shared_repo, "enqueue_outbox", noop)
    monkeypatch.setattr(datasets.dataset_repo, "create_upload_session", create_session)
    monkeypatch.setattr(datasets.dataset_repo, "mark_upload_session_completed", noop)
    monkeypatch.setattr(datasets.dataset_repo, "get_upload_session", get_session)
    request = DatasetCreate(
        name="Sample",
        source_type="sample",
        recording_format="fif",
        files=[FileDeclaration(name="sample.fif", size_bytes=1, role="recording")],
    )
    response = await datasets.create_dataset(
        cast(Any, Connection()),
        cast(StorageBackend, Storage()),
        project_id="project-1",
        user_id="user-1",
        request=request,
        idempotency_key="sample-key",
    )
    assert response.status_code == 201
    assert response.body["upload_session"]["files"] == []


@pytest.mark.asyncio
async def test_create_upload_session_presigns_each_file(monkeypatch) -> None:
    async def create_session(*args, **kwargs):
        return SESSION

    async def add_target(*args, **kwargs):
        return None

    async def presign(*args, **kwargs):
        return PresignedUrl(url="https://example.test/u", method="PUT", expires_at=NOW)

    monkeypatch.setattr(datasets.dataset_repo, "create_upload_session", create_session)
    monkeypatch.setattr(datasets.dataset_repo, "add_upload_target", add_target)
    storage = cast(StorageBackend, Storage())
    monkeypatch.setattr(storage, "presign_put", presign)
    files = [FileDeclaration(name="a.fif", size_bytes=3, role="recording")]
    result = await datasets._create_upload_session(
        CONN,
        storage,
        dataset=DATASET,
        project_id="project-1",
        files=files,
        declared_format="fif",
        acquisition_system="squid",
    )
    assert result.files[0].object_key.endswith("/a.fif")
