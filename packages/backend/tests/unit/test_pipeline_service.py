"""Unit tests for pipeline authorization and version validation."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, cast

import pytest

from app.core.exceptions import ConflictError, NotFoundError, UnprocessableError
from app.schemas.pipelines import Pipeline, PipelineCreate, PipelineVersion, PipelineVersionCreate
from app.services import pipelines

NOW = datetime.now(UTC)
CONN = cast(Any, None)
PIPELINE = Pipeline(
    id="pipe-1",
    project_id="project-1",
    name="Example",
    status="draft",
    created_at=NOW,
    updated_at=NOW,
)


def _version_request(**changes: Any) -> PipelineVersionCreate:
    values: dict[str, Any] = {
        "version": "1.0.0",
        "definition": {"nodes": [{"type": "psd"}]},
        "image_digest": "sha256:" + "a" * 64,
    }
    values.update(changes)
    return PipelineVersionCreate.model_validate(values)


@pytest.mark.asyncio
async def test_create_and_list_pipelines(monkeypatch) -> None:
    calls: list[tuple[str, Any]] = []

    async def access(*args, **kwargs):
        calls.append(("access", kwargs))

    async def create(*args, **kwargs):
        calls.append(("create", kwargs))
        return PIPELINE

    async def listing(*args, **kwargs):
        return [PIPELINE], "next", True

    monkeypatch.setattr(pipelines, "require_project_access", access)
    monkeypatch.setattr(pipelines.pipeline_repo, "create_pipeline", create)
    monkeypatch.setattr(pipelines.pipeline_repo, "list_pipelines_for_project", listing)

    result = await pipelines.create_pipeline(
        CONN,
        user_id="user-1",
        request=PipelineCreate(project_id="project-1", name="Example"),
    )
    assert result == PIPELINE
    assert calls[1][1]["project_id"] == "project-1"
    assert await pipelines.list_pipelines(
        CONN, project_id="project-1", user_id="user-1", limit=10, cursor=None
    ) == ([PIPELINE], "next", True)


@pytest.mark.asyncio
async def test_pipeline_reads_authorize_and_handle_missing(monkeypatch) -> None:
    async def access(*args, **kwargs):
        return None

    monkeypatch.setattr(pipelines, "require_project_access", access)

    async def missing_pipeline(*args, **kwargs):
        return None

    monkeypatch.setattr(pipelines.pipeline_repo, "get_pipeline_by_id", missing_pipeline)
    with pytest.raises(NotFoundError):
        await pipelines.get_pipeline(CONN, pipeline_id="missing", user_id="user-1")

    async def get_pipeline(*args, **kwargs):
        return PIPELINE

    async def versions(*args, **kwargs):
        return [], None, False

    monkeypatch.setattr(pipelines.pipeline_repo, "get_pipeline_by_id", get_pipeline)
    monkeypatch.setattr(pipelines.pipeline_repo, "list_pipeline_versions", versions)
    assert await pipelines.list_pipeline_versions(
        CONN, pipeline_id="pipe-1", user_id="user-1", limit=10, cursor=None
    ) == ([], None, False)


@pytest.mark.asyncio
async def test_create_pipeline_version_validates_conflicts_and_definition(monkeypatch) -> None:
    async def access(*args, **kwargs):
        return None

    async def get_pipeline(*args, **kwargs):
        return PIPELINE

    async def no_existing(*args, **kwargs):
        return None

    async def create(*args, **kwargs):
        return PipelineVersion(
            id="version-1",
            pipeline_id="pipe-1",
            version=kwargs["version"],
            definition=kwargs["definition"],
            image_digest=kwargs["image_digest"],
            parameters_schema=kwargs["parameters_schema"],
            status=kwargs["status"],
            created_at=NOW,
        )

    monkeypatch.setattr(pipelines, "require_project_access", access)
    monkeypatch.setattr(pipelines.pipeline_repo, "get_pipeline_by_id", get_pipeline)
    monkeypatch.setattr(pipelines.pipeline_repo, "get_pipeline_version_by_label", no_existing)
    monkeypatch.setattr(pipelines.pipeline_repo, "create_pipeline_version", create)

    version = await pipelines.create_pipeline_version(
        CONN, pipeline_id="pipe-1", user_id="user-1", request=_version_request()
    )
    assert version.id == "version-1"
    assert version.parameters_schema == {"type": "object"}

    async def existing(*args, **kwargs):
        return {"id": "existing"}

    monkeypatch.setattr(pipelines.pipeline_repo, "get_pipeline_version_by_label", existing)
    with pytest.raises(ConflictError):
        await pipelines.create_pipeline_version(
            CONN, pipeline_id="pipe-1", user_id="user-1", request=_version_request()
        )

    monkeypatch.setattr(pipelines.pipeline_repo, "get_pipeline_version_by_label", no_existing)
    with pytest.raises(UnprocessableError):
        await pipelines.create_pipeline_version(
            CONN,
            pipeline_id="pipe-1",
            user_id="user-1",
            request=_version_request(definition={}),
        )


@pytest.mark.asyncio
async def test_get_pipeline_version_and_missing_pipeline(monkeypatch) -> None:
    async def access(*args, **kwargs):
        return None

    monkeypatch.setattr(pipelines, "require_project_access", access)

    async def missing_version(*args, **kwargs):
        return None

    monkeypatch.setattr(
        pipelines.pipeline_repo, "get_pipeline_version_with_pipeline", missing_version
    )
    with pytest.raises(NotFoundError):
        await pipelines.get_pipeline_version(CONN, version_id="missing", user_id="user-1")

    async def get_version(*args, **kwargs):
        return {
            "id": "version-1",
            "pipeline_id": "pipe-1",
            "project_id": "project-1",
            "version": "1.0.0",
            "definition": {"nodes": []},
            "image_digest": "sha256:" + "b" * 64,
            "parameters_schema": {"type": "object"},
            "status": "draft",
            "created_at": NOW,
        }

    monkeypatch.setattr(pipelines.pipeline_repo, "get_pipeline_version_with_pipeline", get_version)
    result = await pipelines.get_pipeline_version(CONN, version_id="version-1", user_id="user-1")
    assert result.pipeline_id == "pipe-1"
