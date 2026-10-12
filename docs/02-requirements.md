# MEG Lab — Functional and Non-Functional Requirements

## 1. Purpose

This document defines the functional requirements, non-functional requirements, technical constraints, and acceptance criteria for MEG Lab.

All implementation decisions must align with these requirements and the project's `01-overview.md`, `README.md`, and any subsequently written feature, architecture, data-model, and tech-stack documents.

Requirements should be implemented incrementally. Do not attempt to implement the entire platform in a single pass. Deliver one complete vertical slice (project creation → recording upload → validation → signal viewer → processing run → artifact) before expanding scope.

Every requirement in this document carries a stable identifier, a priority, and explicit acceptance criteria. The identifier scheme is described in section 8.

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

## 3. Functional Requirements

Each requirement below states its identifier, title, priority, description, rationale, and acceptance criteria. Where a role matrix or shared lifecycle is referenced, it is defined immediately before the requirements that depend on it.

### 3.1 Authentication and Identity

**FR-001 — Authentication**
**Priority:** P0

Users must be able to sign up, sign in, sign out, and recover access to their account, and the application must authenticate users before granting access to any private resource.

Rationale: MEG recordings and project metadata are private by default; verified identity is the basis for every authorisation decision.

Acceptance criteria:

- Unauthenticated requests to protected endpoints are rejected with a consistent `401` response.
- Users can sign up, sign in, sign out, and recover account access through a documented recovery flow.
- The API never treats a client-supplied user identifier as proof of identity.
- An expired session produces a stable error code and does not expose internal detail.

### 3.2 Projects and Membership

**FR-002 — Projects**
**Priority:** P0

Users must be able to create, rename, archive, and delete projects, with project-scoped membership and roles.

The system supports three project-scoped roles: `owner`, `researcher`, and `viewer`.

| Capability                       | Owner | Researcher | Viewer |
| -------------------------------- | ----- | ---------- | ------ |
| View permitted projects          | Yes   | Yes        | Yes    |
| Create and edit projects         | Yes   | Yes        | No     |
| Archive or delete projects       | Yes   | No         | No     |
| Upload and manage recordings     | Yes   | Yes        | No     |
| View recordings and results      | Yes   | Yes        | Yes    |
| Submit experiment runs           | Yes   | Yes        | No     |
| Create and edit pipelines        | Yes   | Yes        | No     |
| Manage project members and roles | Yes   | No         | No     |
| Create scoped shares             | Yes   | Yes        | No     |

Rationale: Projects are the tenant boundary; a clear role model keeps collaboration possible without exposing recordings across tenants.

Acceptance criteria:

- A valid create request persists a `projects` row with the caller recorded as owner in `project_members`.
- The project list is scoped to membership and supports pagination, deterministic sorting, and search by name.
- Archiving retains recordings, pipelines, runs, and artifacts and makes the project read-only until restored.
- Deletion requires explicit confirmation, is recorded in the audit trail, and applies documented semantics to source data, derived files, cached copies, and backups (see NFR-038).
- Every project-scoped endpoint evaluates the caller's role for that project; a viewer attempting a write operation receives a documented authorisation error.
- Users cannot grant themselves additional permissions, and a project cannot be left without an active owner.

### 3.3 Recording Upload and Ingestion

**FR-003 — Recording upload**
**Priority:** P0

Researchers must be able to upload supported MEG recordings and their associated metadata through the web application using a resumable cloud upload flow.

Rationale: MEG recordings are large and format-specific, and many formats are directory-based or depend on companion files, so ingestion must treat a recording as a validated file set rather than a single blob.

Acceptance criteria:

- Supported recording formats upload successfully through scoped, short-lived signed URLs.
- Directory-based CTF `.ds` recordings and recordings with companion files are uploaded and finalised as a coherent set.
- Upload progress is visible and a failed transfer can be resumed without restarting the entire recording.
- The backend verifies that the expected objects exist and pass integrity checks before accepting an upload as complete.
- A SHA-256 checksum is recorded for each uploaded file asset.
- Replacing source data creates a new dataset version rather than mutating the existing version.

**FR-004 — Format detection**
**Priority:** P0

The system must detect supported file formats and provide clear errors for unsupported inputs.

Rationale: Users should not have to declare a format correctly for ingestion to succeed, and unsupported inputs should fail with an actionable explanation rather than a silent misread.

Acceptance criteria:

- The system recognises FIF (MNE-native), CTF `.ds`, KIT `.sqd`/`.con`, UCL FIL OPM `.bin`, and BIDS-organised MEG datasets.
- A recording missing required companion files is rejected with a message identifying the missing file set.
- Unsupported or ambiguous inputs are rejected before processing with a documented error code.
- Format detection uses bounded parsing and does not load full signal data.

**FR-005 — Metadata inspection**
**Priority:** P0

The application must extract sampling frequency, duration, channel count, channel types, and acquisition information where available.

Rationale: Acquisition metadata drives every downstream analysis and must be explicit, because MEG and OPM recordings differ in channel composition, units, and geometry.

Acceptance criteria:

- Reported sampling frequency, duration, channel count, and channel types match independently verified reference values for the test fixtures.
- Channel types distinguish SQUID magnetometers (`mag`), planar gradiometers (`grad`), auxiliary channels (EEG/EOG/ECG/STIM), and OPM channels.
- Channel units and coordinate frame are reported explicitly where present.
- Metadata that is genuinely absent is reported as unknown rather than fabricated.

### 3.4 Signal Workspace

**FR-006 — Channel browser**
**Priority:** P0

Users must be able to search, select, hide, and group channels by type.

Rationale: A conventional Neuromag Vectorview system alone exposes 306 MEG channels plus auxiliary channels, so channel management is essential for a usable viewer.

Acceptance criteria:

- Channels are grouped by type (for example `mag`, `grad`, EEG, EOG, ECG, STIM, OPM).
- Channel selection and visibility persist per recording version.
- Channel inventories are paginated or virtualised so large systems remain responsive.
- Search matches channel names and types.

**FR-007 — Raw signal viewer**
**Priority:** P0

Users must be able to plot multiple channels against time with configurable amplitude scaling.

Rationale: Raw signal inspection is the central workspace of the product and the first thing a user needs to understand a recording.

Acceptance criteria:

- The viewer plots the selected channels against time.
- Per-channel and global amplitude scaling are configurable and resettable.
- Channel labels, units, and the current scale are visible.
- The viewer fetches only bounded signal windows and never downloads the entire recording to render a section.

**FR-008 — Navigation**
**Priority:** P0

Users must be able to scroll through recording time and change the visible time window.

Rationale: MEG recordings span minutes and users reason about specific intervals, so navigation must be precise and responsive.

Acceptance criteria:

- The visible time window is bounded and configurable, and the user can jump to a specific time.
- Navigation remains consistent with the event timeline.
- Interactions meet the signal-navigation latency target (NFR-001).

**FR-009 — Event inspection**
**Priority:** P0

The application must display event markers and event channels alongside the signal traces.

Rationale: Event-related analysis depends on correct event identification, and event timing must be interpreted against an explicit time base.

Acceptance criteria:

- Event markers align to the signal time base and update with navigation.
- Event channels are rendered alongside the signal traces.
- Event times identify the relevant recording time base and sample conventions.

### 3.5 Processing and Cloud Jobs

**FR-010 — Basic processing**
**Priority:** P0

Users must be able to apply validated filtering and channel-selection operations.

Rationale: Basic, well-understood operations let users clean up a recording safely and are a prerequisite for event-related analysis.

Acceptance criteria:

- Filter parameters and channel selections are validated and recorded.
- Invalid parameters are rejected before submission.
- Outputs preserve source metadata such as sampling frequency, channel identity, and units.
- Bad channels can be marked and are excluded where an operation supports exclusion.

**FR-011 — Cloud jobs**
**Priority:** P0

Users must be able to queue analysis jobs and see progress, logs, cancellation, and failure states.

Rationale: Scientific computation must not block the API, and users need trustworthy visibility into asynchronous work.

Acceptance criteria:

- The API returns a `run_id` promptly (see NFR-003) and enqueues work through the queue for a separate worker.
- Runs support the states `queued`, `running`, `succeeded`, `failed`, and `cancelled`, and every run is in exactly one state.
- Status updates are visible without a full page reload.
- Logs are access-controlled and contain no secrets or raw signal data.
- Cancellation is idempotent and recorded in the audit trail.
- Runs left `running` after a worker crash are recovered or safely classified.

**FR-012 — Artifacts**
**Priority:** P0

Generated outputs must be saved and downloadable as artifacts, including processed recordings, plots, and analysis outputs.

Rationale: Results must outlive the viewer session and be independently verifiable.

Acceptance criteria:

- Each artifact references the producing run and stores its object key, checksum, media type, and metadata.
- Downloads use short-lived signed URLs issued after an authorisation check.
- Artifacts persist independently of the viewer session.
- Users outside the project cannot obtain a download URL or object contents.

