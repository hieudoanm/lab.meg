# 15. UI States (Global)

## 15. UI States (Global)

**Priority:** P0

All primary screens implement: loading (skeletons), empty (with next action), success, validation error (safe), permission error (non-revealing), network error (retry), server error (safe + request id), partial success, disabled (explain why), permission-denied.

### Acceptance conditions
- No internal paths/stack traces leaked.
- States distinguish recoverable vs non-recoverable.
- Focus predictable; accessible feedback.

