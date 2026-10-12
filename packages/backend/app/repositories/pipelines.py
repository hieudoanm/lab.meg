"""Pipeline and pipeline version repositories."""

from __future__ import annotations

from app.db.pool import Connection
from app.repositories._shared import (
    clean,
    cursor_where,
    paginate,
    to_jsonb,
    to_model,
    to_models,
)
from app.schemas.pipelines import Pipeline, PipelineVersion


async def create_pipeline(
    conn: Connection,
    *,
    project_id: str,
    name: str,
    description: str | None,
    status: str = "draft",
) -> Pipeline:
    row = await conn.execute(
        """
        INSERT INTO pipelines (project_id, name, description, status)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (project_id, name, description, status),
    )
    pipeline = to_model(Pipeline, await row.fetchone())
    assert pipeline is not None
    return pipeline


async def get_pipeline_by_id(conn: Connection, pipeline_id: str) -> Pipeline | None:
    row = await conn.execute(
        """
        SELECT p.*,
               (SELECT pv.version FROM pipeline_versions pv
                WHERE pv.pipeline_id = p.id ORDER BY pv.created_at DESC LIMIT 1) AS latest_version
        FROM pipelines p WHERE p.id = %s
        """,
        (pipeline_id,),
    )
    return to_model(Pipeline, await row.fetchone())


async def list_pipelines_for_project(
    conn: Connection,
    *,
    project_id: str,
    limit: int,
    cursor: str | None,
) -> tuple[list[Pipeline], str | None, bool]:
    condition, params = cursor_where(cursor)
    sql = f"""
        SELECT p.*,
               (SELECT pv.version FROM pipeline_versions pv
                WHERE pv.pipeline_id = p.id ORDER BY pv.created_at DESC LIMIT 1) AS latest_version
        FROM pipelines p
        WHERE p.project_id = %s {condition}
        ORDER BY p.created_at DESC, p.id ASC
        LIMIT %s
    """
    row = await conn.execute(sql, [project_id, *params, limit + 1])
    pipelines = to_models(Pipeline, await row.fetchall())
    return paginate(pipelines, limit)


async def list_pipeline_versions(
    conn: Connection,
    *,
    pipeline_id: str,
    limit: int,
    cursor: str | None,
) -> tuple[list[PipelineVersion], str | None, bool]:
    condition, params = cursor_where(cursor)
    row = await conn.execute(
        f"""
        SELECT * FROM pipeline_versions
        WHERE pipeline_id = %s {condition}
        ORDER BY created_at DESC, id ASC
        LIMIT %s
        """,
        [pipeline_id, *params, limit + 1],
    )
    return paginate(to_models(PipelineVersion, await row.fetchall()), limit)


async def create_pipeline_version(
    conn: Connection,
    *,
    pipeline_id: str,
    version: str,
    definition: dict,
    image_digest: str,
    parameters_schema: dict,
    status: str,
) -> PipelineVersion:
    row = await conn.execute(
        """
        INSERT INTO pipeline_versions
            (pipeline_id, version, definition, image_digest, parameters_schema, status)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            pipeline_id,
            version,
            to_jsonb(definition),
            image_digest,
            to_jsonb(parameters_schema),
            status,
        ),
    )
    pipeline_version = to_model(PipelineVersion, await row.fetchone())
    assert pipeline_version is not None
    return pipeline_version


async def get_pipeline_version_by_id(conn: Connection, version_id: str) -> PipelineVersion | None:
    row = await conn.execute(
        "SELECT * FROM pipeline_versions WHERE id = %s",
        (version_id,),
    )
    return to_model(PipelineVersion, await row.fetchone())


async def get_pipeline_version_with_pipeline(conn: Connection, version_id: str) -> dict | None:
    row = await conn.execute(
        """
        SELECT pv.*, p.project_id, p.name AS pipeline_name
        FROM pipeline_versions pv
        JOIN pipelines p ON p.id = pv.pipeline_id
        WHERE pv.id = %s
        """,
        (version_id,),
    )
    result = await row.fetchone()
    return clean(result) if result else None


async def get_pipeline_version_by_label(
    conn: Connection, pipeline_id: str, version: str
) -> PipelineVersion | None:
    row = await conn.execute(
        "SELECT * FROM pipeline_versions WHERE pipeline_id = %s AND version = %s",
        (pipeline_id, version),
    )
    return to_model(PipelineVersion, await row.fetchone())


async def get_latest_pipeline_version(conn: Connection, pipeline_id: str) -> PipelineVersion | None:
    row = await conn.execute(
        """
        SELECT * FROM pipeline_versions
        WHERE pipeline_id = %s
        ORDER BY created_at DESC LIMIT 1
        """,
        (pipeline_id,),
    )
    return to_model(PipelineVersion, await row.fetchone())
