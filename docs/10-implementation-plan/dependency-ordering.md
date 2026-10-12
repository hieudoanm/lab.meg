# Dependency Ordering

## 12. Dependency Ordering

The phase order is driven by technical dependency and risk, not visual appeal.

```mermaid
flowchart LR
    P0["Phase 0: Foundation"] --> P1["Phase 1 / M0: Proof of concept"]
    P1 --> P2["Phase 2 / M1: Platform foundation"]
    P2 --> P3["Phase 3 / M2: Signal workspace"]
    P3 --> P4["Phase 4 / M3: Cloud experiments"]
    P4 --> P5["Phase 5 / M4: Private beta"]
    P5 --> P6["Phase 6: Deployment and CI hardening"]
    P5 --> V["Post-beta roadmap V1 -> V5"]
```

Ordering notes:

- The ingestion interface (Phase 1) must exist before upload validation (Phase 2), because validation is format-aware.
- Metadata and channel records (Phase 2) must exist before the Signal Viewer (Phase 3) can render anything meaningful.
- The viewer and result inspection (Phase 3) must exist before artifact review (Phase 4) is useful.
- Provenance and reproducibility (Phase 4) must be established before epoching and evoked results (Phase 5) can be described as reproducible.
- **OPM ingestion adds substantial work**: it spans format detection, companion metadata, sensor-geometry validation, and a distinct preprocessing template. Budget for it independently rather than treating it as a format-adapter variant.
- **Notebook isolation adds substantial work**: hosted Python execution requires an isolated runtime, restricted network egress, and least-privilege data access. It is deliberately deferred to the developer-workbench release (V2), not the beta, precisely because it is a security-sensitive subsystem.
- The private beta (Phase 5) is not complete until security, load, and scientific regression tests pass.

