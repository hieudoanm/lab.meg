# MEG Lab Security Policy

MEG Lab is research software. It does not diagnose conditions, recommend treatment, or claim clinical or regulatory validity. Even so, uploaded MEG files and their metadata can contain sensitive information; MEG Lab is designed around privacy from the start.

## Supported Versions

Because this is a demonstration project, only the latest `master` build is actively supported. Releases and tags are treated as snapshots, not long-term support branches.

| Version  | Supported |
| -------- | --------- |
| latest   | ✅        |
| < latest | ❌        |

## Reporting a Vulnerability

Please **do not open a public issue** for security problems.

Report privately via GitHub Security Advisories:

https://github.com/hieudoanm/meg-lab/security/advisories/new

Please include:

- Scope and impact: what is affected, how severe, and any CVSS estimate
- Steps to reproduce with the smallest reproducible case
- Affected component, routes, or configuration
- Suggested remediation (optional)

## Response Timeline

| Time        | Commitment                                       |
| ----------- | ------------------------------------------------ |
| First reply | Within 5 business days                           |
| Triage      | Confirm or reject the report, communicate a plan |
| Fix         | Land a patch on `master` and publish a note      |
| Advisory    | Publish a GitHub Security Advisory after the fix |

Disclosure is coordinated. Give the project time to release a fix before publicising the vulnerability.

## Security Architecture

### Authentication and authorisation

- `AUTH_MODE=development` is a local-only convenience (no password). Production must run `AUTH_MODE=oidc`.
- Browser sessions use an **HttpOnly** session cookie (`meg-lab_session`), forwarded through the Next.js BFF proxy so secrets never reach the frontend bundle.
- JWT tokens carry issuer and audience claims; production refuses to start with a default or short `AUTH_TOKEN_SECRET` or with an asymmetric algorithm missing `AUTH_PUBLIC_KEY`.
- **Projects are the tenancy boundary.** Membership is the authorisation source of truth; a client-supplied project identifier is never trusted on its own (see `docs/05-architecture.md`).
- Roles: `owner` (full, manages members), `editor` (may modify resources), `viewer` (read-only).
- Cross-project access returns `404`, never `403`, to avoid disclosing that a resource exists.

### Data protection

- Private by default: projects and data are private unless explicitly shared (`private`/`shared`/`public`).
- All timestamps ISO 8601 UTC; UUIDs identify externally exposed resources.
- SHA-256 checksums recorded for uploads and derived artifacts; never treat possession of an object key as authorisation.
- Validate and bound every upload before parsing: `MAX_UPLOAD_BYTES`, duration, channel count, sampling rate, and `MAX_VIEWER_SLICE_BYTES` bound resource usage.
- No pickle/numpy loading of untrusted data; arrays are managed with explicit spatial headers.

### Infrastructure

- Docker containers run as non-root with health checks; PostgreSQL, Redis, and the MinIO console stay on the internal network.
- TLS terminates at a reverse proxy; expose only frontend + proxy publicly.
- Secrets live only in environment files or a secret store — never in source, images, logs, or frontend bundles.
- `APP_ENV=production` blocks the Swagger/ReDoc surfaces and enforces secure cookies.
- CI runs `pip-audit` and `npm audit` and uploads Trivy SARIF results to GitHub Security.

### API security

- Base path `/api/v1`; unknown request fields rejected on writes (`extra="forbid"`).
- Cursor pagination with `MAX_PAGE_SIZE` bounds list endpoints.
- Idempotency keys make job submission duplicate-safe; the transactional outbox + dispatcher provides at-least-once delivery with bounded retries.
- Never return stack traces, SQL, credentials, object keys, or signed URLs.
- `X-Request-Id` correlation across logs aids audit and forensics.