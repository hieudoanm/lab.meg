# MEG Lab — Project Overview

## 1. Project Summary

**MEG Lab** is a full-stack scientific SaaS application for developers, computational neuroscientists, and neuroscience enthusiasts to organise projects, upload magnetoencephalography (MEG) recordings, inspect neural signals, visualise sensor geometry and brain activity, run asynchronous electrophysiology pipelines, and share reproducible experiments securely with collaborators.

The product supports both conventional SQUID-MEG and optically pumped magnetometer MEG (OPM-MEG) within the same application through a shared project and experiment model, with technology-specific workflows where the measurement assumptions genuinely differ.

The project demonstrates end-to-end software engineering across a React and TypeScript frontend, an asynchronous Python backend, a PostgreSQL database, background processing, object storage, cloud infrastructure, and automated deployment.

MEG Lab is an independent portfolio project inspired by the engineering challenges of scientific electrophysiology software. It must not copy proprietary software, branding, source code, or confidential workflows from any existing company.

## 2. Problem Statement

Computational electrophysiology research often involves multiple projects, large multichannel time-series recordings, sensor geometries, computational pipelines, and collaboration between researchers and developers.

A useful MEG platform needs to make it possible to:

- Organise research projects and associated MEG recordings.
- Upload FIF, CTF, KIT, UCL FIL OPM, and BIDS-organised recordings and validate their structure and acquisition metadata.
- Inspect neural signals through interactive channel and timeline visualisations.
- Inspect sensor geometry, channel types, units, and coordinate frames.
- Execute signal-processing and event-related pipelines without blocking the web application.
- Track processing status, failures, and output artifacts.
- Preserve pipeline parameters, software versions, and data provenance.
- Control access to research recordings across projects and collaborators.
- Maintain reliable, secure, and reproducible infrastructure.

MEG Lab brings these workflows together in one coherent application.

## 3. Product Vision

Build a polished, production-style scientific SaaS platform that demonstrates how modern full-stack engineering can support MEG and OPM-MEG research.

The product should be sufficiently complete that a reviewer can create a project, upload or select a MEG recording, inspect the signals, channels, events, and sensor geometry, launch an analysis pipeline, and examine its epochs, evoked responses, or spectra without manually interacting with the database or backend.

The product promise is:

> Go from a raw MEG recording to an interpretable, reproducible neural signal analysis in the cloud.

MEG Lab is an educational and research platform, not a clinical diagnostic tool. The project should prioritise engineering quality, usability, security, and reproducibility over the number of features.

## 4. Target Users

### 4.1 Computational Neuroscience Learner

A technically capable learner who understands some Python, is curious about neuroscience, and wants to experiment with real MEG recordings without maintaining a scientific computing server.

Primary needs:

- Create and manage projects.
- Upload recordings and inspect their acquisition metadata.
- Explore channels, signals, and events against a navigable timeline.
- Submit and monitor processing jobs.
- Review results and their provenance.

### 4.2 Scientific Software Developer

A developer building and testing electrophysiology tools who needs to run code, inspect data, and iterate quickly.

Primary needs:

- Hosted Python environments with controlled access to project recordings.
- Programmatic job submission and monitoring via API.
- Reproducible execution environments with versioned containers.
- Export and share analysis workflows.

### 4.3 MEG Researcher

A researcher analysing experimental recordings who needs to produce traceable, reproducible results.

Primary needs:

- Channel selection, filtering, epoching, and evoked-response analysis.
- Spectral analysis and sensor-level topographies.
- Artifact inspection and bad-channel marking.
- Experiment history with full reproducibility manifests.

### 4.4 OPM-MEG Researcher

A researcher working with flexible optically pumped magnetometer sensor arrays who needs explicit geometry and acquisition assumptions.

Primary needs:

- Inspect scalable OPM sensor arrays, channel types, units, positions, orientations, and coordinate frames.
- Review slow field fluctuations and auxiliary channels relevant to OPM recordings.
- Select OPM-compatible preprocessing and workflow templates with their assumptions stated.
- Record sensor geometry and processing configuration together with outputs.

### 4.5 Research Educator

An educator demonstrating brain-signal analysis who needs interactive, guided exploration of MEG recordings.

Primary needs:

- Public sample projects with guided onboarding.
- Interactive visualisations for teaching.
- Export visualisations and manifests for educational materials.

## 5. Product Goals

