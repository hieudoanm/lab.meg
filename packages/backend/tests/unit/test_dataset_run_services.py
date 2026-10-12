"""Unit tests for dataset finalisation and run read services."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

import pytest

from app.core.exceptions import UnprocessableError
from app.schemas.datasets import Dataset, DatasetVersion, FileDeclaration
from app.schemas.runs import Artifact
from app.services import datasets, runs
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
    status="ready",
    manifest={},
    created_at=NOW,
)


class Storage:
    async def head_object(self, key):
        return ObjectInfo(key, 3, "sha256:" + "a" * 64, "application/octet-stream")


@pytest.mark.asyncio
async def test_dataset_object_verification_and_reads(monkeypatch) -> None:
    declaration = FileDeclaration(
        name="recording.fif",
        size_bytes=3,
        checksum_sha256="sha256:" + "a" * 64,
        role="recording",
    )
    await datasets._verify_uploaded_object(cast(StorageBackend, Storage()), declaration, "object")

    async def get_dataset(*args, **kwargs):
        return DATASET

    async def access(*args, **kwargs):
        return None

    monkeypatch.setattr(datasets.dataset_repo, "get_dataset_by_id", get_dataset)
    monkeypatch.setattr(datasets, "require_project_access", access)
    assert (
        await datasets.get_dataset(CONN, dataset_id="dataset-1", user_id=None, share_token="share")
        == DATASET
    )
    monkeypatch.setattr(
        datasets.dataset_repo,
        "list_datasets_for_user",
        lambda *args, **kwargs: ([DATASET], "next", True),
    )

    async def listing(*args, **kwargs):
        return [DATASET], "next", True

    monkeypatch.setattr(datasets.dataset_repo, "list_datasets_for_user", listing)
    assert await datasets.list_datasets_for_user(CONN, user_id="user-1", limit=10, cursor=None) == (
        [DATASET],
        "next",
        True,
    )

    async def get_version(*args, **kwargs):
        return VERSION

    monkeypatch.setattr(datasets.dataset_repo, "get_dataset_version_by_id", get_version)
    assert (
        await datasets.get_dataset_version(
            CONN, version_id="version-1", user_id="user-1", share_token=None
        )
        == VERSION
    )


@pytest.mark.asyncio
async def test_dataset_object_verification_rejects_mismatches() -> None:
    declaration = FileDeclaration(name="a.fif", size_bytes=4, role="recording")

    class Missing:
        async def head_object(self, key):
            return None

    with pytest.raises(UnprocessableError, match="missing"):
        await datasets._verify_uploaded_object(cast(StorageBackend, Missing()), declaration, "key")
    with pytest.raises(UnprocessableError, match="size mismatch"):
        await datasets._verify_uploaded_object(cast(StorageBackend, Storage()), declaration, "key")


def _run_row(status: str = "succeeded") -> dict[str, Any]:
    return {
        "id": "run_12345678",
        "project_id": "project-1",
        "pipeline_version_id": "pipeline-version-1",
        "dataset_version_id": "version-1",
        "status": status,
        "parameters": {"alpha": 1},
        "initiated_by": "user-1",
        "created_at": NOW,
    }


@pytest.mark.asyncio
async def test_run_reads_logs_and_artifacts(monkeypatch) -> None:
    async def access(*args, **kwargs):
        return None

    async def get_row(*args, **kwargs):
        return _run_row()

    monkeypatch.setattr(runs, "require_project_access", access)
    monkeypatch.setattr(runs.run_repo, "get_run_row", get_row)

    async def no_manifest(*args, **kwargs):
        return None

    monkeypatch.setattr(runs.run_repo, "get_run_manifest_artifact", no_manifest)
    result = await runs.get_run(CONN, run_id="run_12345678", user_id=None, share_token="share")
    assert result.id == "run_12345678"

    async def logs(*args, **kwargs):
        return [], "next", True

    monkeypatch.setattr(runs.run_repo, "list_run_logs", logs)
    log_list = await runs.get_run_logs(
        CONN,
        run_id="run_12345678",
        user_id=None,
        share_token=None,
        limit=10,
        cursor=None,
        level=None,
    )
    assert log_list.run_id == "run_12345678"

    artifact = Artifact(
        id="artifact-1",
        run_id="run_12345678",
        object_key="out.json",
        checksum="sha256:" + "b" * 64,
        size_bytes=1,
        media_type="application/json",
        kind="derived",
        metadata={},
        created_at=NOW,
    )

    async def artifacts(*args, **kwargs):
        return [artifact], None, False

    class ArtifactStorage:
        async def presign_get(self, key):
            return type("Signed", (), {"url": "https://example.test/out"})()

    monkeypatch.setattr(runs.run_repo, "list_artifacts_for_run", artifacts)
    artifact_list = await runs.list_run_artifacts(
        CONN,
        cast(StorageBackend, ArtifactStorage()),
        run_id="run_12345678",
        user_id=None,
        share_token=None,
        limit=10,
        cursor=None,
        kind=None,
    )
    assert artifact_list.items[0].download_url == "https://example.test/out"


def test_run_helpers_handle_manifest_and_limits() -> None:
    run = runs._run_from_row(_run_row(), manifest=None)
    assert run.parameters == {"alpha": 1}
    assert runs._manifest_from_artifact(None) is None
    assert runs._manifest_from_artifact({"metadata": {"invalid": True}}) is None
