import { ApiClient, apiClient } from './client';
import {
  createMockRun,
  mockRunArtifacts,
  mockRunLogs,
  mockRunWithStatus,
  mockRuns,
  paged,
  runById,
  mocksEnabled,
} from './mock-data';
import type { Artifact, CreateRunBody, ExperimentRun, Page, RunLogLine, RunStatus } from './types';

export interface RunListOptions {
  limit?: number;
  cursor?: string | null;
  projectId?: string;
  status?: RunStatus;
  datasetVersionId?: string;
  pipelineVersionId?: string;
}

export const fetchRuns = (
  options: RunListOptions = {},
  client: ApiClient = apiClient,
): Promise<Page<ExperimentRun>> => {
  if (mocksEnabled()) {
    const items = mockRuns.filter((run) => {
      if (options.projectId && run.project_id !== options.projectId) {
        return false;
      }
      if (options.status && run.status !== options.status) {
        return false;
      }
      if (options.datasetVersionId && run.dataset_version_id !== options.datasetVersionId) {
        return false;
      }
      if (options.pipelineVersionId && run.pipeline_version_id !== options.pipelineVersionId) {
        return false;
      }
      return true;
    });
    return Promise.resolve(paged(items));
  }
  return client.get<Page<ExperimentRun>>('/runs', {
    query: {
      limit: options.limit,
      cursor: options.cursor,
      project_id: options.projectId,
      status: options.status,
      dataset_version_id: options.datasetVersionId,
      pipeline_version_id: options.pipelineVersionId,
    },
  });
};

export const fetchRun = (runId: string, client: ApiClient = apiClient): Promise<ExperimentRun> => {
  if (mocksEnabled()) {
    return Promise.resolve(runById(runId));
  }
  return client.get<ExperimentRun>(`/runs/${runId}`);
};

export const submitRun = (
  body: CreateRunBody,
  idempotencyKey: string,
  client: ApiClient = apiClient,
): Promise<ExperimentRun> => {
  if (mocksEnabled()) {
    return Promise.resolve(
      createMockRun(body.pipeline_version_id, body.dataset_version_id, body.parameters),
    );
  }
  return client.post<ExperimentRun>('/runs', { body, idempotencyKey });
};

export const cancelRun = (runId: string, client: ApiClient = apiClient): Promise<ExperimentRun> => {
  if (mocksEnabled()) {
    return Promise.resolve(mockRunWithStatus(runId, 'cancelled'));
  }
  return client.post<ExperimentRun>(`/runs/${runId}/cancel`);
};

export const rerun = (runId: string, client: ApiClient = apiClient): Promise<ExperimentRun> => {
  if (mocksEnabled()) {
    const run = runById(runId);
    return Promise.resolve(
      createMockRun(run.pipeline_version_id, run.dataset_version_id, run.parameters),
    );
  }
  return client.post<ExperimentRun>(`/runs/${runId}/rerun`);
};

export const fetchRunLogs = (
  runId: string,
  client: ApiClient = apiClient,
): Promise<Page<RunLogLine>> => {
  if (mocksEnabled()) {
    return Promise.resolve(paged(mockRunLogs(runId)));
  }
  return client.get<Page<RunLogLine>>(`/runs/${runId}/logs`);
};

export const fetchRunArtifacts = (
  runId: string,
  client: ApiClient = apiClient,
): Promise<Page<Artifact>> => {
  if (mocksEnabled()) {
    return Promise.resolve(paged(mockRunArtifacts(runId)));
  }
  return client.get<Page<Artifact>>(`/runs/${runId}/artifacts`);
};

export const fetchArtifactDownloadUrl = (
  artifactId: string,
  client: ApiClient = apiClient,
): Promise<{ url: string; expires_at: string }> => {
  if (mocksEnabled()) {
    return Promise.resolve({
      url: `#download:${artifactId}`,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
  }
  return client.get<{ url: string; expires_at: string }>(`/artifacts/${artifactId}/download-url`);
};
