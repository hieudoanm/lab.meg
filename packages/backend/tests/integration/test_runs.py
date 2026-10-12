"""Integration tests: run submission validation and idempotency."""

from __future__ import annotations

import uuid

import pytest

from app.core.exceptions import (
    BadRequestError,
    UnprocessableError,
)
from app.repositories import datasets as dataset_repo
from app.repositories import users as user_repo
from app.schemas.pipelines import PipelineCreate, PipelineVersionCreate
from app.schemas.projects import ProjectCreate
from app.schemas.runs import RunCreate
from app.services import pipelines as pipeline_service
from app.services import projects as project_service
from app.services import runs as run_service


async def _seed(db_conn, storage, email: str = "runner@example.com"):
    user = await user_repo.create_user(db_conn, email=email, display_name="Runner")
    project = await project_service.create_project(
        db_conn, user_id=user.id, request=ProjectCreate(name="Runs Project")
    )
    pipeline = await pipeline_service.create_pipeline(
        db_conn,
        user_id=user.id,
        request=PipelineCreate(project_id=project.id, name="event-related-analysis"),
    )
    definition = {
        "nodes": [
            {"id": "filter", "op": "mne.filter.filter_data", "params": {}},
            {"id": "epoch", "op": "mne.Epochs", "params": {}},
            {"id": "evoked", "op": "mne.Epochs.average", "params": {}},
        ]
    }
    version = await pipeline_service.create_pipeline_version(
        db_conn,
        pipeline_id=pipeline.id,
        user_id=user.id,
        request=PipelineVersionCreate(
            version="1.2.0",
            definition=definition,
            image_digest="sha256:" + "9f" * 32,
            parameters_schema={"type": "object"},
        ),
    )
    dataset = await dataset_repo.create_dataset(
        db_conn, project_id=project.id, name="AEF-001", source_type="upload"
    )
    return user, project, pipeline, version, dataset


async def test_run_requires_idempotency_key(db_conn, storage) -> None:
    user, project, pipeline, version, dataset = await _seed(db_conn, storage)
    request = RunCreate(
        project_id=project.id,
        pipeline_version_id=version.id,
        dataset_version_id=str(uuid.uuid4()),
        parameters={},
    )
    with pytest.raises(BadRequestError):
        await run_service.submit_run(
            db_conn, user_id=user.id, request=request, idempotency_key=None
        )


async def test_run_rejects_unready_dataset(db_conn, storage) -> None:
    user, project, pipeline, version, dataset = await _seed(db_conn, storage)
    dataset_version = await dataset_repo.create_dataset_version(
        conn=db_conn,
        dataset_id=dataset.id,
        version="v1",
        manifest={},
        status="validating",
        checksum=None,
    )
    request = RunCreate(
        project_id=project.id,
        pipeline_version_id=version.id,
        dataset_version_id=dataset_version.id,
        parameters={},
    )
    with pytest.raises(UnprocessableError) as excinfo:
        await run_service.submit_run(
            db_conn,
            user_id=user.id,
            request=request,
            idempotency_key="idem-key-0001",
        )
    assert excinfo.value.code == "dataset_not_ready"


async def test_run_rejects_cross_project_pipeline(db_conn, storage) -> None:
    user, project, pipeline, version, dataset = await _seed(db_conn, storage)
    other_user = await user_repo.create_user(
        db_conn, email="other@example.com", display_name="Other"
    )
    other_project = await project_service.create_project(
        db_conn, user_id=other_user.id, request=ProjectCreate(name="Other")
    )
    other_dataset = await dataset_repo.create_dataset(
        db_conn, project_id=other_project.id, name="Other", source_type="upload"
    )
    other_version = await dataset_repo.create_dataset_version(
        conn=db_conn,
        dataset_id=other_dataset.id,
        version="v1",
        manifest={},
        status="ready",
        checksum="sha256:" + "ab" * 32,
    )
    request = RunCreate(
        project_id=project.id,
        pipeline_version_id=version.id,
        dataset_version_id=other_version.id,
        parameters={},
    )
    with pytest.raises(UnprocessableError) as excinfo:
        await run_service.submit_run(
            db_conn,
            user_id=user.id,
            request=request,
            idempotency_key="idem-key-0002",
        )
    assert excinfo.value.code == "dataset_version_project_mismatch"


async def test_run_idempotency_replays_and_conflicts(db_conn, storage) -> None:
    user, project, pipeline, version, dataset = await _seed(db_conn, storage)
    dataset_version = await dataset_repo.create_dataset_version(
        conn=db_conn,
        dataset_id=dataset.id,
        version="v1",
        manifest={},
        status="ready",
        checksum="sha256:" + "cd" * 32,
    )
    request = RunCreate(
        project_id=project.id,
        pipeline_version_id=version.id,
        dataset_version_id=dataset_version.id,
        parameters={"filter": {"l_freq_hz": 1.0}},
    )
    key = "idem-key-0003"
    first = await run_service.submit_run(
        db_conn, user_id=user.id, request=request, idempotency_key=key
    )
    assert first.status_code == 202
    assert first.body["status"] == "queued"

    replay = await run_service.submit_run(
        db_conn, user_id=user.id, request=request, idempotency_key=key
    )
    assert replay.status_code == 202
    assert replay.body["id"] == first.body["id"]

    modified = RunCreate(
        project_id=request.project_id,
        pipeline_version_id=request.pipeline_version_id,
        dataset_version_id=request.dataset_version_id,
        parameters={"filter": {"l_freq_hz": 5.0}},
    )
    from app.core.exceptions import ConflictError

    with pytest.raises(ConflictError):
        await run_service.submit_run(
            db_conn, user_id=user.id, request=modified, idempotency_key=key
        )
