"""Worker tasks: dataset validation and pipeline execution.

Both tasks are idempotent consumers of at-least-once delivery:
state transitions are atomic conditional updates, so a redelivered
message can never corrupt state or duplicate billable work.
"""

from __future__ import annotations

import json
import logging
import shutil
import tempfile
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import ApiError
from app.core.logging import configure_logging
from app.db.migrate import run_migrations
from app.db.pool import Connection, close_pool, get_connection, get_pool, init_pool
from app.repositories import datasets as dataset_repo
from app.repositories import recordings as recording_repo
from app.repositories import runs as run_repo
from app.repositories import shared as shared_repo
from app.scientific.adapters import open_adapter
from app.scientific.pipeline import (
    PipelineExecutionError,
    execute_definition,
)
from app.scientific.sample import build_sample_metadata, build_sample_raw, save_sample_fif
from app.storage.factory import create_storage
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def _bootstrap() -> None:
    """Worker process bootstrap: logging, pool, migrations."""
    configure_logging()
    settings = get_settings()
    import asyncio

    asyncio.run(_async_bootstrap(settings))


async def _async_bootstrap(settings: Any) -> None:
    await init_pool(settings)
    pool = get_pool()
    async with pool.connection() as conn:
        await run_migrations(conn)
    storage = create_storage(settings)
    await storage.ensure_bucket()


def _storage():
    return create_storage(get_settings())


def _sha256_of_payloads(payloads: list[tuple[str, bytes]]) -> str:
    import hashlib

    digest = hashlib.sha256()
    for object_key, _ in sorted(payloads):
        digest.update(object_key.encode())
    return f"sha256:{digest.hexdigest()}"


async def _validate_dataset(version_id: str, sample: bool) -> None:
    settings = get_settings()
    storage = _storage()
    async with get_connection() as conn, conn.transaction():
        version = await dataset_repo.get_dataset_version_by_id(conn, version_id)
        if version is None:
            raise RuntimeError(f"dataset version not found: {version_id}")
        if version.status != "validating":
            # Already validated by a previous delivery.
            return
        dataset = await dataset_repo.get_dataset_by_id(conn, version.dataset_id)
        assert dataset is not None

        if sample:
            await _generate_sample(conn, storage, dataset, version)
            return

        manifest = version.manifest or {}
        files: list[dict[str, Any]] = manifest.get("files", [])
        recording_format = manifest.get("format", "fif")
        acquisition_system = manifest.get("acquisition_system") or "squid"

        workdir = Path(tempfile.mkdtemp(prefix="meglab-validate-"))
        try:
            payloads: list[tuple[str, bytes]] = []
            for declaration in files:
                object_key = declaration.get("object_key")
                if object_key is None:
                    raise PipelineExecutionError(
                        f"manifest entry '{declaration.get('name')}' has no object key",
                        "invalid_input",
                    )
                payload = await storage.get_object(object_key)
                payloads.append((object_key, payload))
                target = workdir / declaration["name"]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(payload)

            adapter = open_adapter(recording_format, workdir, acquisition_system, storage, files)
            try:
                meta = adapter.metadata()
            finally:
                adapter.close()

            if meta.duration_s > settings.max_recording_duration_s:
                raise PipelineExecutionError(
                    f"recording duration {meta.duration_s}s exceeds the limit",
                    "invalid_input",
                )
            if meta.n_channels > settings.max_channel_count:
                raise PipelineExecutionError(
                    f"channel count {meta.n_channels} exceeds the limit",
                    "invalid_input",
                )

            recording = await recording_repo.create_recording(
                conn, meta, dataset_version_id=version_id
            )
            await recording_repo.create_channels(conn, recording.id, meta.channels)
            if meta.sensor_config is not None:
                await recording_repo.create_sensor_configuration(
                    conn, recording.id, meta.sensor_config
                )
            for event_set in meta.event_sets:
                created = await recording_repo.create_event_set(conn, recording.id, event_set)
                await recording_repo.store_event_payload(
                    conn,
                    created.id,
                    [
                        {
                            "sample": event.sample,
                            "time_s": event.time_s,
                            "code": event.code,
                            "value": event.value,
                            "description": event.description,
                        }
                        for event in event_set.events
                    ],
                )
            checksums = {key: _payload_checksum(payloads, key) for key, _ in payloads}
            sizes = {key: len(payload) for key, payload in payloads}
            for object_key, _payload in payloads:
                await dataset_repo.create_file_asset(
                    conn,
                    recording_id=recording.id,
                    object_key=object_key,
                    checksum=checksums[object_key],
                    size_bytes=sizes[object_key],
                    media_type="application/octet-stream",
                    role="recording",
                )

            checksum = _sha256_of_payloads(payloads)
            await dataset_repo.update_dataset_version_status(conn, version_id, "ready", checksum)
            await dataset_repo.update_dataset_status(conn, dataset.id, "ready")
            await shared_repo.create_audit_event(
                conn,
                actor_id=None,
                action="dataset.version_ready",
                resource_type="dataset_version",
                resource_id=version_id,
            )
        finally:
            shutil.rmtree(workdir, ignore_errors=True)


