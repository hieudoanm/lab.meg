-- Initial schema. Mirrors docs/database/meg-lab.dbml (core entities) plus the
-- platform tables required by the API contract (sessions, local dev
-- credentials, upload sessions, idempotency keys, run logs, shares).
-- Lifecycle statuses are constrained TEXT values with CHECK constraints.

-- ---------------------------------------------------------------------------
-- Identity and access
-- ---------------------------------------------------------------------------

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    display_name text,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Contact information is not the permanent identity key; lookups are
-- case-insensitive.
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));

CREATE TABLE projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (name <> ''),
    description text,
    visibility text NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'public', 'link')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);
CREATE INDEX ix_projects_owner_created_at ON projects (owner_id, created_at DESC);
CREATE INDEX ix_projects_visibility_created_at ON projects (visibility, created_at DESC);

CREATE TABLE project_members (
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_members_project_user PRIMARY KEY (project_id, user_id)
);
CREATE INDEX ix_project_members_user_id ON project_members (user_id);

-- Local development identity (AUTH_MODE=development only). In production the
-- external OIDC provider owns the authoritative identity record and this table
-- stays empty.
CREATE TABLE auth_credentials (
    user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_auth_credentials_email ON auth_credentials (lower(email));

CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    user_agent text,
    ip_address text,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
);
CREATE UNIQUE INDEX uq_sessions_token_hash ON sessions (token_hash);
CREATE INDEX ix_sessions_user_id ON sessions (user_id);
CREATE INDEX ix_sessions_expires_at ON sessions (expires_at);

