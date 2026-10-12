"""Experiment run submission, status, logs, and artifacts."""

from __future__ import annotations

import json
from typing import Any

import jsonschema

from app.core.config import get_settings
from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
    TooManyRequestsError,
    UnprocessableError,
)
from app.db.pool import Connection
from app.repositories import datasets as dataset_repo
from app.repositories import pipelines as pipeline_repo
from app.repositories import recordings as recording_repo
from app.repositories import runs as run_repo
from app.repositories import shared as shared_repo
from app.schemas.runs import (
    ArtifactList,
    ExperimentManifest,
    LogList,
    ResourceLimits,
    Run,
    RunCreate,
    RunList,
)
from app.services.idempotency import IdempotentResponse, check, record
from app.services.tenancy import require_project_access
from app.storage.base import StorageBackend


def _require_idempotency_key(key: str | None) -> str:
    if key is None or not (8 <= len(key) <= 128):
        raise BadRequestError(
            "Idempotency-Key header is required and must be 8-128 characters",
            code="idempotency_key_required",
        )
    return key


async def submit_run(
    conn: Connection,
    *,
    user_id: str,
    request: RunCreate,
    idempotency_key: str | None,
) -> IdempotentResponse:
    key = _require_idempotency_key(idempotency_key)
    payload = {
        "project_id": request.project_id,
        "pipeline_version_id": request.pipeline_version_id,
        "dataset_version_id": request.dataset_version_id,
        "parameters": request.parameters,
        "sensor_configuration_id": request.sensor_configuration_id,
        "resource_limits": (
            request.resource_limits.model_dump(mode="json") if request.resource_limits else None
        ),
    }

    async with conn.transaction():
        await require_project_access(
            conn=conn, project_id=request.project_id, user_id=user_id, write=True
        )
        replay = await check(conn, key, user_id, payload)
        if replay is not None:
            return replay

        # Pipeline version must belong to the same project.
        pipeline_version = await pipeline_repo.get_pipeline_version_with_pipeline(
            conn, request.pipeline_version_id
        )
        if pipeline_version is None or pipeline_version["project_id"] != request.project_id:
            raise UnprocessableError(
                "pipeline version does not belong to this project",
                code="pipeline_version_project_mismatch",
            )

        # Dataset version must belong to the same project and be ready.
        dataset_version = await dataset_repo.get_dataset_version_by_id(
            conn, request.dataset_version_id
        )
        if dataset_version is None:
            raise UnprocessableError(
                "dataset version does not belong to this project",
                code="dataset_version_project_mismatch",
            )
        dataset = await dataset_repo.get_dataset_by_id(conn, dataset_version.dataset_id)
        if dataset is None or dataset.project_id != request.project_id:
            raise UnprocessableError(
                "dataset version does not belong to this project",
                code="dataset_version_project_mismatch",
            )
        if dataset_version.status != "ready":
            raise UnprocessableError(
                "dataset version is not ready for analysis",
                code="dataset_not_ready",
            )

        # Optional sensor configuration must belong to the same project.
        sensor_configuration_id = request.sensor_configuration_id
        if sensor_configuration_id is not None:
            sensor = await recording_repo.get_sensor_configuration_by_id(
                conn, sensor_configuration_id
            )
            if sensor is None:
                raise UnprocessableError(
                    "sensor configuration not found",
                    code="sensor_configuration_not_found",
                )
            recording = await _recording_for_sensor(conn, sensor_configuration_id)
            if recording is None or recording["project_id"] != request.project_id:
                raise UnprocessableError(
                    "sensor configuration does not belong to this project",
                    code="sensor_configuration_project_mismatch",
                )

        # Parameters must satisfy the versioned parameters schema.
        try:
            jsonschema.validate(request.parameters, pipeline_version["parameters_schema"])
        except jsonschema.ValidationError as exc:
            raise UnprocessableError(
                f"parameters do not match the pipeline schema: {exc.message}",
                code="parameters_schema_mismatch",
            ) from exc

        # Concurrency control per user.
        settings = get_settings()
        running = await run_repo.count_running_runs_for_user(conn, user_id)
        if running >= settings.max_concurrent_runs_per_user:
            raise TooManyRequestsError(
                f"at most {settings.max_concurrent_runs_per_user} concurrent runs per user",
                code="concurrent_run_limit",
            )

        resource_limits = (
            request.resource_limits.model_dump(mode="json")
            if request.resource_limits
            else {
                "cpu_cores": settings.run_cpu_limit,
                "memory_bytes": settings.run_memory_limit_mb * 1024 * 1024,
                "disk_bytes": settings.run_disk_limit_mb * 1024 * 1024,
                "wall_clock_limit_s": settings.run_timeout_seconds,
            }
        )

        run_status = await run_repo.create_run(
            conn,
            project_id=request.project_id,
            pipeline_version_id=request.pipeline_version_id,
            dataset_version_id=request.dataset_version_id,
            sensor_configuration_id=sensor_configuration_id,
            initiated_by=user_id,
            parameters=request.parameters,
            idempotency_key=key,
            resource_limits=resource_limits,
        )
        await shared_repo.enqueue_outbox(
            conn,
            topic="run.dispatch",
            payload={"run_id": run_status.id},
        )
        await shared_repo.create_audit_event(
            conn,
            actor_id=user_id,
            action="run.submitted",
            resource_type="run",
            resource_id=run_status.id,
        )

        response = IdempotentResponse(
            status_code=202,
            body=run_status.model_dump(mode="json"),
        )
        await record(conn, key=key, user_id=user_id, payload=payload, response=response)
        return response


