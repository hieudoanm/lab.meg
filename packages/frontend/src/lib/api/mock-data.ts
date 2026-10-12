/**
 * Canonical MEG Lab prototype data (docs/01-overview.md + docs/07-api-spec.md §13).
 *
 * Every fetch function in `lib/api/*` short-circuits to these fixtures when
 * `mocksEnabled()` is active, so the frontend is fully navigable without a backend:
 *
 *   MEG Lab
 *     ├── Auditory Evoked Fields  (SQUID-MEG, Neuromag Vectorview 306 + 9 aux)
 *     ├── OPM Pilot Study         (UCL FIL OPM, 64 ch)
 *     ├── MNE Sample Tutorials    (public sample)
 *     ├── Cognitive Decline       (archived)
 *     └── Resting State Connectivity
 *
 * Deterministic generators keep the Signal Viewer and Sensor Explorer alive
 * with plausible traces and sensor geometry while staying bounded.
 */

import type {
  Artifact,
  Channel,
  CurrentUser,
  Dataset,
  DatasetDetail,
  DatasetVersion,
  EventSet,
  Page,
  ExperimentRun,
  FileAsset,
  Pipeline,
  PipelineParameter,
  PipelineVersion,
  ProjectSummary,
  Quota,
  Recording,
  RunLogLine,
  RunStatus,
  Sensor,
  SensorGeometry,
  Share,
  SignalQuery,
  SignalWindow,
  UsageRecord,
} from './types';

/* ---------------------------------------------------------------------------
 * Mock switch
 * --------------------------------------------------------------------------- */

/**
 * Mocks are enabled unless explicitly disabled, or until a real API base URL
 * is configured. This keeps `pnpm dev` fully navigable out of the box.
 */
export const mocksEnabled = (): boolean => {
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'false') {
    return false;
  }
  if (process.env.NEXT_PUBLIC_USE_MOCKS === 'true') {
    return true;
  }
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  return !configured;
};

/** Single-page envelope used by list endpoints. */
export const paged = <T>(items: T[]): Page<T> => ({
  items,
  next_cursor: null,
  has_more: false,
});

/* ---------------------------------------------------------------------------
 * Time helpers
 * --------------------------------------------------------------------------- */

const NOW = Date.now();

const minutesAgo = (minutes: number): string => new Date(NOW - minutes * 60_000).toISOString();
const daysAgo = (days: number): string => new Date(NOW - days * 86_400_000).toISOString();

const ISO = {
  now: new Date(NOW).toISOString(),
  m2: minutesAgo(2),
  m4: minutesAgo(4),
  m12: minutesAgo(12),
  m34: minutesAgo(34),
  h1: minutesAgo(60),
  h2: minutesAgo(120),
  h3: minutesAgo(180),
  h4: minutesAgo(240),
  h5: minutesAgo(300),
  d1: daysAgo(1),
  d2: daysAgo(2),
  d21: daysAgo(21),
  later: new Date(NOW + 14 * 86_400_000).toISOString(),
};

const SHA = (bytes: string): string => `sha256:${bytes}`;

/* ---------------------------------------------------------------------------
 * Users
 * --------------------------------------------------------------------------- */

export const mockCurrentUser: CurrentUser = {
  id: 'usr_9a7f',
  email: 'hieu@meg-lab.local',
  display_name: 'Hieu Doan',
  created_at: daysAgo(220),
};

/* ---------------------------------------------------------------------------
 * Projects
 * --------------------------------------------------------------------------- */

export const mockProjects: ProjectSummary[] = [
  {
    id: 'proj_001',
    owner_id: 'usr_9a7f',
    name: 'Auditory Evoked Fields',
    description: 'Auditory evoked MEG study (SQUID-MEG)',
    visibility: 'private',
    role: 'owner',
    dataset_count: 4,
    run_count: 9,
    created_at: daysAgo(180),
    updated_at: ISO.m12,
    archived_at: null,
  },
  {
    id: 'proj_002',
    owner_id: 'usr_9a7f',
    name: 'OPM Pilot Study',
    description: 'Optically-pumped magnetometer pilot (UCL FIL OPM array)',
    visibility: 'private',
    role: 'owner',
    dataset_count: 5,
    run_count: 8,
    created_at: daysAgo(95),
    updated_at: ISO.h5,
    archived_at: null,
  },
  {
    id: 'proj_003',
    owner_id: 'usr_9a7f',
    name: 'MNE Sample Tutorials',
    description: 'Public, anonymised sample recordings for read-only exploration',
    visibility: 'public',
    role: 'viewer',
    dataset_count: 2,
    run_count: 6,
    created_at: daysAgo(120),
    updated_at: ISO.d1,
    archived_at: null,
  },
  {
    id: 'proj_004',
    owner_id: 'usr_9a7f',
    name: 'Cognitive Decline',
    description: 'Longitudinal resting-state cohort',
    visibility: 'private',
    role: 'owner',
    dataset_count: 1,
    run_count: 3,
    created_at: daysAgo(330),
    updated_at: daysAgo(21),
    archived_at: daysAgo(21),
  },
  {
    id: 'proj_005',
    owner_id: 'usr_9a7f',
    name: 'Resting State Connectivity',
    description: 'Feasibility study — resting state, 5 min eyes-open blocks',
    visibility: 'private',
    role: 'owner',
    dataset_count: 0,
    run_count: 0,
    created_at: daysAgo(12),
    updated_at: daysAgo(3),
    archived_at: null,
  },
];

