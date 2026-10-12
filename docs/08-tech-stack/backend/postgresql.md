# PostgreSQL

## 6. Database (PostgreSQL)

### 6.1 PostgreSQL 18
Authoritative state; arrays/large numeric blobs (raw MEG arrays) never stored in rows. Object storage for recordings/artifacts. JSONB allowed for geometry/manifest blobs where captured in DBML. 
Driver: Psycopg 3 (async) preferred; asyncpg acceptable if consistent with async stack.

### 6.2 Migrations
Alembic migrations (SQL-based migration scripts where appropriate), applied transactionally. Runner tracks versions/checksums; destructive changes treated carefully. CI runs migrations before tests.

### 6.3 Data Model (logical)
Core entities: `users`, `projects`, `project_members`, `datasets`, `dataset_versions`, `recordings`, `file_assets`, `channels`, `sensor_configurations`, `event_sets`, `pipelines`, `pipeline_versions`, `experiment_runs`, `artifacts`, `shares`, `audit_events`, `idempotency_keys`, `outbox_events`. Every tenant-owned query enforces project scope.

### 6.4 Access Rules
Parameterised SQL only; transactions for multi-step state changes; constraints/indexes by access patterns; connection pooling; row-level security may supplement (not substitute) app-level auth.

