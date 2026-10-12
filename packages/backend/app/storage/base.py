"""Object storage abstractions.

Raw and derived MEG signals never pass through PostgreSQL. Recording
bytes, channel inventories beyond metadata summaries, sensor geometry
payloads, and artifacts live in S3-compatible object storage and are
referenced by server-generated object keys. Possession of an object key
is never authorisation (docs §05).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True)
class ObjectInfo:
    object_key: str
    size_bytes: int
    checksum_sha256: str | None = None
    media_type: str | None = None


@dataclass(frozen=True)
class PresignedUrl:
    url: str
    method: str
    expires_at: datetime
    headers: dict[str, str] | None = None


class StorageBackend(Protocol):
    async def ensure_bucket(self) -> None: ...

    async def head_object(self, object_key: str) -> ObjectInfo | None: ...

    async def upload_bytes(
        self, object_key: str, data: bytes, *, checksum_sha256: str | None = None
    ) -> None: ...

    async def get_object(self, object_key: str) -> bytes: ...

    async def delete_object(self, object_key: str) -> None: ...

    async def presign_put(
        self,
        object_key: str,
        *,
        size_bytes: int,
        checksum_sha256: str | None,
        media_type: str | None,
    ) -> PresignedUrl: ...

    async def presign_get(self, object_key: str) -> PresignedUrl: ...