export const projectById = (id: string): ProjectSummary =>
  mockProjects.find((project) => project.id === id) ?? mockProjects[0];

/* ---------------------------------------------------------------------------
 * Recordings
 * --------------------------------------------------------------------------- */

export const mockRecordings: Recording[] = [
  {
    id: 'rec_3d88',
    dataset_version_id: 'dv_bf82',
    dataset_id: 'ds_7e42',
    project_id: 'proj_001',
    format: 'fif',
    file_name: 'AEF-001_meg.fif',
    duration_s: 240,
    sampling_frequency_hz: 1000,
    n_channels_total: 315,
    n_meg_channels: 306,
    channel_types_summary: ['mag', 'grad', 'stim', 'eeg_aux'],
    sensor_type: 'neuromag_vectorview',
    coordinate_frame: 'head',
    has_sensor_geometry: true,
    has_events: true,
    created_at: ISO.h4,
  },
  {
    id: 'rec_9a44',
    dataset_version_id: 'dv_3e01',
    dataset_id: 'ds_11c2',
    project_id: 'proj_002',
    format: 'opm_bin',
    file_name: 'OPM-SSS-011.bin',
    duration_s: 300,
    sampling_frequency_hz: 1000,
    n_channels_total: 64,
    n_meg_channels: 64,
    channel_types_summary: ['opm', 'stim'],
    sensor_type: 'opm_ucl_fil',
    coordinate_frame: 'head',
    has_sensor_geometry: true,
    has_events: true,
    created_at: ISO.h2,
  },
  {
    id: 'rec_f4a0',
    dataset_version_id: 'dv_c6d4',
    dataset_id: 'ds_22d9',
    project_id: 'proj_003',
    format: 'fif',
    file_name: 'sample_auditory_raw.fif',
    duration_s: 180,
    sampling_frequency_hz: 600.6,
    n_channels_total: 376,
    n_meg_channels: 306,
    channel_types_summary: ['mag', 'grad', 'eeg_aux', 'stim', 'eog'],
    sensor_type: 'neuromag_vectorview',
    coordinate_frame: 'head',
    has_sensor_geometry: true,
    has_events: true,
    created_at: daysAgo(1),
  },
  {
    id: 'rec_55b1',
    dataset_version_id: 'dv_77e2',
    dataset_id: 'ds_5e4f',
    project_id: 'proj_001',
    format: 'fif',
    file_name: 'AEF-001_meg.fif',
    duration_s: 300,
    sampling_frequency_hz: 1000,
    n_channels_total: 315,
    n_meg_channels: 306,
    channel_types_summary: ['mag', 'grad', 'stim', 'eeg_aux'],
    sensor_type: 'neuromag_vectorview',
    coordinate_frame: 'head',
    has_sensor_geometry: true,
    has_events: true,
    created_at: daysAgo(30),
  },
];

export const recordingById = (id: string): Recording =>
  mockRecordings.find((recording) => recording.id === id) ?? mockRecordings[0];

/* ---------------------------------------------------------------------------
 * Channels (generated per sensor array)
 * --------------------------------------------------------------------------- */

const BAD_MEG_CHANNELS = new Set(['MEG0131', 'MEG0167B']);

const neuromagMagName = (i: number): string => `MEG${111 + i - 1}`;

const buildNeuromagChannels = (): Channel[] => {
  const channels: Channel[] = [];
  for (let i = 1; i <= 102; i += 1) {
    const mag = neuromagMagName(i);
    channels.push({
      name: mag,
      type: 'mag',
      unit: 'T',
      status: BAD_MEG_CHANNELS.has(mag) ? 'bad' : 'good',
    });
    channels.push({
      name: `${mag}A`,
      type: 'grad',
      unit: 'T/m',
      status: BAD_MEG_CHANNELS.has(`${mag}A`) ? 'bad' : 'good',
    });
    channels.push({
      name: `${mag}B`,
      type: 'grad',
      unit: 'T/m',
      status: BAD_MEG_CHANNELS.has(`${mag}B`) ? 'bad' : 'good',
    });
  }
  channels.push(
    { name: 'STI101', type: 'stim', unit: 'none', status: 'good' },
    { name: 'EOG001', type: 'eog', unit: 'V', status: 'good' },
    { name: 'ECG001', type: 'ecg', unit: 'V', status: 'good' },
    { name: 'EEG061', type: 'eeg_aux', unit: 'V', status: 'good' },
    { name: 'EEG062', type: 'eeg_aux', unit: 'V', status: 'bad' },
    { name: 'SYS201', type: 'misc', unit: 'none', status: 'good' },
    { name: 'RESP201', type: 'resp', unit: 'none', status: 'good' },
    { name: 'PHOT201', type: 'misc', unit: 'none', status: 'good' },
    { name: 'TEMP001', type: 'temp', unit: 'C', status: 'good' },
  );
  return channels.slice(0, 315);
};

const buildOpmChannels = (): Channel[] => {
  const channels: Channel[] = [];
  for (let i = 1; i <= 64; i += 1) {
    channels.push({
      name: `OPM${String(i).padStart(3, '0')}`,
      type: 'opm',
      unit: 'T',
      status: i % 21 === 0 ? 'bad' : 'good',
    });
  }
  channels.push({ name: 'STI101', type: 'stim', unit: 'none', status: 'good' });
  return channels;
};