**FR-013 — Provenance**
**Priority:** P0

The application must record inputs, parameters, software versions, and outputs for every completed run.

Rationale: Reproducibility is a core product principle, and a completed run must be traceable from raw input to recorded output.

Acceptance criteria:

- Every successful run produces a machine-readable manifest containing a `schema_version`, run identifier, pipeline name/version/image digest, input dataset version identifiers and checksums, parameters, environment, sensor configuration, outputs, and status.
- The manifest records coordinate conventions, sampling conventions, and relevant random seeds or execution details where they affect reproducibility.
- The run detail view exposes inputs, parameters, tool versions, logs, and output references to authorised users.
- Runs are never edited after completion; corrections are recorded as new runs.

**FR-014 — Resource controls**
**Priority:** P0

The system must enforce upload, storage, runtime, memory, and compute limits.

Rationale: Unbounded computation or storage would make cost unpredictable and let one project affect others.

Acceptance criteria:

- Oversized uploads, storage overages, and concurrent run submissions beyond the allowed limit are rejected or queued with an actionable message according to the documented policy.
- Workers enforce CPU, memory, disk, and runtime limits; a run exceeding a limit is terminated and marked `failed` with a resource-limit reason.
- Resource consumption is recorded per run in `usage_records`.
- Users can see their usage against the limits that apply to them.

### 3.6 Security and Sample Workspace

**FR-015 — Security**
**Priority:** P0

The application must enforce project permissions and protect private recordings.

Rationale: Physiological recordings can contain sensitive information, and tenant isolation is a release-blocking concern.

Acceptance criteria:

- Authentication and authorisation are enforced on the server for every protected operation, independently of frontend visibility.
- Every read, write, download, and job submission checks the caller's project membership.
- Recordings and large outputs are stored in private object storage and accessed only via short-lived signed URLs after authorisation.
- All SQL values are passed as query parameters and user input never becomes an arbitrary SQL identifier or expression.
- Automated negative tests verify that users cannot access another project's recordings, runs, artifacts, or files without information leakage.

**FR-016 — Sample workspace**
**Priority:** P0

Users must be able to explore a bundled public or appropriately licensed sample recording and guided tutorial without uploading data.

Rationale: A new user should reach a meaningful result within the first minutes, and the sample removes the need to configure a local scientific computing environment.

Acceptance criteria:

- A new user can open the sample project and inspect a recording within the first minutes of use.
- The sample's licensing and citation requirements are documented.
- Guided onboarding covers opening the sample, navigating channels and time, inspecting events, adjusting display, and saving or sharing a result, and it can be dismissed without blocking the workflow.

### 3.7 Event-Related Analysis

**FR-017 — Epoching**
**Priority:** P1

Users must be able to create epochs around selected events using configurable time windows.

Rationale: Epoching is the bridge from continuous recordings to interpretable event-related results, and its boundary and baseline choices are scientifically consequential.

Acceptance criteria:

- Epoch start, end, baseline, and relevant rejection criteria are configurable and validated.
- Epochs reference the exact recording version and event set they were derived from.
- Overlapping, out-of-range, or too-short windows are rejected with an actionable message.
- The epoch configuration is recorded in the run manifest.

**FR-018 — Evoked responses**
**Priority:** P1

Users must be able to average compatible epochs and display evoked waveforms.

Rationale: Averaging compatible trials improves the signal-to-noise ratio and is the canonical event-related result.

Acceptance criteria:

- Averaging is permitted only across epochs that are compatible in time base, sampling frequency, and channels.
- The evoked waveform display supports channel selection and amplitude scaling.
- The number of accepted and rejected epochs is recorded.
- The evoked output is stored as an artifact with a manifest.

**FR-019 — Spectral analysis**
**Priority:** P1

Users must be able to compute and visualise power spectral density (PSD).

Rationale: Spectral content is fundamental to MEG interpretation and a natural complement to time-domain results.

Acceptance criteria:

- The estimation method and parameters (for example window length and overlap) are configurable and recorded.
- PSD can be computed per channel and aggregated, with a configurable frequency range.
- The PSD visualisation is clearly labelled as a derived result.
- The output is stored as an artifact with a manifest.

### 3.8 Sensor-Level Analysis and OPM

**FR-020 — Sensor topographies**
**Priority:** P1

Users must be able to plot sensor-level measurements using valid sensor positions.

Rationale: Topographies summarise spatial patterns at the sensor level, but they are only valid when sensor geometry is present and correctly interpreted.

