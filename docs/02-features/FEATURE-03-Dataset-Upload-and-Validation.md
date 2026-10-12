# 5. Dataset Upload and Validation

## 5. Dataset Upload and Validation

**Priority:** P0 (FR-003, FR-004, FR-005)

### Supported formats
FIF, CTF `.ds`, KIT `.sqd`/`.con`, UCL FIL OPM `.bin`, BIDS-organised datasets.

### Upload workflow
1. Select project. 2. Enter metadata. 3. Select files. 4. Upload (resumable). 5. Validate. 6. Display result.

Signed upload targets bind the declared byte size. The local development
backend checks `Content-Length` before reading a request and streams chunked
requests into a temporary file with the same hard limit; S3-compatible targets
sign `ContentLength` so the object store enforces the expected size.

### Validation
Checks: format/extension, size limits, integrity/checksum, header parseability, dimensions/spacing, orientation/affine, data type, resource bounds (decompression), metadata consistency. Errors safe and actionable.

### Lifecycle
`pending_upload` → `validating` → `ready`; outcomes `rejected`, `failed`. Failed validation not treated as success. Immutable dataset_versions created.

### Dataset details
Name/id, source/provenance, format/checksum, duration, sampling freq, channels, spatial metadata where applicable, validation status, timestamps, available actions.

### States
- `pending_upload`, `validating`, `ready`, `rejected`, `failed`
- per-file: `uploaded`, `verified`, `quarantined`

### Acceptance conditions
- Authorised user uploads supported recording and reaches `ready` with correct metadata.
- Invalid files `rejected` with safe messages.
- No large raw arrays stored in relational rows unnecessarily.
- Every accepted asset has recorded checksum.