const buildMneChannels = (): Channel[] => {
  const channels = buildNeuromagChannels().slice(0, 306);
  for (let i = 1; i <= 60; i += 1) {
    channels.push({
      name: `EEG${String(i).padStart(3, '0')}`,
      type: 'eeg_aux',
      unit: 'V',
      status: i === 13 ? 'bad' : 'good',
    });
  }
  channels.push(
    { name: 'STI001', type: 'stim', unit: 'none', status: 'good' },
    { name: 'EOG001', type: 'eog', unit: 'V', status: 'good' },
    { name: 'ECG001', type: 'ecg', unit: 'V', status: 'good' },
    { name: 'MISC001', type: 'misc', unit: 'none', status: 'good' },
    { name: 'MISC002', type: 'misc', unit: 'none', status: 'good' },
    { name: 'MISC003', type: 'misc', unit: 'none', status: 'good' },
    { name: 'MISC004', type: 'misc', unit: 'none', status: 'good' },
    { name: 'MISC005', type: 'misc', unit: 'none', status: 'good' },
    { name: 'MISC006', type: 'misc', unit: 'none', status: 'good' },
    { name: 'MISC007', type: 'misc', unit: 'none', status: 'good' },
  );
  return channels.slice(0, 376);
};

export const mockChannels = (recordingId: string): Channel[] => {
  const recording = recordingById(recordingId);
  if (recording.sensor_type === 'opm_ucl_fil') {
    return buildOpmChannels();
  }
  if (recording.sensor_type === 'neuromag_vectorview' && recording.n_channels_total >= 376) {
    return buildMneChannels();
  }
  return buildNeuromagChannels();
};

/* ---------------------------------------------------------------------------
 * Datasets
 * --------------------------------------------------------------------------- */

interface MockDatasetInput {
  id: string;
  projectId: string;
  name: string;
  version: string;
  sourceType: DatasetDetail['source_type'];
  status: DatasetDetail['status'];
  recording?: Recording;
  description?: string;
}

const toDataset = (input: MockDatasetInput): DatasetDetail => {
  const versionId = `dv_${input.id.slice(3)}`;
  const version: DatasetVersion = {
    id: versionId,
    dataset_id: input.id,
    version: input.version,
    status: input.status === 'validating' ? 'validating' : 'ready',
    format: input.recording?.format ?? 'fif',
    file_name: input.recording?.file_name ?? null,
    checksum_sha256: SHA(input.id.padEnd(8, '0')),
    created_at: ISO.now,
  };
  const fileAssets: FileAsset[] = input.recording
    ? [
        {
          id: `art_f1_${input.id}`,
          dataset_version_id: versionId,
          name: input.recording.file_name,
          checksum: SHA(input.recording.file_name.padEnd(8, '0')),
          size_bytes: input.recording.sensor_type === 'opm_ucl_fil' ? 52_428_800 : 195_422_013,
          media_type:
            input.recording.format === 'opm_bin'
              ? 'application/octet-stream'
              : 'application/x-meg-fif',
          role: 'primary',
          created_at: ISO.now,
        },
        {
          id: `art_f2_${input.id}`,
          dataset_version_id: versionId,
          name: input.recording.file_name.replace(/\.(fif|bin)$/, '_events.$1'),
          checksum: SHA(`events-${input.id}`.padEnd(8, '0')),
          size_bytes: 1_245_184,
          media_type: 'application/octet-stream',
          role: 'events',
          created_at: ISO.now,
        },
        {
          id: `art_f3_${input.id}`,
          dataset_version_id: versionId,
          name: input.recording.file_name.replace(/\.(fif|bin)$/, '.json'),
          checksum: SHA(`meta-${input.id}`.padEnd(8, '0')),
          size_bytes: 84_377,
          media_type: 'application/json',
          role: 'metadata',
          created_at: ISO.now,
        },
      ]
    : [];
  return {
    id: input.id,
    project_id: input.projectId,
    name: input.name,
    description: input.description ?? null,
    source_type: input.sourceType,
    status: input.status,
    created_at: ISO.now,
    updated_at: ISO.now,
    archived_at: null,
    current_dataset_version: version,
    version_count: input.version === 'v3' ? 3 : 1,
    recording_count: input.recording ? 1 : 0,
    run_count: 0,
    recording: input.recording ?? null,
    file_assets: fileAssets,
  };
};

