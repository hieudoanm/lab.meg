

## 2. User Roles

### 2.1 Personas

The five personas are defined in `01-overview.md`.

| Persona                            | Primary goal                                                     |
| ---------------------------------- | ---------------------------------------------------------------- |
| Computational Neuroscience Learner | Learn with real MEG data without configuring a scientific server |
| Scientific Software Developer      | Build, run, and iterate on neuroimaging analysis code            |
| MEG Researcher                     | Explore hypotheses and produce traceable, reproducible results    |
| OPM-MEG Researcher                 | Work with flexible OPM sensor arrays                             |
| Research Educator                  | Demonstrate brain-signal analysis with interactive examples      |

### 2.2 Project roles

Tenancy in MEG Lab is project-scoped. A user holds one of the following roles on each project they can access.

| Role   | Typical persona                             | Capabilities                                                                   |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------ |
| Owner  | Any user who creates or is assigned one     | Full control, including members, sharing, deletion, and all editor actions     |
| Editor | Learner, Developer, Researcher, Contributor | Upload datasets, run experiments, create pipelines, annotate, export           |
| Viewer | Educator, invited reviewer                  | Read-only access to datasets, runs, artifacts, and annotations that are shared |

Rules:

- A user may hold different roles on different projects.
- Only owners manage membership and sharing scope.
- Server-side authorisation is authoritative; the frontend only hides or disables unavailable actions.
- Operational (operator) access to the platform does not automatically grant permission to read scientific data.

## 3. Authentication and Project Access

### US-001: Sign up and sign in

**As a** user,
**I want to** create an account and sign in securely,
**so that** I can access the projects and datasets available to me.

Acceptance criteria:

- Given valid credentials, when I sign in, then I receive an authenticated session.
- Given invalid credentials, when I sign in, then I receive a safe error message.
- Given a new user, when I register with a valid email, then an account is created and I can sign in.
- Given an expired session, when I request a protected resource, then the application renews the session or asks me to authenticate again.
- Given an unauthenticated request to a protected API endpoint, then the API rejects the request.
- Authentication errors do not disclose whether another user's account exists unless the identity provider explicitly permits that behaviour.

Priority: P0. Requirements: FR-001. Journeys: all.

### US-002: Sign out and recover access

**As a** user,
**I want to** sign out and recover access to my account,
**so that** my session is safe and I can regain access if needed.

Acceptance criteria:

- Given an active session, when I sign out, then the session is invalidated and I can no longer use it to call protected endpoints.
- Given a forgotten password, when I request recovery, then the flow does not reveal whether the email is registered and uses a time-limited token.
- Given a recovery token that is expired or already used, when I attempt to reset, then the request is rejected safely.
- Sign-out clears client-side cached project data.

Priority: P0. Requirements: FR-001. Journeys: all.
### US-003: Select an active project

**As a** user who belongs to multiple projects,
**I want to** select my active project,
**so that** I work with the correct datasets and runs.

Acceptance criteria:

- Given several project memberships, when I select a project, then the application loads resources belonging to that project.
- Given no membership in the requested project, when I attempt to access it, then the server denies access.
- Changing the active project clears or invalidates cached project-specific data.
- Switching projects does not expose data from the previously selected project.

Priority: P0. Requirements: FR-002, FR-015. Journeys: all.

### US-004: Enforce project role permissions

**As a** project owner,
**I want to** control what members can do,
**so that** access matches their responsibilities.

Acceptance criteria:

- Given a viewer, when they attempt a write operation, then the API rejects it.
- Given an editor, when they upload a dataset or submit a run, then the API permits it.
- Given a non-owner, when they attempt to manage members or sharing, then the API rejects it.
- Given an unauthorised user, when they call the API directly rather than using the UI, then the same permission rules apply.
- Possession of an object-storage key, URL, or resource identifier does not by itself grant access.

Priority: P0. Requirements: FR-015. Journeys: all.

### US-005: Create a project

**As a** user,
**I want to** create a project,
**so that** I can organise related datasets, pipelines, and experiments.

Acceptance criteria:

