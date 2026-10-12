/**
 * Domain types for the MEG Lab REST API (docs/07-api-spec.md) and data model
 * (docs/06-data-model.md).
 *
 * These mirror the server contract. JSON field names stay in `snake_case` so no
 * translation layer is required between the API and the UI.
 */

export type Uuid = string;

/** ISO 8601 timestamp with an explicit UTC offset, normally `Z`. */
export type IsoTimestamp = string;

export type ProjectRole = 'owner' | 'editor' | 'viewer';

export type ProjectVisibility = 'private' | 'public';

export type ProjectStatus = 'active' | 'archived';

export type DatasetSourceType = 'upload' | 'import' | 'sample';
export type AcquisitionSystem = 'squid' | 'opm';

export type DatasetStatus = 'uploading' | 'validating' | 'ready' | 'failed';

export type DatasetVersionStatus = 'created' | 'validating' | 'ready' | 'failed';

export type UploadSessionStatus = 'pending' | 'completed' | 'expired' | 'aborted';

export type UploadMethod = 'backend' | 'signed_url';

export type PipelineVersionStatus = 'draft' | 'published' | 'deprecated';

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type QuotaState = 'within_quota' | 'approaching_limit' | 'limit_reached';

/** Supported MEG recording formats (docs/07-api-spec.md §9). */
export type RecordingFormat = 'fif' | 'ctf' | 'kit' | 'opm_bin' | 'bids';

/** Named sensor arrays (docs/07-api-spec.md §9). */
export type SensorType = 'neuromag_vectorview' | 'opm_ucl_fil' | 'ctf' | 'kit';

export type CoordinateFrame = 'head' | 'device' | 'mri' | 'unknown';

export type ChannelType =
  | 'mag'
  | 'grad'
  | 'opm'
  | 'eeg'
  | 'eeg_aux'
  | 'stim'
  | 'eog'
  | 'ecg'
  | 'misc'
  | 'syst'
  | 'resp'
  | 'temp';

export type ChannelStatus = 'good' | 'bad' | 'disabled';

export type SignalUnitsPreset = 'si' | 'native' | 'display';

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ApiErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface CurrentUser {
  id: Uuid;
  email: string | null;
  display_name: string | null;
  created_at: IsoTimestamp;
}

export interface ProjectMember {
  project_id: Uuid;
  user_id: Uuid;
  role: ProjectRole;
  display_name: string | null;
  email: string | null;
  created_at: IsoTimestamp;
}

export interface ProjectInvitation {
  id: Uuid;
  project_id: Uuid;
  email: string;
  role: ProjectRole;
  token?: string | null;
  expires_at: IsoTimestamp;
  accepted_at?: IsoTimestamp | null;
  created_at: IsoTimestamp;
}

export interface Project {
  id: Uuid;
  owner_id: Uuid;
  name: string;
  description: string | null;
  visibility: ProjectVisibility;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  archived_at: IsoTimestamp | null;
}

export interface ProjectSummary extends Project {
  role: ProjectRole;
  dataset_count: number;
  run_count: number;
}

export interface ProjectCreateBody {
  name: string;
  description?: string | null;
  visibility?: ProjectVisibility;
}

export interface ProjectUpdateBody {
  name?: string;
  description?: string | null;
  visibility?: ProjectVisibility;
  archived_at?: IsoTimestamp | null;
}

/**
 * Acquisition metadata for a single recording within a dataset version
 * (docs/07-api-spec.md §9).
 */
export interface Recording {
  id: Uuid;
  dataset_version_id: Uuid;
  dataset_id: Uuid;
  project_id: Uuid;
  format: RecordingFormat;
  file_name: string;
  duration_s: number;
  sampling_frequency_hz: number;
  n_channels_total: number;
  n_meg_channels: number;
  channel_types_summary: ChannelType[];
  sensor_type: SensorType;
  coordinate_frame: CoordinateFrame;
  has_sensor_geometry: boolean;
  has_events: boolean;
  created_at: IsoTimestamp;
}

