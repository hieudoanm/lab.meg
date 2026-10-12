import { ApiClient, apiClient } from './client';
import { mockPipelines, paged, pipelineById, mocksEnabled } from './mock-data';
import type { Page, Pipeline, PipelineVersion } from './types';

export interface CreatePipelineBody {
  project_id: string;
  name: string;
  description?: string | null;
}

export interface CreatePipelineVersionBody {
  version: string;
  definition: { nodes: Array<{ type: string; params: Record<string, unknown> }> };
  image_digest: string;
  parameters_schema?: Record<string, unknown>;
  status?: 'draft' | 'published' | 'deprecated';
}

interface RawPipelineVersion extends Omit<PipelineVersion, 'parameters' | 'steps'> {
  definition?: { nodes?: Array<Record<string, unknown>>; steps?: Array<Record<string, unknown>> };
  parameters_schema?: {
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
}

const normalizeVersion = (value: RawPipelineVersion): PipelineVersion => {
  const definition = value.definition ?? {};
  const nodes = definition.nodes ?? definition.steps ?? [];
  const properties = value.parameters_schema?.properties ?? {};
  return {
    ...value,
    changelog: value.changelog ?? null,
    parameters: Object.entries(properties).map(([name, schema]) => ({
      name,
      label: typeof schema.title === 'string' ? schema.title : name,
      type: schema.enum
        ? 'enum'
        : schema.type === 'number' || schema.type === 'integer' || schema.type === 'boolean'
          ? schema.type
          : 'string',
      description: typeof schema.description === 'string' ? schema.description : null,
      default: schema.default,
      required: (value.parameters_schema?.required ?? []).includes(name),
      minimum: typeof schema.minimum === 'number' ? schema.minimum : null,
      maximum: typeof schema.maximum === 'number' ? schema.maximum : null,
      options: Array.isArray(schema.enum)
        ? schema.enum.filter((item): item is string => typeof item === 'string')
        : undefined,
    })),
    steps: nodes.map((node) => ({
      name:
        typeof node.name === 'string'
          ? node.name
          : typeof node.type === 'string'
            ? node.type
            : 'step',
      type:
        typeof node.type === 'string' ? node.type : typeof node.op === 'string' ? node.op : 'step',
      params:
        node.params && typeof node.params === 'object'
          ? (node.params as Record<string, unknown>)
          : {},
    })),
  };
};

export const createPipeline = (
  body: CreatePipelineBody,
  client: ApiClient = apiClient,
): Promise<Pipeline> => client.post<Pipeline>('/pipelines', { body });

export const createPipelineVersion = (
  pipelineId: string,
  body: CreatePipelineVersionBody,
  client: ApiClient = apiClient,
): Promise<PipelineVersion> =>
  client.post<PipelineVersion>(`/pipelines/${pipelineId}/versions`, { body });

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
  return client
    .get<Page<PipelineVersion>>(`/pipelines/${pipelineId}/versions`)
    .then((page) => ({ ...page, items: page.items.map(normalizeVersion) }));
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
  return client
    .get<PipelineVersion>(`/pipeline-versions/${pipelineVersionId}`)
    .then(normalizeVersion);
};
