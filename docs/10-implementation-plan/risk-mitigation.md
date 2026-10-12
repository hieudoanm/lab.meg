# Risk Register

## 15. Risk Register

| Risk                                             | Impact                           | Mitigation                                                                                        |
| ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------- |
| Scope expansion                                  | Delayed delivery                 | Ship one complete MEG workflow before supporting every format; keep the first operations small    |
| OPM ingestion underestimated                     | Delayed OPM support              | Treat OPM ingestion and metadata validation as explicit deliverables from Milestone 0            |
| Tenant isolation bug                             | Data exposure                    | Centralised permission checks, composite foreign keys, and negative integration tests             |
| Unsafe or malformed recording parsing            | Security and reliability issues  | Bounded header parsing, decompression limits, strict validation, and resource limits              |
| Signal rendering becomes slow                    | Poor usability                   | Bounded queries, multiresolution summaries, caching, and efficient rendering                      |
| Duplicate job delivery                           | Inconsistent results             | Idempotent workers, leases, and database state checks                                             |
| Lost queue messages                              | Stuck runs                       | Transactional outbox and dispatcher with recovery                                                 |
| Artifact persisted before manifest               | False success                    | Persist artifacts and manifest, then mark the run successful in one flow                          |
| Incorrect metadata, units, or coordinate frame   | Scientifically incorrect results | Persist and test sampling frequency, channel types, units, and frames against verified fixtures   |
| OPM workflows treated as ordinary MEG            | Misleading results               | Explicit sensor metadata, compatible pipeline requirements, OPM-specific validation               |
| Untrusted notebook code compromises infrastructure | Infrastructure breach          | Isolated runtimes, restricted egress, least privilege; defer notebooks until V2                   |
| Excessive self-hosting cost                      | Unexpected expense               | Quotas, resource limits, per-run accounting, and documented teardown                              |
| Arbitrary code compromises infrastructure        | Infrastructure breach            | Isolated OCI runtimes, restricted egress, least privilege, no shared secrets                      |
| Scientific misinterpretation                     | Misleading claims                | Explicit units, coordinate frames, provenance, and a limitations statement                        |
| Large recordings exhaust browser or API memory   | Poor usability                   | Bounded range requests, derived downsampled summaries, and bounded responses                       |
| Complex infrastructure too early                 | Slow development                 | Prove the local Docker Compose vertical slice first; keep cloud deferred                          |
| Inconsistent API types                           | Integration defects              | Generate or synchronise client types from OpenAPI                                                 |
| Insufficient test realism                        | Hidden database bugs             | Use real PostgreSQL integration tests and reference recordings from both SQUID and OPM sources    |

