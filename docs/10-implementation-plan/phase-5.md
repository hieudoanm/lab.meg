# Phase 5 — Milestone 4: Private Beta

## 9. Phase 5 — Milestone 4: Private Beta

### 9.1 Objective

Complete the analysis toolkit, formalise OPM workflows, and make the platform usable by external computational neuroscience users.

**Priority:** P1 — **Weeks:** 9–12

### 9.2 Milestone definition (product specification, section 12)

- Event-related epochs and evoked responses.
- OPM sensor metadata validation and a documented preprocessing template.
- Sample projects, onboarding, and exports.
- Security, load, and scientific regression tests.
- Feedback from computational neuroscience users.

Exit criterion: external users can complete the core workflow without developer intervention.

### 9.3 Tasks

#### Event-related analysis (FR-017, FR-018, FR-019)

- [x] Implement epoching with configurable `tmin`, `tmax`, baseline, and rejection criteria.
- [x] Validate windows and reject overlapping, out-of-range, or too-short epochs with an actionable message.
- [x] Reference the exact recording version and event set for every epoch.
- [x] Average compatible epochs and display evoked waveforms with channel selection and scaling.
- [x] Record accepted and rejected epoch counts; refuse to average incompatible epochs.
- [x] Complete PSD estimation with configurable frequency range, per-channel and aggregated display.

#### Sensor-level analysis, OPM, and geometry (FR-020, FR-021, FR-022, FR-023)

- [x] Plot sensor-level topographies using valid sensor positions; reject recordings without usable geometry.
- [x] State units and coordinate frame on every topography.
- [x] Persist bad-channel marks per recording version and show them in the viewer.
- [x] Offer correction methods only where their channel and data prerequisites are met, and record their application.
- [x] Identify OPM recordings from channel types and acquisition metadata.
- [x] Validate OPM sensor metadata (types, units, positions, orientations, frames).
- [x] Publish a documented OPM preprocessing template that declares its assumptions and prerequisites, following the MNE-Python OPM guidance.
- [x] Render sensor positions and orientations in an interactive 3D view with an explicit frame.
- [x] Support variable and time-varying OPM geometry where movement-tracking data exists.

#### Comparison, export, and sample experience (FR-016, FR-025, FR-026)

- [x] Compare raw and processed signals, epochs, or spectral outputs with a linked timeline or axis where bases allow.
- [x] Report a mismatch in time base, sampling frequency, or channels rather than silently misaligning.
- [x] Build the public sample project with licence and citation display and allow unauthenticated viewer access.
- [x] Add guided onboarding that can be dismissed without blocking the workflow.
- [x] Export plots (with the research disclaimer), selected data, and manifests.
- [x] Implement scoped, revocable sharing links with read-only shared pages.

#### Hardening and validation

- [x] Run security, load, and scientific regression tests across the full workflow.
- [x] Collect structured feedback from computational neuroscience users.
- [x] Document known limitations and the scientific limitations statement.

### 9.4 Reproducibility requirements

- Source recordings must not be silently overwritten; preprocessing produces derived artifacts.
- Algorithm changes are reflected in the version identifier; results from different versions must not be silently merged.
- A rerun resolves to the same inputs, pipeline version, parameters, and environment.
- Numerical-equivalence checks define an explicit tolerance where bitwise identity is unrealistic.
- Every completed run has a machine-readable manifest with traceable inputs, parameters, environment, and outputs.

### 9.5 Dependencies

- Phase 4.

### 9.6 Exit criteria

- An external user can complete the core workflow — upload, explore, analyse, inspect, export — without developer intervention.
- An OPM recording flows through metadata validation and a compatible preprocessing template with assumptions recorded.
- Sensor geometry is visualised in a declared frame and degrades gracefully when absent.
- A user can compare an input and a derived result with synchronised navigation when comparable.
- Private resources are never public unless explicitly shared; sharing links are scoped, revocable, and permission-checked.
- Security, load, and scientific regression tests pass.
- Feedback from computational neuroscience users has been collected and triaged.

### 9.7 Risks

| Risk                                    | Mitigation                                                           |
| --------------------------------------- | -------------------------------------------------------------------- |
| OPM treated as ordinary MEG             | Explicit sensor metadata, compatible pipeline requirements, OPM validation |
| Scientific misinterpretation            | Explicit units, coordinate frames, provenance, limitations statement |
| Slow or unusable onboarding             | Sample project and guided tutorial verified with real beta users     |
| Sharing leaks private data              | Private-by-default, explicit scope, server-side permission checks    |
| Numerical regressions slip through      | A regression fixture suite with reference outputs and tolerances     |

### 9.8 FR mapping

Milestone 4 completes FR-016, FR-017, FR-018, FR-019, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, and FR-026.

