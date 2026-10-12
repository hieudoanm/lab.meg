# Test Data Management

## 20. Test Data and Environment Management

Synthetic only for CI/dev. Tiny deterministic fixtures; larger only for resource tests and cleaned up. No large raw recordings committed; generators preferred. Isolated test DBs per session; temp storage/cleanup; no shared mutable fixtures; parallel tests isolated (unique keys). Keep auth isolated from prod. Real research data requires explicit approval/licensing/anonymisation.

