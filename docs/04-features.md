# MEG Lab — Features

## 1. Purpose

This document describes how MEG Lab features should behave from the user's perspective and how their behaviour should be implemented.

It complements:

- `01-overview.md` — product vision and scope.
- `02-requirements.md` — functional and non-functional requirements (FR-001..FR-027).
- `03-user-stories.md` — user goals and acceptance scenarios.
- `05-architecture.md` — system boundaries and technical responsibilities.
- `06-data-model.md` — entities, relationships, and constraints.
- `07-api-specification.md` — REST endpoints and request/response models.
- `08-tech-stack.md` — technology choices and rationale.
- `09-design.md` — interface and interaction design.

Features should be delivered in vertical slices: a user should be able to complete a useful workflow through the frontend, API, database, and relevant background services before the next major workflow is started.

The canonical entities referenced throughout are `users`, `projects`, `project_members`, `datasets`, `dataset_versions`, `file_assets`, `upload_sessions`, `recordings`, `channels`, `event_sets`, `sensor_configurations`, `pipelines`, `pipeline_versions`, `experiment_runs`, `artifacts`, `annotations`, `usage_records`, and `audit_events`.

MEG Lab is a research-software demonstration. It does not diagnose conditions, recommend treatment, or claim clinical or regulatory validity.

Each feature section below states its **user-visible behaviour**, **inputs**, **outputs**, **states**, **edge cases**, and **acceptance conditions**. Priority references map to the P0–P3 definitions and to functional requirements FR-001..FR-027.

## 2. Feature Priorities

| Priority | Meaning | Product stage |
| -------- | ------- | ------------- |
| P0       | Required for a usable, secure MVP | Core platform |
| P1       | Important for a convincing portfolio demonstration | Computational laboratory |
| P2       | Valuable enhancement after the MVP is stable | Advanced platform |
| P3       | Later exploration, dependent on demonstrated demand | Ecosystem |
## 3. Authentication and Project Context

**Priority:** P0 (FR-001, FR-015)

### Description
Users authenticate and work within a project. Project context determines which datasets, pipelines, runs, artifacts, annotations they may access.

### User-visible behaviour
- Clear sign-in experience.
- After auth, see available projects.
- Select project or return to last valid selection.
- Active project displayed consistently in navigation/header.
- Session expiry prompts recovery.
- If no memberships, explain next steps (create project or open sample).

### Inputs
- Credentials/OIDC callback.
- Active project selection.
- Project identifier in API requests.

### Outputs
- Authenticated session.
- Verified project context.
- Project-scoped resource collections.
- Signed-out state clearing cached project data.

### Behaviour
1. Authenticate via managed OIDC provider.
2. Retrieve identity and project_members roles.
3. Select project with verified membership.
4. Load project-scoped resources.
5. Include project context in API requests.
6. Independently verify membership/permissions server-side for every request.

### States
- `anonymous`: only public sample reachable.
- `authenticated-no-project`: signed in but no memberships.
- `active`: signed in with verified project context.
- `expired`: session invalid; resources hidden with recovery prompt.

### Edge cases
- Invalid/expired session.
- Removed membership or role downgrade.
- Project archived/deleted while open.
- Multiple projects.
- Altered project identifier in API request.
- Identity provider unavailable.
- Concurrent sign-out in another tab.

### Acceptance conditions
- Cannot access private resources without auth.
- Changing active project changes visible scope.
- Direct API cannot bypass membership checks.
- Cross-project reads/writes rejected even if storage key known.
- Auth errors handled without exposing sensitive details.

## 4. Project Management and Membership

**Priority:** P0 (FR-002, FR-015)

### Description
Projects organise datasets and analyses. Membership is project-scoped.

### User-visible behaviour
Project list shows: name, description, dataset count, status (active/archived), visibility, last updated, available actions. Users can search, paginate, create, inspect, edit, archive per permissions.

### Create project
Required: name. Optional: description. Prevent duplicate submissions with validation.

### Project details
Overview, dataset list, pipeline list, experiment history, provenance, role-appropriate actions.

### Membership management (P1)
Owners manage: list members/roles, add/change/remove members, preserve last-owner invariant. Membership changes generate audit events.

### States
- `active`: editable per role.
- `archived`: read-only by default.
- `deleting`: locked.
- `deleted`: resources removed per documented semantics.

