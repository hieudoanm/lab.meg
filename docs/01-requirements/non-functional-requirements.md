# MEG Lab — Functional and Non-Functional Requirements

## 1. Purpose

This document defines the functional requirements, non-functional requirements, technical constraints, and acceptance criteria for MEG Lab.

All implementation decisions must align with these requirements and the project's `00-overview.md`, `README.md`, and any subsequently written feature, architecture, data-model, and tech-stack documents.

Requirements should be implemented incrementally. Do not attempt to implement the entire platform in a single pass. Deliver one complete vertical slice (project creation → recording upload → validation → signal viewer → processing run → artifact) before expanding scope.

Every requirement in this document carries a stable identifier, a priority, and explicit acceptance criteria. The identifier scheme is described in section 8.

## 2. Scope

## 2. Scope

### 2.1 In Scope (P0 and P1)

The MVP must provide:

- User authentication and session handling.
- Project management with project-scoped membership and roles.
- MEG recording upload through a resumable, signed-URL upload flow, covering FIF, CTF `.ds`, KIT (`.sqd`/`.con`), and UCL FIL OPM `.bin` recordings together with their companion files.
- Format detection, recording validation, metadata extraction, and provenance tracking.
- An interactive Signal Viewer with multichannel traces, timeline navigation, and event inspection.
- A channel browser with search, selection, hiding, and grouping by channel type.
- Display and navigation controls: time window, amplitude scaling, and channel grouping.
- Asynchronous execution of validated filtering, channel-selection, and event-related pipelines in isolated OCI workers.
- Experiment run monitoring, logs, cancellation, and failure recovery.
- Artifact storage, download, and machine-readable experiment manifests.
- Reproducible reruns from recorded configuration.
- Epoching, evoked responses, spectral analysis, sensor topographies, artifact inspection, and OPM support.
- Sensor geometry visualisation in a declared coordinate frame.
- Comparisons of raw and processed signals, epochs, or spectral outputs.
- Export, scoped sharing, and public sample projects.
- Role-based access control and project-scoped tenant isolation.
- Usage records and enforced quotas.
- Audit events and operational endpoints.
- Automated tests, continuous integration, and reproducible local development.

### 2.2 Out of Scope (Initial Releases)

The following are explicitly outside the initial scope, though P2 and P3 items are recorded for the longer-term platform:

- Clinical diagnosis, treatment recommendation, or any claim of clinical or regulatory validity.
- Direct acquisition from physical MEG or OPM systems, and real-time neurofeedback.
- SQUID tomographic noise handling and signal-space separation as the product focus.
- Large-scale deep-learning training on MEG recordings.
- Replacement of specialist MEG analysis suites (MNE-Python, FieldTrip, Brainstorm, and similar).
- Arbitrary MEG file formats beyond the documented format set (FIF, CTF `.ds`, KIT `.sqd`/`.con`, UCL FIL OPM `.bin`, and BIDS-organised datasets).
- Commercial billing, subscriptions, or payment collection.
- Microservices, Kubernetes, or a general-purpose cloud IDE without demonstrated need.
- Managed cloud infrastructure and Terraform provisioning (deferred; see section 5).

### 2.3 Priority Definitions

Use four priority levels throughout development:

- **P0 — Core platform:** required for a usable first release.
- **P1 — Analysis toolkit:** enough scientific functionality to make the product valuable.
- **P2 — Advanced research:** source estimation, notebooks, sophisticated pipelines, and collaboration.
- **P3 — Ecosystem:** plugins, broader modality support, and community workflows.

The P0 scope corresponds to FR-001..FR-016 (core platform) and the P1 scope to FR-017..FR-027 (scientific analysis) in the product specification. This document expands each requirement with a description, a rationale, and acceptance criteria, and adds the non-functional requirements, technical constraints, and end-to-end acceptance criteria that govern the whole platform.

## 4. Non-Functional Requirements

## 4. Non-Functional Requirements

These are initial engineering targets to validate through measurement and load testing, not measured performance claims. Numbers such as latency and availability targets apply to the initial production configuration and reference hardware profile.

### 4.1 Performance

| ID      | Area                       | Requirement                                                                                                                                                         |
| ------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-001 | Signal navigation latency  | Common signal-viewer interactions (time scroll, window change, channel select, scale) respond in under 150 ms for cached, bounded signal windows.                    |
| NFR-002 | API latency                | p95 under 300 ms for ordinary metadata reads under target load.                                                                                                     |
| NFR-003 | Job submission latency     | `POST /api/v1/runs` returns a run identifier within 2 s under normal load.                                                                                          |
| NFR-004 | Computation placement      | Expensive scientific computation must never run inside synchronous API request handlers.                                                                            |
| NFR-005 | Bounded responses          | Signal and data endpoints must enforce strict response-size limits; full recordings are never returned by default.                                                  |
| NFR-006 | Pagination limits          | List endpoints must enforce pagination limits.                                                                                                                      |
| NFR-007 | Large-file storage         | Large recordings, channel inventories, and arrays must use object storage or compact storage rather than large relational fields.                                   |
| NFR-008 | Client rendering           | The client must avoid rendering unnecessarily large arrays and should fetch only windowed or downsampled data where appropriate.                                    |
| NFR-009 | Measured optimisation      | Performance decisions must be supported by measurements where possible rather than arbitrary optimisation.                                                           |