Acceptance criteria:

- Topographies require valid sensor positions and reject recordings without usable geometry with an actionable error.
- Units and coordinate frame are stated.
- The same topography view works for SQUID and OPM sensor layouts where geometry permits.

**FR-021 — Artifact inspection**
**Priority:** P1

Users must be able to mark bad channels and inspect artifacts and may apply selected correction methods.

Rationale: Data quality decisions materially affect results, so they must be inspectable and recorded.

Acceptance criteria:

- Bad-channel marks are persisted per recording version and shown in the viewer.
- Artifacts can be inspected in the signal and topography views.
- Selected correction methods are offered only where their channel and data prerequisites are met, and their application is recorded in the manifest.

**FR-022 — OPM support**
**Priority:** P1

The system must identify OPM recordings and expose compatible sensor and preprocessing workflows.

Rationale: OPM-MEG is not simply ordinary MEG; it has distinct sensor arrays, geometry, and preprocessing assumptions, so treating it as conventional MEG would produce misleading results.

Acceptance criteria:

- OPM recordings are identified from channel types and acquisition metadata.
- OPM workflows declare their assumptions and prerequisites before they run.
- OPM-specific preprocessing steps follow the MNE-Python OPM preprocessing guidance.
- Where OPM-Python is used for a selected integration, its compatibility, licensing, and maintenance are documented.

**FR-023 — Sensor geometry**
**Priority:** P1

Users must be able to visualise sensor positions and orientations in a declared coordinate frame.

Rationale: Sensor positions, orientations, and coordinate frames are central to interpreting MEG and to any spatially informed analysis.

Acceptance criteria:

- Sensor positions and orientations are rendered in an interactive 3D view.
- The coordinate frame and units are explicit.
- Variable OPM sensor geometry is supported, including geometry that varies over time where movement-tracking data exists.
- Recordings without usable geometry degrade gracefully rather than displaying fabricated positions.

### 3.9 Pipelines, Comparison, Export and BIDS

**FR-024 — Pipeline templates**
**Priority:** P1

Users must be able to run versioned, parameterised analysis workflows.

Rationale: Templates make analyses repeatable and shareable and are the basis for reproducibility across runs.

Acceptance criteria:

- Each pipeline version records a definition and a container `image_digest`.
- Supported parameters are typed, validated, documented with defaults, and rejected when invalid before submission.
- A pipeline definition is validated before it can run; references to missing inputs or unsupported parameters are rejected.
- Editing a published version creates a new version rather than mutating history.

**FR-025 — Comparison**
**Priority:** P1

Users must be able to compare raw and processed signals, epochs, or spectral outputs.

Rationale: Comparing before and after processing is how users judge whether a step helped, and comparison must not hide scientific assumptions.

Acceptance criteria:

- Comparable inputs share a linked timeline or frequency axis where their bases allow it.
- A mismatch in time base, sampling frequency, or channels is reported rather than silently misaligned.
- Difference views are deterministic, record their inputs, and are clearly identified as derived visualisations.

**FR-026 — Export**
**Priority:** P1

Users must be able to export plots, selected data, and machine-readable analysis manifests, and to create scoped sharing links.

Rationale: Results must be usable outside the application and shareable without exposing more than intended.

Acceptance criteria:

- Exported plots carry the research disclaimer and the metadata needed to interpret them.
- Exported files are clearly labelled as display renderings rather than analysis inputs.
- The downloaded manifest matches the stored manifest for the run and validates against its declared schema version.
- Shares specify an explicit scope (for example read-only project or single experiment) and expiry, grant only the documented access, and are revocable.

**FR-027 — BIDS import**
**Priority:** P1

Users must be able to import and validate supported BIDS-organised MEG datasets.

Rationale: BIDS is the community convention for organising MEG datasets, and importing it correctly preserves the metadata and companion files that analyses depend on.

Acceptance criteria:

- BIDS is treated as an organisation and validation layer applied to supported recordings, not as an acquisition format.
- A validation result records the BIDS specification version used.
- Companion files such as channel descriptions, coordinate-system information, and event definitions are preserved.
- The frontend presents BIDS validation findings with actionable guidance.

### 3.10 Traceability to the Product Specification

The product specification (`README.md`) defines FR-001..FR-027. This document preserves those identifiers and expands each requirement with a description, a rationale, and acceptance criteria.