- Given a valid project name, when I submit the form, then the project is created with me as owner.
- Given an empty or invalid name, when I submit the form, then validation explains what needs to change.
- Given a successful creation, then the project appears in my project list.
- Repeated submission caused by a retry must not unintentionally create duplicate projects when the request uses an idempotency key.
- A new project is private by default.

Priority: P0. Requirements: FR-002. Journeys: B.

### US-006: Browse and search projects

**As a** user,
**I want to** browse and search my projects,
**so that** I can find the work I need.

Acceptance criteria:

- The list displays the project name and relevant summary metadata, such as owner, role, and last activity.
- Search filters results to projects the user can access.
- Pagination does not expose resources outside the user's permitted scope.
- A user with no projects sees a helpful empty state with a create action.
- A search with no matches displays a distinct no-results state.
- Loading and API failures are distinguishable from an empty list.

Priority: P0. Requirements: FR-002. Journeys: all.

### US-007: Edit, archive, or delete a project

**As a** project owner,
**I want to** update, archive, or delete a project,
**so that** the workspace stays organised and I control data lifetime.

Acceptance criteria:

- A permitted user can update supported project fields such as name and description.
- Invalid changes are rejected with actionable feedback.
- A viewer or editor cannot archive or delete a project.
- Archiving does not silently delete datasets, run history, or artifacts.
- Deletion follows documented semantics for source data, derived files, cached copies, and backups.
- An archived project cannot accept new uploads or runs unless that behaviour is explicitly supported and documented.

Priority: P0. Requirements: FR-002, FR-015. Journeys: all.

### US-008: Manage project members and roles

**As a** project owner,
**I want to** manage membership and roles,
**so that** collaborators have appropriate access.

Acceptance criteria:

- An owner can inspect member roles.
- An owner can invite, change, and remove members using the implemented invitation mechanism.
- A non-owner cannot perform owner-only operations.
- The last-owner invariant is preserved.
- Membership changes generate audit events.
- A removed member cannot access protected resources through an existing session after the change takes effect.
- Membership changes take effect for API calls, not only in the UI.

Priority: P0. Requirements: FR-015, FR-026. Journeys: all.

## 5. Dataset Upload and Validation

### US-009: Upload a MEG recording

**As an** editor,
**I want to** upload supported MEG recordings and companion files,
**so that** I can inspect and analyse the data.

Acceptance criteria:

- Given a project I can modify, when I start an upload, then the API returns a scoped upload session with short-lived, narrowly scoped credentials.
- The upload is resumable after an interruption without restarting from the beginning.
- The application shows upload progress and validation status.
- The dataset becomes available for exploration only after validation succeeds.
- The source recording is stored privately.
- The system records provenance, including a SHA-256 checksum of uploaded assets.
- A viewer cannot upload a dataset.
- Uploading to a project I cannot modify is rejected.
- The server validates the completed object before accepting it as a dataset asset.

Priority: P0. Requirements: FR-003, FR-004. Journeys: B, C.

### US-010: Handle invalid or oversized uploads

**As an** editor,
**I want to** understand why an upload failed,
**so that** I can correct the problem.

Acceptance criteria:

- Unsupported formats produce a clear error.
- Malformed files, truncated data, and decompression bombs are rejected safely, with bounded decompression.
- Files exceeding configured size, storage, or concurrency limits are rejected safely.
- A failed upload does not create a dataset version that appears ready for analysis.
- Internal filesystem paths, stack traces, storage keys, and secrets are not shown to the user.
- The failure is logged with a request or operation identifier where appropriate.

Priority: P0. Requirements: FR-003, FR-004, FR-014. Journeys: B.

### US-011: Detect format and inspect metadata

**As an** editor,
**I want to** detect the format and inspect recording metadata,
**so that** I understand the recording before analysis.

Acceptance criteria:

- The system identifies supported formats (FIF, CTF `.ds`, KIT `.sqd`/`.con`, UCL FIL OPM `.bin`, BIDS-organised datasets) and rejects unsupported formats.
- The dataset page displays duration, sampling frequency, channel count, channel types, and acquisition information when known.
- Unknown metadata is explicitly represented as unknown rather than fabricated.
- Dataset and dataset-version status determines which actions are available.
- A dataset still being validated cannot be used for analysis or opened in the viewer.
- Editing metadata or uploading a new file creates a new immutable dataset version rather than overwriting the previous one.

