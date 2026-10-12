"""S3-compatible storage backend (MinIO in development, S3 in production).

Upload integrity: presigned PUTs carry a ``x-amz-checksum-sha256``
constraint so the storage service itself rejects corrupted or tampered
uploads; finalisation re-verifies existence, size, and checksum.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import boto3
from botocore.config import Config

from app.core.config import Settings
from app.storage.base import ObjectInfo, PresignedUrl


class S3Storage:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
            config=Config(s3={"addressing_style": "path"}, max_pool_connections=8),
        )

    async def ensure_bucket(self) -> None:
        await _to_thread(self._client.head_bucket, Bucket=self._settings.s3_bucket)

    async def head_object(self, object_key: str) -> ObjectInfo | None:
        try:
            resp: dict[str, Any] = await _to_thread(
                self._client.head_object, Bucket=self._settings.s3_bucket, Key=object_key
            )
        except self._client.exceptions.ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey"):
                return None
            raise
        return ObjectInfo(
            object_key=object_key,
            size_bytes=int(resp.get("ContentLength", 0)),
            checksum_sha256=resp.get("ChecksumSHA256"),
            media_type=resp.get("ContentType"),
        )

    async def upload_bytes(
        self, object_key: str, data: bytes, *, checksum_sha256: str | None = None
    ) -> None:
        kwargs: dict[str, Any] = {
            "Bucket": self._settings.s3_bucket,
            "Key": object_key,
            "Body": data,
        }
        if checksum_sha256:
            kwargs["ChecksumSHA256"] = checksum_sha256
        await _to_thread(self._client.put_object, **kwargs)

    async def get_object(self, object_key: str) -> bytes:
        resp = await _to_thread(
            self._client.get_object, Bucket=self._settings.s3_bucket, Key=object_key
        )
        return resp["Body"].read()

    async def delete_object(self, object_key: str) -> None:
        await _to_thread(
            self._client.delete_object, Bucket=self._settings.s3_bucket, Key=object_key
        )

    async def presign_put(
        self,
        object_key: str,
        *,
        size_bytes: int,  # noqa: ARG002 - declared size is recorded in the upload session
        checksum_sha256: str | None,
        media_type: str | None,
    ) -> PresignedUrl:
        params: dict[str, Any] = {"Bucket": self._settings.s3_bucket, "Key": object_key}
        headers: dict[str, str] = {}
        if checksum_sha256:
            params["ChecksumSHA256"] = checksum_sha256
            headers["x-amz-checksum-sha256"] = checksum_sha256
        if media_type:
            params["ContentType"] = media_type
            headers["Content-Type"] = media_type
        url = self._client.generate_presigned_url(
            "put_object", Params=params, ExpiresIn=self._settings.s3_signed_url_ttl_seconds
        )
        return PresignedUrl(
            url=url,
            method="PUT",
            expires_at=_expires(self._settings),
            headers=headers or None,
        )

    async def presign_get(self, object_key: str) -> PresignedUrl:
        url = self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._settings.s3_bucket, "Key": object_key},
            ExpiresIn=self._settings.s3_signed_url_ttl_seconds,
        )
        return PresignedUrl(url=url, method="GET", expires_at=_expires(self._settings))


def _expires(settings: Settings) -> datetime:
    return datetime.now(UTC) + timedelta(seconds=settings.s3_signed_url_ttl_seconds)


def _to_thread(fn, *args: object, **kwargs: object):
    import asyncio

    return asyncio.to_thread(fn, *args, **kwargs)


def _quote_key(object_key: str) -> str:
    return quote(object_key, safe="/")