async def _recording_for_sensor(
    conn: Connection, sensor_configuration_id: str
) -> dict[str, Any] | None:
    row = await conn.execute(
        """
        SELECT dv.dataset_id, ds.project_id
        FROM sensor_configurations sc
        JOIN recordings r ON r.id = sc.recording_id
        JOIN dataset_versions dv ON dv.id = r.dataset_version_id
        JOIN datasets ds ON ds.id = dv.dataset_id
        WHERE sc.id = %s
        """,
        (sensor_configuration_id,),
    )
    result = await row.fetchone()
    return dict(result) if result else None


async def get_run(
    conn: Connection,
    *,
    run_id: str,
    user_id: str,
    share_token: str | None,
) -> Run:
    row = await run_repo.get_run_row(conn, run_id)
    if row is None:
        raise NotFoundError("run not found")
    await require_project_access(
        conn=conn,
        project_id=row["project_id"],
        user_id=user_id,
        share_token=share_token,
    )
    manifest = None
    if row.get("status") in ("succeeded", "failed"):
        manifest = _manifest_from_artifact(await run_repo.get_run_manifest_artifact(conn, run_id))
    return _run_from_row(row, manifest=manifest)


async def list_runs(
    conn: Connection,
    *,
    user_id: str,
    limit: int,
    cursor: str | None,
    project_id: str | None,
    status: str | None,
) -> RunList:
    if project_id is not None:
        await require_project_access(conn=conn, project_id=project_id, user_id=user_id)
    items, next_cursor, has_more = await run_repo.list_runs_for_user(
        conn,
        user_id=user_id,
        limit=limit,
        cursor=cursor,
        project_id=project_id,
        status=status,
    )
    return RunList(items=items, next_cursor=next_cursor, has_more=has_more)


async def get_run_logs(
    conn: Connection,
    *,
    run_id: str,
    user_id: str,
    share_token: str | None,
    limit: int,
    cursor: str | None,
    level: str | None,
) -> LogList:
    row = await run_repo.get_run_row(conn, run_id)
    if row is None:
        raise NotFoundError("run not found")
    await require_project_access(
        conn=conn,
        project_id=row["project_id"],
        user_id=user_id,
        share_token=share_token,
    )
    logs, next_cursor, has_more = await run_repo.list_run_logs(
        conn, run_id=run_id, limit=limit, cursor=cursor, level=level
    )
    return LogList(
        run_id=run_id,
        items=logs,
        next_cursor=next_cursor,
        has_more=has_more,
    )


async def list_run_artifacts(
    conn: Connection,
    storage: StorageBackend,
    *,
    run_id: str,
    user_id: str,
    share_token: str | None,
    limit: int,
    cursor: str | None,
    kind: str | None,
) -> ArtifactList:
    row = await run_repo.get_run_row(conn, run_id)
    if row is None:
        raise NotFoundError("run not found")
    await require_project_access(
        conn=conn,
        project_id=row["project_id"],
        user_id=user_id,
        share_token=share_token,
    )
    artifacts, next_cursor, has_more = await run_repo.list_artifacts_for_run(
        conn, run_id=run_id, limit=limit, cursor=cursor, kind=kind
    )
    # Download URLs are issued only after the authorisation check above
    # and are short-lived and single-object scoped.
    for artifact in artifacts:
        presigned = await storage.presign_get(artifact.object_key)
        artifact.download_url = presigned.url
    return ArtifactList(
        run_id=run_id,
        items=artifacts,
        next_cursor=next_cursor,
        has_more=has_more,
    )


def _run_from_row(row: dict[str, Any], *, manifest: ExperimentManifest | None = None) -> Run:
    resource_limits = ResourceLimits(
        cpu_cores=row.get("cpu_limit_cores"),
        memory_bytes=row.get("memory_limit_bytes"),
        disk_bytes=row.get("disk_limit_bytes"),
        wall_clock_limit_s=row.get("wall_clock_limit_s"),
    )
    return Run(
        id=row["id"],
        project_id=row["project_id"],
        pipeline_version_id=row["pipeline_version_id"],
        dataset_version_id=row["dataset_version_id"],
        sensor_configuration_id=row.get("sensor_configuration_id"),
        status=row["status"],
        parameters=row.get("parameters") or {},
        idempotency_key=row.get("idempotency_key"),
        error_classification=row.get("error_classification"),
        resource_limits=resource_limits,
        manifest=manifest,
        initiated_by=row["initiated_by"],
        started_at=row.get("started_at"),
        finished_at=row.get("finished_at"),
        created_at=row["created_at"],
    )


def _manifest_from_artifact(artifact: dict[str, Any] | None) -> ExperimentManifest | None:
    if artifact is None:
        return None
    metadata = artifact.get("metadata") or {}
    try:
        return ExperimentManifest.model_validate(metadata)
    except Exception:  # noqa: BLE001 - manifests are best-effort
        return None


_ = json