Priority: P0. Requirements: FR-004, FR-005. Journeys: B, C.

## 6. Signal Viewer, Channels, Events and Navigation

### US-012: Browse and select channels

**As a** user,
**I want to** browse, search, select, hide, and group channels by type,
**so that** I can focus on the signals of interest.

Acceptance criteria:

- I can view channels grouped by type (e.g. mag, grad, other, aux).
- I can search for channels by name.
- I can select/deselect multiple channels and hide/show groups.
- Bad channels are clearly marked.
- Channel selection persists across sessions.
- Channel information includes name, type, unit, and status.

Priority: P0. Requirements: FR-006. Journeys: A, C.

### US-013: View raw signals

**As a** user,
**I want to** plot multiple channels against time,
**so that** I can inspect neural signals.

Acceptance criteria:

- Given a ready recording, when I open the viewer, then selected channels render with time axis.
- I can adjust amplitude scaling per view or globally.
- The viewer does not load the entire recording into browser memory at once.
- Plot updates smoothly when changing time window or channels.
- An inaccessible recording cannot be retrieved by changing request URLs.
- Display transformations are distinguished from analytical computations.

Priority: P0. Requirements: FR-007. Journeys: A.

### US-014: Navigate recording timeline

**As a** user,
**I want to** scroll through the recording and change visible time windows,
**so that** I can inspect specific intervals.

Acceptance criteria:

- I can pan and zoom the time axis.
- I can jump to specific time points or events.
- Visible time window and total duration are displayed.
- Navigation remains responsive for long recordings.
- Requests exceeding configured limits return bounded responses.

Priority: P0. Requirements: FR-008. Journeys: A, B.

### US-015: Inspect event markers

**As a** user,
**I want to** display event markers and event channels alongside signal traces,
**so that** I can identify stimuli and responses.

Acceptance criteria:

- Event markers are shown on the timeline aligned to recording time base.
- Event sets are listed with labels and counts.
- I can filter events by type.
- Clicking an event jumps to that time point.
- Events are associated with the correct recording and version.
- Event data respects access controls.

Priority: P0. Requirements: FR-009. Journeys: A, B.

### US-016: Save viewer configuration

**As a** user,
**I want to** save viewer configuration and annotated screenshot,
**so that** I can return to or share a specific view.

Acceptance criteria:

- I can save channel selection, time window, scaling, and event filters as viewer state.
- Saved state references the recording version.
- I can export an annotated screenshot of the current view.
- Viewer state persists across sessions for authorised users.
- Saving requires authentication and stores in accessible project.

Priority: P0. Requirements: FR-016, FR-026. Journeys: A.

### US-017: Apply basic processing

**As an** editor,
**I want to** apply validated filtering and channel-selection operations,
**so that** I can prepare data for analysis.

Acceptance criteria:

- I can configure filtering with validated parameters (e.g. low/high cutoff, notch) with units.
- Invalid parameters are rejected before execution.
- Processing records parameters, input version, and software environment.
- Results are stored as artifacts and can be compared to original.
- Display previews do not modify source data.
- Operations respect resource limits.

Priority: P0. Requirements: FR-010. Journeys: B, C.

## 7. Cloud Jobs, Artifacts, Provenance, and Resource Controls

### US-018: Submit asynchronous job

**As an** editor,
**I want to** queue analysis jobs,
**so that** computation runs asynchronously without blocking the UI.

Acceptance criteria:

- Given valid inputs and permissions, submitting returns a run identifier promptly.
- Jobs run in isolated workers outside API request handlers.
- The run records dataset version, pipeline version, parameters, and environment.
- Repeated submissions with same idempotency key do not create duplicate runs.
- Invalid inputs and inaccessible datasets are rejected before execution.

Priority: P0. Requirements: FR-011. Journeys: B.

### US-019: Monitor job progress and logs

**As an** editor,
**I want to** see job progress, status, and logs,
**so that** I know whether it has completed.

Acceptance criteria:

- Status distinguishes queued, running, succeeded, failed, and cancelled.
- Logs distinguish progress from errors and are accessible to authorised users.
- Logs do not contain credentials, tokens, or unnecessary raw data.
- UI does not display failed/incomplete runs as successful.
- Temporary status fetch failures are communicated clearly.

Priority: P0. Requirements: FR-011. Journeys: B, C.

### US-020: Cancel jobs

**As an** editor,
**I want to** cancel queued or running jobs,
**so that** I can stop unwanted work.

Acceptance criteria:

- I can cancel runs in cancellable states.
- Cancelled runs reach terminal cancelled state; not reported as succeeded.
- Partially produced outputs are not presented as complete artifacts.
- Cancellation releases resources according to quota policy.
- Cancellation is auditable.

Priority: P0. Requirements: FR-011, FR-014. Journeys: B.

### US-021: Handle job failures

**As an** editor,
**I want to** understand and recover from failures,
**so that** I can continue my work.

Acceptance criteria:

- Failed runs display safe, actionable explanations when available.
- Transient infrastructure errors use bounded retries; permanent errors not retried indefinitely.
- Retry is traceable to previous execution.
- Run not marked successful until results persisted successfully.
- No silent duplication/corruption from duplicate delivery.

Priority: P0. Requirements: FR-011. Journeys: B.

### US-022: Save and download artifacts

**As an** editor,
**I want to** save and download generated outputs,
**so that** I can use them outside the platform.

Acceptance criteria:

- Each artifact records object key, checksum, media type, and metadata.
- I can download authorised artifacts via short-lived, scoped URLs.
- Download without permission is rejected even if identifier known.
- Artifacts associated with run that produced them.
- Artifact integrity verifiable via recorded checksum.

Priority: P0. Requirements: FR-012. Journeys: B, E.

### US-023: Record provenance and manifests

**As an** editor,
**I want to** every completed run to record provenance,
**so that** results are traceable and reproducible.

Acceptance criteria:

- Every successful run produces a machine-readable manifest recording inputs, parameters, environment, and outputs.
- Manifest includes schema version, run id, pipeline version, image digest, input versions and checksums, parameters, environment, sensor configuration reference, outputs, and status.
- Inputs, parameters, pipeline version, container image digest, and software environment recorded.
- Coordinate conventions and relevant random seeds recorded where they affect reproducibility.
- Provenance accessible via UI and API.

Priority: P0. Requirements: FR-013. Journeys: B, C, D, E.

### US-024: Reproduce an experiment

**As a** researcher,
**I want to** rerun an experiment from recorded configuration,
**so that** I can confirm reproducibility.

Acceptance criteria:

- I can trigger reproduction from existing manifest.
- Reproduction creates new traceable run linked to original reference.
- Resolves same input versions where still available; reports limitation if unavailable.
- Original run is not mutated.
- Numerical equivalence checked where exact bitwise identity is unrealistic.

Priority: P0. Requirements: FR-013. Journeys: B, D, E.

### US-025: Enforce resource limits

**As an** editor/operator context,
**I want** file-size, runtime, storage, concurrency, and compute quotas enforced,
**so that** platform remains available and costs bounded.

Acceptance criteria:

- Requests exceeding limits rejected before expensive processing.
- Runs exceeding runtime/resource budget terminated and reported.
- Concurrency limits prevent runaway work.
- Enforcement consistent regardless of UI or API.
- Exceeding quota produces clear, actionable message.
- Usage recorded against quotas.

Priority: P0. Requirements: FR-014. Journeys: B, all.

### US-026: Sample workspace

**As a** new or unauthenticated user,
**I want to** explore a bundled public sample,
**so that** I can get value in first few minutes.

Acceptance criteria:

- Can open sample from landing page without signing in.
- Sample uses public/licensed data; licence and citation shown.
- Viewer, navigation, display controls behave as for private datasets.
- Anonymous exploration cannot access private project data.
- Sample source and provenance documented.

Priority: P0. Requirements: FR-016. Journeys: A.

### US-027: Sign in to save sample state

**As a** computational neuroscience learner,
**I want to** save views/annotations from sample after signing in,
**so that** I can return to them.

Acceptance criteria:

- Signing in from sample preserves state or returns to sample.
- Saving requires authentication and creates in accessible project.
- Saved view records dataset version, viewer state, crosshair location.
- Saving does not copy private data to public scope.
- Viewer state persists across sessions.

