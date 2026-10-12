"""Dataset lifecycle: resumable upload sessions and versioned finalisation."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import (
    ConflictError,
    PayloadTooLargeError,
    UnprocessableError,
)
from app.db.pool import Connection
from app.repositories import datasets as dataset_repo
from app.repositories import shared as shared_repo
from app.schemas.datasets import (
    Dataset,
    DatasetCompleteRequest,
    DatasetCreate,
    DatasetVersion,
    UploadSession,
)
from app.scientific.formats import default_acquisition_system, validate_file_set
from app.services.idempotency import (
    IdempotentResponse,
    check,
    record,
    require_idempotency_key,
)
from app.services.tenancy import require_project_access
from app.storage.base import StorageBackend


async def create_dataset(
    conn: Connection,
    storage: StorageBackend,
    *,
    project_id: str,
    user_id: str,
    request: DatasetCreate,
    idempotency_key: str | None,
) -> IdempotentResponse:
    key = require_idempotency_key(idempotency_key)
    payload = {
        "name": request.name,
        "source_type": request.source_type,
        "recording_format": request.recording_format,
        "acquisition_system": request.acquisition_system,
        "files": [f.model_dump(mode="json") for f in request.files],
    }
    async with conn.transaction():
        await require_project_access(conn=conn, project_id=project_id, user_id=user_id, write=True)
        replay = await check(conn, key, user_id, payload)
        if replay is not None:
            return replay

        findings = validate_file_set(request.recording_format, request.files)
        if findings:
            raise UnprocessableError(
                "declared file set is incomplete or invalid",
                code="dataset_file_set_invalid",
                details=[{"message": f} for f in findings],
            )
        for declaration in request.files:
            if declaration.size_bytes > get_settings().max_upload_bytes:
                raise PayloadTooLargeError(
                    f"declared file '{declaration.name}' exceeds the upload limit",
                    code="upload_too_large",
                )

        acquisition_system = request.acquisition_system or default_acquisition_system(
            request.recording_format
        )

        if request.source_type == "sample":
            dataset = await dataset_repo.create_dataset(
                conn,
                project_id=project_id,
                name=request.name,
                source_type="sample",
                status="validating",
            )
            version_label = await dataset_repo.next_version_label(conn, dataset.id)
            manifest = {
                "source_type": "sample",
                "format": request.recording_format,
                "acquisition_system": acquisition_system,
                "name": request.name,
            }
            version = await dataset_repo.create_dataset_version(
                conn,
                dataset_id=dataset.id,
                version=version_label,
                manifest=manifest,
                status="validating",
                checksum=None,
            )
            await shared_repo.enqueue_outbox(
                conn,
                topic="dataset.validate",
                payload={"dataset_version_id": version.id, "sample": True},
            )
            session = await _completed_sample_session(conn, dataset.id, project_id)
            response = IdempotentResponse(
                status_code=201,
                body={
                    "dataset": dataset.model_dump(mode="json"),
                    "upload_session": session.model_dump(mode="json"),
                },
            )
        else:
            dataset = await dataset_repo.create_dataset(
                conn,
                project_id=project_id,
                name=request.name,
                source_type=request.source_type,
                status="uploading",
            )
            session = await _create_upload_session(
                conn,
                storage,
                dataset=dataset,
                project_id=project_id,
                files=request.files,
                declared_format=request.recording_format,
                acquisition_system=acquisition_system,
            )
            response = IdempotentResponse(
                status_code=201,
                body={
                    "dataset": dataset.model_dump(mode="json"),
                    "upload_session": session.model_dump(mode="json"),
                },
            )

        await record(conn, key=key, user_id=user_id, payload=payload, response=response)
        return response


async def _create_upload_session(
    conn: Connection,
    storage: StorageBackend,
    *,
    dataset: Dataset,
    project_id: str,
    files: list[Any],
    declared_format: str,
    acquisition_system: str,
) -> UploadSession:
    settings = get_settings()
    expected_total = sum(f.size_bytes for f in files)
    session = await dataset_repo.create_upload_session(
        conn,
        dataset_id=dataset.id,
        project_id=project_id,
        expected_size_bytes=expected_total,
        checksum_sha256=None,
        expires_at=datetime.now(UTC) + timedelta(seconds=settings.upload_session_ttl_seconds),
        declared_format=declared_format,
        acquisition_system=acquisition_system,
    )
    targets = []
    for declaration in files:
        object_key = (
            f"projects/{project_id}/datasets/{dataset.id}/uploads/{session.id}/{declaration.name}"
        )
        await dataset_repo.add_upload_target(
            conn,
            upload_session_id=session.id,
            name=declaration.name,
            object_key=object_key,
            size_bytes=declaration.size_bytes,
            checksum_sha256=declaration.checksum_sha256,
            media_type=declaration.media_type,
            role=declaration.role,
        )
        presigned = await storage.presign_put(
            object_key,
            size_bytes=declaration.size_bytes,
            checksum_sha256=declaration.checksum_sha256,
            media_type=declaration.media_type,
        )
        targets.append(
            {
                "name": declaration.name,
                "object_key": object_key,
                "upload_url": presigned.url,
                "method": presigned.method,
                "headers": presigned.headers,
                "expires_at": presigned.expires_at,
            }
        )
    return UploadSession.model_validate(
        {
            **session.model_dump(mode="json"),
            "files": targets,
        }
    )


async def _completed_sample_session(
    conn: Connection, dataset_id: str, project_id: str
) -> UploadSession:
    session = await dataset_repo.create_upload_session(
        conn,
        dataset_id=dataset_id,
        project_id=project_id,
        expected_size_bytes=0,
        checksum_sha256=None,
        expires_at=datetime.now(UTC),
    )
    await dataset_repo.mark_upload_session_completed(conn, session.id)
    stored = await dataset_repo.get_upload_session(conn, session.id)
    assert stored is not None
    return UploadSession.model_validate({**stored.model_dump(mode="json"), "files": []})


async def complete_dataset(
    conn: Connection,
    storage: StorageBackend,
    *,
    dataset_id: str,
    user_id: str,
    request: DatasetCompleteRequest,
    idempotency_key: str | None,
) -> IdempotentResponse:
    key = require_idempotency_key(idempotency_key)
    payload = {"files": [f.model_dump(mode="json") for f in request.files]}
    async with conn.transaction():
        dataset = await dataset_repo.get_dataset_by_id(conn, dataset_id)
        if dataset is None:
            from app.core.exceptions import NotFoundError

            raise NotFoundError("dataset not found")
        await require_project_access(
            conn=conn, project_id=dataset.project_id, user_id=user_id, write=True
        )

        replay = await check(conn, key, user_id, payload)
        if replay is not None:
            return replay

        if dataset.status != "uploading":
            raise ConflictError(
                "dataset upload session is no longer active",
                code="dataset_state_conflict",
            )

        session_row = await dataset_repo.get_active_upload_session_row(conn, dataset.id)
        if session_row is None:
            raise ConflictError(
                "no active upload session for this dataset",
                code="upload_session_expired",
            )
        session_id = session_row["id"]
        declared_format = session_row.get("declared_format") or "fif"
        targets = await dataset_repo.list_upload_targets(conn, session_id)
        target_by_name = {target.name: target for target in targets}

        findings = validate_file_set(declared_format, request.files)
        if findings:
            raise UnprocessableError(
                "final declared file set is incomplete or invalid",
                code="dataset_file_set_invalid",
                details=[{"message": f} for f in findings],
            )

        for declaration in request.files:
            target = target_by_name.get(declaration.name)
            if target is None:
                raise UnprocessableError(
                    f"'{declaration.name}' was not declared in the upload session",
                    code="upload_object_undeclared",
                )
            await _verify_uploaded_object(storage, declaration, target.object_key)

        version_label = await dataset_repo.next_version_label(conn, dataset.id)
        manifest = {
            "format": declared_format,
            "acquisition_system": session_row.get("acquisition_system"),
            "files": [f.model_dump(mode="json") for f in request.files],
        }
        version = await dataset_repo.create_dataset_version(
            conn,
            dataset_id=dataset.id,
            version=version_label,
            manifest=manifest,
            status="validating",
            checksum=None,
        )
        await dataset_repo.update_dataset_status(conn, dataset.id, "validating")
        await dataset_repo.mark_upload_session_completed(conn, session_id)
        await shared_repo.enqueue_outbox(
            conn,
            topic="dataset.validate",
            payload={"dataset_version_id": version.id},
        )

        response = IdempotentResponse(
            status_code=202,
            body=version.model_dump(mode="json"),
        )
        await record(conn, key=key, user_id=user_id, payload=payload, response=response)
        return response


async def _verify_uploaded_object(
    storage: StorageBackend, declaration: Any, object_key: str
) -> None:
    """Every declared object must exist with matching size and checksum."""
    info = await storage.head_object(object_key)
    if info is None:
        raise UnprocessableError(
            f"uploaded object for '{declaration.name}' is missing",
            code="upload_object_missing",
        )
    if info.size_bytes != declaration.size_bytes:
        raise UnprocessableError(
            f"size mismatch for '{declaration.name}': declared {declaration.size_bytes}, "
            f"stored {info.size_bytes}",
            code="upload_size_mismatch",
        )
    if declaration.checksum_sha256 and info.checksum_sha256:
        stored = info.checksum_sha256
        if not stored.startswith("sha256:"):
            stored = f"sha256:{stored}"
        if stored.lower() != declaration.checksum_sha256.lower():
            raise UnprocessableError(
                f"checksum mismatch for '{declaration.name}'",
                code="upload_checksum_mismatch",
            )


async def get_dataset(
    conn: Connection,
    *,
    dataset_id: str,
    user_id: str,
    share_token: str | None,
) -> Dataset:
    dataset = await dataset_repo.get_dataset_by_id(conn, dataset_id)
    if dataset is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("dataset not found")
    await require_project_access(
        conn=conn,
        project_id=dataset.project_id,
        user_id=user_id,
        share_token=share_token,
    )
    return dataset


async def list_datasets_for_user(
    conn: Connection,
    *,
    user_id: str,
    limit: int,
    cursor: str | None,
) -> tuple[list[Dataset], str | None, bool]:
    return await dataset_repo.list_datasets_for_user(
        conn, user_id=user_id, limit=limit, cursor=cursor
    )


async def get_dataset_version(
    conn: Connection,
    *,
    version_id: str,
    user_id: str,
    share_token: str | None,
) -> DatasetVersion:
    version = await dataset_repo.get_dataset_version_by_id(conn, version_id)
    if version is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("dataset version not found")
    dataset = await dataset_repo.get_dataset_by_id(conn, version.dataset_id)
    if dataset is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("dataset not found")
    await require_project_access(
        conn=conn,
        project_id=dataset.project_id,
        user_id=user_id,
        share_token=share_token,
    )
    return version
