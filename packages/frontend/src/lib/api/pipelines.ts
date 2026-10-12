import { ApiClient, apiClient } from './client';
import { mockPipelines, paged, pipelineById, mocksEnabled } from './mock-data';
import type { Page, Pipeline, PipelineVersion } from './types';

export interface PipelineListOptions {
  limit?: number;
  cursor?: string | null;
  projectId?: string;
}

export const fetchPipelines = (
  options: PipelineListOptions = {},
  client: ApiClient = apiClient,
): Promise<Page<Pipeline>> => {
  if (mocksEnabled()) {
    const items = options.projectId
      ? mockPipelines.filter((pipeline) => pipeline.project_id === options.projectId)
      : mockPipelines;
    return Promise.resolve(paged(items));
  }
  return client.get<Page<Pipeline>>('/pipelines', {
    query: { limit: options.limit, cursor: options.cursor, project_id: options.projectId },
  });
};

export const fetchPipeline = (
  pipelineId: string,
  client: ApiClient = apiClient,
): Promise<Pipeline> => {
  if (mocksEnabled()) {
    return Promise.resolve(pipelineById(pipelineId));
  }
  return client.get<Pipeline>(`/pipelines/${pipelineId}`);
};

export const fetchPipelineVersions = (
  pipelineId: string,
  client: ApiClient = apiClient,
): Promise<Page<PipelineVersion>> => {
  if (mocksEnabled()) {
    const pipeline = pipelineById(pipelineId);
    return Promise.resolve(paged(pipeline.latest_version ? [pipeline.latest_version] : []));
  }
  return client.get<Page<PipelineVersion>>(`/pipelines/${pipelineId}/versions`);
};

export const fetchPipelineVersion = (
  pipelineVersionId: string,
  client: ApiClient = apiClient,
): Promise<PipelineVersion> => {
  if (mocksEnabled()) {
    const pipeline = mockPipelines.find(
      (candidate) => candidate.latest_version?.id === pipelineVersionId,
    );
    return Promise.resolve(
      pipeline?.latest_version ?? pipelineById(pipelineVersionId).latest_version!,
    );
  }
  return client.get<PipelineVersion>(`/pipeline-versions/${pipelineVersionId}`);
};
