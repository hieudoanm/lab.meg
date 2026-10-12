# 12. Export, BIDS Import, Sharing

## 12. Export, BIDS Import, Sharing

**Priority:** P1 (FR-026, FR-027), P1 (FR-015)

### Export
Viewer snapshots, manifests, selected derived data; scoped URLs; respect permissions.

### BIDS import
Import supported BIDS MEG datasets; validate; record BIDS version; preserve metadata/companion files.

### Sharing
Scoped revocable links; read-only by default; explicit scope; audit events; do not leak outside scope.

### Acceptance conditions
- Exports include context (project/dataset version/state).
- BIDS validation reports clear errors/warnings.
- Shared resources permission-checked server-side; expired/revoked blocked.