### 4.2 Availability and Reliability

| ID      | Area                 | Requirement                                                                                                     |
| ------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| NFR-010 | Availability         | 99.5% monthly for the initial production service.                                                               |
| NFR-011 | Upload reliability   | Resumable uploads with safe retries and integrity verification.                                                 |
| NFR-012 | Job delivery         | Background jobs must tolerate repeated delivery (at-least-once) without corrupting results.                     |
| NFR-013 | Retry policy         | Failed jobs must have clear states and bounded retry policies that distinguish transient from permanent errors. |
| NFR-014 | Transactions         | Database transactions must protect consistency-critical operations such as submission and state transitions.    |
| NFR-015 | Migrations           | Database migrations must be versioned, reviewed, and repeatable.                                                |
| NFR-016 | Recovery of runs     | The system must recover or safely classify runs left running after a worker crash.                              |
| NFR-017 | Backup and restore   | Documented backup, restore, and disaster-recovery procedures must exist.                                        |
| NFR-018 | Recovery point       | Backup and restore procedures must state and test a recovery point and recovery time objective.                 |
| NFR-019 | Graceful degradation | Dependency failures must degrade gracefully with actionable errors rather than silent data loss.                |

### 4.3 Reproducibility

| ID      | Area                   | Requirement                                                                                                                                          |
| ------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-020 | Manifest completeness  | Every completed run has a machine-readable manifest with traceable inputs, parameters, environment, and outputs.                                     |
| NFR-021 | Immutable versions     | Dataset versions and pipeline versions are immutable once referenced by a run.                                                                       |
| NFR-022 | Runtime capture        | Runs record the container image digest and relevant library versions (for example MNE-Python, NumPy, and SciPy).                                       |
| NFR-023 | Coordinate conventions | Runs record the sensor coordinate frame, sampling conventions, and relevant random seeds and execution details affecting reproducibility.            |
| NFR-024 | Numerical equivalence  | Reproducibility checks define an explicit numerical tolerance where exact bitwise identity is unrealistic.                                            |

### 4.4 Security, Privacy and Isolation

| ID      | Area                     | Requirement                                                                                                                                                     |
| ------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-025 | Server-side enforcement  | Authentication and authorisation must be enforced on the server.                                                                                                |
| NFR-026 | Deny by default          | Access must be denied unless authentication and authorisation checks succeed.                                                                                   |
| NFR-027 | Tenant isolation         | No cross-project access through the API, storage, or worker mounts.                                                                                             |
| NFR-028 | Parameterised SQL        | All database queries must use parameterised SQL.                                                                                                                |
| NFR-029 | Secret protection        | Secrets must never be committed to source control or exposed to frontend code.                                                                                  |
| NFR-030 | Transport security       | Production traffic must use HTTPS.                                                                                                                              |
| NFR-031 | Private object storage   | Object storage must be private by default; access is via short-lived signed URLs after authorisation.                                                           |
| NFR-032 | Upload safety            | File uploads must have strict size limits and bounded parsing limits against malformed inputs and decompression-based resource exhaustion.                     |
| NFR-033 | Untrusted code isolation | Notebooks and custom scripts must run in isolated runtimes with no default access to application secrets or other projects' files.                              |
| NFR-034 | Network controls         | Worker egress must be restricted, preventing access to internal services and cloud metadata endpoints.                                                          |
| NFR-035 | Least privilege          | Short-lived credentials and narrowly scoped object-storage permissions must be used.                                                                            |
| NFR-036 | Data safety in logs      | Logs and error responses must not expose credentials, raw signal data, or internal stack traces.                                                                |
| NFR-037 | Privacy posture          | The application must warn users against uploading identifiable or unauthorised clinical recordings and must define retention and data-processing policies before accepting such data. |
| NFR-038 | Deletion semantics       | Clear deletion semantics must be defined for source data, derived files, cached copies, and backups.                                                            |
| NFR-039 | Dev-auth safety          | Development authentication must not be enabled accidentally in production.                                                                                      |
| NFR-040 | Security tests           | Security-critical behaviours must have automated tests, including negative cross-project access tests.                                                          |

### 4.5 Resource Limits and Cost

| ID      | Area               | Requirement                                                                                                |
| ------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| NFR-041 | Quota enforcement  | CPU, memory, disk, runtime, concurrency, and cost quotas must be enforced.                                 |
| NFR-042 | Per-run accounting | Resource consumption must be recorded per run.                                                             |
| NFR-043 | Visibility of cost | Users must have visibility of their usage and of the resource limits that apply to them.                   |
| NFR-044 | Bounded scheduling | Queue and concurrency controls must prevent unbounded resource consumption and abandoned-job accumulation. |