Priority: P1. Requirements: FR-016. Journeys: A.

### US-028: Guided educational exploration

**As a** research educator,
**I want to** guide learners through a recording interactively,
**so that** I can demonstrate brain-signal analysis.

Acceptance criteria:

- Can sequence sample views with saved orientations/annotations as walkthrough.
- Walkthrough identifies steps and can be shared with defined scope.
- Explanations of coordinates, metadata, channel info visible where relevant.
- Uses public/licensed data consistent with sharing scope.
- Does not make clinical claims.

Priority: P2. Requirements: FR-016. Journeys: A, E.

### US-029: Epoching around events

**As a** researcher,
**I want to** create epochs around selected events,
**so that** I can analyse event-related activity.

Acceptance criteria:

- Can create epochs with configurable time windows (tmin, tmax).
- Can select event types and apply rejection criteria.
- Epochs reference event set, parameters, input version.
- Invalid parameters rejected before execution.
- Epochs stored as artifacts with provenance.

Priority: P1. Requirements: FR-017. Journeys: B.

### US-030: Compute evoked responses

**As a** researcher,
**I want to** average compatible epochs,
**so that** I can examine evoked waveforms.

Acceptance criteria:

- Can compute evoked from selected epochs.
- Evoked waveforms displayed with time axis and channel selection.
- Can compare evoked with original/raw signals.
- Results reference epoch parameters and input versions.
- Units and scaling clearly indicated.

Priority: P1. Requirements: FR-018, FR-025. Journeys: B.

### US-031: Spectral analysis

**As a** researcher,
**I want to** compute and visualise power spectral density,
**so that** I can examine frequency content.

Acceptance criteria:

- Can compute PSD for selected channels with configurable parameters.
- PSD plots display frequency ranges and units.
- Can compare PSD across conditions or with processed data.
- Results stored as artifacts with parameters and provenance.
- Invalid frequency ranges rejected.

Priority: P1. Requirements: FR-019, FR-025. Journeys: B, C.

### US-032: Sensor topographies

**As a** researcher,
**I want to** plot sensor-level measurements using valid sensor positions,
**so that** I can visualise spatial distribution.

Acceptance criteria:

- Can plot topographies when sensor positions available.
- Requires valid coordinate frame and sensor geometry.
- Clearly indicates channels missing positions.
- Topographies reference time/frequency ranges used.
- Cannot plot meaningful topography without geometry (handled gracefully).

Priority: P1. Requirements: FR-020, FR-023, FR-025. Journeys: C.

### US-033: Artifact inspection and bad channels

**As a** researcher,
**I want to** mark bad channels and inspect artifacts,
**so that** I can improve data quality.

Acceptance criteria:

- Can mark/unmark channels as bad.
- Bad channel list persists with recording version.
- Visual indicators in viewer and channel browser.
- Can apply selected correction methods with documented assumptions.
- Changes to bad channels recorded in provenance/annotations.
- Correction methods validated for data type (SQUID vs OPM).

Priority: P1. Requirements: FR-021, FR-025. Journeys: B, C.

### US-034: OPM support and workflows

**As an** OPM-MEG researcher,
**I want to** identify OPM recordings and use compatible workflows,
**so that** I can analyse OPM data appropriately.

Acceptance criteria:

- System identifies OPM recordings (e.g. UCL FIL OPM `.bin`).
- Exposes OPM-compatible preprocessing workflows.
- Validates required sensor/metadata for OPM workflows.
- Warns when using SQUID workflows on OPM data.
- OPM-specific assumptions documented in UI and manifests.
- Records sensor type in provenance.

Priority: P1. Requirements: FR-022. Journeys: C.

### US-035: Sensor geometry inspection

**As an** researcher,
**I want to** inspect sensor positions/orientations and coordinate frames,
**so that** I understand spatial configuration.

Acceptance criteria:

- Can view sensor geometry in declared coordinate frame.
- Positions/orientations shown with units.
- Coordinate frame clearly indicated.
- OPM geometry may vary; variations captured where available.
- Missing geometry handled gracefully.
- Geometry stored with sensor configuration.

