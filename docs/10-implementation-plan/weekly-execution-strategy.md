# Suggested Weekly Execution Strategy

## 14. Suggested Weekly Execution Strategy

Prioritise work by dependency and risk, not visual appeal. This sequence assumes roughly one experienced full-stack developer and matches the 8–12 week private-beta estimate in `docs/README.md` section 12.

| Week | Focus                                                            | Phase |
| ---- | ---------------------------------------------------------------- | ----- |
| 1    | Foundation, ingestion proof, signal rendering, OPM path          | 0–1   |
| 2–3  | Authentication, projects, uploads, validation, access control    | 2     |
| 4–5  | Channel browser, signal viewer, event inspection, metadata panels | 3     |
| 6–8  | Queue, worker, pipelines, runs, artifacts, manifests             | 4     |
| 9–12 | Epoching, evoked, OPM template, sharing, hardening, beta         | 5     |
| 12+  | Deployment, CI hardening, portfolio polish, roadmap              | 6     |

Priority ordering:

| Priority | Work                                                                  |
| -------- | --------------------------------------------------------------------- |
| P0       | Repository, database, API, authentication, tenant isolation          |
| P1       | Ingestion, uploads, validation, metadata                              |
| P2       | Signal viewer, pipelines, worker reliability, artifacts, manifests    |
| P3       | Epoching, evoked, spectral, OPM workflows, sensor geometry            |
| P4       | Reliability, security, quotas, end-to-end workflow, regression tests  |
| P5       | Portfolio polish and self-hosted deployment                           |

A small, working deployment is more valuable than a large unfinished feature set. If time is limited, defer hosted notebooks, the visual pipeline builder, BIDS ingestion, source analysis, and multimodal workflows.