### Goal 1: Deliver a complete MEG analysis workflow

A user can move from project creation to signal exploration, event-related analysis, and results within the web application.

### Goal 2: Demonstrate full-stack ownership

The implementation covers frontend development, API design, database modelling, background processing, infrastructure, testing, and deployment.

### Goal 3: Make MEG signals understandable

The application presents channels, time-series signals, events, sensor geometry, pipeline parameters, and results in a clear and accessible interface.

### Goal 4: Establish secure multi-project tenancy

Different users can use the application without accessing one another's projects, recordings, jobs, or results unless explicitly shared.

### Goal 5: Support reproducible computation

Each pipeline run records its algorithm version, parameters, input dataset version, container image digest, and execution status.

### Goal 6: Provide a maintainable codebase

The repository has clear architectural boundaries, automated tests, reproducible setup instructions, and documented engineering decisions.

## 6. Non-Goals

The initial release will not:

- Diagnose neurological conditions or recommend medical treatment.
- Claim clinical validity or regulatory certification.
- Acquire data directly from physical MEG or OPM systems.
- Turn SQUID tomographic noise handling or signal-space separation (SSS) into the product focus.
- Implement real-time neurofeedback or closed-loop stimulation.
- Train large-scale deep learning models on MEG recordings.
- Replace specialist MEG analysis software (MNE-Python, FieldTrip, Brainstorm, etc.).
- Support arbitrary scientific file formats beyond the documented format set (FIF, CTF, KIT, UCL FIL OPM `.bin`, and BIDS-organised MEG datasets).
- Implement billing, subscriptions, or a commercial pricing system.
- Use microservices or Kubernetes without a demonstrated need.

These features may be considered in future iterations, but they must not compromise the initial delivery.

## 7. Scientific Data

The initial demonstration will use appropriately licensed public MEG datasets such as:

- **MNE sample auditory-evoked-field (AEF) dataset** (CC BY 4.0).
- **Appropriately licensed public MEG and OPM-MEG datasets** whose terms permit research and educational use.

The application should preserve available provenance information, including:

- Dataset source and source URL.
- Subject identifier (anonymised).
- Recording duration and sampling frequency.
- Channel count, channel names, channel types, and units.
- Sensor positions, orientations, and coordinate frame.
- Event definitions and their time-base conventions.
- Acquisition format and source-file references.
- File checksum.
- Validation status.
- Preprocessing and analysis parameters.

The project must respect each dataset's published terms and citation requirements.

Large raw recordings must not be committed to the Git repository. Use small synthetic fixtures for automated tests and development, and download public sample data through documented instructions when needed.

Only public or synthetic data should be used in the portfolio demonstration.

## 8. Primary User Workflow

The primary workflow is:

1. A user signs in.
2. The user creates or opens a project.
3. The user uploads a supported MEG recording (FIF, CTF `.ds`, KIT `.sqd`/`.con`, or UCL FIL OPM `.bin`) together with its companion files.
4. MEG Lab validates the file set, extracts acquisition metadata, and records its provenance.
5. The user opens the Signal Viewer.
6. The user selects and groups channels, navigates the recording timeline, and inspects events.
7. The user optionally inspects sensor geometry in the Sensor Explorer.
8. The user submits an event-related analysis pipeline (for example filtering, epoching, and averaging).
9. MEG Lab processes the pipeline asynchronously in an isolated worker.
10. The user inspects the epochs and evoked results and compares them with the original signals.
11. The user exports artifacts and a reproducible experiment manifest.
12. The user can share the project or a scoped view of the experiment.

Every stage should provide meaningful feedback, including loading states, validation errors, processing progress, and recovery instructions.

## 9. Technology Direction

The intended technology stack is:

- **Frontend:** Next.js, React, and TypeScript.
- **Signal visualisation:** Plotly.js or a custom WebGL/canvas renderer for high-density time-series.
- **Sensor visualisation:** Three.js or vtk.js for sensor layouts and geometry.
- **Backend API:** Python, FastAPI, and Pydantic.
- **Database access:** PostgreSQL using asynchronous drivers and explicit SQL.
- **Background processing:** Redis-backed queue initially, or managed queue service, with a separate worker.
- **File storage:** S3-compatible object storage for source recordings and derived artifacts.
- **Scientific runtime:** Versioned OCI containers with MNE-Python, NumPy, and SciPy; evaluate OPM-Python for selected OPM integrations.
- **Dataset organisation:** The BIDS MEG specification for BIDS-organised datasets.
- **Observability:** Structured logs, metrics, and error tracking.
- **Infrastructure:** Google Cloud Platform and Terraform (or AWS equivalent).
- **CI/CD:** GitHub Actions.
- **Testing:** Frontend unit and browser tests, backend unit and integration tests, and scientific, spatial, and security-focused tests.

