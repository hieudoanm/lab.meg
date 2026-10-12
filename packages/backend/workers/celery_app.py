"""Celery application shared by the API and worker processes."""

from __future__ import annotations

from celery import Celery

from app.core.config import get_settings

celery_app = Celery(
    "meg-lab",
    broker=get_settings().celery_broker_url or get_settings().redis_url,
    backend=None,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    task_track_started=True,
)

# Consumers are idempotent: at-least-once delivery must never
# corrupt state (NFR-012). Terminal run states and dataset
# version states are guarded by atomic conditional updates.
celery_app.autodiscover_tasks(["workers"], force=True)