export const mockDatasets: DatasetDetail[] = [
  toDataset({
    id: 'ds_7e42',
    projectId: 'proj_001',
    name: 'AEF-001 v3',
    version: 'v3',
    sourceType: 'upload',
    status: 'ready',
    recording: mockRecordings[0],
    description: 'Auditory evoked fields session',
  }),
  toDataset({
    id: 'ds_5e4f',
    projectId: 'proj_001',
    name: 'AEF-001 v2',
    version: 'v2',
    sourceType: 'upload',
    status: 'ready',
    recording: mockRecordings[3],
  }),
  toDataset({
    id: 'ds_8f1a',
    projectId: 'proj_001',
    name: 'AEF-002 v1',
    version: 'v1',
    sourceType: 'upload',
    status: 'ready',
    recording: mockRecordings[3],
  }),
  toDataset({
    id: 'ds_b34e',
    projectId: 'proj_001',
    name: 'AEF-003 v1',
    version: 'v1',
    sourceType: 'upload',
    status: 'validating',
  }),
  toDataset({
    id: 'ds_11c2',
    projectId: 'proj_002',
    name: 'OPM-SSS-011 v1',
    version: 'v1',
    sourceType: 'upload',
    status: 'ready',
    recording: mockRecordings[1],
    description: '64-ch UCL FIL OPM array',
  }),
  toDataset({
    id: 'ds_29c8',
    projectId: 'proj_002',
    name: 'OPM-SSS-010 v1',
    version: 'v1',
    sourceType: 'upload',
    status: 'ready',
    recording: mockRecordings[1],
  }),
  toDataset({
    id: 'ds_31d0',
    projectId: 'proj_002',
    name: 'OPM-RS-007 v1',
    version: 'v1',
    sourceType: 'upload',
    status: 'ready',
    recording: mockRecordings[1],
  }),
  toDataset({
    id: 'ds_42a1',
    projectId: 'proj_002',
    name: 'OPM-RS-006 v1',
    version: 'v1',
    sourceType: 'upload',
    status: 'validating',
  }),
  toDataset({
    id: 'ds_53b2',
    projectId: 'proj_002',
    name: 'OPM-EEG-004 v1',
    version: 'v1',
    sourceType: 'upload',
    status: 'ready',
    recording: mockRecordings[1],
  }),
  toDataset({
    id: 'ds_22d9',
    projectId: 'proj_003',
    name: 'sample-auditory-raw v1',
    version: 'v1',
    sourceType: 'sample',
    status: 'ready',
    recording: mockRecordings[2],
    description: 'Public MNE-Python sample recording (anonymised)',
  }),
  toDataset({
    id: 'ds_64c3',
    projectId: 'proj_003',
    name: 'sample-visual-raw v1',
    version: 'v1',
    sourceType: 'sample',
    status: 'ready',
    recording: mockRecordings[2],
  }),
  toDataset({
    id: 'ds_75d4',
    projectId: 'proj_004',
    name: 'CD-RS-001 v1',
    version: 'v1',
    sourceType: 'upload',
    status: 'ready',
    recording: mockRecordings[0],
  }),
];

export const datasetById = (id: string): DatasetDetail =>
  mockDatasets.find((dataset) => dataset.id === id) ?? mockDatasets[0];

export const datasetByRecordingId = (recordingId: string): Dataset =>
  mockDatasets.find((dataset) => dataset.recording?.id === recordingId) ?? mockDatasets[0];

/* ---------------------------------------------------------------------------
 * Pipelines
 * --------------------------------------------------------------------------- */

const FILTER_PARAMS: PipelineParameter[] = [
  {
    name: 'l_freq_hz',
    type: 'number',
    label: 'Low cutoff (high-pass)',
    unit: 'Hz',
    default: 1.0,
    required: true,
    minimum: 0.1,
    maximum: 100,
  },
  {
    name: 'h_freq_hz',
    type: 'number',
    label: 'High cutoff (low-pass)',
    unit: 'Hz',
    default: 40.0,
    required: true,
    minimum: 1,
    maximum: 500,
  },
];

const EPOCH_PARAMS: PipelineParameter[] = [
  {
    name: 'tmin_s',
    type: 'number',
    label: 'Epoch start (tmin)',
    unit: 's',
    default: -0.2,
    required: true,
    minimum: -1,
    maximum: 0,
  },
  {
    name: 'tmax_s',
    type: 'number',
    label: 'Epoch end (tmax)',
    unit: 's',
    default: 0.8,
    required: true,
    minimum: 0,
    maximum: 5,
  },
  {
    name: 'baseline_s',
    type: 'string',
    label: 'Baseline window',
    unit: 's',
    default: '(-0.2, 0.0)',
  },
];

interface MockPipelineInput {
  id: string;
  projectId: string;
  name: string;
  description: string;
  kind: string;
  version: string;
  parameters: PipelineParameter[];
  steps: PipelineVersion['steps'];
  runCount: number;
}

const digest = (pipeline: string): string => SHA(pipeline.padEnd(14, '0'));

const toPipeline = (
  input: Omit<MockPipelineInput, 'steps'> & { steps: PipelineVersion['steps'] },
): Pipeline => {
  const versionId = `pv_${input.id.slice(3)}`;
  const version: PipelineVersion = {
    id: versionId,
    pipeline_id: input.id,
    version: input.version,
    status: 'published',
    image_digest: digest(input.name),
    changelog: `Initial published definition for ${input.name}.`,
    created_at: daysAgo(40),
    parameters: input.parameters,
    steps: input.steps,
  };
  return {
    id: input.id,
    project_id: input.projectId,
    name: input.name,
    description: input.description,
    kind: input.kind,
    created_at: daysAgo(41),
    updated_at: daysAgo(40),
    latest_version: version,
    version_count: 1,
    run_count: input.runCount,
  };
};