The detailed decisions and rationale are specified in `08-tech-stack.md`.

Local commits use Husky and lint-staged to apply fast formatting and lint checks to staged backend and frontend source files. CI remains the authoritative full quality gate.

## 10. Security and Privacy Principles

Security must be implemented as part of the architecture, not added as a final polishing step.

The application must:

- Authenticate users before granting access to private resources.
- Enforce authorisation on the server.
- Validate project membership for every project-scoped operation.
- Prevent cross-project access to records and stored files.
- Use parameterised SQL.
- Keep secrets out of source control and frontend bundles.
- Limit upload sizes and validate file contents (format detection and bounded metadata parsing).
- Use private object storage and short-lived signed URLs where appropriate.
- Avoid logging credentials, access tokens, or raw signal data unnecessarily.
- Provide automated tests for unauthorised access attempts.

MEG Lab is a portfolio demonstration and must not claim compliance with HIPAA, ISO 27001, medical-device regulations, or other certifications without independently establishing the applicable requirements and evidence.

MEG recordings and their metadata or companion files can contain sensitive participant information. An educational SaaS must not assume that physiological recordings are anonymous simply because they do not resemble medical images. Cloud storage and sharing should be designed around privacy from the start, not added when collaboration features arrive.

## 11. MVP Definition of Done

The minimum viable product is complete when:

- A developer can run the application using documented instructions.
- A user can access a workspace and create a project.
- A supported MEG recording can be uploaded or loaded from a documented sample, including its companion files.
- Recording, channel, and sensor metadata are visible.
- The Signal Viewer renders multiple channels against a navigable timeline with event markers.
- A processing pipeline can be submitted as a background job.
- Job status, logs, and results are available in the frontend.
- Invalid data and failed jobs produce understandable errors.
- Project and role permissions are enforced.
- Automated tests cover the core workflow and project isolation.
- CI runs the required quality checks.
- The architecture and operational limitations are documented.
- A cloud deployment can be reproduced using Terraform when cloud credentials are available.

## 12. Success Criteria

The project should demonstrate the following outcomes:

| Area                 | Success criterion                                                                 |
| -------------------- | --------------------------------------------------------------------------------- |
| User experience      | A reviewer can complete the primary workflow without developer assistance.        |
| Frontend             | Strictly typed React components with meaningful loading, error, and empty states. |
| Backend              | Documented REST endpoints with validated request and response models.             |
| Database             | Versioned migrations, parameterised SQL, and appropriate indexes.                 |
| Scientific computing | Correct signal operations verified against known test data and reference outputs. |
| Background jobs      | Durable job states, bounded retries, and idempotent processing.                   |
| Security             | Automated negative tests for cross-project access.                                |
| Testing              | Repeatable automated checks covering critical workflows.                          |
| DevOps               | Reproducible infrastructure and documented deployment procedures.                 |
| Portfolio            | A clear README, architecture diagram, demo, and documented trade-offs.            |

## 13. Guiding Principles

1. **Working software first:** deliver a complete vertical slice before expanding the scope.
2. **Signals first:** make raw recordings, channels, events, and time-series visualisation intuitive and responsive.
3. **Scientific integrity:** preserve provenance and distinguish display transformations from analytical computations.
4. **One platform, multiple sensor technologies:** support conventional MEG and OPM-MEG through a shared model with technology-specific workflows.
5. **Secure by default:** deny access unless authentication and authorisation checks succeed.
6. **Explicit contracts:** use documented API models and database migrations.
7. **Reliable asynchronous processing:** assume jobs may be delivered more than once or fail midway.
8. **Simple architecture:** prefer a modular monolith and separate worker over unnecessary distributed complexity.
9. **Reproducibility:** record the inputs, parameters, container images, and versions needed to understand an analysis.
10. **Evidence over claims:** document only features that have actually been implemented and tested.
11. **Incremental delivery:** keep every implementation milestone runnable and reviewable.
12. **No clinical claims:** present MEG Lab as a research-software demonstration, not a medical product.
