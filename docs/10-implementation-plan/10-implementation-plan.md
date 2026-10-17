# MEG Lab — Implementation Plan

## 1. Purpose

This document defines the phased implementation plan for MEG Lab, an independent cloud-based computational electrophysiology SaaS portfolio project.

The goal is to deliver a working, self-hosted application that demonstrates:

- Full-stack TypeScript and Python development.
- Secure project-scoped multi-tenant application design.
- Ingestion, validation, and acquisition-metadata extraction for FIF, CTF `.ds`, KIT (`.sqd`/`.con`), UCL FIL OPM `.bin`, and BIDS-organised MEG recordings.
- Responsive multichannel signal visualisation with event markers and explicit time bases.
- Sensor-geometry exploration in a declared coordinate frame, including OPM arrays.
- Reproducible scientific computation using versioned OCI container images built on MNE-Python.
- Reliable asynchronous background processing with a transactional outbox.
- PostgreSQL data modelling with explicit SQL and versioned migrations.
- Private S3-compatible object storage for raw recordings, derivatives, and artifacts.
- Automated testing and continuous integration.
- Docker Compose self-hosted deployment and CI hardening.
- Production-minded engineering decisions and documented trade-offs.

The project must be implemented incrementally. Each phase produces a testable result before the next phase begins, and each phase maps to a milestone in the product specification (`docs/README.md`, section 12).

Scope references in this plan use the functional requirements `FR-001..FR-027` from the product specification and the feature priorities P0–P3.


## 2. Delivery Principles

### 2.1 Build a vertical slice first

The first objective is not to build every screen or establish the entire infrastructure. Build one complete workflow end to end:

1. Open the application.
2. Authenticate, or use an explicitly configured local development identity.
3. Create a project.
4. Upload a synthetic or appropriately licensed MEG recording, including any companion files.
5. Validate the file set and extract acquisition metadata.
6. Explore the channels, signals, and events in the Signal Viewer.
7. Submit a preprocessing or analysis operation.
8. Process it in a background worker inside a versioned container.
9. Retrieve the artifact and its experiment manifest.

This workflow proves that the major components work together before the feature set expands.

### 2.2 Prefer working software over premature abstraction

- Implement only the features required by the current milestone.
- Avoid building a generic workflow engine before two real operations exist.
- Avoid a complex permission framework before the initial roles are understood.
- Avoid a plugin system for a single signal operation.
- Avoid a universal format adapter before two real readers exist.
- Add abstractions only when repeated behaviour or a clear architectural boundary justifies them.

### 2.3 Keep scientific claims modest

The initial application performs descriptive signal processing and visualisation. It does not diagnose conditions, interpret clinical outcomes, or claim that its outputs are validated for medical use. Display transformations and navigation must be distinguished from analytical computations (`docs/04-architecture/04-architecture.md`). A pipeline result is a research output, not a clinical finding.

### 2.4 Protect the development feedback loop

- Run linting and type checking frequently.
- Add tests alongside features.
- Use small pull requests or commits.
- Keep the local development environment reproducible through Docker Compose and pinned dependency locks.
- Treat a broken `master` branch as a delivery problem.

### 2.5 Separation of interactive and scientific workload

Computation must never run inside a web request handler. The API validates, authorises, and returns a run identifier promptly; the worker performs signal processing inside an isolated OCI container. This rule is non-negotiable (`docs/08-tech-stack.md`). Interactive viewing is served from bounded, cached signal windows, while analysis runs asynchronously.

### 2.6 Treat OPM ingestion as a first-class path

OPM-MEG is not simply ordinary MEG with different sensor names. Its file variants, companion metadata, sensor geometry, and preprocessing assumptions differ from conventional SQUID-MEG. OPM ingestion and metadata validation are therefore explicit deliverables from Milestone 0 onward, not a late enhancement. This is called out here because it materially increases delivery effort compared with a SQUID-only product (`docs/README.md`, section 14).


## 3. Milestone Overview

## 3. Milestone Overview

The plan follows the delivery milestones in `docs/README.md` section 12. Each phase below reproduces the corresponding milestone as its backbone and expands it with tasks, dependencies, exit criteria, and risks.

| Phase | Milestone                                | Product spec milestone | Priority | Expected outcome                                                          |
| ----- | ---------------------------------------- | ---------------------- | -------- | ------------------------------------------------------------------------- |
| 0     | Project foundation                       | Pre-milestone          | —        | Workspace, tooling, Compose services, and CI skeleton                     |
| 1     | Scientific proof of concept              | Milestone 0            | P0       | Validated ingestion and signal rendering, including a tested OPM path     |
| 2     | Platform foundation                      | Milestone 1            | P0       | Secure project creation and supported-recording upload                    |
| 3     | Signal workspace                         | Milestone 2            | P0       | A user can explore a recording without manually setting up Python         |
| 4     | Cloud experiments                        | Milestone 3            | P0       | A user can run an analysis and retrieve a traceable output                |
| 5     | Private beta                             | Milestone 4            | P1       | External users complete the core workflow without developer intervention  |
| 6     | Deployment and CI hardening              | Post-beta              | —        | Reproducible self-hosted deployment and authoritative quality gates       |

A milestone is complete only when its exit criteria are met. The mapping above aligns the phases with the product milestones in `docs/README.md` section 12 and the priority levels in section 3.


## 4. Phase 0 — Project Foundation

See [`phase-0.md`](phase-0.md).

## 5. Phase 1 — Milestone 0: Scientific Proof of Concept

See [`phase-1.md`](phase-1.md).

## 6. Phase 2 — Milestone 1: Platform Foundation

See [`phase-2.md`](phase-2.md).

## 7. Phase 3 — Milestone 2: Signal Workspace

See [`phase-3.md`](phase-3.md).

## 8. Phase 4 — Milestone 3: Cloud Experiments

See [`phase-4.md`](phase-4.md).

## 9. Phase 5 — Milestone 4: Private Beta

See [`phase-5.md`](phase-5.md).

## 10. Post-Beta Roadmap

See [`post-beta-roadmap.md`](post-beta-roadmap.md).

## 11. Functional Requirement Mapping

See [`requirement-mapping.md`](requirement-mapping.md).

## 12. Dependency Ordering

See [`dependency-ordering.md`](dependency-ordering.md).

## 13. Continuous Integration and Engineering Quality Gates

See [`ci-and-quality-gates.md`](ci-and-quality-gates.md).

## 14. Suggested Weekly Execution Strategy

See [`weekly-execution-strategy.md`](weekly-execution-strategy.md).

## 15. Risk Register

See [`risk-mitigation.md`](risk-mitigation.md).

## 16. Definition of Project Completion

See [`definition-of-done.md`](definition-of-done.md).

## 17. Post-MVP Opportunities

See [`post-mvp-opportunities.md`](post-mvp-opportunities.md).
