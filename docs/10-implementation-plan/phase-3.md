# Phase 3 — Milestone 2: Signal Workspace

## 7. Phase 3 — Milestone 2: Signal Workspace

### 7.1 Objective

Deliver the interactive Signal Viewer and metadata panels that let users explore a recording without setting up Python.

**Priority:** P0 — **Weeks:** 4–5

### 7.2 Milestone definition (product specification, section 12)

- Channel browser and responsive signal viewer.
- Time navigation, scaling, and event inspection.
- Sensor and acquisition metadata panels.
- Save and restore viewer state.

Exit criterion: a user can explore a recording without manually setting up
Python. The current implementation satisfies the bounded trace, event, and
sensor metadata portions; anatomical multiplanar rendering and the bundled
sample workspace remain outstanding.

### 7.3 Tasks

#### Channel browser (FR-006)

- [x] Group channels by type (`mag`, `grad`, EEG, EOG, ECG, STIM, OPM).
- [x] Implement search matching channel names and types.
- [x] Support channel selection and visibility persistence per recording version.
- [x] Virtualise or paginate large channel inventories.

#### Signal viewer (FR-007, FR-008, FR-009)

- [x] Render multiple selected channels against time.
- [x] Support per-channel and global amplitude scaling, with reset.
- [x] Display channel labels, units, and the current scale.
- [x] Fetch only bounded signal windows; never download the whole recording to render a section.
- [x] Implement a configurable, bounded visible time window and jump-to-time navigation.
- [x] Keep navigation consistent with the event timeline.
- [x] Render event markers and event channels alongside the traces on an explicit time base.
- [x] Meet the signal-navigation latency target for cached, bounded windows (NFR-001).
- [x] Precompute multiresolution signal summaries for responsive plotting.

#### Metadata panels (FR-005, FR-023 partial)

- [x] Display recording and acquisition metadata alongside the viewer.
- [x] Display channel type, units, and coordinate frame where present.
- [x] Prototype a sensor-geometry panel in a declared coordinate frame.

#### Viewer state and sample workspace (FR-016 partial)

- [x] Save and restore viewer state (channel selection, time window, scaling) without treating display settings as analytical parameters.
- [x] Add viewer loading, partial, error, and empty states with retry.
- [ ] Bundle the MNE sample AEF dataset (CC BY 4.0) with licence and citation display.
- [ ] Allow exploration of the sample recording without uploading data.

### 7.4 Viewer requirements

- The viewer is an exploration tool, not a clinical interpretation system.
- Display transforms (scaling, windowing, grouping) must not modify source data.
- The client requests only the data needed for display; the server enforces a maximum response size.
- Event times must identify the relevant recording time base and sample conventions.
- A recording without usable geometry degrades gracefully rather than displaying fabricated sensor positions.

### 7.5 Dependencies

- Phase 2 (datasets, channels, and metadata records).

### 7.6 Exit criteria

- An authorised user can open a ready recording and navigate multiple linked channels against a timeline.
- Event markers align with the corresponding sample or time in the trace according to the declared time base.
- Display changes update within the latency target and leave the source recording unchanged.
- The complete recording is never loaded into the browser by default.
- A new user can inspect the bundled sample project without uploading data.
- Rendering failures show a safe, retryable state.

### 7.7 Risks

| Risk                                        | Mitigation                                                       |
| ------------------------------------------- | ---------------------------------------------------------------- |
| Browser memory exhaustion on large recordings | Derived, downsampled summaries and bounded fetches              |
| Event misalignment                          | Test against known markers and an explicit time base             |
| Incorrect channel typing or grouping        | Verified fixtures; group by MNE channel type                     |
| Viewer library incompatible with SSR        | Render the signal/sensor canvas only in client components        |

### 7.8 FR mapping

Milestone 2 completes FR-006, FR-007, FR-008, FR-009, and the viewer-state and sample portions of FR-005, FR-016, and FR-023.