### Acceptance conditions
- Only authorised roles can create/rename/archive/delete.
- Membership changes authorised server-side and audited.
- Archiving preserves data and makes read-only.
- Deletion follows documented semantics for source/derived/cached/backup data.

## 5. Dataset Upload and Validation

**Priority:** P0 (FR-003, FR-004, FR-005)

### Supported formats
FIF, CTF `.ds`, KIT `.sqd`/`.con`, UCL FIL OPM `.bin`, BIDS-organised datasets.

### Upload workflow
1. Select project. 2. Enter metadata. 3. Select files. 4. Upload (resumable). 5. Validate. 6. Display result.

### Validation
Checks: format/extension, size limits, integrity/checksum, header parseability, dimensions/spacing, orientation/affine, data type, resource bounds (decompression), metadata consistency. Errors safe and actionable.

### Lifecycle
`pending_upload` → `validating` → `ready`; outcomes `rejected`, `failed`. Failed validation not treated as success. Immutable dataset_versions created.

### Dataset details
Name/id, source/provenance, format/checksum, duration, sampling freq, channels, spatial metadata where applicable, validation status, timestamps, available actions.

### States
- `pending_upload`, `validating`, `ready`, `rejected`, `failed`
- per-file: `uploaded`, `verified`, `quarantined`

### Acceptance conditions
- Authorised user uploads supported recording and reaches `ready` with correct metadata.
- Invalid files `rejected` with safe messages.
- No large raw arrays stored in relational rows unnecessarily.
- Every accepted asset has recorded checksum.

## 6. Signal Viewer, Channels, Events, Navigation

**Priority:** P0 (FR-006, FR-007, FR-008, FR-009)

### Viewer
Responsive multichannel time-series plotting with channel selection, grouping (mag/grad/other/aux), search, bad-channel indicators.

### Navigation
Pan/zoom time axis, jump to time/events, show visible window and duration. Bounded requests.

### Events
Event markers aligned to recording time base, filter by type, click to navigate, event sets listed with counts.

### Display controls
Amplitude scaling, show/hide channels/groups, reset view. Display transforms distinct from analysis.

### Data retrieval
Request bounded windows/multiresolution summaries; no full recording download for viewport rendering.

### States
- `loading`, `ready`, `partial`, `error`

### Edge cases
- Long recordings, many channels, missing events, bad channels, network interruptions.
- Access revocation mid-view.

### Acceptance conditions
- Can view selected channels, navigate timeline, inspect events, adjust scaling without loading entire recording.
- Bad channels clearly marked.
- Bounded responses enforced server-side.

## 7. Cloud Jobs, Processing, Artifacts, Provenance

**Priority:** P0 (FR-010, FR-011, FR-012, FR-013)

### Basic processing
Validated filtering and channel operations. Preview without modifying source. Records params/env.

### Async jobs
Submit → get run id (prompt), isolated worker, record full context, idempotent, validate before exec.

### Monitoring
States queued/running/succeeded/failed/cancelled. Logs structured, safe. Cancellation honoured.

### Artifacts & manifests
Each artifact has key/checksum/media type/metadata; short-lived scoped download URLs. Manifest with full provenance including sensor config refs, environment, versions.

### Reproducibility
Rerun from manifest creates new traceable run; reports missing inputs.

### States
Per run: queued/running/succeeded/failed/cancelled. Artifacts: available/expired/deleted.

### Acceptance conditions
- Async submission returns id promptly; isolated execution.
- Status/logs visible; safe errors on failure.
- Cancellation works for cancellable states.
- Successful run has artifacts + manifest with provenance.
- Downloads integrity-checked and access-controlled.

## 8. Epoching, Evoked Responses, Spectral Analysis

**Priority:** P1 (FR-017, FR-018, FR-019)

### Epoching
Configurable tmin/tmax, event selection, baseline, rejection criteria. Epochs reference event set, params, input version.

### Evoked responses
Average compatible epochs; display waveforms; compare with raw/processed.

### Spectral analysis
PSD for selected channels with validated params; plots with units/ranges.

### Acceptance conditions
- Params validated; results stored with provenance.
- Comparisons supported where compatible.
- Units/scaling clear.

## 9. Sensor Topographies, Geometry, OPM Support

**Priority:** P1 (FR-020, FR-022, FR-023)

### Sensor geometry
Inspect positions/orientations, coordinate frame, units. Handle missing geometry. OPM geometry may vary.