| Product-spec ID | Title                | Section in this document |
| --------------- | -------------------- | ------------------------ |
| FR-001          | Authentication       | 3.1                      |
| FR-002          | Projects             | 3.2                      |
| FR-003          | Recording upload     | 3.3                      |
| FR-004          | Format detection     | 3.3                      |
| FR-005          | Metadata inspection  | 3.3                      |
| FR-006          | Channel browser      | 3.4                      |
| FR-007          | Raw signal viewer    | 3.4                      |
| FR-008          | Navigation           | 3.4                      |
| FR-009          | Event inspection     | 3.4                      |
| FR-010          | Basic processing     | 3.5                      |
| FR-011          | Cloud jobs           | 3.5                      |
| FR-012          | Artifacts            | 3.5                      |
| FR-013          | Provenance           | 3.5                      |
| FR-014          | Resource controls    | 3.5                      |
| FR-015          | Security             | 3.6                      |
| FR-016          | Sample workspace     | 3.6                      |
| FR-017          | Epoching             | 3.7                      |
| FR-018          | Evoked responses     | 3.7                      |
| FR-019          | Spectral analysis    | 3.7                      |
| FR-020          | Sensor topographies  | 3.8                      |
| FR-021          | Artifact inspection  | 3.8                      |
| FR-022          | OPM support          | 3.8                      |
| FR-023          | Sensor geometry      | 3.8                      |
| FR-024          | Pipeline templates   | 3.9                      |
| FR-025          | Comparison           | 3.9                      |
| FR-026          | Export               | 3.9                      |
| FR-027          | BIDS import          | 3.9                      |

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

## 6. Acceptance Criteria

The MVP must satisfy the following end-to-end acceptance conditions.

### AC-001 — Project creation

Given an authenticated researcher, when they create a project with a valid name, the project is persisted with the caller as owner and appears in their project list.

### AC-002 — Invalid project input

Given an invalid project payload, when the API receives it, the API returns a documented validation error and does not create a partial project.

### AC-003 — Recording upload and validation

Given a supported MEG recording and its companion files with valid metadata, when the upload and validation workflow completes, the recording becomes `ready` and its acquisition metadata is available.

### AC-004 — Invalid recording

Given an oversized, malformed, incomplete, or unsupported recording, when validation runs, the recording is `rejected` or `failed` with an actionable reason and is not available for analysis.

### AC-005 — Signal viewer rendering

Given a ready recording, when an authorised user opens the Signal Viewer, multiple selected channels render against a navigable timeline with event markers that stay aligned to the signal time base.

### AC-006 — Display and navigation controls

Given a loaded recording, when the user changes the visible time window, selects or hides channels, adjusts amplitude scaling, and returns to the event timeline, the display updates within the signal-navigation latency target and the source recording is unchanged.

### AC-007 — Event alignment

Given a recording with events, when the user navigates to a marked event, the marker aligns with the corresponding sample or time in the signal trace according to the declared time base.

### AC-008 — Asynchronous experiment

Given a ready recording and a valid pipeline version, when an authorised user submits a run, the API returns promptly with an accepted run resource, and the worker processes the run asynchronously.

### AC-009 — Scientific correctness

Given a known test recording, when a filtering, epoched, evoked, or spectral operation runs, the output sampling frequency, channel identity, latency relationships, and numerical results match independently verified expected values within the documented tolerance.

### AC-010 — Idempotency

Given the same recording version, pipeline version, parameters, and idempotency key, when a submission is repeated, the system returns the existing run and does not create conflicting duplicate work or results.

### AC-011 — Artifacts and manifest

Given a successful run, when it completes, its artifacts are downloadable by authorised members and a machine-readable manifest is stored alongside them.

### AC-012 — Reproducible rerun

Given a completed run, when an authorised user reruns it from its recorded configuration, the system resolves the same input and pipeline versions and records a reference to the source run.

### AC-013 — Role enforcement

Given a viewer, when they attempt a write operation, the API rejects the operation even if the request is made directly without using the frontend.

### AC-014 — Project isolation

Given users in separate projects, when one user attempts to access another project's recordings, runs, artifacts, or files, the request is denied without leaking protected information.

### AC-015 — Worker recovery

Given a worker failure during processing, when recovery or retry occurs, the run eventually reaches a valid state without producing duplicate artifacts or duplicate usage records.

### AC-016 — Resource quotas

Given a project at its storage or concurrency limit, when a user attempts an operation that would exceed the limit, the operation is rejected or queued with an actionable message.

### AC-017 — Local reproducibility

Given a clean checkout and the documented prerequisites, when a developer follows the setup guide, the Docker Compose stack starts and the application is usable.

