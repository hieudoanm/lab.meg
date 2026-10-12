"""Local filesystem storage backend for development and tests.

Presigned URLs are HMAC-signed, single-object, short-lived internal
URLs served by ``/internal/storage/{key}``. The signature covers the
method, object key, and expiry, so a URL cannot be replayed for a
different object or method.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import shutil
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from app.core.config import Settings
from app.storage.base import ObjectInfo, PresignedUrl


class FileStorage:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._root = Path(settings.storage_data_dir).resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, object_key: str) -> Path:
        candidate = (self._root / object_key).resolve()
        if not str(candidate).startswith(str(self._root) + os.sep):
            raise ValueError("object key escapes storage root")
        return candidate

    async def ensure_bucket(self) -> None:
        self._root.mkdir(parents=True, exist_ok=True)

    async def head_object(self, object_key: str) -> ObjectInfo | None:
        path = self._path(object_key)
        if not path.is_file():
            return None
        return ObjectInfo(
            object_key=object_key,
            size_bytes=path.stat().st_size,
            checksum_sha256=await _to_thread(_file_sha256, path),
            media_type=None,
        )

    async def upload_bytes(
        self, object_key: str, data: bytes, *, checksum_sha256: str | None = None
    ) -> None:
        path = self._path(object_key)
        await _to_thread(_write, path, data)

    async def get_object(self, object_key: str) -> bytes:
        return await _to_thread(self._path(object_key).read_bytes)

    async def delete_object(self, object_key: str) -> None:
        path = self._path(object_key)
        await _to_thread(lambda p: p.unlink(missing_ok=True), path)

    async def presign_put(
        self,
        object_key: str,
        *,
        size_bytes: int,  # noqa: ARG002
        checksum_sha256: str | None,
        media_type: str | None,
    ) -> PresignedUrl:
        return self._presign(
            object_key, "PUT", checksum_sha256=checksum_sha256, media_type=media_type
        )

    async def presign_get(self, object_key: str) -> PresignedUrl:
        return self._presign(object_key, "GET")

    def _presign(
        self,
        object_key: str,
        method: str,
        *,
        checksum_sha256: str | None = None,
        media_type: str | None = None,
    ) -> PresignedUrl:
        expires_at = datetime.now(UTC) + timedelta(seconds=self._settings.s3_signed_url_ttl_seconds)
        expires = int(expires_at.timestamp())
        signature = _sign(
            self._settings.session_secret,
            method,
            object_key,
            expires,
            checksum_sha256 or "",
            media_type or "",
        )
        query = f"method={method}&expires={expires}&sig={signature}"
        if checksum_sha256:
            query += f"&checksum={quote(checksum_sha256, safe='')}"
        if media_type:
            query += f"&media_type={quote(media_type, safe='')}"
        url = f"{self._settings.public_base_url}/internal/storage/{quote(object_key, safe='/')}?{query}"
        return PresignedUrl(
            url=url,
            method=method,
            expires_at=expires_at,
            headers={"x-amz-checksum-sha256": checksum_sha256} if checksum_sha256 else None,
        )


def _sign(
    secret: str, method: str, object_key: str, expires: int, checksum: str, media_type: str
) -> str:
    message = "\n".join((method, object_key, str(expires), checksum, media_type)).encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify_signature(
    settings: Settings,
    method: str,
    object_key: str,
    expires: int,
    checksum: str,
    media_type: str,
    signature: str,
) -> bool:
    if expires <= int(time.time()):
        return False
    expected = _sign(settings.session_secret, method, object_key, expires, checksum, media_type)
    return hmac.compare_digest(expected, signature)


def _file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return f"sha256:{h.hexdigest()}"


def _write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_bytes(data)
    shutil.move(str(tmp), str(path))


def _to_thread(fn, *args: object, **kwargs: object):
    import asyncio

    return asyncio.to_thread(fn, *args, **kwargs)
