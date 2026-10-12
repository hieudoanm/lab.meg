# MEG Lab SaaS — Product Specification

Product strategy · Functional requirements · Architecture · Data model · Delivery roadmap

> This document is the product-strategy source. The normative implementation set is [`01`–`12`](#normative-documents) plus the [`api-specs/`](api-specs/), [`database/`](database/), and [`diagrams/`](diagrams/) assets. Where this document and the numbered documents disagree on implementation detail, the numbered documents govern.

## Normative documents

| #   | Document                                                 | Governs                                                |
| --- | -------------------------------------------------------- | ------------------------------------------------------ |
| 01  | [`01-overview.md`](01-overview.md)                       | Product vision and scope                               |
| 02  | [`02-requirements.md`](02-requirements.md)               | Functional/non-functional requirements (`FR-`, `NFR-`) |
| 03  | [`03-user-stories.md`](03-user-stories.md)               | User goals and acceptance scenarios                    |
| 04  | [`04-features.md`](04-features.md)                       | User-visible behaviour                                 |
| 05  | [`05-architecture.md`](05-architecture.md)               | Module boundaries, request lifecycle, tenancy          |
| 06  | [`06-data-model.md`](06-data-model.md)                   | Schema, constraints, state transitions                 |
| 07  | [`07-api-spec.md`](07-api-spec.md)                       | REST contract, status codes, error envelope            |
| 08  | [`08-tech-stack.md`](08-tech-stack.md)                   | Allowed technologies and dependency policy             |
| 09  | [`09-design.md`](09-design.md)                           | UI tokens, layout, states, accessibility               |
| 10  | [`10-testing-strategy.md`](10-testing-strategy.md)       | Test layers, fixtures, acceptance criteria             |
| 11  | [`11-implementation-plan.md`](11-implementation-plan.md) | Phased delivery plan                                   |
| 12  | [`12-deployment.md`](12-deployment.md)                   | Operations, CI, and Docker Compose deployment          |

### Supporting assets

| Path                              | Purpose                                                                     |
| --------------------------------- | --------------------------------------------------------------------------- |
| [`api-specs/`](api-specs/)        | OpenAPI 3.1 contract (`api-spec.yaml`, `api-spec.json`)                     |
| [`database/`](database/)          | DBML schema (`meg-lab.dbml`) and layout                                     |
| [`diagrams/`](diagrams/)          | Mermaid diagrams (architecture, data flow, upload, experiment, end-to-end, CI/CD) |
| [`design/`](design/)              | HTML design prototype (`html/`) and captured screenshots (`images/`)        |

---

## 1. Product vision

MEG Lab is a cloud-based computational electrophysiology workbench for developers, computational neuroscientists, and neuroscience enthusiasts.

It enables users to upload magnetoencephalography (MEG) recordings, inspect neural signals, run reproducible analyses, visualise sensor geometry and brain activity, and share experiments — without maintaining their own scientific computing infrastructure.

The product supports both conventional SQUID-MEG and optically pumped magnetometer MEG (OPM-MEG) within the same application.

## Product principles

Signals first

Make raw recordings, channels, events, and time-series visualisation intuitive and responsive.

One platform, multiple sensor technologies

Support conventional MEG and OPM-MEG through a shared project and experiment model, with technology-specific workflows.

Scientific computation without infrastructure overhead

Offer managed Python environments, asynchronous jobs, and reproducible pipelines.

Reproducibility by default

Preserve input versions, sensor configurations, analysis parameters, software environments, and outputs.

### The product promise

> Go from a raw MEG recording to an interpretable, reproducible neural signal analysis in the cloud.

MEG Lab is an educational and research platform, not a clinical diagnostic tool.

## 2. Target users

| Persona                            | Primary need                        | Desired outcome                                           |
| ---------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| Computational neuroscience learner | Understand MEG signals and analysis | Complete an analysis using real recordings                |
| Scientific software developer      | Develop and test analysis tools     | Execute Python code against MEG datasets                  |
| MEG researcher                     | Analyse experimental recordings     | Produce reliable, traceable results                       |
| OPM-MEG researcher                 | Work with flexible sensor arrays    | Inspect sensor geometry and run appropriate OPM workflows |
| Research educator                  | Demonstrate brain-signal analysis   | Share interactive, reproducible examples                  |

Primary persona: a developer or computational neuroscience enthusiast who knows some Python and wants to explore MEG, but does not want to configure a local scientific computing environment before getting started.

## 3. Scope and priorities

- P0 — Core platform: necessary for the first usable release.
- P1 — Analysis toolkit: enough scientific functionality to make the product valuable.
- P2 — Advanced research: source estimation, notebooks, sophisticated pipelines, and collaboration.
- P3 — Ecosystem: plugins, broader modality support, and community workflows.

The full platform is the product vision. The first release should deliver one complete scientific workflow rather than an incomplete version of every feature.

## Current implementation status

This snapshot reflects the repository state on 2026-10-13. It is intentionally
separate from the product vision above.

### Implemented and exercised

- Development authentication, sign-in/sign-out, password reset, and the
  HttpOnly session-cookie BFF flow.
- Private projects, project detail routing, project-scoped roles
  (`owner`, `editor`, `viewer`), invitations, invitation acceptance, role
  changes, member removal, and the last-owner invariant.
- Dataset registration, signed uploads, browser-side SHA-256 calculation,
  completion checks, validation enqueueing, and worker ingestion.
- Recording metadata, channels, bounded signal windows, event sets/event
  markers, and sensor-geometry availability in the MEG viewer.
- Pipeline creation and version publication, run submission, transactional
  outbox dispatch, Celery execution, logs, artifacts, and reproducibility
  manifests.
- Public/share-token read authorization for supported dataset, recording, and
  run resources, with private resources returning non-disclosing errors.
- Docker Compose startup, health/readiness checks, frontend smoke E2E tests,
  and the recorded project/membership/isolation demo.

### Partial or not yet delivered

- The browser demo does not yet upload a recording or execute a scientific run;
  those workflows are implemented in the application and covered by targeted
  backend/frontend tests, but are not part of the current recording.
- Artifact/provenance UI, richer multi-node pipeline editing, and a full
  dataset-to-run browser walkthrough remain to be added.
- Upload request-size enforcement before local buffering and the remaining
  PostgreSQL-gated integration/security tests are still outstanding.
- UI screenshots in the README and a deployed live environment are still
  outstanding.

## 4. Functional requirements

### 4.1 P0 — Core platform

| ID     | Feature             | Acceptance criteria                                                                                             |
| ------ | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| FR-001 | Authentication      | Users can sign up, sign in, sign out, and recover account access                                                |
| FR-002 | Projects            | Users can create, rename, archive, and delete projects                                                          |
| FR-003 | Recording upload    | Users can upload supported MEG recordings and associated metadata                                               |
| FR-004 | Format detection    | Detect supported file formats and provide clear errors for unsupported inputs                                   |
| FR-005 | Metadata inspection | Extract sampling frequency, duration, channel count, channel types, and acquisition information where available |
| FR-006 | Channel browser     | Search, select, hide, and group channels by type                                                                |
| FR-007 | Raw signal viewer   | Plot multiple channels against time with configurable amplitude scaling                                         |
| FR-008 | Navigation          | Scroll through recording time and change visible time windows                                                   |
| FR-009 | Event inspection    | Display event markers and event channels alongside signal traces                                                |
| FR-010 | Basic processing    | Apply validated filtering and channel-selection operations                                                      |
| FR-011 | Cloud jobs          | Queue analysis jobs and show progress, logs, cancellation, and failure states                                   |
| FR-012 | Artifacts           | Save and download processed recordings, plots, and analysis outputs                                             |
| FR-013 | Provenance          | Record inputs, parameters, software versions, and outputs for every completed run                               |
| FR-014 | Resource controls   | Enforce upload, storage, runtime, memory, and compute limits                                                    |
| FR-015 | Security            | Enforce project permissions and protect private recordings                                                      |
| FR-016 | Sample workspace    | Open a suitable sample recording and guided tutorial without uploading personal data                            |

### 4.2 P1 — Scientific analysis

| ID     | Feature             | Acceptance criteria                                                              |
| ------ | ------------------- | -------------------------------------------------------------------------------- |
| FR-017 | Epoching            | Create epochs around selected events using configurable time windows             |
| FR-018 | Evoked responses    | Average compatible epochs and display evoked waveforms                           |
| FR-019 | Spectral analysis   | Compute and visualise power spectral density                                     |
| FR-020 | Sensor topographies | Plot sensor-level measurements using valid sensor positions                      |
| FR-021 | Artifact inspection | Mark bad channels and inspect artifacts; support selected correction methods     |
| FR-022 | OPM support         | Identify OPM recordings and expose compatible sensor and preprocessing workflows |
| FR-023 | Sensor geometry     | Visualise sensor positions and orientations in a declared coordinate frame       |
| FR-024 | Pipeline templates  | Run versioned, parameterised analysis workflows                                  |
| FR-025 | Comparison          | Compare raw and processed signals, epochs, or spectral outputs                   |
| FR-026 | Export              | Export plots, selected data, and machine-readable analysis manifests             |
| FR-027 | BIDS import         | Import and validate supported BIDS-organised MEG datasets                        |

### 4.3 P2 — Advanced research workbench

- Hosted Python notebooks using MNE-Python.
- Interactive pipeline builder.
- Independent component analysis (ICA) and signal-space projection (SSP) workflows, with appropriate channel and data prerequisites.
- Time-frequency analysis and event-related spectral changes.
- Forward models and source estimation.
- Cortical source visualisation with compatible anatomical MRI data.
- Functional connectivity analysis.
- OPM-specific preprocessing and background-field handling.
- Sensor movement and time-varying geometry workflows where the required tracking data exists.
- Versioned environments, reusable scripts, and Python SDK.
- Private collaborative projects and role-based access.

### 4.4 P3 — Ecosystem and extensions

- Public analysis and tutorial gallery.
- Reusable community pipelines.
- Plugin SDK for custom processing nodes.
- External dataset integrations.
- Batch processing across recordings and participants.
- Advanced compute tiers and optional GPU workloads.
- Multimodal workflows combining MEG with MRI and, later, EEG.

MNE-Python already supports a wide range of MEG formats and analysis methods, while its OPM tutorial documents distinct processing considerations. Use it as the scientific foundation rather than reimplementing these algorithms in the SaaS.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

+2

## 5. User journeys

### Journey A — Explore a recording

Goal: understand what is inside a MEG recording.

1. Open a public sample project.
2. Inspect recording duration, sampling frequency, and channel types.
3. Plot selected channels and navigate the recording timeline.
4. Inspect event markers and identify a time interval of interest.
5. Save a viewer configuration and annotated screenshot.

Success metric: percentage of new users who inspect a recording and save a meaningful result.

### Journey B — Run an event-related analysis

Goal: turn raw data into an interpretable scientific result.

1. Create a project and upload a supported recording with its companion files.
2. Validate metadata and inspect events and channel quality.
3. Configure filtering, epoch boundaries, baseline correction, and relevant rejection criteria.
4. Submit an asynchronous processing job.
5. Inspect the epochs and evoked response, then compare with the original data.
6. Export the results and experiment manifest.

Success metric: successful first analysis, time to completion, and repeat-run rate.

### Journey C — Analyse OPM-MEG

Goal: support flexible sensor configurations without hiding important scientific assumptions.

1. Import an OPM recording and associated sensor-position and acquisition metadata.
2. Review sensor types, units, positions, orientations, and coordinate frames.
3. Inspect slow field fluctuations and relevant auxiliary channels.
4. Select a compatible OPM workflow and inspect its assumptions and requirements.
5. Run preprocessing and compare diagnostic plots before and after processing.
6. Save the processing configuration, sensor geometry, and outputs together.

Success metric: successful OPM workflow completion with all required geometry and provenance recorded.

### Journey D — Develop a custom analysis

Goal: provide a practical environment for scientific software development.

1. Start a hosted Python notebook using a supported environment.
2. Load the project's recording through a controlled data-access mechanism.
3. Use MNE-Python to inspect signals and run an experiment.
4. Save code, environment specification, logs, and output artifacts.
5. Package a successful analysis as a reusable pipeline template.

Success metric: notebook sessions that produce saved, reproducible outputs.

### Journey E — Publish a reproducible experiment

1. Select a completed experiment and review its input references and configuration.
2. Choose which plots, outputs, code, and data may be shared.
3. Publish a read-only project page with an explicit access policy.
4. Allow another user to inspect the results and rerun the workflow when they have authorised access to the inputs.

Success metric: published experiments viewed, cloned, or successfully reproduced.

## 6. Application structure

Home

Recent projects, job status, resource usage

Projects

Recordings, experiments, notebooks, artifacts

Datasets

Uploads, metadata, BIDS import, validation

Signal Viewer

Channels, traces, events, filtering previews

Sensor Explorer

Layouts, sensor types, geometry and coordinates

Pipelines

Templates, configurations, executions and logs

Notebooks

Hosted Python and scientific development

Explore

Public sample datasets and community workflows

Settings

Security, storage, compute quotas and billing

The Signal Viewer should be the central workspace. The Sensor Explorer and OPM-specific controls should be available in context when a recording has the necessary metadata, rather than making users navigate to a separate application.

## 7. Technical architecture

### 7.1 System design

\#chatgpt-mermaid-\_r_24a\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_24a\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_24a\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_24a\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_24a\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_24a\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_24a\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_24a\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_24a\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_24a\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_24a\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_24a\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_24a\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_24a\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;}#chatgpt-mermaid-\_r_24a\_ p{margin:0;}#chatgpt-mermaid-\_r_24a\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_24a\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_24a\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_24a\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_24a\_ .label text,#chatgpt-mermaid-\_r_24a\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_24a\_ .node rect,#chatgpt-mermaid-\_r_24a\_ .node circle,#chatgpt-mermaid-\_r_24a\_ .node ellipse,#chatgpt-mermaid-\_r_24a\_ .node polygon,#chatgpt-mermaid-\_r_24a\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_24a\_ .rough-node .label text,#chatgpt-mermaid-\_r_24a\_ .node .label text,#chatgpt-mermaid-\_r_24a\_ .image-shape .label,#chatgpt-mermaid-\_r_24a\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_24a\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_24a\_ .rough-node .label,#chatgpt-mermaid-\_r_24a\_ .node .label,#chatgpt-mermaid-\_r_24a\_ .image-shape .label,#chatgpt-mermaid-\_r_24a\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_24a\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_24a\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_24a\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_24a\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_24a\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_24a\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_24a\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_24a\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_24a\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_24a\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_24a\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_24a\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_24a\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_24a\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_24a\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_24a\_ .icon-shape,#chatgpt-mermaid-\_r_24a\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_24a\_ .icon-shape p,#chatgpt-mermaid-\_r_24a\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_24a\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_24a\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_24a\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_24a\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_24a\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_24a\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_24a\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_24a\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_24a\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_24a\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_24a\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_24a\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_24a\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_24a\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_24a\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_24a\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_24a\_ .node rect,#chatgpt-mermaid-\_r_24a\_ .node circle,#chatgpt-mermaid-\_r_24a\_ .node ellipse,#chatgpt-mermaid-\_r_24a\_ .node polygon,#chatgpt-mermaid-\_r_24a\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_24a\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_24a\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2px,2px;}#chatgpt-mermaid-\_r_24a\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_24a\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_24a\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;}Next.js + TypeScriptFastAPI ApplicationPostgreSQLObject StorageJob QueueIsolated Python WorkersIsolated Notebook RuntimePipeline Registry

The application API handles authentication, permissions, metadata, project management, and job submission. Scientific workers handle signal processing and longer-running analyses. The browser should request only the relevant signal window and display-resolution data rather than downloading an entire large recording to render a small section.

### 7.2 Recommended technology stack

| Layer                   | Recommended technology                                                | Responsibility                                              |
| ----------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| Frontend                | Next.js, React, TypeScript                                            | Application UI and workspace                                |
| Signal charts           | Plotly.js or a custom WebGL/canvas renderer                           | High-density time-series visualisation                      |
| Sensor visualisation    | Three.js or vtk.js                                                    | 3D sensor layouts and geometry                              |
| API                     | Python FastAPI                                                        | Project and analysis API                                    |
| Scientific processing   | MNE-Python, NumPy, SciPy                                              | Signal I/O, preprocessing, epochs, spectra, source analysis |
| OPM-specific processing | MNE-Python OPM workflows; evaluate OPM-Python for supported pipelines | OPM-specific processing                                     |
| Database                | PostgreSQL                                                            | Metadata and relational entities                            |
| File storage            | S3-compatible object storage                                          | Raw recordings, derivatives, and reports                    |
| Queue                   | Redis-backed queue initially, or a managed queue                      | Asynchronous processing                                     |
| Runtime                 | Versioned OCI containers                                              | Reproducible scientific environments                        |
| Observability           | Structured logs, metrics, error tracking                              | Operational reliability                                     |

MNE-Python provides the main processing backbone. OPM-Python is another relevant project specifically designed for OPM-MEG preprocessing, with modular interfaces that may be suitable for selected integrations. Assess compatibility, licensing, and maintenance before making it a production dependency.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

+1

### 7.3 Data ingestion strategy

Do not treat every MEG dataset as one uploaded file. Some formats are single files; others are directory-based or depend on companion files.

Start with:

- FIF: MNE-native data.
- CTF `.ds`: directory-based recordings.
- KIT: supported recording formats such as `.sqd` and `.con`.
- UCL FIL OPM: supported `.bin` recordings with their associated metadata.
- BIDS-organised datasets: import supported recordings and associated metadata together.

MNE's reader documentation covers multiple vendor formats, including FIF, CTF, KIT, and UCL FIL OPM. Support should be verified against the exact file variants and companion files you intend to accept.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

+1

Implement format adapters behind a common ingestion interface:

1. Identify the recording format.
2. Validate the required file set.
3. Extract metadata through the appropriate reader.
4. Persist an immutable source reference.
5. Generate a metadata summary and preview artifacts.
6. Expose the dataset to compatible analysis workflows.

Avoid promising universal MEG format support in the initial release.

### 7.4 Processing architecture

The initial processing path should be asynchronous:

\#chatgpt-mermaid-\_r_253\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_253\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_253\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_253\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_253\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_253\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_253\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_253\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_253\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_253\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_253\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_253\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_253\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_253\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;}#chatgpt-mermaid-\_r_253\_ p{margin:0;}#chatgpt-mermaid-\_r_253\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_253\_ .cluster-label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_253\_ .cluster-label span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_253\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_253\_ .label text,#chatgpt-mermaid-\_r_253\_ span{fill:rgb(237, 237, 237);color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_253\_ .node rect,#chatgpt-mermaid-\_r_253\_ .node circle,#chatgpt-mermaid-\_r_253\_ .node ellipse,#chatgpt-mermaid-\_r_253\_ .node polygon,#chatgpt-mermaid-\_r_253\_ .node path{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_253\_ .rough-node .label text,#chatgpt-mermaid-\_r_253\_ .node .label text,#chatgpt-mermaid-\_r_253\_ .image-shape .label,#chatgpt-mermaid-\_r_253\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_253\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_253\_ .rough-node .label,#chatgpt-mermaid-\_r_253\_ .node .label,#chatgpt-mermaid-\_r_253\_ .image-shape .label,#chatgpt-mermaid-\_r_253\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_253\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_253\_ .root .anchor path{fill:rgb(175, 175, 175)!important;stroke-width:0;stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_253\_ .arrowheadPath{fill:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_253\_ .edgePath .path{stroke:rgb(175, 175, 175);stroke-width:1px;}#chatgpt-mermaid-\_r_253\_ .flowchart-link{stroke:rgb(175, 175, 175);fill:none;}#chatgpt-mermaid-\_r_253\_ .edgeLabel{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_253\_ .edgeLabel p{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_253\_ .edgeLabel rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_253\_ .labelBkg{background-color:rgba(0, 0, 0, 0.5);}#chatgpt-mermaid-\_r_253\_ .cluster rect{fill:rgb(48, 48, 48);stroke:rgba(255, 255, 255, 0.15);stroke-width:1px;}#chatgpt-mermaid-\_r_253\_ .cluster text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_253\_ .cluster span{color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_253\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:12px;background:rgb(48, 48, 48);border:1px solid rgba(255, 255, 255, 0.15);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_253\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_253\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_253\_ .icon-shape,#chatgpt-mermaid-\_r_253\_ .image-shape{background-color:rgb(0, 0, 0);text-align:center;}#chatgpt-mermaid-\_r_253\_ .icon-shape p,#chatgpt-mermaid-\_r_253\_ .image-shape p{background-color:rgb(0, 0, 0);padding:2px;}#chatgpt-mermaid-\_r_253\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_253\_ .image-shape .label rect{opacity:0.5;background-color:rgb(0, 0, 0);fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_253\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_253\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_253\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_253\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_253\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_253\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_253\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_253\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_253\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_253\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_253\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_253\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_253\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_253\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_253\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_253\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_253\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_253\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_253\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_253\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_253\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(153, 206, 255);}#chatgpt-mermaid-\_r_253\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_253\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_253\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-width:1px;}#chatgpt-mermaid-\_r_253\_ .node rect,#chatgpt-mermaid-\_r_253\_ .node circle,#chatgpt-mermaid-\_r_253\_ .node ellipse,#chatgpt-mermaid-\_r_253\_ .node polygon,#chatgpt-mermaid-\_r_253\_ .node path{fill:rgb(0, 40, 77);stroke:rgba(255, 255, 255, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_253\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_253\_ .node.mermaid-decision .label-container{fill:rgb(0, 14, 26);stroke:rgb(26, 62, 95);stroke-dasharray:2px,2px;}#chatgpt-mermaid-\_r_253\_ .edgePaths .flowchart-link{stroke:rgb(175, 175, 175);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_253\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_253\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;}Upload recordingValidate files and metadataSupported and valid?Report errorsRegister dataset versionCreate experiment runQueue processing jobStart isolated workerLoad recording with MNEExecute validated pipelineSuccessful?Record error and logsValidate outputsStore artifacts and manifestMark run completeNoYesNoYes

Each job should have a stable identifier, immutable inputs, a validated parameter set, a known software environment, resource limits, and a clear terminal state.

### 7.5 Scalability decisions

- Use lazy file access and chunked signal reads where the selected format and processing operation allow it.
- Precompute multiresolution signal summaries for interactive plotting.
- Cache derived artifacts by immutable input identity and processing configuration.
- Keep raw data separate from temporary worker storage.
- Use different worker profiles for light preprocessing, memory-intensive analysis, and optional GPU workloads.
- Introduce a separate notebook orchestrator only when notebook usage justifies the operational complexity.

## 8. Data model

Store application metadata in PostgreSQL and raw or derived recordings in object storage. The schema must represent both the continuous time series and the spatial configuration of the measurement.

### 8.1 Entity relationships

\#chatgpt-mermaid-\_r_25c\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;fill:rgb(237, 237, 237);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_25c\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_25c\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_25c\_ .error-icon{fill:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_25c\_ .error-text{fill:rgb(237, 237, 237);stroke:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_25c\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_25c\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_25c\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_25c\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_25c\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_25c\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_25c\_ .marker{fill:rgb(175, 175, 175);stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_25c\_ .marker.cross{stroke:rgb(175, 175, 175);}#chatgpt-mermaid-\_r_25c\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;font-size:16px;}#chatgpt-mermaid-\_r_25c\_ p{margin:0;}#chatgpt-mermaid-\_r_25c\_ .entityBox{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_25c\_ .relationshipLabelBox{fill:rgb(48, 48, 48);opacity:0.7;background-color:rgb(48, 48, 48);}#chatgpt-mermaid-\_r_25c\_ .relationshipLabelBox rect{opacity:0.5;}#chatgpt-mermaid-\_r_25c\_ .labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_25c\_ .edgeLabel{background-color:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_25c\_ .edgeLabel .label rect{fill:rgb(0, 0, 0);}#chatgpt-mermaid-\_r_25c\_ .edgeLabel .label text{fill:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_25c\_ .edgeLabel .label{fill:rgb(31, 78, 148);font-size:14px;}#chatgpt-mermaid-\_r_25c\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;color:rgb(237, 237, 237);}#chatgpt-mermaid-\_r_25c\_ .edge-pattern-dashed{stroke-dasharray:8,8;}#chatgpt-mermaid-\_r_25c\_ .node rect,#chatgpt-mermaid-\_r_25c\_ .node circle,#chatgpt-mermaid-\_r_25c\_ .node ellipse,#chatgpt-mermaid-\_r_25c\_ .node polygon{fill:rgb(9, 23, 44);stroke:rgb(31, 78, 148);stroke-width:1px;}#chatgpt-mermaid-\_r_25c\_ .relationshipLine{stroke:rgb(175, 175, 175);stroke-width:1px;fill:none;}#chatgpt-mermaid-\_r_25c\_ .marker{fill:none!important;stroke:rgb(175, 175, 175)!important;stroke-width:1;}#chatgpt-mermaid-\_r_25c\_ [data-look=neo].labelBkg{background-color:rgba(48, 48, 48, 0.5);}#chatgpt-mermaid-\_r_25c\_ .node .neo-node{stroke:rgb(31, 78, 148);}#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_25c\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_25c\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].node .neo-line path{stroke:rgb(31, 78, 148);filter:none;}#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_25c\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_25c\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_25c\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_25c\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_25c\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,Segoe UI,Helvetica,Apple Color Emoji,Arial,sans-serif,Segoe UI Emoji,Segoe UI Symbol;}USERPROJECTPROJECT_MEMBERDATASETDATASET_VERSIONRECORDINGSENSOR_CONFIGURATIONEVENT_SETPIPELINEPIPELINE_VERSIONEXPERIMENT_RUNARTIFACTownsincludesparticipatescontainsversionscontainsusesincludesdefinesversionsexecutesproducesconsumes

### 8.2 Core entities

| Entity                  | Important fields                                                                 | Purpose                          |
| ----------------------- | -------------------------------------------------------------------------------- | -------------------------------- |
| `users`                 | `id`, `email`, `display_name`                                                    | User identity                    |
| `projects`              | `id`, `owner_id`, `name`, `visibility`                                           | Workspace                        |
| `project_members`       | `project_id`, `user_id`, `role`                                                  | Collaboration permissions        |
| `datasets`              | `id`, `project_id`, `name`, `source_type`                                        | Logical dataset                  |
| `dataset_versions`      | `id`, `dataset_id`, `version`, `manifest`                                        | Immutable input snapshots        |
| `recordings`            | `id`, `dataset_version_id`, `format`, `duration_s`, `sampling_frequency_hz`      | Recording metadata               |
| `file_assets`           | `id`, `recording_id`, `object_key`, `checksum`, `size_bytes`                     | Raw and companion files          |
| `channels`              | `id`, `recording_id`, `name`, `type`, `unit`, `status`                           | Channel inventory                |
| `sensor_configurations` | `id`, `recording_id`, `sensor_type`, `coordinate_frame`, `geometry`              | Sensor layout and geometry       |
| `event_sets`            | `id`, `recording_id`, `source`, `metadata`                                       | Event definitions and provenance |
| `pipelines`             | `id`, `project_id`, `name`                                                       | Logical workflow                 |
| `pipeline_versions`     | `id`, `pipeline_id`, `definition`, `image_digest`                                | Versioned analysis configuration |
| `experiment_runs`       | `id`, `pipeline_version_id`, `status`, `parameters`, `started_at`, `finished_at` | Execution records                |
| `artifacts`             | `id`, `run_id`, `object_key`, `checksum`, `media_type`                           | Outputs and reports              |
| `usage_records`         | `id`, `user_id`, `run_id`, `resource_type`, `quantity`                           | Quotas and billing               |
| `audit_events`          | `id`, `actor_id`, `action`, `resource_id`, `created_at`                          | Security and traceability        |

Treat this as a logical starting point. For large datasets, channel inventories, event arrays, and geometry may need normalisation or compact storage rather than being stored as large JSON blobs.

### 8.3 Essential data-model rules

1. A logical dataset may contain multiple recordings and multiple versions.
2. Every recording must retain its acquisition format and source-file references.
3. Store channel types and units explicitly; do not assume all channels represent MEG sensors.
4. Sensor positions and orientations must identify their coordinate frame and units.
5. OPM sensor geometry may vary between recordings and may vary over time if movement-tracking data is available.
6. Event times must identify the relevant recording time base and sample conventions.
7. Each experiment must reference exact input versions, pipeline versions, parameters, and software environments.
8. Raw inputs should remain immutable; preprocessing generates derived artifacts instead of silently overwriting source data.

For BIDS support, preserve relevant acquisition metadata and companion files, including channel descriptions and coordinate-system information where applicable. The BIDS MEG specification provides conventions for representing these details.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://bids-specification.readthedocs.io&sz=32)

Brain Imaging Data Structure v1.4.1

+1

### 8.4 Example experiment manifest

```
{
  "schema_version": "1.0",
  "run_id": "run_uuid",
  "inputs": [
    {
      "dataset_version_id": "dataset_version_uuid",
      "checksum": "sha256:..."
    }
  ],
  "pipeline": {
    "name": "event-related-analysis",
    "version": "1.0.0",
    "image_digest": "sha256:..."
  },
  "parameters": {
    "filter": {
      "l_freq_hz": 1.0,
      "h_freq_hz": 40.0
    },
    "epoch": {
      "tmin_s": -0.2,
      "tmax_s": 0.8,
      "baseline_s": [-0.2, 0.0]
    }
  },
  "environment": {
    "python_version": "recorded-at-runtime",
    "mne_version": "recorded-at-runtime"
  },
  "sensor_configuration_id": "sensor_config_uuid",
  "outputs": [],
  "status": "succeeded"
}
```

This is illustrative, not a universal analysis configuration. Filter settings, epoch boundaries, baseline choices, and event definitions must be user-configurable and scientifically justified for each experiment. The actual runtime should populate version fields rather than relying on fixed placeholder values.

## 9. API specification

Use a versioned REST API for metadata and job operations. Add server-sent events or WebSockets if live job updates and collaborative interactions require them.

| Method | Endpoint                           | Purpose                                                     |
| ------ | ---------------------------------- | ----------------------------------------------------------- |
| `POST` | `/api/v1/projects`                 | Create a project                                            |
| `GET`  | `/api/v1/projects`                 | List accessible projects                                    |
| `POST` | `/api/v1/projects/{id}/datasets`   | Create dataset and upload session                           |
| `POST` | `/api/v1/datasets/{id}/complete`   | Finalise upload and begin validation                        |
| `GET`  | `/api/v1/datasets/{id}`            | Get dataset metadata                                        |
| `GET`  | `/api/v1/recordings/{id}`          | Get recording and acquisition metadata                      |
| `GET`  | `/api/v1/recordings/{id}/channels` | List channel metadata                                       |
| `GET`  | `/api/v1/recordings/{id}/events`   | List event sets                                             |
| `GET`  | `/api/v1/recordings/{id}/signals`  | Retrieve a bounded signal window or multiresolution summary |
| `GET`  | `/api/v1/recordings/{id}/sensors`  | Retrieve sensor geometry where available                    |
| `POST` | `/api/v1/pipelines`                | Create a pipeline                                           |
| `POST` | `/api/v1/pipelines/{id}/versions`  | Create a versioned pipeline definition                      |
| `POST` | `/api/v1/runs`                     | Submit an experiment                                        |
| `GET`  | `/api/v1/runs/{id}`                | Retrieve job status                                         |
| `GET`  | `/api/v1/runs/{id}/logs`           | Retrieve authorised logs                                    |
| `GET`  | `/api/v1/runs/{id}/artifacts`      | List outputs                                                |
| `POST` | `/api/v1/projects/{id}/shares`     | Create a scoped sharing link                                |

For the signal endpoint, define explicit parameters for channel selection, time interval, and output resolution. Validate requests server-side and return bounded responses. Never expose arbitrary object-storage paths as a substitute for an access-controlled API.

## 10. Cloud execution, security, and privacy

### 10.1 Execution requirements

- Run scientific jobs outside normal API request handlers.
- Execute user-supplied code in isolated runtimes.
- Apply CPU, memory, disk, runtime, and concurrency quotas.
- Prevent untrusted jobs from accessing application secrets or other users' recordings.
- Restrict worker network access and block cloud metadata endpoints.
- Use short-lived, narrowly scoped storage credentials.
- Make retries idempotent so a duplicated job submission does not silently create duplicate billable runs.
- Store logs and terminal states for failed jobs.
- Provide cancellation and cleanup of temporary processing data.

### 10.2 Research-data protection

- Private by default.
- Explicit sharing scopes and expiration options for share links.
- Upload validation and protections against malformed files and decompression-based resource exhaustion.
- Clear retention and deletion rules covering source files, outputs, caches, and backups.
- Privacy notices warning against uploading identifiable or unauthorised clinical recordings.
- Appropriate data-processing agreements and privacy controls before accepting sensitive research data at scale.

MEG datasets may contain sensitive participant information in their metadata or associated files. An educational SaaS should not assume that physiological recordings are anonymous simply because they do not resemble medical images.

### 10.3 Non-functional requirements

These are initial targets for testing and refinement, not claims about current performance.

| Area              | Proposed target                                                                |
| ----------------- | ------------------------------------------------------------------------------ |
| Availability      | 99.5% monthly for the initial production service                               |
| Signal navigation | Target under 150 ms for cached, bounded signal-window interactions             |
| API latency       | p95 under 300 ms for ordinary metadata reads under target load                 |
| Job submission    | Return a run ID within 2 seconds under normal load                             |
| Uploads           | Resumable transfer with integrity verification                                 |
| Reproducibility   | Every completed run has traceable inputs, parameters, environment, and outputs |
| Security          | No cross-project access through APIs, storage, or worker execution             |
| Observability     | Logs, job status, resource consumption, and actionable failure reasons         |
| Recovery          | Documented backup, restore, and disaster-recovery procedures                   |

Large recordings and complex analyses will naturally take longer. Benchmark using representative recordings from both conventional MEG and OPM-MEG before setting user-facing processing-time estimates.

## 11. Testing strategy

| Test category          | What to verify                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Unit                   | Metadata parsing, time/sample conversions, permissions, parameter validation          |
| Scientific correctness | Filter responses, event alignment, epoch boundaries, units, and expected outputs      |
| Spatial correctness    | Sensor coordinates, orientations, coordinate frames, and geometry transformations     |
| Integration            | Upload, storage, metadata extraction, queues, workers, and artifact retrieval         |
| Security               | Cross-tenant access, malicious files, isolated execution, expired URLs                |
| End-to-end             | Upload → inspect → process → visualise → export                                       |
| Reproducibility        | Same input and configuration resolves to the same scientific workflow and environment |
| Performance            | Large recordings, many channels, concurrent users, and dense signal plots             |
| Recovery               | Worker crashes, retries, cancellation, duplicate submissions, and partial uploads     |

Build a small regression dataset suite containing known sample recordings, event markers, sensor metadata, and expected results. Include both SQUID and OPM examples from sources whose terms permit the intended use.

## 12. MVP and delivery milestones

For the full platform, plan several independently useful releases. A small team could target a private beta in approximately 8–12 weeks, assuming one experienced full-stack developer, a deliberately limited initial format set, and reuse of existing scientific libraries. This is an estimate; OPM ingestion, notebook isolation, and production security can add substantial work.

### Milestone 0 — Scientific proof of concept

P0

Week 1

- Load one supported conventional MEG recording.
- Render multichannel signals and event markers.
- Validate metadata extraction.
- Execute a small MNE processing operation.
- Load one representative OPM recording and verify its ingestion path.

  Exit criterion: validated ingestion and signal rendering, including a tested OPM path.

### Milestone 1 — Platform foundation

P0

Weeks 2–3

- Authentication and project management.
- Object storage, upload sessions, checksums, and metadata records.
- Dataset validation and access control.
- Initial resource limits and audit events.

  Exit criterion: users can securely create projects and upload supported recordings.

### Milestone 2 — Signal workspace

P0

Weeks 4–5

- Channel browser and responsive signal viewer.
- Time navigation, scaling, and event inspection.
- Sensor and acquisition metadata panels.
- Save and restore viewer state.

  Exit criterion: a user can explore a recording without manually setting up Python.

### Milestone 3 — Cloud experiments

P0

Weeks 6–8

- Queue and isolated worker.
- Filtering and basic spectral analysis.
- Job status, logs, failure handling, and cancellation.
- Artifact storage and experiment manifests.

  Exit criterion: users can run an analysis and retrieve a traceable output.

### Milestone 4 — Private beta

P1

Weeks 9–12

- Event-related epochs and evoked responses.
- OPM sensor metadata validation and a documented preprocessing template.
- Sample projects, onboarding, and exports.
- Security, load, and scientific regression tests.
- Feedback from computational neuroscience users.

  Exit criterion: external users can complete the core workflow without developer intervention.

### Post-beta roadmap

| Release | Focus               | Deliverables                                                     |
| ------- | ------------------- | ---------------------------------------------------------------- |
| V1      | Core analysis       | Epoching, evoked responses, PSD, channel quality tools           |
| V1.5    | OPM workflows       | Sensor geometry, relevant diagnostics, specialised preprocessing |
| V2      | Developer workbench | Hosted notebooks, Python SDK, reusable pipelines                 |
| V3      | Source analysis     | Forward modelling, source estimation, anatomical visualisation   |
| V4      | Research platform   | BIDS workflows, collaboration, public experiments, plugins       |
| V5      | Multimodal research | Optional integration with MRI and EEG projects                   |

The milestone order should follow technical dependencies and user feedback. You can build the foundations for advanced source analysis early without exposing a half-finished source-localisation interface in the beta.

## 13. Product metrics

The north-star metric should be weekly users completing a reproducible MEG analysis.

A completed analysis should have traceable inputs, a saved configuration, recorded software versions, and inspectable outputs.

### Supporting metrics

## Activation

New users who inspect a recording and complete a meaningful action.

## Reliability

Upload success, job success, and scientific validation rates.

## Retention

Users who return to explore or analyse another recording.

## Efficiency

Time to first successful analysis and compute cost per run.

## OPM adoption

Users completing OPM-specific workflows successfully.

## Sharing

Experiments viewed, cloned, or reproduced by others.

During beta testing, distinguish between users who cannot finish an analysis because of product usability and those blocked by missing scientific metadata or unsupported acquisition formats. They require different solutions.

## 14. Main risks and mitigations

| Risk                                                | Mitigation                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Too many formats to support                         | Start with a documented set and add adapters incrementally                              |
| OPM workflows are treated as ordinary MEG workflows | Explicit sensor metadata, compatible pipeline requirements, and OPM-specific validation |
| Signal rendering becomes slow                       | Bounded queries, multiresolution summaries, caching, and efficient rendering            |
| Compute costs become unpredictable                  | Job quotas, timeouts, resource accounting, and transparent usage limits                 |
| Incorrect scientific results                        | Reference datasets, numerical regression tests, and recorded processing parameters      |
| Untrusted notebook code compromises infrastructure  | Isolated runtimes, restricted networking, and least-privilege credentials               |
| Users cannot reproduce published results            | Immutable inputs, pinned environments, and versioned pipeline definitions               |
| Users do not pay for the product                    | Validate demand and willingness to pay before investing in expensive hosted computation |

## 15. Final product recommendation

I would position MEG Lab as a developer-first, cloud-native MEG research workbench with first-class OPM-MEG support.

The strongest differentiator is the combination of an interactive signal viewer, managed scientific computation, explicit sensor geometry, and reproducible experiments.

Build in this order:

1. Reliable ingestion of supported MEG recordings.
2. High-quality multichannel signal and event visualisation.
3. Secure asynchronous Python processing.
4. Epoching, evoked responses, and spectral analysis.
5. OPM-specific metadata, geometry, and processing workflows.
6. Hosted notebooks and a Python SDK.
7. Source estimation, BIDS workflows, collaboration, and community extensions.

For implementation, use these primary references:

- [MNE-Python documentation](https://mne.tools/stable/index.html) — scientific processing and supported formats.
- [MNE-Python OPM preprocessing tutorial](https://mne.tools/stable/auto_tutorials/preprocessing/80_opm_processing.html) — OPM-specific considerations.
- [OPM-Python documentation](https://opm-python.readthedocs.io/en/latest/index.html) — an additional OPM preprocessing option.
- [BIDS MEG specification](https://bids-specification.readthedocs.io/en/stable/modality-specific-files/magnetoencephalography.html) — standardised MEG dataset organisation and metadata.

These references provide a practical starting point for a platform that supports both conventional MEG and OPM-MEG without reinventing existing scientific tools.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://github.com&sz=32)

GitHub

+3
