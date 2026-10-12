import { ApiClient, apiClient } from './client';
import {
  mockChannels,
  mockEventSets,
  mockSensorGeometry,
  mockSignals,
  paged,
  recordingById,
  mocksEnabled,
} from './mock-data';
import type {
  Channel,
  EventSet,
  Page,
  Recording,
  SensorGeometry,
  SignalQuery,
  SignalWindow,
} from './types';

export const fetchRecording = (
  recordingId: string,
  client: ApiClient = apiClient,
): Promise<Recording> => {
  if (mocksEnabled()) {
    return Promise.resolve(recordingById(recordingId));
  }
  return client.get<Recording>(`/recordings/${recordingId}`);
};

export const fetchRecordingChannels = (
  recordingId: string,
  client: ApiClient = apiClient,
): Promise<Page<Channel>> => {
  if (mocksEnabled()) {
    return Promise.resolve(paged(mockChannels(recordingId)));
  }
  return client.get<Page<Channel>>(`/recordings/${recordingId}/channels`);
};

export const fetchRecordingEventSets = (
  recordingId: string,
  client: ApiClient = apiClient,
): Promise<Page<EventSet>> => {
  if (mocksEnabled()) {
    return Promise.resolve(paged(mockEventSets(recordingId)));
  }
  return client.get<Page<EventSet>>(`/recordings/${recordingId}/events`);
};

export const fetchRecordingSignals = (
  recordingId: string,
  query: SignalQuery,
  client: ApiClient = apiClient,
): Promise<SignalWindow> => {
  if (mocksEnabled()) {
    return Promise.resolve(mockSignals(recordingId, query));
  }
  return client
    .get<{
      recording_id: string;
      tmin_s: number;
      tmax_s: number;
      sampling_frequency_hz: number;
      effective_sampling_frequency_hz: number;
      resolution: SignalQuery['resolution'];
      decimation: number;
      channel_names: string[];
      unit: string | null;
      times_s: number[];
      data: number[][];
      truncated: boolean;
    }>(`/recordings/${recordingId}/signals`, {
      query: {
        channel_ids: query.channels,
        grouping: query.grouping,
        tmin_s: query.tmin,
        tmax_s: query.tmax,
        resolution: query.resolution,
        downsample_factor: query.downsampleFactor,
        decimation_ack: query.decimationAck,
        units: query.units,
      },
    })
    .then((window) => ({
      recording_id: window.recording_id,
      tmin_s: window.tmin_s,
      tmax_s: window.tmax_s,
      sampling_frequency_hz: window.sampling_frequency_hz,
      effective_sampling_frequency_hz: window.effective_sampling_frequency_hz,
      downsample_factor: window.decimation,
      decimated: window.decimation > 1,
      n_times: window.times_s.length,
      channels: window.channel_names.map((name, index) => ({
        name,
        type: 'mag' as const,
        unit: window.unit ?? '',
        data: window.data[index] ?? [],
      })),
      times: window.times_s,
      summary: 'bounded_window' as const,
      boundary_checked: true,
    }));
};

export const fetchSensorGeometry = (
  recordingId: string,
  client: ApiClient = apiClient,
): Promise<SensorGeometry> => {
  if (mocksEnabled()) {
    return Promise.resolve(mockSensorGeometry(recordingId));
  }
  return client.get<SensorGeometry>(`/recordings/${recordingId}/sensors`);
};

export const fetchRecordingDownloadUrl = (
  recordingId: string,
  client: ApiClient = apiClient,
): Promise<{ url: string; expires_at: string }> => {
  if (mocksEnabled()) {
    return Promise.resolve({
      url: `#download:${recordingId}`,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
  }
  return client.get<{ url: string; expires_at: string }>(`/recordings/${recordingId}/download-url`);
};
