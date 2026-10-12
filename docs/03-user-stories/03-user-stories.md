# MEG Lab — User Stories

## 1. Purpose

This document defines the user stories for MEG Lab. Each story is documented in its own file under [`US-###.md`](US-001.md). The stories are grouped by workflow area below.

## 2. User Roles

### 2.1 Personas

The five personas are defined in [`00-overview.md`](../00-overview.md).

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

See [`US-001.md`](US-001.md).

### US-002: Sign out and recover access

See [`US-002.md`](US-002.md).

### US-003: Select an active project

See [`US-003.md`](US-003.md).

### US-004: Enforce project role permissions

See [`US-004.md`](US-004.md).

### US-005: Create a project

See [`US-005.md`](US-005.md).

### US-006: Browse and search projects

See [`US-006.md`](US-006.md).

### US-007: Edit, archive, or delete a project

See [`US-007.md`](US-007.md).

### US-008: Manage project members and roles

See [`US-008.md`](US-008.md).

## 5. Dataset Upload and Validation

### US-009: Upload a MEG recording

See [`US-009.md`](US-009.md).

### US-010: Handle invalid or oversized uploads

See [`US-010.md`](US-010.md).

### US-011: Detect format and inspect metadata

See [`US-011.md`](US-011.md).

## 6. Signal Viewer, Channels, Events and Navigation

### US-012

See [`US-012.md`](US-012.md).

### US-013

See [`US-013.md`](US-013.md).

### US-014

See [`US-014.md`](US-014.md).

### US-015

See [`US-015.md`](US-015.md).

### US-016

See [`US-016.md`](US-016.md).

### US-017

See [`US-017.md`](US-017.md).

## 7. Cloud Jobs, Artifacts, Provenance, and Resource Controls

### US-018

See [`US-018.md`](US-018.md).

### US-019

See [`US-019.md`](US-019.md).

### US-020

See [`US-020.md`](US-020.md).

### US-021

See [`US-021.md`](US-021.md).

### US-022

See [`US-022.md`](US-022.md).

### US-023

See [`US-023.md`](US-023.md).

### US-024

See [`US-024.md`](US-024.md).

### US-025

See [`US-025.md`](US-025.md).

### US-026: Sample workspace

See [`US-026.md`](US-026.md).

### US-027: Sign in to save sample state

See [`US-027.md`](US-027.md).

### US-028: Guided educational exploration

See [`US-028.md`](US-028.md).

## 8. Security, Sharing, Audit, and Operations

### US-043: Manage sharing with scoped links

See [`US-043.md`](US-043.md).

### US-044: Review audit events

See [`US-044.md`](US-044.md).

### US-045: Monitor service health

See [`US-045.md`](US-045.md).

### US-046: Accessibility and clear states

See [`US-046.md`](US-046.md).

s not silently overwritten.
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
