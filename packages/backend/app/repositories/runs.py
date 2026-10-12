"""Experiment run, run log, and artifact repositories."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.core.ids import new_run_id
from app.core.pagination import CursorPosition, decode_cursor, encode_cursor
from app.db.pool import Connection
from app.repositories._shared import (
    clean,
    cursor_where,
    paginate,
    to_jsonb,
    to_model,
    to_models,
)
from app.schemas.runs import Artifact, LogLine, Run, RunStatus


async def create_run(
    conn: Connection,
    *,
    project_id: str,
    pipeline_version_id: str,
    dataset_version_id: str,
    sensor_configuration_id: str | None,
    initiated_by: str,
    parameters: dict[str, Any],
    idempotency_key: str,
    resource_limits: dict[str, Any] | None,
) -> RunStatus:
    run_id = new_run_id()
    row = await conn.execute(
        """
        INSERT INTO experiment_runs
            (id, project_id, pipeline_version_id, dataset_version_id,
             sensor_configuration_id, initiated_by, status, parameters,
             idempotency_key, cpu_limit_cores, memory_limit_bytes,
             disk_limit_bytes, wall_clock_limit_s)
        VALUES (%s, %s, %s, %s, %s, %s, 'queued', %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            run_id,
            project_id,
            pipeline_version_id,
            dataset_version_id,
            sensor_configuration_id,
            initiated_by,
            to_jsonb(parameters),
            idempotency_key,
            (resource_limits or {}).get("cpu_cores"),
            (resource_limits or {}).get("memory_bytes"),
            (resource_limits or {}).get("disk_bytes"),
            (resource_limits or {}).get("wall_clock_limit_s"),
        ),
    )
    result = await row.fetchone()
    assert result is not None
    payload = clean(result)
    payload["pipeline_version_id"] = payload["pipeline_version_id"]
    payload["dataset_version_id"] = payload["dataset_version_id"]
    return RunStatus.model_validate(payload)