export const mockPipelines: Pipeline[] = [
  toPipeline({
    id: 'pl_8ab3',
    projectId: 'proj_001',
    name: 'event-related-analysis',
    description: 'Epoching + evoked response pipeline',
    kind: 'evoked',
    version: '1.2.0',
    parameters: [
      ...FILTER_PARAMS,
      ...EPOCH_PARAMS,
      {
        name: 'baseline_correction',
        type: 'boolean',
        label: 'Baseline correction',
        default: true,
      },
    ],
    steps: [
      { name: 'filter', type: 'bandpass', params: { l_freq_hz: 1.0, h_freq_hz: 40.0 } },
      {
        name: 'epoch',
        type: 'epochs',
        params: { tmin_s: -0.2, tmax_s: 0.8, baseline_s: [-0.2, 0.0] },
      },
      { name: 'evoked', type: 'evoked', params: { combine: 'rms' } },
    ],
    runCount: 9,
  }),
  toPipeline({
    id: 'pl_5c94',
    projectId: 'proj_001',
    name: 'spectral-analysis',
    description: 'Welch power spectral density + band power summaries',
    kind: 'spectral',
    version: '0.9.3',
    parameters: [
      ...FILTER_PARAMS,
      {
        name: 'n_fft',
        type: 'integer',
        label: 'FFT length',
        unit: 'samples',
        default: 1024,
        minimum: 128,
        maximum: 8192,
      },
      {
        name: 'win',
        type: 'enum',
        label: 'Window function',
        options: ['hann', 'hamming', 'blackman'],
        default: 'hann',
      },
    ],
    steps: [
      { name: 'filter', type: 'bandpass', params: { l_freq_hz: 1.0, h_freq_hz: 40.0 } },
      { name: 'psd', type: 'welch', params: { n_fft: 1024, average: 'mean' } },
    ],
    runCount: 6,
  }),
  toPipeline({
    id: 'pl_6d05',
    projectId: 'proj_002',
    name: 'opm-preprocess',
    description: 'OPM movement compensation, projection, and cleaning',
    kind: 'opm',
    version: '0.4.0',
    parameters: [
      {
        name: 'movement_compensation',
        type: 'boolean',
        label: 'Movement compensation',
        default: true,
      },
      ...FILTER_PARAMS,
    ],
    steps: [
      { name: 'compensate', type: 'opm_movement', params: { method: 'maxwell_filter' } },
      { name: 'filter', type: 'bandpass', params: { l_freq_hz: 1.0, h_freq_hz: 40.0 } },
    ],
    runCount: 8,
  }),
  toPipeline({
    id: 'pl_7e16',
    projectId: 'proj_001',
    name: 'bad-channel-detection',
    description: 'Automatic bad segment and channel detection',
    kind: 'qc',
    version: '1.1.0',
    parameters: [
      {
        name: 'percent_thresh',
        type: 'number',
        label: 'Percent threshold',
        unit: '%',
        default: 20,
        minimum: 1,
        maximum: 90,
      },
      {
        name: 'n_jobs',
        type: 'integer',
        label: 'Parallel jobs',
        default: 2,
        minimum: 1,
        maximum: 16,
      },
    ],
    steps: [{ name: 'reject', type: 'annotate_bad', params: { percent_thresh: 20 } }],
    runCount: 4,
  }),
  toPipeline({
    id: 'pl_8f27',
    projectId: 'proj_002',
    name: 'ssp-artifact-removal',
    description: 'Signal-space projection for cardiac/eye artefact removal',
    kind: 'ssp',
    version: '0.3.0',
    parameters: [
      {
        name: 'n_eeg',
        type: 'integer',
        label: 'EEG SSP components',
        default: 2,
        minimum: 0,
        maximum: 8,
      },
      {
        name: 'n_mag',
        type: 'integer',
        label: 'Magnetometer SSP components',
        default: 2,
        minimum: 0,
        maximum: 8,
      },
    ],
    steps: [{ name: 'ssp', type: 'compute_ssp', params: { n_eeg: 2, n_mag: 2 } }],
    runCount: 2,
  }),
];

export const pipelineById = (id: string): Pipeline =>
  mockPipelines.find((pipeline) => pipeline.id === id) ?? mockPipelines[0];

/* ---------------------------------------------------------------------------
 * Runs
 * --------------------------------------------------------------------------- */

interface MockRunInput {
  id: string;
  projectId: string;
  pipeline: Pipeline;
  dataset: DatasetDetail;
  status: RunStatus;
  requestedMinutesAgo: number;
  parameters: Record<string, unknown>;
  error?: { code: string; message: string };
  durationMin: number;
}

const toRun = (input: MockRunInput): ExperimentRun => {
  const { pipeline, dataset, status } = input;
  const requestedAt = minutesAgo(input.requestedMinutesAgo);
  const startedAt =
    status === 'queued'
      ? null
      : minutesAgo(Math.min(input.requestedMinutesAgo, Math.max(input.requestedMinutesAgo - 1, 1)));
  const finishedAt =
    status === 'succeeded' || status === 'failed' || status === 'cancelled'
      ? minutesAgo(Math.max(input.requestedMinutesAgo - input.durationMin, 0))
      : null;
  return {
    id: input.id,
    project_id: input.projectId,
    pipeline_id: pipeline.id,
    pipeline_name: pipeline.name,
    pipeline_version: pipeline.latest_version?.version ?? '—',
    pipeline_version_id: pipeline.latest_version?.id ?? '',
    dataset_id: dataset.id,
    dataset_name: dataset.name,
    dataset_version_id: dataset.current_dataset_version?.id ?? '',
    dataset_version: dataset.current_dataset_version?.version ?? '—',
    status,
    parameters: input.parameters,
    error: input.error ?? null,
    requested_at: requestedAt,
    started_at: startedAt,
    finished_at: finishedAt,
    duration_s: status === 'succeeded' || status === 'failed' ? input.durationMin * 60 : null,
    artifacts_count: status === 'succeeded' ? 2 : 0,
  };
};