### Sensor Explorer
Visualise sensor layout by type, bad channels, coordinate frame; link to channels/viewer.

### Sensor topographies
Plot sensor-level measurements when geometry available; indicate missing positions.

### OPM support
Identify OPM recordings; expose compatible workflows; validate required metadata; document assumptions; record sensor type.

### Acceptance conditions
- Geometry recorded with sensor configuration.
- Topographies require valid geometry; graceful fallback if missing.
- OPM workflows validated and distinguished from SQUID.

## 10. Artifact Inspection, Bad Channels, Correction

**Priority:** P1 (FR-021, FR-025)

### Artifact inspection
Inspect artifacts in context; compare with inputs where compatible.

### Bad channels
Mark/unmark bad channels; persist with recording version; visual indicators.

### Correction methods
Apply selected validated methods; document assumptions; validate compatibility (SQUID vs OPM).

### Comparison
Side-by-side comparison of raw/processed/epochs/spectra with sync where compatible; label clearly.

### Acceptance conditions
- Bad channel changes recorded.
- Correction methods validated before application.
- Comparisons handle incompatible cases gracefully.

## 11. Pipelines, Templates, Notebooks (concept)

**Priority:** P1 (FR-024), P2 (advanced)

### Pipeline templates
Template gallery with documented IO/params; versioned; container image digest recorded.

### Create/version
Immutable versions; changes create new version; scoped access.

### Publish
Mark as template with visibility; no private data exposure.

### Custom analysis (P2)
Hosted Python envs with controlled data access, save env spec/code/logs/artifacts, package as reusable template.

### Acceptance conditions
- Every run references specific pipeline version + image digest.
- Published templates specify visibility; private data not exposed.

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

## 13. Sample Workspace, Explore

**Priority:** P0 (FR-016)

### Landing & Explore
Public samples grid with licence/citation. Anonymous exploration supported.

### Sample flow
Open sample → inspect → (auth required to save/annotate). Saved state preserves version/context.

### Guided walkthrough (P2)
Sequence views/annotations with explanations; share with defined scope.

### Acceptance conditions
- Sample accessible without auth; private data never exposed.
- Licence/citation shown.
- Auth required for stateful save operations.

## 14. Settings, Resource Controls, Quotas

**Priority:** P0 (FR-014), P1

### Settings
Profile, security, compute & storage quotas, API keys, notifications (as per shipped design).

### Resource controls
Upload size, storage, runtime, memory, concurrency enforced server-side. Usage recorded.

### Quotas UI
Show usage vs limits; estimates labelled; approaching/limit states with clear messages.

### Acceptance conditions
- Enforcement before expensive work; consistent UI/API.
- Usage visible and attributable where relevant.
- Clear actionable messages on limit breaches.

## 15. UI States (Global)

**Priority:** P0

All primary screens implement: loading (skeletons), empty (with next action), success, validation error (safe), permission error (non-revealing), network error (retry), server error (safe + request id), partial success, disabled (explain why), permission-denied.

### Acceptance conditions
- No internal paths/stack traces leaked.
- States distinguish recoverable vs non-recoverable.
- Focus predictable; accessible feedback.

## 16. Security, Audit, Health, Operations

**Priority:** P0/P1 (FR-011, FR-014, FR-015)

### Audit
Append-only audit events for security-relevant actions; include actor/action/resource/timestamp; no secrets/raw data.

### Health
`/healthz` liveness, `/readyz` readiness (DB/queue/storage); no secrets.

### Logging
Structured logs with request/run id, operation, outcome; avoid raw data/secrets.

### Privacy
Private by default; explicit sharing; bounded decompression; isolated untrusted code; least privilege.

### Acceptance conditions
- Cross-project access blocked by tests.
- Health endpoints safe.
- Logs structured and safe.

## 17. Feature Completion Definition

A feature is complete when: behaviour documented, FE/BE implement contract, authz enforced, validation/failure/cancel handled, tests pass (incl. scientific correctness where relevant), migrations added, logs/ops adequate, docs updated, no critical security issues, E2E exercised where practical, quality gates pass.

## 18. MVP Definition of Done

MVP ready when core workflow works end-to-end: auth → project → upload/inspect → view signals/events → run basic processing job → get artifacts+manifest → export. OPM/SQUID paths supported per requirements, quotas/audit/health in place, accessibility and states implemented, cross-project access prevented and tested.
