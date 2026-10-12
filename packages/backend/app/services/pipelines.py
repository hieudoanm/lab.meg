"""Pipeline and pipeline version services."""

from __future__ import annotations

from app.core.exceptions import ConflictError, NotFoundError, UnprocessableError
from app.db.pool import Connection
from app.repositories import pipelines as pipeline_repo
from app.schemas.pipelines import Pipeline, PipelineCreate, PipelineVersion, PipelineVersionCreate
from app.services.tenancy import require_project_access


async def create_pipeline(conn: Connection, *, user_id: str, request: PipelineCreate) -> Pipeline:
    await require_project_access(
        conn=conn, project_id=request.project_id, user_id=user_id, write=True
    )
    pipeline = await pipeline_repo.create_pipeline(
        conn,
        project_id=request.project_id,
        name=request.name,
        description=request.description,
    )
    return pipeline


async def list_pipelines(
    conn: Connection, *, project_id: str, user_id: str, limit: int, cursor: str | None
) -> tuple[list[Pipeline], str | None, bool]:
    await require_project_access(conn=conn, project_id=project_id, user_id=user_id)
    return await pipeline_repo.list_pipelines_for_project(
        conn, project_id=project_id, limit=limit, cursor=cursor
    )


async def create_pipeline_version(
    conn: Connection,
    *,
    pipeline_id: str,
    user_id: str,
    request: PipelineVersionCreate,
) -> PipelineVersion:
    pipeline = await pipeline_repo.get_pipeline_by_id(conn, pipeline_id)
    if pipeline is None:
        raise NotFoundError("pipeline not found")
    await require_project_access(
        conn=conn, project_id=pipeline.project_id, user_id=user_id, write=True
    )

    existing = await pipeline_repo.get_pipeline_version_by_label(conn, pipeline_id, request.version)
    if existing is not None:
        raise ConflictError(
            f"pipeline version {request.version} already exists",
            code="pipeline_version_conflict",
        )

    definition = request.definition or {}
    nodes = definition.get("nodes") or definition.get("steps")
    if not isinstance(nodes, list) or not nodes:
        raise UnprocessableError(
            "pipeline definition must contain a non-empty 'nodes' or 'steps' list",
            code="pipeline_definition_invalid",
        )

    parameters_schema = request.parameters_schema or {"type": "object"}
    if not isinstance(parameters_schema, dict):
        raise UnprocessableError(
            "parameters_schema must be a JSON Schema object",
            code="parameters_schema_invalid",
        )

    return await pipeline_repo.create_pipeline_version(
        conn,
        pipeline_id=pipeline_id,
        version=request.version,
        definition=definition,
        image_digest=request.image_digest,
        parameters_schema=parameters_schema,
        status=request.status,
    )
