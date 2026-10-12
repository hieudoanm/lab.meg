"""Storage backend factory."""

from __future__ import annotations

from app.core.config import Settings
from app.storage.base import PresignedUrl
from app.storage.local import FileStorage
from app.storage.s3 import S3Storage


def create_storage(settings: Settings) -> FileStorage | S3Storage:
    if settings.storage_backend == "s3":
        return S3Storage(settings)
    return FileStorage(settings)


__all__ = ["create_storage", "FileStorage", "S3Storage", "PresignedUrl"]