Priority: P1. Requirements: FR-023. Journeys: C.

### US-036: Sensor Explorer visualisation

**As a** researcher,
**I want to** visualise sensor layout,
**so that** I can understand spatial arrangement.

Acceptance criteria:

- Sensor Explorer shows sensor types (mag/grad/other) with positions.
- Can toggle bad channels visibility.
- Displays coordinate frame and units.
- Supports 2D/3D layouts where appropriate.
- Links to channel browser and viewer.
- Handles missing positions without crashing.

Priority: P1. Requirements: FR-023. Journeys: C.

### US-037: Pipeline templates

**As an** editor/developer,
**I want to** run versioned, parameterised pipeline templates,
**so that** analyses are consistent and reproducible.

Acceptance criteria:

- Can select from template gallery with documented inputs/outputs/parameters.
- Parameters validated with types, units, defaults.
- Running resolves specific pipeline version and container image digest.
- Templates from public/catalogue used read-only unless explicit permission.
- Pipeline access scoped to project where applicable.

Priority: P1. Requirements: FR-024. Journeys: B, C, D.

### US-038: Create and version pipelines

**As a** developer,
**I want to** define pipelines and create immutable versions,
**so that** analyses are repeatable.

Acceptance criteria:

- Creating pipeline stores name/owner.
- Creating version records definition and runtime container image digest.
- Existing version cannot be silently modified; changes produce new version.
- Viewer cannot create/modify pipelines.
- Pipeline scoped appropriately.

Priority: P1. Requirements: FR-024. Journeys: D.

### US-039: Publish reusable pipeline template

**As an** open-source contributor,
**I want to** publish documented reusable pipeline,
**so that** others can build on work.

Acceptance criteria:

- Can mark pipeline version as template with documented inputs/outputs/parameters.
- Records environment and image digest needed to run.
- Specifies visibility scope.
- Does not expose private datasets from development.
- Others can run without access to private development data.

Priority: P2. Requirements: FR-024, FR-026. Journeys: D, E.

### US-040: Compare signals and results

**As a** researcher,
**I want to** compare raw and processed signals, epochs, or spectral outputs,
**so that** I can evaluate effects.

Acceptance criteria:

- Can compare compatible views side by side.
- Crosshair/selection synchronised where geometry/time compatible.
- Incompatible geometry reported clearly.
- Clearly label input vs derived.
- Does not modify sources.

Priority: P1. Requirements: FR-025. Journeys: B, C.

### US-041: Export plots, data, and manifests

**As a** user,
**I want to** export plots, selected data, and machine-readable manifests,
**so that** I can include in reports.

Acceptance criteria:

- Can export viewer snapshot with orientation/annotations.
- Can export experiment manifest for accessible run.
- Can export selected derived data where supported.
- Exports identify project/dataset version/viewer state.
- Respect access controls; omit unauthorised data.

Priority: P1. Requirements: FR-026. Journeys: A, B, D, E.

### US-042: BIDS import and validation

**As a** researcher,
**I want to** import and validate supported BIDS-organised MEG datasets,
**so that** I can work with standardised data.

Acceptance criteria:

- Can import supported BIDS MEG datasets with required companion files.
- Validation reports errors/warnings with paths.
- BIDS version recorded on dataset and in run manifests.
- Invalid datasets clearly marked; do not pass silently.
- Treated as organisation/validation layer; ingestion uses BIDS metadata.

Priority: P1. Requirements: FR-027. Journeys: B, C.

## 8. Security, Sharing, Audit, and Operations

### US-043: Manage sharing with scoped links

**As a** project owner,
**I want to** share with explicit scope,
**so that** collaborators/reviewers can inspect safely.

Acceptance criteria:

- Can create scoped sharing link with defined visibility/permission level.
- Private by default until explicitly enabled.
- Read-only share cannot permit uploads/runs/membership changes.
- Expired or revoked links stop granting access.
- Does not expose data outside chosen scope.
- Creating/changing/revoking generates audit event.

Priority: P1. Requirements: FR-015, FR-026. Journeys: E.

### US-044: Review audit events

**As an** authorised operator or project owner,
**I want to** trace important changes,
**so that** I can investigate unexpected behaviour.

