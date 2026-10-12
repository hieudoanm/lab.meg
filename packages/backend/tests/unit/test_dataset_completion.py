"""Unit tests for completing uploaded datasets."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

import pytest

from app.core.exceptions import UnprocessableError
from app.schemas.datasets import Dataset, DatasetCompleteRequest, DatasetVersion, FileDeclaration
from app.services import datasets
from app.storage.base import ObjectInfo, StorageBackend

CONN = cast(Any, None)
NOW = datetime.now(UTC)
DATASET = Dataset(
    id="dataset-1",
    project_id="project-1",
    name="Dataset",
    source_type="upload",
    status="uploading",
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


class Transaction:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None


class Connection:
    def transaction(self):
        return Transaction()


class Storage:
    async def head_object(self, key):
        return ObjectInfo(key, 3, "sha256:" + "a" * 64, "application/octet-stream")


@pytest.mark.asyncio
async def test_complete_dataset_creates_version_and_dispatches(monkeypatch) -> None:
    async def access(*args, **kwargs):
        return None

    async def no_replay(*args, **kwargs):
        return None

    async def dataset(*args, **kwargs):
        return DATASET

    async def session(*args, **kwargs):
        return {"id": "session-1", "declared_format": "fif", "acquisition_system": "squid"}

    async def targets(*args, **kwargs):
        return [type("Target", (), {"name": "recording.fif", "object_key": "object-key"})()]

    async def next_version(*args, **kwargs):
        return "1.0.0"

    async def create_version(*args, **kwargs):
        return VERSION

    async def noop(*args, **kwargs):
        return None

    monkeypatch.setattr(datasets.dataset_repo, "get_dataset_by_id", dataset)
    monkeypatch.setattr(datasets, "require_project_access", access)
    monkeypatch.setattr(datasets, "check", no_replay)
    monkeypatch.setattr(datasets.dataset_repo, "get_active_upload_session_row", session)
    monkeypatch.setattr(datasets.dataset_repo, "list_upload_targets", targets)
    monkeypatch.setattr(datasets.dataset_repo, "next_version_label", next_version)
    monkeypatch.setattr(datasets.dataset_repo, "create_dataset_version", create_version)
    monkeypatch.setattr(datasets.dataset_repo, "update_dataset_status", noop)
    monkeypatch.setattr(datasets.dataset_repo, "mark_upload_session_completed", noop)
    monkeypatch.setattr(datasets.shared_repo, "enqueue_outbox", noop)
    monkeypatch.setattr(datasets, "record", noop)
    request = DatasetCompleteRequest(
        files=[FileDeclaration(name="recording.fif", size_bytes=3, role="recording")]
    )
    response = await datasets.complete_dataset(
        cast(Any, Connection()),
        cast(StorageBackend, Storage()),
        dataset_id="dataset-1",
        user_id="user-1",
        request=request,
        idempotency_key="complete-key",
    )
    assert response.status_code == 202
    assert response.body["id"] == VERSION.id


@pytest.mark.asyncio
async def test_complete_dataset_rejects_undeclared_object(monkeypatch) -> None:
    async def dataset(*args, **kwargs):
        return DATASET

    async def access(*args, **kwargs):
        return None

    async def no_replay(*args, **kwargs):
        return None

    async def session(*args, **kwargs):
        return {"id": "session-1", "declared_format": "fif"}

    async def targets(*args, **kwargs):
        return []

    monkeypatch.setattr(datasets.dataset_repo, "get_dataset_by_id", dataset)
    monkeypatch.setattr(datasets, "require_project_access", access)
    monkeypatch.setattr(datasets, "check", no_replay)
    monkeypatch.setattr(datasets.dataset_repo, "get_active_upload_session_row", session)
    monkeypatch.setattr(datasets.dataset_repo, "list_upload_targets", targets)
    request = DatasetCompleteRequest(
        files=[FileDeclaration(name="recording.fif", size_bytes=3, role="recording")]
    )
    with pytest.raises(UnprocessableError, match="not declared"):
        await datasets.complete_dataset(
            cast(Any, Connection()),
            cast(StorageBackend, Storage()),
            dataset_id="dataset-1",
            user_id="user-1",
            request=request,
            idempotency_key="complete-key",
        )
