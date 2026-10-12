"""Unit tests for API route orchestration and response shaping."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, cast

import pytest
from starlette.requests import Request

from app.api.routes import datasets, pipelines, projects, recordings, runs, usage
from app.schemas.datasets import DatasetCreate, FileDeclaration
from app.schemas.pipelines import PipelineCreate, PipelineVersionCreate
from app.schemas.projects import ProjectCreate, ProjectInvitationCreate, ProjectMemberRoleUpdate
from app.schemas.runs import RunCreate

CONN = cast(Any, object())
USER: Any = SimpleNamespace(id="user-1")
PAGE = SimpleNamespace(limit=25, cursor="cursor")


def request_with_query(query: str = "") -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "query_string": query.encode(),
            "headers": [],
        }
    )


@pytest.mark.asyncio
async def test_dataset_routes_forward_inputs_and_wrap_responses(monkeypatch) -> None:
    seen: dict[str, Any] = {}

    async def listing(*args, **kwargs):
        seen["list"] = kwargs
        return [], "next", True

    async def creating(*args, **kwargs):
        seen["create"] = kwargs
        return SimpleNamespace(status_code=201, body={"id": "dataset-1"})

    async def completing(*args, **kwargs):
        seen["complete"] = kwargs
        return SimpleNamespace(status_code=200, body={"status": "queued"})

    async def getting(*args, **kwargs):
        seen["get"] = kwargs
        return SimpleNamespace(id="dataset-1")

    monkeypatch.setattr(datasets.dataset_service, "list_datasets_for_user", listing)
    monkeypatch.setattr(datasets.dataset_service, "create_dataset", creating)
    monkeypatch.setattr(datasets.dataset_service, "complete_dataset", completing)
    monkeypatch.setattr(datasets.dataset_service, "get_dataset", getting)
    assert (await datasets.list_datasets(CONN, USER, PAGE)).has_more
    response = await datasets.create_dataset(
        "project-1",
        DatasetCreate(
            name="data",
            source_type="sample",
            recording_format="fif",
            files=[FileDeclaration(name="sample.fif", size_bytes=1, role="recording")],
        ),
        "idem",
        CONN,
        object(),
        USER,
    )
    assert response.status_code == 201
    response = await datasets.complete_dataset(
        "dataset-1", cast(Any, object()), "idem", CONN, object(), USER
    )
    assert response.status_code == 200
    assert (await datasets.get_dataset("dataset-1", CONN, USER, "share")).id == "dataset-1"
    assert seen["create"]["idempotency_key"] == "idem"
    assert seen["get"]["user_id"] == "user-1"


@pytest.mark.asyncio
async def test_project_routes_cover_crud_members_and_invitations(monkeypatch) -> None:
    async def empty(*args, **kwargs):
        return [], None, False

    async def project(*args, **kwargs):
        return SimpleNamespace(id="project-1")

    async def members(*args, **kwargs):
        return [SimpleNamespace(model_dump=lambda **kw: {"user_id": "user-2"})]

    async def nothing(*args, **kwargs):
        return None

    monkeypatch.setattr(projects.project_service, "list_projects", empty)
    monkeypatch.setattr(projects.project_service, "create_project", project)
    monkeypatch.setattr(projects.project_service, "create_share", project)
    monkeypatch.setattr(projects.project_service, "get_project", project)
    monkeypatch.setattr(projects.project_service, "list_project_members", members)
    monkeypatch.setattr(projects.project_service, "invite_project_member", project)
    monkeypatch.setattr(projects.project_service, "update_project_member", project)
    monkeypatch.setattr(projects.project_service, "remove_project_member", nothing)
    monkeypatch.setattr(projects.project_service, "accept_project_invitation", project)
    assert not (await projects.list_projects(CONN, USER, PAGE)).has_more
    assert (await projects.create_project(ProjectCreate(name="p"), CONN, USER)).id == "project-1"
    assert (
        await projects.create_share("project-1", cast(Any, object()), CONN, USER)
    ).id == "project-1"
    assert (await projects.get_project("project-1", CONN, USER)).id == "project-1"
    assert (await projects.list_members("project-1", CONN, USER))["items"][0]["user_id"] == "user-2"
    assert (
        await projects.invite_member(
            "project-1", ProjectInvitationCreate(email="a@b.com"), CONN, USER
        )
    ).id == "project-1"
    assert (
        cast(
            Any,
            await projects.update_member(
                "project-1", "user-2", ProjectMemberRoleUpdate(role="viewer"), CONN, USER
            ),
        ).id
        == "project-1"
    )
    await projects.remove_member("project-1", "user-2", CONN, USER)
    assert cast(Any, await projects.accept_invitation("token", CONN, USER)).id == "project-1"


@pytest.mark.asyncio
async def test_pipeline_routes_forward_and_serialize(monkeypatch) -> None:
    async def created(*args, **kwargs):
        return SimpleNamespace(id="pipeline-1")

    async def page(*args, **kwargs):
        return [], "next", True

    async def version(*args, **kwargs):
        return SimpleNamespace(id="version-1")

    monkeypatch.setattr(pipelines.pipeline_service, "create_pipeline", created)
    monkeypatch.setattr(pipelines.pipeline_service, "list_pipelines", page)
    monkeypatch.setattr(pipelines.pipeline_service, "get_pipeline", created)
    monkeypatch.setattr(pipelines.pipeline_service, "list_pipeline_versions", page)
    monkeypatch.setattr(pipelines.pipeline_service, "get_pipeline_version", version)
    monkeypatch.setattr(pipelines.pipeline_service, "create_pipeline_version", version)
    assert (
        await pipelines.create_pipeline(
            cast(Any, PipelineCreate(project_id="project-1", name="p")), CONN, USER
        )
    ).id == "pipeline-1"
    assert (await pipelines.list_pipelines("project-1", CONN, USER, PAGE))["has_more"]
    assert (await pipelines.get_pipeline("pipeline-1", CONN, USER)).id == "pipeline-1"
    assert not (await pipelines.list_pipeline_versions("pipeline-1", CONN, USER, PAGE))["items"]
    assert (await pipelines.get_pipeline_version("version-1", CONN, USER)).id == "version-1"
    assert (
        await pipelines.create_pipeline_version(
            "pipeline-1",
            cast(
                Any,
                PipelineVersionCreate(
                    version="1.0.0",
                    definition={},
                    image_digest="sha256:" + "0" * 64,
                ),
            ),
            CONN,
            USER,
        )
    ).id == "version-1"


@pytest.mark.asyncio
async def test_run_and_usage_routes_forward_inputs(monkeypatch) -> None:
    async def response(*args, **kwargs):
        return SimpleNamespace(status_code=202, body={"run_id": "run-1"})

    async def run(*args, **kwargs):
        return SimpleNamespace(id="run-1")

    def model_dump(*args, **kwargs):
        return {"items": []}

    monkeypatch.setattr(runs.run_service, "submit_run", response)
    monkeypatch.setattr(runs.run_service, "list_runs", lambda *a, **k: run())
    monkeypatch.setattr(runs.run_service, "get_run", run)

    async def logs(*args, **kwargs):
        return SimpleNamespace(model_dump=model_dump)

    async def artifacts(*args, **kwargs):
        return SimpleNamespace(model_dump=model_dump)

    monkeypatch.setattr(runs.run_service, "get_run_logs", logs)
    monkeypatch.setattr(runs.run_service, "list_run_artifacts", artifacts)
    assert (
        await runs.submit_run(
            cast(
                Any,
                RunCreate(
                    project_id="p",
                    pipeline_version_id="v",
                    dataset_version_id="d",
                    parameters={},
                ),
            ),
            "idem",
            CONN,
            USER,
        )
    ).status_code == 202
    assert (
        cast(
            Any,
            await runs.list_runs(
                request_with_query("project_id=p&status=queued"), CONN, USER, PAGE
            ),
        ).id
        == "run-1"
    )
    assert (await runs.get_run("run-1", CONN, USER, None)).id == "run-1"
    assert (
        await runs.get_run_logs("run-1", request_with_query("level=error"), CONN, USER, None, PAGE)
    ) == {"items": []}
    assert (
        await runs.list_run_artifacts(
            "run-1", request_with_query("kind=raw"), CONN, object(), USER, None, PAGE
        )
    ) == {"items": []}

    monkeypatch.setattr(usage.usage_service, "list_usage", run)

    async def quota_values(*args, **kwargs):
        return {"cpu": 1.0}

    monkeypatch.setattr(usage.usage_service, "quotas", quota_values)
    assert cast(Any, await usage.list_usage(CONN, USER, PAGE)).id == "run-1"
    assert await usage.quotas(CONN, USER) == {"cpu": 1.0}


@pytest.mark.asyncio
async def test_recording_routes_parse_query_parameters(monkeypatch) -> None:
    seen: dict[str, Any] = {}

    async def recording(*args, **kwargs):
        seen.update(kwargs)
        return SimpleNamespace(id="recording-1")

    async def channels(*args, **kwargs):
        seen.update(kwargs)
        return SimpleNamespace(id="channels")

    async def events(*args, **kwargs):
        seen.update(kwargs)
        return SimpleNamespace(id="events")

    async def signal(*args, **kwargs):
        seen.update(kwargs)
        return SimpleNamespace(id="signal")

    monkeypatch.setattr(recordings.recording_service, "get_recording", recording)
    monkeypatch.setattr(recordings.recording_service, "list_channels", channels)
    monkeypatch.setattr(recordings.recording_service, "list_event_sets", events)
    monkeypatch.setattr(recordings.recording_service, "signal_window", signal)
    monkeypatch.setattr(recordings.recording_service, "get_sensor_configuration", recording)
    assert (await recordings.get_recording("r", CONN, USER, None)).id == "recording-1"
    assert (
        cast(
            Any,
            await recordings.list_channels(
                "r", request_with_query("type=meg&channel_ids=a,%20b"), CONN, USER, None, PAGE
            ),
        ).id
        == "channels"
    )
    assert seen["channel_ids"] == ["a", "b"]
    assert (
        cast(
            Any,
            await recordings.list_event_sets(
                "r", request_with_query("source=stim"), CONN, USER, None, PAGE
            ),
        ).id
        == "events"
    )
    assert (
        cast(
            Any,
            await recordings.signal_window(
                "r",
                request_with_query("tmin_s=0&tmax_s=1&resolution=high"),
                CONN,
                object(),
                USER,
                None,
            ),
        ).id
        == "signal"
    )
    assert cast(Any, await recordings.get_sensors("r", CONN, USER, None)).id == "recording-1"
    with pytest.raises(Exception, match="required"):
        await recordings.signal_window(
            "r", request_with_query("tmin_s=0"), CONN, object(), USER, None
        )
