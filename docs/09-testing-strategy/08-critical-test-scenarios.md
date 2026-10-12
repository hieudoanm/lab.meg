# Critical Test Scenarios

## 15. End-to-End Tests

Workflow A (primary): sign in → create/select project → upload synthetic MEG recording → finalise → wait for `ready` → inspect metadata/channels/events → open Signal Viewer → configure view → submit run (deterministic params) → wait for `succeeded` → inspect logs/artifacts/manifest → export manifest (verify input references).
Workflow B (permissions): viewer cannot access write actions; direct API calls denied.
Workflow C (failure): invalid/malformed upload → validation fails → never `ready` → UI safe message; cannot run.

Deterministic fixtures; run on PRs when practical and before release.

