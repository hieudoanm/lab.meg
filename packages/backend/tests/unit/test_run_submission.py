"""Unit tests for run submission validation and dispatch."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

import pytest

from app.core.exceptions import UnprocessableError
from app.schemas.datasets import Dataset, DatasetVersion
from app.schemas.runs import RunCreate, RunStatus
from app.services import runs

CONN = cast(Any, None)
NOW = datetime.now(UTC)
DATASET = Dataset(
    id="dataset-1",
    project_id="project-1",
    name="Dataset",
    source_type="upload",
    status="ready",
    created_at=NOW,
    updated_at=NOW,
)
VERSION = DatasetVersion(
    id="dataset-version-1",
    dataset_id="dataset-1",
    version="1.0.0",
    status="ready",
    manifest={},
    created_at=NOW,
)
RUN_STATUS = RunStatus(
    id="run_12345678",
    status="queued",
    pipeline_version_id="pipeline-version-1",
    dataset_version_id="dataset-version-1",
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


@pytest.mark.asyncio
async def test_submit_run_successfully_enqueues_and_records(monkeypatch) -> None:
    async def noop(*args, **kwargs):
        return None

    async def pipeline(*args, **kwargs):
        return {"project_id": "project-1", "parameters_schema": {"type": "object"}}

    async def dataset_version(*args, **kwargs):
        return VERSION

    async def dataset(*args, **kwargs):
        return DATASET

    async def running(*args, **kwargs):
        return 0

    async def create(*args, **kwargs):
        return RUN_STATUS

    monkeypatch.setattr(runs, "require_project_access", noop)
    monkeypatch.setattr(runs, "check", noop)
    monkeypatch.setattr(runs, "record", noop)
    monkeypatch.setattr(runs.pipeline_repo, "get_pipeline_version_with_pipeline", pipeline)
    monkeypatch.setattr(runs.dataset_repo, "get_dataset_version_by_id", dataset_version)
    monkeypatch.setattr(runs.dataset_repo, "get_dataset_by_id", dataset)
    monkeypatch.setattr(runs.run_repo, "count_running_runs_for_user", running)
    monkeypatch.setattr(runs.run_repo, "create_run", create)
    monkeypatch.setattr(runs.shared_repo, "enqueue_outbox", noop)
    monkeypatch.setattr(runs.shared_repo, "create_audit_event", noop)
    request = RunCreate(
        project_id="project-1",
        pipeline_version_id="pipeline-version-1",
        dataset_version_id="dataset-version-1",
        parameters={},
    )
    response = await runs.submit_run(
        cast(Any, Connection()),
        user_id="user-1",
        request=request,
        idempotency_key="run-key-1",
    )
    assert response.status_code == 202
    assert response.body["id"] == "run_12345678"


@pytest.mark.asyncio
async def test_submit_run_rejects_cross_project_pipeline(monkeypatch) -> None:
    async def noop(*args, **kwargs):
        return None

    async def pipeline(*args, **kwargs):
        return {"project_id": "other-project", "parameters_schema": {"type": "object"}}

    monkeypatch.setattr(runs, "require_project_access", noop)
    monkeypatch.setattr(runs, "check", noop)
    monkeypatch.setattr(runs.pipeline_repo, "get_pipeline_version_with_pipeline", pipeline)
    request = RunCreate(
        project_id="project-1",
        pipeline_version_id="pipeline-version-1",
        dataset_version_id="dataset-version-1",
        parameters={},
    )
    with pytest.raises(UnprocessableError, match="pipeline version"):
        await runs.submit_run(
            cast(Any, Connection()),
            user_id="user-1",
            request=request,
            idempotency_key="run-key-1",
        )
