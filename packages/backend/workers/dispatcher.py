"""Transactional-outbox dispatcher.

Claims pending outbox events (``FOR UPDATE SKIP LOCKED``),
publishes them to Celery, and marks them published. Delivery is
at-least-once; consumers are idempotent, so redelivery after a
crash can never corrupt state (NFR-012).
"""

from __future__ import annotations

import asyncio
import logging
import signal
from typing import Any

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.migrate import run_migrations
from app.db.pool import close_pool, get_connection, get_pool, init_pool
from app.repositories import shared as shared_repo
from workers.celery_app import celery_app

logger = logging.getLogger(__name__)

TOPIC_ROUTING = {
    "dataset.validate": "workers.tasks.validate_dataset",
    "run.dispatch": "workers.tasks.execute_run",
}

_running = True


def _stop(*args: Any) -> None:
    global _running
    _running = False


async def dispatch_once() -> int:
    dispatched = 0
    async with get_connection() as conn:
        events = await shared_repo.claim_outbox_events(conn, limit=10)
        for event in events:
            topic = event["topic"]
            payload = event["payload"] or {}
            task_name = TOPIC_ROUTING.get(topic)
            if task_name is None:
                logger.warning("unknown outbox topic: %s", topic)
                await shared_repo.mark_outbox_failed(conn, event["id"])
                continue
            try:
                task = celery_app.tasks[task_name]
                if topic == "dataset.validate" and payload.get("sample"):
                    task = celery_app.tasks["workers.tasks.validate_sample_dataset"]
                task.delay(
                    **{k: v for k, v in payload.items() if k in ("dataset_version_id", "run_id")}
                )
                await shared_repo.mark_outbox_published(conn, event["id"])
                dispatched += 1
            except Exception:  # noqa: BLE001 - transient broker failure
                logger.exception("failed to dispatch outbox event %s", event["id"])
                await shared_repo.mark_outbox_failed(conn, event["id"])
    return dispatched


async def main_loop() -> None:
    configure_logging()
    settings = get_settings()
    await init_pool(settings)
    pool = get_pool()
    async with pool.connection() as conn:
        await run_migrations(conn)

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)

    logger.info("dispatcher started")
    while _running:
        try:
            await dispatch_once()
        except Exception:  # noqa: BLE001 - dispatcher must never die
            logger.exception("dispatch cycle failed")
        await asyncio.sleep(1.0)
    await close_pool()
    logger.info("dispatcher stopped")


def main() -> None:
    asyncio.run(main_loop())


if __name__ == "__main__":
    main()
