# Background Jobs and Execution

## 8. Background Jobs & Execution

### 8.1 Celery + Redis
- Celery workers consume jobs from Redis broker.
- Transactional outbox: API writes run + outbox in same transaction; outbox dispatcher publishes to queue (idempotent).
- Idempotency keys on run submission (`POST /api/v1/runs`, `Idempotency-Key` header).
- Tasks idempotent under redelivery; explicit run-state transitions; concurrency controls prevent conflicting workers.
- Resource limits: CPU/memory/wall-clock per job; timeouts; bounded retries with backoff.
- Worker isolation: no cross-project access; no app secrets by default; restricted egress.
- OCI runtime: worker launches versioned OCI containers pinned by digest. Image includes Python 3.15.0, MNE-Python, NumPy, SciPy, and Matplotlib. Separate OPM-oriented image where preprocessing differs. Record `image_digest` in `pipeline_versions` and experiment manifests.

### 8.2 Processing Model
- All MEG computation in isolated containers/workers (never in API handlers).
- Bounded signal access: workers read only required windows/files; respect dataset scoping.
- Experiment manifest captures: `run_id`, pipeline (name/version/image_digest), inputs (dataset_version_id/checksum), parameters, environment, outputs, status.

