# MEG Lab — Features

## 1. Purpose

This document describes how MEG Lab features should behave from the user's perspective and how their behaviour should be implemented.

It complements:

- `00-overview.md` — product vision and scope.
- `01-requirements/01-requirements.md` — functional and non-functional requirements (FR-001..FR-027).
- `03-user-stories.md` — user goals and acceptance scenarios.
- `04-architecture/04-architecture.md` — system boundaries and technical responsibilities.
- `05-data-model/05-data-model.md` — entities, relationships, and constraints.
- `07-api-specification.md` — REST endpoints and request/response models.
- `08-tech-stack.md` — technology choices and rationale.
- `07-ui-ux-design/07-ui-ux-design.md` — interface and interaction design.

Features should be delivered in vertical slices: a user should be able to complete a useful workflow through the frontend, API, database, and relevant background services before the next major workflow is started.

The canonical entities referenced throughout are `users`, `projects`, `project_members`, `datasets`, `dataset_versions`, `file_assets`, `upload_sessions`, `recordings`, `channels`, `event_sets`, `sensor_configurations`, `pipelines`, `pipeline_versions`, `experiment_runs`, `artifacts`, `annotations`, `usage_records`, and `audit_events`.

MEG Lab is a research-software demonstration. It does not diagnose conditions, recommend treatment, or claim clinical or regulatory validity.

Each feature section below states its **user-visible behaviour**, **inputs**, **outputs**, **states**, **edge cases**, and **acceptance conditions**. Priority references map to the P0–P3 definitions and to functional requirements FR-001..FR-027.

## 2. Feature Priorities

## 2. Feature Priorities

| Priority | Meaning | Product stage |
| -------- | ------- | ------------- |
| P0       | Required for a usable, secure MVP | Core platform |
| P1       | Important for a convincing portfolio demonstration | Computational laboratory |
| P2       | Valuable enhancement after the MVP is stable | Advanced platform |
| P3       | Later exploration, dependent on demonstrated demand | Ecosystem |

## 3. Feature Index

| #   | Document                                                 | Governs                                                |
| --- | -------------------------------------------------------- | ------------------------------------------------------ |
| 01  | [`FEATURE-01-Authentication-and-Project-Context.md`](FEATURE-01-Authentication-and-Project-Context.md) | Authentication and project context (FR-001, FR-015) |
| 02  | [`FEATURE-02-Project-Management-and-Membership.md`](FEATURE-02-Project-Management-and-Membership.md) | Projects and membership (FR-002, FR-015) |
| 03  | [`FEATURE-03-Dataset-Upload-and-Validation.md`](FEATURE-03-Dataset-Upload-and-Validation.md) | Dataset upload and validation (FR-003, FR-004, FR-005) |
| 04  | [`FEATURE-04-Signal-Viewer-Channels-Events-Navigation.md`](FEATURE-04-Signal-Viewer-Channels-Events-Navigation.md) | Signal viewer, channels, events, navigation (FR-006..FR-009) |
| 05  | [`FEATURE-05-Cloud-Jobs-Processing-Artifacts-Provenance.md`](FEATURE-05-Cloud-Jobs-Processing-Artifacts-Provenance.md) | Cloud jobs, processing, artifacts, provenance (FR-010..FR-013) |
| 06  | [`FEATURE-06-Epoching-Evoked-Responses-Spectral-Analysis.md`](FEATURE-06-Epoching-Evoked-Responses-Spectral-Analysis.md) | Epoching, evoked responses, spectral analysis (FR-017..FR-019) |
| 07  | [`FEATURE-07-Sensor-Topographies-Geometry-OPM-Support.md`](FEATURE-07-Sensor-Topographies-Geometry-OPM-Support.md) | Sensor topographies, geometry, OPM support (FR-020..FR-023) |
| 08  | [`FEATURE-08-Artifact-Inspection-Bad-Channels-Correction.md`](FEATURE-08-Artifact-Inspection-Bad-Channels-Correction.md) | Artifact inspection, bad channels, correction (FR-021, FR-025) |
| 09  | [`FEATURE-09-Pipelines-Templates-Notebooks.md`](FEATURE-09-Pipelines-Templates-Notebooks.md) | Pipelines, templates, notebooks (FR-024) |
| 10  | [`FEATURE-10-Export-BIDS-Import-Sharing.md`](FEATURE-10-Export-BIDS-Import-Sharing.md) | Export, BIDS import, sharing (FR-026, FR-027, FR-015) |
| 11  | [`FEATURE-11-Sample-Workspace-Explore.md`](FEATURE-11-Sample-Workspace-Explore.md) | Sample workspace and explore (FR-016) |
| 12  | [`FEATURE-12-Settings-Resource-Controls-Quotas.md`](FEATURE-12-Settings-Resource-Controls-Quotas.md) | Settings, resource controls, quotas (FR-014) |
| 13  | [`FEATURE-13-UI-States-Global.md`](FEATURE-13-UI-States-Global.md) | Global UI states |
| 14  | [`FEATURE-14-Security-Audit-Health-Operations.md`](FEATURE-14-Security-Audit-Health-Operations.md) | Security, audit, health, operations (FR-011, FR-014, FR-015) |

## 17. Feature Completion Definition

A feature is complete when: behaviour documented, FE/BE implement contract, authz enforced, validation/failure/cancel handled, tests pass (incl. scientific correctness where relevant), migrations added, logs/ops adequate, docs updated, no critical security issues, E2E exercised where practical, quality gates pass.

## 18. MVP Definition of Done

MVP ready when core workflow works end-to-end: auth → project → upload/inspect → view signals/events → run basic processing job → get artifacts+manifest → export. OPM/SQUID paths supported per requirements, quotas/audit/health in place, accessibility and states implemented, cross-project access prevented and tested.
