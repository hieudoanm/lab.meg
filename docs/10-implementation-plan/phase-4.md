# Phase 4 — Milestone 3: Cloud Experiments

## 8. Phase 4 — Milestone 3: Cloud Experiments

### 8.1 Objective

Implement durable asynchronous signal processing with versioned pipelines, logs, artifacts, and experiment manifests.

**Priority:** P0 — **Weeks:** 6–8

### 8.2 Milestone definition (product specification, section 12)

- Queue and isolated worker.
- Filtering and basic spectral analysis.
- Job status, logs, failure handling, and cancellation.
- Artifact storage and experiment manifests.

Exit criterion: users can run an analysis and retrieve a traceable output.

### 8.3 Initial operations

Implement a small set of well-tested operations (`docs/02-features/02-features.md`):

- Band-pass and notch filtering with explicit high/low cutoffs in hertz.
- Channel selection and re-referencing where appropriate for the channel type.
- Resampling to a target sampling frequency.
- Bad-channel detection producing a marked channel set.
- Power spectral density estimation (PSD) with configurable window and overlap.

Operations must preserve source metadata such as sampling frequency, channel identity, units, and coordinate frame unless the operation explicitly and visibly changes it.

### 8.4 Tasks

#### Pipeline definitions (FR-024)

- [x] Define pipeline and parameter schemas with explicit types, units, and validation.
- [x] Pin each pipeline version to a container `image_digest`.
- [x] Validate a pipeline definition before it can run; reject unsupported parameters.
- [x] Make published versions immutable; editing creates a new version.

#### Queue and isolated worker (FR-011)

- [x] Configure Redis and Celery with a separate worker process.
- [x] Implement run submission that validates permissions, parameters, and dataset state.
- [x] Implement idempotency for run submission using `idempotency_keys`.
- [x] Persist the run record and an `outbox_events` row in one transaction.
- [x] Implement the outbox dispatcher with `FOR UPDATE SKIP LOCKED` claiming.
- [x] Implement the worker that launches the pinned OCI image by `image_digest`.
- [x] Load run inputs from private object storage through a controlled, read-only mechanism.
- [x] Validate worker input independently; do not trust the request payload.
- [x] Apply CPU, memory, disk, and wall-clock limits, and restrict egress.

#### Job lifecycle (FR-010, FR-011)

- [x] Implement the states `queued`, `running`, `succeeded`, `failed`, and `cancelled`.
- [x] Implement run status polling and structured run logs.
- [x] Implement bounded retry handling with backoff and jitter.
- [x] Implement stale-run recovery using a lease or heartbeat.
- [x] Implement cooperative cancellation for `queued` and `running` runs.

#### Artifacts and provenance (FR-012, FR-013)

- [x] Compute the operation and validate the output before persisting.
- [x] Persist artifacts with SHA-256 checksums and media types.
- [x] Write the machine-readable experiment manifest (schema version, inputs, pipeline, parameters, environment, sensor configuration, outputs, status).
- [x] Mark the run successful only after artifacts and manifest are persisted and validated.
- [x] Record resource consumption per run in `usage_records`.
- [x] Add worker integration tests, idempotency tests, and scientific-correctness tests against reference recordings.

### 8.5 Required run states

| State       | Meaning                                                      |
| ----------- | ------------------------------------------------------------ |
| `queued`    | Accepted but not yet executing                               |
| `running`   | A worker is processing the run                               |
| `succeeded` | Computation, artifact persistence, and manifest writing done |
| `failed`    | Processing failed and will not be retried automatically      |
| `cancelled` | Processing was cancelled according to documented rules       |

State transitions must be validated, persisted, and enforced at the database boundary. A cancelled or successful run must not be silently reopened by a duplicate worker message.

### 8.6 Dependencies

- Phases 2 and 3 (inputs and result inspection).

### 8.7 Exit criteria

- Submitting a run returns a run identifier promptly, independent of processing time.
- Run state persists across API and worker restarts.
- Duplicate submissions do not create duplicate logical runs; duplicate worker delivery does not corrupt results.
- A failed run returns no fabricated results and exposes a safe failure reason.
- Every successful run produces validated artifacts, checksums, and a machine-readable manifest.
- Cancel is honoured and recorded.
- Worker crashes are observable and recoverable without restarting live work.

### 8.8 Risks

| Risk                                    | Mitigation                                                             |
| --------------------------------------- | ---------------------------------------------------------------------- |
| Lost queue messages                     | Transactional outbox and idempotent workers                            |
| Duplicate delivery corrupts results     | Conditional state transitions and leases                               |
| Container escapes or overuses resources | Isolated runtime, no default secrets, explicit limits and egress rules |
| Manifest write fails after compute      | A run is not `succeeded` until artifacts and manifest persist          |
| Scientific regression on parameter change | Versioned pipelines and numerical regression tests against fixtures   |

### 8.9 FR mapping

Milestone 3 completes FR-010, FR-011, FR-012, FR-013, FR-014, FR-024, and begins FR-019 (basic spectral analysis).