### AC-018 — CI quality gates

Given a pull request, CI runs the required automated checks and fails when a mandatory check fails.

### AC-019 — Sample project without upload

Given a new user, when they open the bundled sample project, they can inspect a recording without uploading any data.

### AC-020 — Scoped sharing and export

Given a project or experiment, when an owner creates a scoped sharing link, the link grants only the declared scope and can be revoked; exported visualisations carry the research disclaimer.

### AC-021 — OPM workflow

Given an OPM recording with sensor-position and acquisition metadata, when the user reviews sensor types, units, positions, orientations, and coordinate frames and runs a compatible OPM preprocessing template, the workflow records its assumptions, prerequisites, and sensor geometry alongside its outputs.

## 7. Assumptions and Open Decisions

The following decisions should be resolved early and documented in the relevant project files:

- Which authentication provider or local development mechanism will be used.
- Which exact file variants are supported in the first release for FIF, CTF `.ds`, KIT `.sqd`/`.con`, and UCL FIL OPM `.bin`, including which companion files are required.
- Whether the first processing templates use MNE-Python directly or OPM-Python for selected OPM steps.
- Which durable queue configuration (Celery plus Redis settings and outbox dispatcher behaviour) best fits local and self-hosted environments.
- Whether project-scoped isolation is delivered as a thoroughly tested shared-schema model first, with stricter isolation documented as a subsequent milestone.
- Which object-storage adapter is used for local development (MinIO is the assumed default).
- Whether the optional Tauri desktop shell is pursued and on what schedule.
- Which sample datasets are bundled and under what licence, starting with the MNE sample AEF dataset (CC BY 4.0).
- The exact scope of BIDS support in the first BIDS iteration and which BIDS specification version is pinned.
- The numerical tolerance used for reproducibility checks.
- Which sensor-visualisation library (Three.js or vtk.js) is used for the initial Sensor Explorer.

When a decision is not blocking, choose the simplest secure option, document the rationale, and avoid introducing unnecessary complexity.

## 8. Requirement Management

- Keep requirement identifiers stable when updating this document. New requirements are appended with new identifiers rather than renumbering existing ones.
- Use the prefix `FR-` for functional requirements, `NFR-` for non-functional requirements, and `AC-` for acceptance criteria.
- Every requirement carries a priority from section 2.3.
- Update affected documentation when scope or behaviour changes, and keep the traceability table in section 3.10 current.
- Link critical requirements to tests where practical.
- Do not mark a requirement complete merely because a placeholder or interface exists.
- Treat project isolation, safe file handling, parameterised SQL, secret protection, and reproducibility metadata as release-blocking requirements.
- Record deferred requirements explicitly rather than silently omitting them.
- Keep the product-specification identifiers (FR-001..FR-027) aligned with this document; when a specification-level requirement is refined into additional sub-requirements, record the relationship without renumbering the original.

## Definition of Done

A requirement is Done when all of the following are true:

- The behaviour described in its acceptance criteria is implemented and demonstrated end to end.
- Automated tests cover the requirement, including negative and isolation cases where applicable.
- Formatting, linting, and type checking pass for the affected backend and frontend code.
- The API contract, migrations, or documentation are updated where the requirement changes them.
- Security-relevant changes have been reviewed for authorisation, input validation, and secret handling.
- Observability is in place for any new asynchronous behaviour, including run status, logs, and failure reasons.
- No clinical, regulatory, or compliance claim is made beyond what has been independently established.

The MVP is Done when:

- A developer can run the application using documented instructions.
- A user can sign in, create a project, and manage membership.
- A supported MEG recording can be uploaded or loaded from a documented sample with its companion files, validated, and its metadata and provenance shown.
- The Signal Viewer renders multiple channels against a navigable timeline with event markers, channel grouping, and display controls.
- An event-related pipeline can be submitted as a background job, and epochs, evoked responses, and spectra can be inspected.
- An OPM recording can be identified and an OPM-compatible workflow can be run with its geometry and assumptions recorded.
- Run status, logs, cancellation, and artifacts are available in the frontend, with a machine-readable manifest per successful run.
- A run can be reproduced from its recorded configuration.
- Invalid data and failed runs produce understandable errors.
- Project roles and project isolation are enforced and covered by automated negative tests.
- Resource quotas are enforced and usage is recorded.
- Automated tests cover the core workflow and project isolation, and CI runs the required quality checks.
- The architecture, operational limitations, and deferred scope are documented.