def _payload_checksum(payloads: list[tuple[str, bytes]], object_key: str) -> str:
    import hashlib

    for key, payload in payloads:
        if key == object_key:
            return f"sha256:{hashlib.sha256(payload).hexdigest()}"
    return "sha256:" + "0" * 64


def _object_key_for_file(
    conn: Connection, dataset: Any, version: Any, declaration: dict[str, Any]
) -> str:
    return (
        f"projects/{dataset.project_id}/datasets/{dataset.id}"
        f"/uploads/{version.id}/{declaration['name']}"
    )


async def _generate_sample(conn: Connection, storage: Any, dataset: Any, version: Any) -> None:
    raw = build_sample_raw()
    meta = build_sample_metadata(raw)
    sample_dir = Path(tempfile.mkdtemp(prefix="meglab-sample-"))
    try:
        sample_file = sample_dir / "sample_recording.fif"
        save_sample_fif(raw, sample_file)
        payload = sample_file.read_bytes()
        object_key = f"projects/{dataset.project_id}/datasets/{dataset.id}/samples/{version.id}/sample_recording.fif"
        await storage.upload_bytes(object_key, payload)

        recording = await recording_repo.create_recording(conn, meta, dataset_version_id=version.id)
        await recording_repo.create_channels(conn, recording.id, meta.channels)
        if meta.sensor_config is not None:
            await recording_repo.create_sensor_configuration(conn, recording.id, meta.sensor_config)
        for event_set in meta.event_sets:
            created = await recording_repo.create_event_set(conn, recording.id, event_set)
            await recording_repo.store_event_payload(
                conn,
                created.id,
                [
                    {
                        "sample": event.sample,
                        "time_s": event.time_s,
                        "code": event.code,
                        "value": event.value,
                        "description": event.description,
                    }
                    for event in event_set.events
                ],
            )
        import hashlib

        checksum = f"sha256:{hashlib.sha256(payload).hexdigest()}"
        await dataset_repo.create_file_asset(
            conn,
            recording_id=recording.id,
            object_key=object_key,
            checksum=checksum,
            size_bytes=len(payload),
            media_type="application/octet-stream",
            role="recording",
        )
        await dataset_repo.update_dataset_version_status(conn, version.id, "ready", checksum)
        await dataset_repo.update_dataset_status(conn, dataset.id, "ready")
        await shared_repo.create_audit_event(
            conn,
            actor_id=None,
            action="dataset.version_ready",
            resource_type="dataset_version",
            resource_id=version.id,
        )
    finally:
        shutil.rmtree(sample_dir, ignore_errors=True)


