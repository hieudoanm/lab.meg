"""Internal storage endpoints for the local (file) backend.

These serve the short-lived, single-object, HMAC-signed URLs issued
by :class:`app.storage.local.FileStorage`. They are not part of the
public API surface and carry their own expiry and method-scoped
signature; possession of the URL is the only credential.
"""

from __future__ import annotations

import hashlib
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import FileResponse
from starlette.responses import JSONResponse

from app.api.deps import get_settings
from app.core.exceptions import BadRequestError
from app.storage.local import FileStorage, verify_signature

router = APIRouter()


def _file_storage(settings: Any) -> FileStorage:
    from app.storage.factory import create_storage

    storage = create_storage(settings)
    if not isinstance(storage, FileStorage):
        raise BadRequestError("internal storage is disabled", code="storage_backend_s3")
    return storage


@router.get("/internal/storage/{object_key:path}")
async def internal_get(
    object_key: str,
    request: Request,
    method: str = Query("GET"),
    expires: int = Query(...),
    sig: str = Query(...),
    checksum: str = Query(""),
    media_type: str = Query(""),
    settings=Depends(get_settings),
) -> Response:
    if method != "GET":
        raise BadRequestError("method not allowed for this URL", code="signed_url_method")
    if not verify_signature(settings, "GET", object_key, expires, checksum, media_type, sig):
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("signed URL is invalid or expired", code="signed_url_invalid")
    storage = _file_storage(settings)
    path = storage._path(object_key)  # noqa: SLF001 - internal router
    if not path.is_file():
        from app.core.exceptions import NotFoundError

        raise NotFoundError("object not found")
    return FileResponse(path, media_type="application/octet-stream")


@router.put("/internal/storage/{object_key:path}")
async def internal_put(
    object_key: str,
    request: Request,
    method: str = Query("PUT"),
    expires: int = Query(...),
    sig: str = Query(...),
    checksum: str = Query(""),
    media_type: str = Query(""),
    settings=Depends(get_settings),
) -> JSONResponse:
    if method != "PUT":
        raise BadRequestError("method not allowed for this URL", code="signed_url_method")
    if not verify_signature(settings, "PUT", object_key, expires, checksum, media_type, sig):
        from app.core.exceptions import ForbiddenError

        raise ForbiddenError("signed URL is invalid or expired", code="signed_url_invalid")
    body = await request.body()
    if checksum:
        digest = f"sha256:{hashlib.sha256(body).hexdigest()}"
        if digest != checksum:
            from app.core.exceptions import UnprocessableError

            raise UnprocessableError(
                "uploaded content checksum mismatch", code="upload_checksum_mismatch"
            )
    storage = _file_storage(settings)
    path = storage._path(object_key)  # noqa: SLF001 - internal router
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return JSONResponse({"object_key": object_key, "size_bytes": len(body)}, status_code=200)