CREATE TABLE password_reset_tokens (
    token_hash text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Datasets and recordings
-- ---------------------------------------------------------------------------

CREATE TABLE datasets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (name <> ''),
    source_type text NOT NULL CHECK (source_type IN ('upload', 'import', 'sample')),
    status text NOT NULL DEFAULT 'uploading'
        CHECK (status IN ('uploading', 'validating', 'ready', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    archived_at timestamptz
);
CREATE INDEX ix_datasets_project_created_at ON datasets (project_id, created_at DESC);
CREATE UNIQUE INDEX uq_datasets_project_id_id ON datasets (project_id, id);
CREATE INDEX ix_datasets_status ON datasets (status);

CREATE TABLE dataset_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id uuid NOT NULL REFERENCES datasets(id) ON DELETE RESTRICT,
    version text NOT NULL CHECK (version <> ''),
    manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'validating'
        CHECK (status IN ('uploading', 'validating', 'ready', 'failed')),
    checksum text CHECK (checksum ~ '^sha256:[0-9a-f]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_dataset_versions_dataset_version ON dataset_versions (dataset_id, version);
CREATE INDEX ix_dataset_versions_dataset_created_at ON dataset_versions (dataset_id, created_at DESC);
CREATE UNIQUE INDEX uq_dataset_versions_dataset_id_id ON dataset_versions (dataset_id, id);

CREATE TABLE recordings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version_id uuid NOT NULL REFERENCES dataset_versions(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (name <> ''),
    format text NOT NULL CHECK (format IN ('fif', 'ctf', 'kit', 'bin', 'bids')),
    acquisition_system text NOT NULL CHECK (acquisition_system IN ('squid', 'opm')),
    device_serial text,
    manufacturer text,
    duration_s double precision NOT NULL CHECK (duration_s >= 0),
    sampling_frequency_hz double precision NOT NULL CHECK (sampling_frequency_hz > 0),
    n_channels integer NOT NULL CHECK (n_channels > 0),
    maxfilter_sss_applied boolean,
    coordinate_frame text NOT NULL DEFAULT 'head'
        CHECK (coordinate_frame IN ('head', 'device', 'opm')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_recordings_dataset_version_created_at ON recordings (dataset_version_id, created_at DESC);
CREATE UNIQUE INDEX uq_recordings_dataset_version_id_id ON recordings (dataset_version_id, id);
CREATE INDEX ix_recordings_acquisition_system ON recordings (acquisition_system);

CREATE TABLE file_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id uuid NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    object_key text NOT NULL,
    checksum text NOT NULL CHECK (checksum ~ '^sha256:[0-9a-f]{64}$'),
    size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
    media_type text NOT NULL,
    role text NOT NULL CHECK (role IN (
        'recording', 'events', 'channels', 'coordsystem', 'calibration',
        'crosstalk', 'header', 'companion', 'metadata'
    )),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_file_assets_object_key ON file_assets (object_key);
CREATE INDEX ix_file_assets_recording_id ON file_assets (recording_id);
CREATE INDEX ix_file_assets_recording_role ON file_assets (recording_id, role);

CREATE TABLE channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id uuid NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    name text NOT NULL,
    group_name text,
    type text NOT NULL CHECK (type IN ('mag', 'grad', 'eeg', 'eog', 'ecg', 'stim', 'misc', 'opm')),
    unit text NOT NULL CHECK (unit IN (
        'tesla', 'tesla_per_metre', 'volt', 'amperes', 'dimensionless', 'other'
    )),
    unit_mul double precision NOT NULL DEFAULT 1.0,
    status text NOT NULL DEFAULT 'good' CHECK (status IN ('good', 'bad')),
    coil_type text,
    position_x_mm double precision,
    position_y_mm double precision,
    position_z_mm double precision,
    orientation_x double precision,
    orientation_y double precision,
    orientation_z double precision,
    opm_scalar boolean,
    opm_vector boolean,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_channels_recording_name UNIQUE (recording_id, name)
);
CREATE INDEX ix_channels_recording_type ON channels (recording_id, type);
CREATE INDEX ix_channels_recording_status ON channels (recording_id, status);

CREATE TABLE sensor_configurations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id uuid NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    sensor_type text NOT NULL CHECK (sensor_type IN (
        'magnetometer', 'gradiometer', 'opm_scalar', 'opm_vector', 'aux'
    )),
    coordinate_frame text NOT NULL CHECK (coordinate_frame IN ('head', 'device', 'opm')),
    positions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    orientations_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    calibrations_json jsonb,
    movement_ref text,
    time_varying boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_sensor_configurations_recording_id ON sensor_configurations (recording_id);
CREATE INDEX ix_sensor_configurations_coordinate_frame ON sensor_configurations (coordinate_frame);

CREATE TABLE event_sets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    recording_id uuid NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    name text NOT NULL,
    source text NOT NULL CHECK (source IN ('acquisition', 'annotation', 'derived')),
    sample_convention text NOT NULL CHECK (sample_convention IN (
        'onset', 'first_sample', 'mid_sample', 'trigger'
    )),
    event_count integer NOT NULL DEFAULT 0 CHECK (event_count >= 0),
    description text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_event_sets_recording_created_at ON event_sets (recording_id, created_at DESC);
CREATE INDEX ix_event_sets_recording_source ON event_sets (recording_id, source);

-- Resumable upload sessions and their declared file targets.
CREATE TABLE upload_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id uuid NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'expired', 'aborted')),
    expected_size_bytes bigint CHECK (expected_size_bytes >= 0),
    checksum_sha256 text CHECK (checksum_sha256 ~ '^sha256:[0-9a-f]{64}$'),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz
);
CREATE INDEX ix_upload_sessions_dataset_id ON upload_sessions (dataset_id);
CREATE INDEX ix_upload_sessions_expires_at ON upload_sessions (expires_at);

CREATE TABLE upload_targets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_session_id uuid NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
    name text NOT NULL,
    object_key text NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
    checksum_sha256 text CHECK (checksum_sha256 ~ '^sha256:[0-9a-f]{64}$'),
    media_type text,
    role text NOT NULL CHECK (role IN (
        'recording', 'events', 'channels', 'coordsystem', 'calibration',
        'crosstalk', 'header', 'companion', 'metadata'
    )),
    uploaded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_upload_targets_session_object UNIQUE (upload_session_id, object_key)
);

-- ---------------------------------------------------------------------------
-- Pipelines and runs
-- ---------------------------------------------------------------------------

CREATE TABLE pipelines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    name text NOT NULL CHECK (name <> ''),
    description text,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_pipelines_project_created_at ON pipelines (project_id, created_at DESC);
CREATE UNIQUE INDEX uq_pipelines_project_id_id ON pipelines (project_id, id);

CREATE TABLE pipeline_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id uuid NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
    version text NOT NULL CHECK (version <> ''),
    definition jsonb NOT NULL,
    image_digest text NOT NULL CHECK (image_digest ~ '^sha256:[0-9a-f]{64}$'),
    parameters_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'published', 'archived')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_pipeline_versions_pipeline_version ON pipeline_versions (pipeline_id, version);