const canonicalRuns: ExperimentRun[] = [
  toRun({
    id: 'run_4ad82b31',
    projectId: 'proj_001',
    pipeline: pipelineById('pl_8ab3'),
    dataset: datasetById('ds_7e42'),
    status: 'running',
    requestedMinutesAgo: 2,
    durationMin: 0,
    parameters: {
      filter: { l_freq_hz: 1.0, h_freq_hz: 40.0 },
      epoch: { tmin_s: -0.2, tmax_s: 0.8 },
    },
  }),
  toRun({
    id: 'run_9f3c1b7a',
    projectId: 'proj_001',
    pipeline: pipelineById('pl_5c94'),
    dataset: datasetById('ds_7e42'),
    status: 'succeeded',
    requestedMinutesAgo: 34,
    durationMin: 3,
    parameters: { filter: { l_freq_hz: 1.0, h_freq_hz: 40.0 }, n_fft: 1024, win: 'hann' },
  }),
  toRun({
    id: 'run_2ee510ab',
    projectId: 'proj_002',
    pipeline: pipelineById('pl_6d05'),
    dataset: datasetById('ds_11c2'),
    status: 'succeeded',
    requestedMinutesAgo: 60,
    durationMin: 4,
    parameters: { movement_compensation: true, filter: { l_freq_hz: 1.0, h_freq_hz: 40.0 } },
  }),
  toRun({
    id: 'run_c1e777da',
    projectId: 'proj_001',
    pipeline: pipelineById('pl_7e16'),
    dataset: datasetById('ds_5e4f'),
    status: 'failed',
    requestedMinutesAgo: 180,
    durationMin: 1,
    error: { code: 'bad_segments', message: 'Insufficient clean segments after rejection.' },
    parameters: { percent_thresh: 20, n_jobs: 2 },
  }),
  toRun({
    id: 'run_55aa9c30',
    projectId: 'proj_002',
    pipeline: pipelineById('pl_8ab3'),
    dataset: datasetById('ds_11c2'),
    status: 'queued',
    requestedMinutesAgo: 240,
    durationMin: 0,
    parameters: {
      filter: { l_freq_hz: 1.0, h_freq_hz: 40.0 },
      epoch: { tmin_s: -0.2, tmax_s: 0.8 },
    },
  }),
  toRun({
    id: 'run_e08127bb',
    projectId: 'proj_002',
    pipeline: pipelineById('pl_8f27'),
    dataset: datasetById('ds_29c8'),
    status: 'cancelled',
    requestedMinutesAgo: 1440,
    durationMin: 2,
    parameters: { n_eeg: 2, n_mag: 2 },
  }),
];

/** Generate enough deterministic runs to make lists and KPIs feel real. */
export const mockRuns: ExperimentRun[] = (() => {
  const runs = [...canonicalRuns];
  const statuses: RunStatus[] = [
    'succeeded',
    'succeeded',
    'succeeded',
    'running',
    'queued',
    'failed',
  ];
  const pools = [
    { pipe: 'pl_8ab3', ds: 'ds_7e42' },
    { pipe: 'pl_5c94', ds: 'ds_7e42' },
    { pipe: 'pl_6d05', ds: 'ds_11c2' },
    { pipe: 'pl_8f27', ds: 'ds_29c8' },
    { pipe: 'pl_7e16', ds: 'ds_5e4f' },
    { pipe: 'pl_8f27', ds: 'ds_11c2' },
  ];
  for (let i = 0; i < 22; i += 1) {
    const pool = pools[i % pools.length];
    runs.push(
      toRun({
        id: `run_${(i + 100).toString(16)}dcba`,
        projectId: pipelineById(pool.pipe).project_id,
        pipeline: pipelineById(pool.pipe),
        dataset: datasetById(pool.ds),
        status: statuses[i % statuses.length],
        requestedMinutesAgo: 60 * 6 + i * 47,
        durationMin: 2 + (i % 14),
        parameters: { note: `batch iteration ${i + 1}` },
      }),
    );
  }
  return runs;
})();

export const runById = (id: string): ExperimentRun =>
  mockRuns.find((run) => run.id === id) ?? mockRuns[0];

/** Build the queued run created by `POST /runs` in mock mode. */
export const createMockRun = (
  pipelineVersionId: string,
  datasetVersionId: string,
  parameters: Record<string, unknown>,
): ExperimentRun => {
  const pipeline =
    mockPipelines.find((candidate) => candidate.latest_version?.id === pipelineVersionId) ??
    mockPipelines[0];
  const dataset =
    mockDatasets.find((candidate) => candidate.current_dataset_version?.id === datasetVersionId) ??
    mockDatasets[0];
  const id = `run_${(mockRuns.length + 1).toString(16).padStart(8, '0')}`;
  return toRun({
    id,
    projectId: pipeline.project_id,
    pipeline,
    dataset,
    status: 'queued',
    requestedMinutesAgo: 0,
    durationMin: 0,
    parameters,
  });
};

/** Clone a run with an overridden status (cancel/rerun in mock mode). */
export const mockRunWithStatus = (runId: string, status: RunStatus): ExperimentRun => {
  const run = runById(runId);
  const now = new Date(NOW).toISOString();
  return {
    ...run,
    status,
    finished_at:
      status === 'succeeded' || status === 'failed' || status === 'cancelled'
        ? now
        : run.finished_at,
    error:
      status === 'cancelled'
        ? { code: 'cancelled', message: 'Run cancelled by user.' }
        : status === 'queued'
          ? null
          : run.error,
    duration_s: status === 'succeeded' || status === 'failed' ? run.duration_s : null,
  };
};

