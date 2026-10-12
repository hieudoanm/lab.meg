# 7. Cloud Jobs, Processing, Artifacts, Provenance

## 7. Cloud Jobs, Processing, Artifacts, Provenance

**Priority:** P0 (FR-010, FR-011, FR-012, FR-013)

### Basic processing
Validated filtering and channel operations. Preview without modifying source. Records params/env.

### Async jobs
Submit → get run id (prompt), isolated worker, record full context, idempotent, validate before exec.

### Monitoring
States queued/running/succeeded/failed/cancelled. Logs structured, safe. Cancellation honoured.

### Artifacts & manifests
Each artifact has key/checksum/media type/metadata; short-lived scoped download URLs. Manifest with full provenance including sensor config refs, environment, versions.

The pipeline/run worker path is implemented: pipeline creation and version
publication, queued run submission, transactional outbox dispatch, atomic
worker claiming, execution, logs, artifacts, and manifests. The current
frontend authoring flow publishes a simple initial version; a richer visual
multi-node editor and a complete artifact/provenance browser remain future
work.

### Reproducibility
Rerun from manifest creates new traceable run; reports missing inputs.

### States
Per run: queued/running/succeeded/failed/cancelled. Artifacts: available/expired/deleted.

### Acceptance conditions
- Async submission returns id promptly; isolated execution.
- Status/logs visible; safe errors on failure.
- Cancellation works for cancellable states.
- Successful run has artifacts + manifest with provenance.
- Downloads integrity-checked and access-controlled.

