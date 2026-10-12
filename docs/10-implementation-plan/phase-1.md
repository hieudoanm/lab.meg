# Phase 1 — Milestone 0: Scientific Proof of Concept

## 5. Phase 1 — Milestone 0: Scientific Proof of Concept

### 5.1 Objective

Prove that MEG Lab can ingest supported recordings and render their signals, including a representative OPM path, before investing in platform infrastructure.

**Priority:** P0 — **Week:** 1

### 5.2 Milestone definition (product specification, section 12)

- Load one supported conventional MEG recording.
- Render multichannel signals and event markers.
- Validate metadata extraction.
- Execute a small MNE processing operation.
- Load one representative OPM recording and verify its ingestion path.

Exit criterion: validated ingestion and signal rendering, including a tested OPM path.

### 5.3 Tasks

- [x] Build a minimal ingestion interface that identifies a recording format and validates its required file set.
- [x] Implement a FIF reader and verify it can open a bundled sample recording.
- [x] Implement a CTF `.ds` reader that treats the directory as a coherent file set.
- [x] Implement a KIT reader covering the supported `.sqd`/`.con` variants chosen for the release.
- [x] Implement a UCL FIL OPM `.bin` reader that also loads its companion metadata.
- [x] Extract sampling frequency, duration, channel count, channel names, channel types, and units.
- [x] Distinguish SQUID magnetometers (`mag`), planar gradiometers (`grad`), auxiliary channels (EEG/EOG/ECG/STIM), and OPM channels.
- [x] Report unknown metadata as unknown rather than fabricating a value.
- [x] Render a static multichannel plot (server-side or minimal client) to prove signal access.
- [x] Overlay event markers on the same explicit time base as the signal.
- [x] Run one small MNE-Python operation (for example a band-pass filter) and inspect its output.
- [x] Load one representative OPM recording and confirm the ingestion path, including sensor units and coordinate frame where available.
- [x] Record SHA-256 checksums for every ingested source file.
- [x] Add a small regression fixture set with independently verified metadata.

### 5.4 Initial format set

Support should be verified against the exact file variants and companion files intended for acceptance. Do not claim support for a format until its reader, validation, and tests are implemented. BIDS is an organisation and validation layer over supported recordings, not an acquisition format (`docs/08-tech-stack.md`).

| Format         | Shape                | Initial handling                                            |
| -------------- | -------------------- | ----------------------------------------------------------- |
| FIF            | Single file          | MNE-native reader                                           |
| CTF `.ds`      | Directory            | Directory treated as a validated file set                   |
| KIT `.sqd`/`.con` | Single file       | Supported variants only                                     |
| UCL FIL OPM `.bin` | File + companions | Reader plus companion-metadata ingestion                   |
| BIDS           | Directory tree       | Deferred to the research-platform roadmap (V4)              |

### 5.5 Dependencies

- Phase 0.

### 5.6 Exit criteria

- One conventional recording loads end to end and its metadata matches verified reference values.
- Multichannel signals and event markers render against a shared time base.
- One small MNE processing operation produces a checked output.
- One OPM recording loads through the same ingestion interface and exposes its sensor metadata path.
- Every ingested file has a recorded checksum.
- No raw signal arrays are stored in relational rows.

### 5.7 Risks

| Risk                                        | Mitigation                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| OPM file variants and companions diverge    | Verify against the exact target dataset early; keep the OPM reader behind an adapter |
| Metadata misread for exotic channels        | Report unknown rather than fabricate; test against verified fixtures               |
| Format detection loads full signal data     | Use bounded header parsing during detection                                       |
| Premature universal-format ambition         | Ship the documented format set; add adapters incrementally                        |

### 5.8 FR mapping

Milestone 0 begins FR-004 (format detection), FR-005 (metadata inspection), and the ingestion portion of FR-003 (recording upload).

