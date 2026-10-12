# 16. Security, Audit, Health, Operations

## 16. Security, Audit, Health, Operations

**Priority:** P0/P1 (FR-011, FR-014, FR-015)

### Audit
Append-only audit events for security-relevant actions; include actor/action/resource/timestamp; no secrets/raw data.

### Health
`/healthz` liveness, `/readyz` readiness (DB/queue/storage); no secrets.

### Logging
Structured logs with request/run id, operation, outcome; avoid raw data/secrets.

### Privacy
Private by default; explicit sharing; bounded decompression; isolated untrusted code; least privilege.

### Acceptance conditions
- Cross-project access blocked by tests.
- Health endpoints safe.
- Logs structured and safe.