CREATE INDEX ix_pipeline_versions_pipeline_created_at ON pipeline_versions (pipeline_id, created_at DESC);

CREATE TABLE experiment_runs (
    id text PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
    pipeline_version_id uuid NOT NULL REFERENCES pipeline_versions(id) ON DELETE RESTRICT,
    dataset_version_id uuid NOT NULL REFERENCES dataset_versions(id) ON DELETE RESTRICT,
    sensor_configuration_id uuid REFERENCES sensor_configurations(id) ON DELETE SET NULL,
    initiated_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key text NOT NULL,
    error_classification text,
    cpu_limit_cores double precision,
    memory_limit_bytes bigint,
    disk_limit_bytes bigint,
    wall_clock_limit_s integer,
    started_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_experiment_runs_idempotency_key ON experiment_runs (idempotency_key);
CREATE INDEX ix_experiment_runs_status_created_at ON experiment_runs (status, created_at DESC);
CREATE INDEX ix_experiment_runs_dataset_version_created_at ON experiment_runs (dataset_version_id, created_at DESC);
CREATE INDEX ix_experiment_runs_pipeline_version_created_at ON experiment_runs (pipeline_version_id, created_at DESC);
CREATE INDEX ix_experiment_runs_project_created_at ON experiment_runs (project_id, created_at DESC);

CREATE TABLE artifacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id text NOT NULL REFERENCES experiment_runs(id) ON DELETE CASCADE,
    object_key text NOT NULL,
    checksum text NOT NULL CHECK (checksum ~ '^sha256:[0-9a-f]{64}$'),
    size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
    media_type text NOT NULL,
    kind text NOT NULL DEFAULT 'derived'
        CHECK (kind IN ('original', 'derived', 'report', 'manifest')),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_artifacts_object_key ON artifacts (object_key);
CREATE INDEX ix_artifacts_run_id ON artifacts (run_id);
CREATE INDEX ix_artifacts_run_kind ON artifacts (run_id, kind);

CREATE TABLE run_logs (
    run_id text NOT NULL REFERENCES experiment_runs(id) ON DELETE CASCADE,
    sequence bigint NOT NULL,
    timestamp timestamptz NOT NULL DEFAULT now(),
    level text NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    source text,
    message text NOT NULL,
    CONSTRAINT pk_run_logs PRIMARY KEY (run_id, sequence)
);

-- ---------------------------------------------------------------------------
-- Usage, audit, outbox, sharing, idempotency
-- ---------------------------------------------------------------------------

CREATE TABLE usage_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    run_id text REFERENCES experiment_runs(id) ON DELETE SET NULL,
    resource_type text NOT NULL CHECK (resource_type IN ('core_hours', 'storage_bytes')),
    quantity bigint NOT NULL CHECK (quantity >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_usage_records_user_created_at ON usage_records (user_id, created_at DESC);
CREATE INDEX ix_usage_records_run_id ON usage_records (run_id);
CREATE INDEX ix_usage_records_resource_type_created_at ON usage_records (resource_type, created_at DESC);

CREATE TABLE audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_events_resource_created_at ON audit_events (resource_type, resource_id, created_at DESC);
CREATE INDEX ix_audit_events_actor_created_at ON audit_events (actor_id, created_at DESC);

CREATE TABLE outbox_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    topic text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'published', 'failed')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);
CREATE INDEX ix_outbox_events_status_created_at ON outbox_events (status, created_at);
CREATE INDEX ix_outbox_events_published_at ON outbox_events (published_at);
CREATE INDEX ix_outbox_events_topic_created_at ON outbox_events (topic, created_at DESC);

CREATE TABLE shares (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    resource_id uuid,
    scope text NOT NULL CHECK (scope IN ('project', 'dataset', 'run')),
    role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
    token_hash text NOT NULL,
    created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_shares_token_hash ON shares (token_hash);
CREATE INDEX ix_shares_project_id ON shares (project_id);

-- Client-supplied idempotency keys for state-changing requests (run
-- submission, upload finalisation). Responses are replayed verbatim for
-- identical retries; a different request hash is a 409 conflict.
CREATE TABLE idempotency_keys (
    key text NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_hash text NOT NULL,
    response_status integer NOT NULL,
    response_body jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    CONSTRAINT pk_idempotency_keys PRIMARY KEY (key, user_id)
);
CREATE INDEX ix_idempotency_keys_expires_at ON idempotency_keys (expires_at);