async def _execute_run(run_id: str) -> None:
    storage = _storage()
    async with get_connection() as conn:
        # Atomic claim: only one consumer transitions queued -> running.
        claimed = await run_repo.claim_queued_run(conn, run_id)
        if not claimed:
            return

        row = await run_repo.get_run_row(conn, run_id)
        if row is None:
            return
        await run_repo.append_run_log(
            conn,
            run_id=run_id,
            level="info",
            source="init",
            message=f"[init] loading dataset version {row['dataset_version_id']}",
        )

        dataset_version = await dataset_repo.get_dataset_version_by_id(
            conn, row["dataset_version_id"]
        )
        assert dataset_version is not None
        recordings_list = await recording_repo.list_recordings_for_dataset_version(
            conn, row["dataset_version_id"]
        )
        if not recordings_list:
            await _fail_run(conn, run_id, "dataset version contains no recordings", "invalid_input")
            return
        recording = recordings_list[0]

        assets = await dataset_repo.list_file_assets(conn, recording.id)
        workdir = Path(tempfile.mkdtemp(prefix="meglab-run-"))
        try:
            payloads = []
            for asset in assets:
                payload = await storage.get_object(asset["object_key"])
                payloads.append((asset["object_key"], payload))
                target = workdir / Path(asset["object_key"]).name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(payload)

            from app.scientific.adapters import open_adapter as _open

            adapter = _open(
                recording.format, workdir, recording.acquisition_system, storage, assets
            )
            try:
                meta = adapter.metadata()
                artifacts = execute_definition(row["pipeline_definition"], adapter, meta)
            finally:
                adapter.close()
        except PipelineExecutionError as exc:
            await _fail_run(conn, run_id, str(exc), exc.classification)
            shutil.rmtree(workdir, ignore_errors=True)
            return
        except Exception:  # noqa: BLE001 - sanitised failure classification
            await _fail_run(conn, run_id, "pipeline execution failed", "internal_error")
            logger.exception("run %s failed", run_id)
            shutil.rmtree(workdir, ignore_errors=True)
            return
        finally:
            pass

        environment = {
            "python_version": __import__("platform").python_version(),
            "mne_version": __import__("mne").__version__,
        }
        outputs = []
        for artifact in artifacts:
            object_key = f"runs/{run_id}/{artifact.name}"
            payload = artifact.payload
            payload_bytes = payload.encode() if isinstance(payload, str) else payload
            await storage.upload_bytes(object_key, payload_bytes)
            await run_repo.create_artifact(
                conn,
                run_id=run_id,
                object_key=object_key,
                checksum=_payload_checksum([(object_key, payload_bytes)], object_key),
                size_bytes=len(payload_bytes),
                media_type=artifact.media_type,
                kind=artifact.kind,
                metadata=artifact.metadata or {},
            )
            outputs.append({"name": artifact.name, "object_key": object_key})
            await run_repo.append_run_log(
                conn,
                run_id=run_id,
                level="info",
                source="exec",
                message=f"[exec] produced artifact {artifact.name}",
            )

        # Reproducibility manifest (FR-013), stored as a manifest artifact.
        manifest = {
            "schema_version": "1.0",
            "run_id": run_id,
            "inputs": [
                {
                    "dataset_version_id": row["dataset_version_id"],
                    "checksum": dataset_version.checksum,
                }
            ],
            "pipeline": {
                "name": row["pipeline_name"],
                "version": row.get("version") or "",
                "image_digest": row["image_digest"],
            },
            "parameters": row.get("parameters") or {},
            "environment": environment,
            "sensor_configuration_id": row.get("sensor_configuration_id"),
            "outputs": outputs,
            "status": "succeeded",
        }
        manifest_json = json.dumps(manifest, default=str)
        manifest_key = f"runs/{run_id}/manifest.json"
        await storage.upload_bytes(manifest_key, manifest_json.encode())
        await run_repo.create_artifact(
            conn,
            run_id=run_id,
            object_key=manifest_key,
            checksum=_payload_checksum([(manifest_key, manifest_json.encode())], manifest_key),
            size_bytes=len(manifest_json.encode()),
            media_type="application/json",
            kind="manifest",
            metadata=manifest,
        )

        await run_repo.update_run_terminal(conn, run_id=run_id, status="succeeded")
        await run_repo.append_run_log(
            conn,
            run_id=run_id,
            level="info",
            source="exec",
            message=f"[exec] run completed with {len(outputs)} artifacts",
        )
        await shared_repo.record_usage(
            conn,
            user_id=row["initiated_by"],
            run_id=run_id,
            resource_type="core_hours",
            quantity=1,
        )
        await shared_repo.record_usage(
            conn,
            user_id=row["initiated_by"],
            run_id=run_id,
            resource_type="storage_bytes",
            quantity=sum(len(p) for _, p in payloads),
        )
        shutil.rmtree(workdir, ignore_errors=True)


async def _fail_run(conn: Connection, run_id: str, message: str, classification: str) -> None:
    await run_repo.update_run_terminal(
        conn, run_id=run_id, status="failed", error_classification=classification
    )
    await run_repo.append_run_log(
        conn,
        run_id=run_id,
        level="error",
        source="exec",
        message=f"[exec] failed: {message}",
    )


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def validate_dataset(self, dataset_version_id: str) -> dict[str, Any]:  # noqa: ARG001
    import asyncio

    return asyncio.run(_run_with_bootstrap(_validate_dataset, dataset_version_id, False))


@celery_app.task(bind=True, max_retries=3, default_retry_delay=5)
def validate_sample_dataset(self, dataset_version_id: str) -> dict[str, Any]:  # noqa: ARG001
    import asyncio

    return asyncio.run(_run_with_bootstrap(_validate_dataset, dataset_version_id, True))


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def execute_run(self, run_id: str) -> dict[str, Any]:  # noqa: ARG001
    import asyncio

    return asyncio.run(_run_with_bootstrap(_execute_run, run_id))


async def _run_with_bootstrap(coro_fn, *args: Any) -> dict[str, Any]:
    try:
        _bootstrap()
        await coro_fn(*args)
        return {"status": "ok"}
    except ApiError as exc:
        logger.error("task failed with API error: %s", exc.message)
        return {"status": "failed", "code": exc.code}
    finally:
        await close_pool()