Acceptance criteria:

- Security-relevant actions generate audit events (auth, membership, sharing, deletion, run submission).
- Each event includes actor, action, resource type/id, timestamp where available.
- Audit records do not contain credentials, tokens, or raw data.
- Ordinary users cannot modify audit history via public endpoints.
- Access respects scope; does not expose unrelated projects.

Priority: P1. Requirements: FR-015. Journeys: E.

### US-045: Monitor service health

**As an** operator,
**I want to** determine application health,
**so that** I can identify operational problems.

Acceptance criteria:

- Liveness endpoint indicates API process alive.
- Readiness endpoint reflects health of essential dependencies (DB, queue, object storage).
- Health endpoints do not disclose credentials/connection strings.
- Logs include context to correlate failures.
- Centralised job status/logs/resource usage/failure reasons available.
- Logs avoid unnecessary sensitive data.

Priority: P0. Requirements: FR-011, FR-014. Journeys: all.

### US-046: Accessibility and clear states

**As a** user,
**I want** accessible controls and meaningful feedback,
**so that** I can complete workflows effectively.

Acceptance criteria:

- Primary workflows navigable with keyboard.
- Form fields have meaningful labels.
- Validation errors associated with relevant fields.
- Status changes communicated without relying on colour alone.
- Loading, empty, success, failure states implemented where relevant.
- Errors explain what happened and how to recover where possible.
- Focus remains predictable after dialogs/submissions/navigation.

Priority: P1. Requirements: FR-001..FR-027. Journeys: all.

## 9. Cross-Cutting Acceptance Rules

These rules apply to every story:

1. Tenant isolation: every read/write/download/job checks project permissions; possession of identifier/storage key is not authorisation.
2. Private by default: datasets, artifacts, annotations private unless explicitly shared.
3. Provenance on every run: inputs, parameters, pipeline version, container image digest, software environment recorded.
4. Resumable uploads: interrupted uploads can resume; server validates completed object.
5. Spatial/temporal metadata: sensor geometry, coordinate frames, units, event time bases explicitly recorded.
6. Immutable versions: dataset versions, pipeline versions, run records not silently overwritten.
7. Invalid input rejected before expensive processing.
8. Errors actionable but do not expose secrets/internal details.
9. Loading/empty/success/failure states implemented where relevant.
10. Idempotency keys for state-changing operations to prevent accidental duplicates.
11. Untrusted files and code handled separately (bounded decompression/parsing for files; isolated/network-restricted runtimes for code).
12. Negative cross-project access tests included.
13. Important workflows have end-to-end coverage.
14. Database changes via versioned migrations with parameterised SQL.
15. API behaviour documented and consistent with specs.
16. Code passes configured quality gates/CI.

## 10. MVP Acceptance Checklist

- [ ] Sign up, sign in, sign out (US-001, US-002)
- [ ] Project selection and role enforcement (US-003, US-004)
- [ ] Create/browse projects (US-005, US-006)
- [ ] Upload supported MEG recordings with validation (US-009, US-010, US-011)
- [ ] Channel browser, signal viewer, navigation, events (US-012..US-015)
- [ ] Save viewer state (US-016)
- [ ] Basic processing and async jobs (US-017, US-018, US-019, US-020, US-021)
- [ ] Artifacts and manifests with provenance (US-022, US-023)
- [ ] Reproducible runs (US-024)
- [ ] Resource limits enforced (US-025)
- [ ] Sample workspace works without auth (US-026)
- [ ] Epoching/evoked/spectral (US-029, US-030, US-031) for core workflow
- [ ] Sensor geometry and OPM identification where applicable (US-034, US-035)
- [ ] Pipeline templates and runs (US-037)
- [ ] Export and sharing (US-041, US-043)
- [ ] Health/audit and accessibility (US-044, US-045, US-046)
- [ ] Cross-project access prevented and tested

## Definition of Done

A user story is complete when all acceptance criteria met, server-side authorisation enforced, states implemented, idempotency handled, migrations added, API documented, provenance recorded, tests added with E2E coverage for important workflows, quality gates pass, accessibility met, and documentation updated. No clinical claims introduced.
