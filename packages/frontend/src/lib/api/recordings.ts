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
  return client.get<Page<EventSet>>(`/recordings/${recordingId}/event-sets`);
};

export const fetchRecordingSignals = (
  recordingId: string,
  query: SignalQuery,
  client: ApiClient = apiClient,
): Promise<SignalWindow> => {
  if (mocksEnabled()) {
    return Promise.resolve(mockSignals(recordingId, query));
  }
  return client.get<SignalWindow>(`/recordings/${recordingId}/signals`, {
    query: {
      channels: query.channels,
      grouping: query.grouping,
      tmin: query.tmin,
      tmax: query.tmax,
      resolution: query.resolution,
      downsample_factor: query.downsampleFactor,
      decimation_ack: query.decimationAck,
      units: query.units,
    },
  });
};

export const fetchSensorGeometry = (
  recordingId: string,
  client: ApiClient = apiClient,
): Promise<SensorGeometry> => {
  if (mocksEnabled()) {
    return Promise.resolve(mockSensorGeometry(recordingId));
  }
  return client.get<SensorGeometry>(`/recordings/${recordingId}/sensor-geometry`);
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