export interface Channel {
  name: string;
  type: ChannelType;
  unit: string;
  status: ChannelStatus;
}

export interface EventItem {
  id: number;
  time_s: number;
  sample: number;
  duration_s: number;
}

export interface EventSet {
  id: Uuid;
  name: string;
  source: string;
  events: EventItem[];
  metadata: Record<string, unknown>;
}

export interface SignalSeries {
  name: string;
  type: ChannelType;
  unit: string;
  data: number[];
}

/**
 * A bounded signal window or multiresolution summary (docs/07-api-spec.md §9).
 * Responses never contain the whole recording.
 */
export interface SignalWindow {
  recording_id: Uuid;
  tmin_s: number;
  tmax_s: number;
  sampling_frequency_hz: number;
  effective_sampling_frequency_hz: number;
  downsample_factor: number;
  decimated: boolean;
  n_times: number;
  channels: SignalSeries[];
  times: number[];
  summary: 'bounded_window' | 'multiresolution_summary';
  boundary_checked: boolean;
}

export interface SensorGeometry {
  recording_id: Uuid;
  sensor_type: SensorType;
  coordinate_frame: CoordinateFrame;
  units: string;
  sensors: Sensor[];
  helmet_model: string | null;
  opm_metadata: OpmMetadata | null;
}

export interface Sensor {
  name: string;
  type: ChannelType;
  coil_type: 'magnetometer' | 'planar_gradiometer' | 'opm' | 'other';
  position: [number, number, number];
  orientation: [number, number, number];
  normal?: [number, number, number];
}

export interface OpmMetadata {
  array_type: string;
  n_channels: number;
  movement_tracking: boolean;
}

export interface SignalQuery {
  channels?: string;
  grouping?: 'type' | 'sensor_group' | 'custom';
  tmin: number;
  tmax: number;
  resolution?: 'full' | 'high' | 'medium' | 'low' | 'summary';
  downsampleFactor?: number;
  decimationAck?: boolean;
  units?: SignalUnitsPreset;
}

export interface DatasetVersion {
  id: Uuid;
  dataset_id: Uuid;
  version: string;
  status: DatasetVersionStatus;
  format?: RecordingFormat | null;
  file_name?: string | null;
  checksum_sha256: string | null;
  created_at: IsoTimestamp;
}

export interface FileAsset {
  id: Uuid;
  dataset_version_id: Uuid;
  name: string;
  checksum: string;
  size_bytes: number;
  media_type: string;
  role: string | null;
  created_at: IsoTimestamp;
}

export interface Dataset {
  id: Uuid;
  project_id: Uuid;
  name: string;
  description: string | null;
  source_type: DatasetSourceType;
  status: DatasetStatus;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  archived_at: IsoTimestamp | null;
  current_dataset_version: DatasetVersion | null;
  version_count: number;
  recording_count: number;
  run_count: number;
}

/** Dataset plus nested acquisition metadata for the detail page. */
export interface DatasetDetail extends Dataset {
  recording: Recording | null;
  file_assets: FileAsset[];
}

export interface DatasetCreateBody {
  name: string;
  source_type: DatasetSourceType;
  recording_format: RecordingFormat;
  acquisition_system?: AcquisitionSystem | null;
  files: FileDeclaration[];
}

export interface FileDeclaration {
  name: string;
  size_bytes: number;
  checksum_sha256?: string | null;
  media_type?: string | null;
  role:
    | 'recording'
    | 'events'
    | 'channels'
    | 'coordsystem'
    | 'calibration'
    | 'crosstalk'
    | 'header'
    | 'companion'
    | 'metadata';
}

export interface DatasetCreateResponse {
  dataset: Dataset;
  upload_session: DatasetUploadSession;
}