### 4.6 Observability

| ID      | Area                    | Requirement                                                                               |
| ------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| NFR-045 | Traceability            | Requests and jobs must be traceable through stable identifiers across the API and worker. |
| NFR-046 | Structured logs         | Logs must be structured and suitable for operational troubleshooting.                     |
| NFR-047 | Health versus readiness | Health and readiness checks must distinguish process health from dependency availability. |
| NFR-048 | Failure visibility      | Job failures, queue delays, and retry patterns must be observable.                        |
| NFR-049 | Minimal collection      | Monitoring must avoid unnecessary collection of personal or scientific data.              |

### 4.7 Accessibility and Usability

| ID      | Area               | Requirement                                                                                          |
| ------- | ------------------ | ---------------------------------------------------------------------------------------------------- |
| NFR-050 | Keyboard access    | Primary workflows must be keyboard accessible.                                                       |
| NFR-051 | Semantic labelling | Interactive controls, including signal canvases, must have semantic labels.                          |
| NFR-052 | Focus and contrast | Focus states and sufficient colour contrast must be provided.                                        |
| NFR-053 | Non-colour status  | Status must not be communicated by colour alone.                                                     |
| NFR-054 | Viewer alternative | Viewers and charts must provide a meaningful textual or tabular alternative.                         |
| NFR-055 | Actionable errors  | Forms must provide actionable validation errors.                                                     |
| NFR-056 | Consistent states  | Loading, empty, success, and error states must be implemented consistently.                          |
| NFR-057 | Conformance target | Core workflows should target WCAG 2.1 AA conformance, verified for the primary journey.              |

### 4.8 Maintainability and Portability

| ID      | Area                   | Requirement                                                                                                                          |
| ------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-058 | Strict typing          | TypeScript must use strict type checking.                                                                                            |
| NFR-059 | Python typing          | Python code must use type annotations for application interfaces and pass mypy checks.                                               |
| NFR-060 | Migrations             | Database changes must use versioned migrations.                                                                                      |
| NFR-061 | Clear boundaries       | Frontend, API, persistence, queue, worker, and scientific computation must have clear boundaries.                                    |
| NFR-062 | Documented contracts   | Public API contracts and operational procedures must be documented.                                                                  |
| NFR-063 | Simplicity             | Avoid unnecessary abstractions, dependencies, and distributed services.                                                              |
| NFR-064 | Local independence     | Local development must not require paid cloud services.                                                                              |
| NFR-065 | Opt-in cloud           | Cloud deployment must be opt-in and explicitly deferred from the initial scope.                                                      |
| NFR-066 | Cost documentation     | Infrastructure documentation must explain likely costs and cleanup procedures when cloud deployment is introduced.                   |
| NFR-067 | Container portability  | Local and self-hosted deployment must be reproducible through Docker Compose.                                                        |
| NFR-068 | Isolated cloud details | Cloud-specific operations should be isolated behind small interfaces when this materially improves local testing or maintainability. |

## 5. Technical Constraints

## 5. Technical Constraints

1. Use Next.js (App Router), React, TypeScript, TailwindCSS, and daisyUI for the web application.
2. Use Plotly.js or a custom WebGL/canvas renderer for high-density signal visualisation, and Three.js or vtk.js for sensor geometry. An optional Tauri desktop shell may reuse the web application.
3. Use Python, FastAPI, and Pydantic for the API.
4. Use PostgreSQL as the source of truth for application metadata and job state.
5. Use asynchronous PostgreSQL access through Psycopg 3 with explicit SQL rather than an ORM.
6. Use Celery with Redis for the queue, with a separate worker process and a separate outbox dispatcher; background jobs must not run inside API request handlers.
7. Store raw recordings and large outputs in S3-compatible object storage (MinIO locally) and issue signed URLs after authorisation checks.
8. Use MNE-Python, NumPy, and SciPy for file I/O and analysis, evaluate OPM-Python for selected OPM integrations, and use the BIDS MEG specification for BIDS-organised datasets.
9. Run experiment computation in versioned OCI container images with explicit resource limits.
10. Use `uv` as the Python dependency manager.
11. Use Ruff and mypy for Python quality gates, and ESLint and Prettier for frontend quality gates.
12. Use pytest for backend tests and Vitest and Playwright for frontend tests.
13. Use GitHub Actions for continuous integration.
14. Use Docker Compose for local and self-hosted deployment.
15. Use small synthetic or appropriately licensed fixtures in the repository rather than large raw scientific datasets.
16. Keep secrets out of source control and out of frontend bundles.
17. Managed cloud infrastructure and Terraform provisioning are explicitly deferred; do not introduce them without a demonstrated need.
18. Follow existing repository conventions where they are sound; do not restructure a working repository unnecessarily.