/* ---------------------------------------------------------------------------
 * Run logs and artifacts
 * --------------------------------------------------------------------------- */

export const mockRunLogs = (runId: string): RunLogLine[] => {
  const run = runById(runId);
  const base = new Date(run.started_at ?? run.requested_at).getTime();
  const line = (
    offset: number,
    severity: RunLogLine['severity'],
    operation: string,
    message: string,
  ): RunLogLine => ({
    timestamp: new Date(base + offset * 1000).toISOString(),
    severity,
    operation,
    message,
  });
  return [
    line(0, 'info', 'worker', 'Worker started.'),
    line(2, 'info', 'io', `Loading recording from ${run.dataset_name}.`),
    line(5, 'info', 'io', 'Raw file read complete.'),
    line(8, 'info', 'preprocess', 'Band-pass filter applied 1.0–40.0 Hz.'),
    line(11, 'info', 'epochs', 'Constructing epochs from stimulus channel.'),
    ...(run.status === 'failed'
      ? [line(13, 'error', 'reject', 'Insufficient clean segments after rejection.')]
      : run.status === 'succeeded'
        ? [
            line(14, 'info', 'epochs', 'Epochs created: n=120.'),
            line(17, 'info', 'output', 'Evoked response and PSD written to artifacts.'),
          ]
        : [line(13, 'info', 'epochs', 'Epochs created: n=120.')]),
  ];
};

export const mockRunArtifacts = (runId: string): Artifact[] => {
  if (runById(runId).status !== 'succeeded') {
    return [];
  }
  return [
    {
      id: 'art_e7a0',
      run_id: runId,
      name: 'evoked_response.png',
      checksum: SHA('5eb9a2f1'),
      media_type: 'image/png',
      size_bytes: 245_760,
      created_at: ISO.m4,
    },
    {
      id: 'art_f3b2',
      run_id: runId,
      name: 'evoked_data.json',
      checksum: SHA('7b9c44da'),
      media_type: 'application/json',
      size_bytes: 4096,
      created_at: ISO.m4,
    },
  ];
};

/* ---------------------------------------------------------------------------
 * Signals
 * --------------------------------------------------------------------------- */

const genSample = (index: number, t: number, f0: number, scale: number, seed: number): number => {
  const tone = Math.sin(2 * Math.PI * f0 * t + seed * 0.7) * scale;
  const drift = Math.sin(2 * Math.PI * 0.5 * t + seed) * 0.28;
  const hash = Math.sin(seed * 12.9898 + t * 78.233) * 43758.5453;
  const noise = (hash - Math.floor(hash) - 0.5) * 0.12;
  return tone + drift + noise;
};

const makeTrace = (index: number, n: number, hz: number, seed: number): number[] => {
  const f0 = 3 + (index % 5);
  const scale = 1.8 / Math.sqrt(1 + (index % 4));
  return Array.from({ length: n }, (_, i) => genSample(index, i / hz, f0, scale, seed + i));
};

export const mockSignals = (recordingId: string, query: SignalQuery): SignalWindow => {
  const recording = recordingById(recordingId);
  const tmin = Math.max(query.tmin, 0);
  const tmax = Math.min(query.tmax, recording.duration_s);
  const duration = Math.max(tmax - tmin, 0.001);
  const maxPoints = 4000;
  const autoFactor = Math.ceil((duration * recording.sampling_frequency_hz) / maxPoints);
  const downsampleFactor = Math.max(query.downsampleFactor ?? autoFactor, 1);
  const effectiveHz = recording.sampling_frequency_hz / downsampleFactor;
  const nTimes = Math.max(Math.floor(duration * effectiveHz), 1);

  const allChannels = mockChannels(recordingId);
  const rawSelection = (query.channels ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  let picked: Channel[] = [];
  if (rawSelection.length === 0) {
    const names = ['MEG0111', 'MEG0162A', 'STI101', 'EOG001', 'MEG0131', 'MEG0161B'];
    picked = names
      .map((name) => allChannels.find((channel) => channel.name === name))
      .filter((channel): channel is Channel => channel !== undefined);
  } else {
    picked = rawSelection
      .filter((part) => !part.startsWith('!'))
      .flatMap((part) => {
        if (part.endsWith('*')) {
          const prefix = part.slice(0, -1);
          return allChannels.filter((channel) => channel.name.startsWith(prefix)).slice(0, 32);
        }
        const channel = allChannels.find((candidate) => candidate.name === part);
        return channel ? [channel] : [];
      })
      .slice(0, 16);
  }
  if (picked.length === 0) {
    picked = allChannels.slice(0, 6);
  }

  const times = Array.from({ length: nTimes }, (_, i) => tmin + i / effectiveHz);
  const channels = picked.map((channel) => {
    const index = allChannels.indexOf(channel);
    const seed = index * 13;
    const data =
      channel.type === 'stim'
        ? times.map((_, i) => (i % Math.max(Math.round(effectiveHz), 1) === 0 ? 1 : 0))
        : makeTrace(index, nTimes, effectiveHz, seed);
    return { name: channel.name, type: channel.type, unit: channel.unit, data };
  });

  return {
    recording_id: recordingId,
    tmin_s: tmin,
    tmax_s: tmax,
    sampling_frequency_hz: recording.sampling_frequency_hz,
    effective_sampling_frequency_hz: effectiveHz,
    downsample_factor: downsampleFactor,
    decimated: downsampleFactor > 1,
    n_times: nTimes,
    channels,
    times,
    summary: downsampleFactor > 1 ? 'multiresolution_summary' : 'bounded_window',
    boundary_checked: true,
  };
};

/* ---------------------------------------------------------------------------
 * Event sets
 * --------------------------------------------------------------------------- */

export const mockEventSets = (recordingId: string): EventSet[] => {
  const recording = recordingById(recordingId);
  const events = Array.from({ length: 100 }, (_, i) => {
    const sample = 500 + i * 1000;
    return { id: i + 1, time_s: sample / recording.sampling_frequency_hz, sample, duration_s: 0 };
  });
  return [
    {
      id: 'es_6201',
      name: 'stimulus_events',
      source: 'stim_channel',
      events,
      metadata: { event_id_mapping: { '1': 'tone', '2': 'click' } },
    },
  ];
};

/* ---------------------------------------------------------------------------
 * Sensor geometry
 * --------------------------------------------------------------------------- */

const R = 0.09;

const helmetPositions = (count: number): [number, number, number][] => {
  const positions: [number, number, number][] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count;
    const theta = (Math.PI * t) / 2 + 0.05;
    const phi = i * 2.3999632297;
    positions.push([
      R * Math.sin(theta) * Math.cos(phi),
      R * Math.sin(theta) * Math.sin(phi),
      R * Math.cos(theta),
    ]);
  }
  return positions;
};

