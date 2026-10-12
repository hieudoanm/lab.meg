# Definition of Done

## 23. Definition of Done

Feature/release complete when:
1. Behaviour tested at appropriate pyramid level.
2. Invalid/malformed MEG inputs handled safely (FIF/CTF/.ds/KIT/UCL FIL OPM/.bin/BIDS variants covered where supported).
3. Authorisation enforced server-side; cross-project negative tests pass.
4. DB constraints/transactions/migrations tested.
5. Scientific operations have known expected outputs and geometry/metadata invariants.
6. Time-sample/coordinate/frame consistency verified within tolerance (incl. MNE reference where applicable).
7. Worker idempotency, duplicate delivery, retry, cancellation, stale-run recovery covered.
8. Reproducibility verified (inputs + params + pipeline version/image_digest + environment recorded; numerical equivalence as appropriate).
9. Object storage privacy/expiry/checksums/cleanup tested.
10. Frontend states (loading/success/empty/error/partial/disabled/permission) implemented and tested; log viewer grid `88px 56px 1fr` correct.
11. API/frontend contracts drift-checked.
12. Required CI gates pass (backend/frontend/E2E/security as above).
13. No secrets/large raw binaries committed.
14. Docs/contracts updated.
15. No unsupported clinical/diagnostic claims introduced.