async def get_run_row(conn: Connection, run_id: str) -> dict[str, Any] | None:
    row = await conn.execute(
        """
        SELECT r.*, pv.definition AS pipeline_definition,
               pv.image_digest AS image_digest, pv.parameters_schema AS parameters_schema,
               p.name AS pipeline_name, p.project_id AS project_id,
               dv.checksum AS dataset_checksum
        FROM experiment_runs r
        JOIN pipeline_versions pv ON pv.id = r.pipeline_version_id
        JOIN pipelines p ON p.id = pv.pipeline_id
        JOIN dataset_versions dv ON dv.id = r.dataset_version_id
        WHERE r.id = %s
        """,
        (run_id,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def list_runs_for_user(
    conn: Connection,
    *,
    user_id: str,
    limit: int,
    cursor: str | None,
    project_id: str | None = None,
    status: str | None = None,
) -> tuple[list[RunStatus], str | None, bool]:
    clauses = [
        "EXISTS (SELECT 1 FROM project_members pm"
        " WHERE pm.project_id = r.project_id AND pm.user_id = %s)"
    ]
    params: list[Any] = [user_id]
    if project_id:
        clauses.append("r.project_id = %s")
        params.append(project_id)
    if status:
        clauses.append("r.status = %s")
        params.append(status)

    condition, cursor_params = cursor_where(cursor, "r")
    sql = f"""
        SELECT r.* FROM experiment_runs r
        WHERE {' AND '.join(clauses)} {condition}
        ORDER BY r.created_at DESC, r.id ASC
        LIMIT %s
    """
    row = await conn.execute(sql, [*params, *cursor_params, limit + 1])
    runs = to_models(RunStatus, await row.fetchall())
    return paginate(runs, limit)


async def claim_queued_run(conn: Connection, run_id: str) -> bool:
    """Atomically transition queued -> running. Returns False when already claimed."""
    row = await conn.execute(
        """
        UPDATE experiment_runs
        SET status = 'running', started_at = now()
        WHERE id = %s AND status = 'queued'
        RETURNING id
        """,
        (run_id,),
    )
    result = await row.fetchone()
    return result is not None


async def update_run_terminal(
    conn: Connection,
    *,
    run_id: str,
    status: str,
    error_classification: str | None = None,
) -> None:
    await conn.execute(
        """
        UPDATE experiment_runs
        SET status = %s, finished_at = now(),
            error_classification = COALESCE(%s, error_classification)
        WHERE id = %s AND status IN ('queued', 'running')
        """,
        (status, error_classification, run_id),
    )


async def count_running_runs_for_user(conn: Connection, user_id: str) -> int:
    row = await conn.execute(
        """
        SELECT count(*) AS n
        FROM experiment_runs r
        WHERE r.initiated_by = %s AND r.status = 'running'
        """,
        (user_id,),
    )
    result = await row.fetchone()
    return int(result["n"])  # type: ignore[index]


async def get_run_by_idempotency_key(
    conn: Connection, idempotency_key: str
) -> dict[str, Any] | None:
    row = await conn.execute(
        "SELECT * FROM experiment_runs WHERE idempotency_key = %s",
        (idempotency_key,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def next_log_sequence(conn: Connection, run_id: str) -> int:
    row = await conn.execute(
        "SELECT COALESCE(max(sequence), -1) + 1 AS n FROM run_logs WHERE run_id = %s",
        (run_id,),
    )
    result = await row.fetchone()
    return int(result["n"])  # type: ignore[index]


async def append_run_log(
    conn: Connection,
    *,
    run_id: str,
    level: str,
    source: str | None,
    message: str,
) -> None:
    sequence = await next_log_sequence(conn, run_id)
    await conn.execute(
        """
        INSERT INTO run_logs (run_id, sequence, level, source, message)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (run_id, sequence, level, source, message),
    )


async def list_run_logs(
    conn: Connection,
    *,
    run_id: str,
    limit: int,
    cursor: str | None,
    level: str | None = None,
) -> tuple[list[LogLine], str | None, bool]:
    """Run logs paginate over (timestamp DESC, sequence DESC)."""
    clauses = ["rl.run_id = %s"]
    params: list[Any] = [run_id]
    if level:
        clauses.append("rl.level = %s")
        params.append(level)

    log_condition, cursor_params = _log_cursor_where(cursor)
    sql = f"""
        SELECT rl.* FROM run_logs rl
        WHERE {' AND '.join(clauses)} {log_condition}
        ORDER BY rl.timestamp DESC, rl.sequence DESC
        LIMIT %s
    """
    row = await conn.execute(sql, [*params, *cursor_params, limit + 1])
    logs = to_models(LogLine, await row.fetchall())
    has_more = len(logs) > limit
    page = logs[:limit]
    next_cursor = _log_cursor(page) if has_more and page else None
    return page, next_cursor, has_more


def _log_cursor_where(cursor: str | None) -> tuple[str, list[Any]]:
    if cursor is None:
        return "", []
    position = decode_cursor(cursor)
    if position is None:
        return "", []
    return (
        "((rl.timestamp < %s) OR (rl.timestamp = %s AND rl.sequence > %s))",
        [position.created_at, position.created_at, int(position.id)],
    )


def _log_cursor(page: list[LogLine]) -> str | None:
    last = page[-1]
    position = CursorPosition(created_at=last.timestamp, id=str(last.sequence))
    return encode_cursor(position)


async def create_artifact(
    conn: Connection,
    *,
    run_id: str,
    object_key: str,
    checksum: str,
    size_bytes: int,
    media_type: str,
    kind: str,
    metadata: dict[str, Any] | None,
) -> Artifact:
    row = await conn.execute(
        """
        INSERT INTO artifacts (run_id, object_key, checksum, size_bytes, media_type, kind, metadata)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (run_id, object_key, checksum, size_bytes, media_type, kind, to_jsonb(metadata or {})),
    )
    artifact = to_model(Artifact, await row.fetchone())
    assert artifact is not None
    return artifact


async def list_artifacts_for_run(
    conn: Connection,
    *,
    run_id: str,
    limit: int,
    cursor: str | None,
    kind: str | None = None,
) -> tuple[list[Artifact], str | None, bool]:
    clauses = ["a.run_id = %s"]
    params: list[Any] = [run_id]
    if kind:
        clauses.append("a.kind = %s")
        params.append(kind)

    condition, cursor_params = cursor_where(cursor, "a")
    sql = f"""
        SELECT a.* FROM artifacts a
        WHERE {' AND '.join(clauses)} {condition}
        ORDER BY a.created_at DESC, a.id ASC
        LIMIT %s
    """
    row = await conn.execute(sql, [*params, *cursor_params, limit + 1])
    artifacts = to_models(Artifact, await row.fetchall())
    return paginate(artifacts, limit)


async def count_artifacts_for_run(conn: Connection, run_id: str) -> int:
    row = await conn.execute(
        "SELECT count(*) AS n FROM artifacts WHERE run_id = %s",
        (run_id,),
    )
    result = await row.fetchone()
    return int(result["n"])  # type: ignore[index]


async def get_run_manifest_artifact(conn: Connection, run_id: str) -> dict[str, Any] | None:
    """The experiment manifest is stored as a manifest-kind artifact (FR-013)."""
    row = await conn.execute(
        "SELECT * FROM artifacts WHERE run_id = %s AND kind = 'manifest' ORDER BY created_at DESC LIMIT 1",
        (run_id,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


_ = Run, datetime
