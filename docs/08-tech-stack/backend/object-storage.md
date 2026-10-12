# Object Storage

## 7. Object Storage & Uploads

### 7.1 S3-Compatible Storage
- Private by default; block public access.
- MinIO locally (dev/CI); S3/GCS-compatible in production.
- Short-lived signed URLs for banded reads/uploads (single-object scoped).
- Object key possession != authorisation.
- Validate upload authorisation before finalising; checksum (SHA-256) + size checks.
- Never expose object keys in public API responses.
- Bounded decompression and format validation on upload finalisation (`POST /api/v1/datasets/{id}/complete`).
- Resumable uploads supported.