export interface DatasetCompleteResponse {
  dataset_id: Uuid;
  status: DatasetStatus;
  validation_job_id: Uuid | null;
  message: string;
}

export interface UploadSession {
  upload_session_id: Uuid;
  status: UploadSessionStatus;
  upload_method: UploadMethod;
  upload_url: string;
  expires_at: IsoTimestamp;
}

export interface UploadTarget {
  name: string;
  object_key: string;
  upload_url: string;
  method: 'PUT';
  headers: Record<string, string> | null;
  expires_at: IsoTimestamp;
}

export interface DatasetUploadSession {
  id: Uuid;
  dataset_id: Uuid;
  project_id: Uuid;
  status: UploadSessionStatus;
  expected_size_bytes: number | null;
  checksum_sha256: string | null;
  files: UploadTarget[];
  expires_at: IsoTimestamp;
  created_at: IsoTimestamp;
}

export interface UploadSessionCreateBody {
  file_name: string;
  file_size_bytes: number;
  expected_checksum_sha256?: string | null;
  media_type?: string | null;
}

export interface Pipeline {
  id: Uuid;
  project_id: Uuid;
  name: string;
  description: string | null;
  kind: string;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  latest_version: PipelineVersion | null;
  version_count: number;
  run_count: number;
}

export interface PipelineStep {
  name: string;
  type: string;
  params: Record<string, unknown>;
}

export interface PipelineParameter {
  name: string;
  type: 'number' | 'integer' | 'boolean' | 'string' | 'enum';
  label: string;
  description?: string | null;
  unit?: string | null;
  default?: unknown;
  required?: boolean;
  minimum?: number | null;
  maximum?: number | null;
  options?: string[];
}

export interface PipelineVersion {
  id: Uuid;
  pipeline_id: Uuid;
  version: string;
  status: PipelineVersionStatus;
  image_digest: string;
  changelog: string | null;
  created_at: IsoTimestamp;
  parameters: PipelineParameter[];
  steps: PipelineStep[];
}

export interface RunError {
  code: string;
  message: string;
}

export interface ExperimentRun {
  id: Uuid;
  project_id: Uuid;
  pipeline_id: Uuid;
  pipeline_name: string;
  pipeline_version: string;
  pipeline_version_id: Uuid;
  dataset_id: Uuid;
  dataset_name: string;
  dataset_version_id: Uuid;
  dataset_version: string;
  status: RunStatus;
  parameters: Record<string, unknown>;
  error: RunError | null;
  requested_at: IsoTimestamp;
  started_at: IsoTimestamp | null;
  finished_at: IsoTimestamp | null;
  duration_s: number | null;
  artifacts_count: number;
}

export interface CreateRunBody {
  project_id: Uuid;
  pipeline_version_id: Uuid;
  dataset_version_id: Uuid;
  parameters: Record<string, unknown>;
}

export interface Artifact {
  id: Uuid;
  run_id: Uuid;
  name: string;
  checksum: string;
  media_type: string;
  size_bytes: number;
  created_at: IsoTimestamp;
}

export interface RunLogLine {
  timestamp: IsoTimestamp;
  severity: 'debug' | 'info' | 'warning' | 'error';
  operation: string;
  message: string;
}

export interface ShareCreateBody {
  scope: 'read_only' | 'custom';
  expires_at?: IsoTimestamp;
  grants?: string[];
}

export interface Share {
  share_id: Uuid;
  project_id: Uuid;
  share_url: string;
  scope: 'read_only' | 'custom';
  expires_at: IsoTimestamp;
  revoked_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
}

export interface UsageRecord {
  id: Uuid;
  resource_type: 'cpu_seconds' | 'storage_bytes' | 'runs';
  quantity: number;
  run_id: Uuid | null;
  created_at: IsoTimestamp;
}

export interface Quota {
  resource_type: 'storage_bytes' | 'cpu_seconds' | 'runs';
  limit: number;
  used: number;
  state: QuotaState;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
}