const normalize = ([x, y, z]: [number, number, number]): [number, number, number] => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

const tangentTo = (radial: [number, number, number]): [number, number, number] =>
  normalize([-radial[1], radial[0], 0]);

export const mockSensorGeometry = (recordingId: string): SensorGeometry => {
  const recording = recordingById(recordingId);
  const positions = helmetPositions(recording.sensor_type === 'opm_ucl_fil' ? 64 : 102);
  const sensors: Sensor[] = [];

  if (recording.sensor_type === 'opm_ucl_fil') {
    positions.forEach((position, i) => {
      const radial = normalize(position);
      sensors.push({
        name: `OPM${String(i + 1).padStart(3, '0')}`,
        type: 'opm',
        coil_type: 'opm',
        position,
        orientation: radial,
        normal: radial,
      });
    });
    return {
      recording_id: recordingId,
      sensor_type: 'opm_ucl_fil',
      coordinate_frame: recording.coordinate_frame,
      units: 'm',
      sensors,
      helmet_model: 'opm_array',
      opm_metadata: {
        array_type: 'ucl_fil_opm',
        n_channels: 64,
        movement_tracking: true,
      },
    };
  }

  positions.forEach((position, i) => {
    const radial = normalize(position);
    const tangent1 = tangentTo(radial);
    const tangent2 = normalize([tangent1[1], -tangent1[0], 0]);
    const mag = neuromagMagName(i + 1);
    sensors.push({
      name: mag,
      type: 'mag',
      coil_type: 'magnetometer',
      position,
      orientation: radial,
      normal: radial,
    });
    sensors.push({
      name: `${mag}A`,
      type: 'grad',
      coil_type: 'planar_gradiometer',
      position,
      orientation: tangent1,
      normal: radial,
    });
    sensors.push({
      name: `${mag}B`,
      type: 'grad',
      coil_type: 'planar_gradiometer',
      position,
      orientation: tangent2,
      normal: radial,
    });
  });

  return {
    recording_id: recordingId,
    sensor_type: 'neuromag_vectorview',
    coordinate_frame: recording.coordinate_frame,
    units: 'm',
    sensors,
    helmet_model: 'neuromag_vectorview',
    opm_metadata: null,
  };
};

/* ---------------------------------------------------------------------------
 * Quotas and usage
 * --------------------------------------------------------------------------- */

export const mockQuotas: Quota[] = [
  {
    resource_type: 'storage_bytes',
    limit: 100 * 1024 ** 3,
    used: Math.round(31.8 * 1024 ** 3),
    state: 'approaching_limit',
  },
  {
    resource_type: 'cpu_seconds',
    limit: 24 * 3600,
    used: Math.round(6.68 * 3600),
    state: 'within_quota',
  },
  {
    resource_type: 'runs',
    limit: 100,
    used: 23,
    state: 'within_quota',
  },
];

export const mockUsage = (): UsageRecord[] => [
  {
    id: 'usage_01',
    resource_type: 'storage_bytes',
    quantity: Math.round(31.8 * 1024 ** 3),
    run_id: null,
    created_at: ISO.now,
  },
  {
    id: 'usage_02',
    resource_type: 'cpu_seconds',
    quantity: Math.round(6.68 * 3600),
    run_id: runById('run_9f3c1b7a').id,
    created_at: ISO.now,
  },
  {
    id: 'usage_03',
    resource_type: 'runs',
    quantity: 23,
    run_id: null,
    created_at: ISO.now,
  },
];

/* ---------------------------------------------------------------------------
 * Shares
 * --------------------------------------------------------------------------- */

export const mockShares: Share[] = [
  {
    share_id: 'sh_c902',
    project_id: 'proj_003',
    share_url: 'https://meg-lab.example.com/share/sh_c902',
    scope: 'read_only',
    expires_at: ISO.later,
    revoked_at: null,
    created_at: ISO.d1,
  },
];
