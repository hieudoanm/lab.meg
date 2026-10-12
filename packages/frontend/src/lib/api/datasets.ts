import { ApiClient, apiClient } from './client';
import { datasetById, mockDatasets, paged, mocksEnabled } from './mock-data';
import type {
  Dataset,
  DatasetCreateBody,
  DatasetCreateResponse,
  DatasetDetail,
  DatasetVersion,
  FileAsset,
  Page,
  Recording,
  UploadSession,
  UploadSessionCreateBody,
} from './types';

export interface DatasetListOptions {
  limit?: number;
  cursor?: string | null;
  projectId?: string;
}

export const fetchDatasets = (
  options: DatasetListOptions = {},
  client: ApiClient = apiClient,
): Promise<Page<Dataset>> => {
  if (mocksEnabled()) {
    const items = options.projectId
      ? mockDatasets.filter((dataset) => dataset.project_id === options.projectId)
      : mockDatasets;
    return Promise.resolve(paged(items));
  }
  const path = options.projectId ? `/projects/${options.projectId}/datasets` : '/datasets';
  return client.get<Page<Dataset>>(path, {
    query: { limit: options.limit, cursor: options.cursor },
  });
};

export const fetchProjectDatasets = (
  projectId: string,
  options: Omit<DatasetListOptions, 'projectId'> = {},
  client: ApiClient = apiClient,
): Promise<Page<Dataset>> => {
  return fetchDatasets({ ...options, projectId }, client);
};

export const fetchDataset = (
  datasetId: string,
  client: ApiClient = apiClient,
): Promise<DatasetDetail> => {
  if (mocksEnabled()) {
    return Promise.resolve(datasetById(datasetId));
  }
  return client.get<DatasetDetail>(`/datasets/${datasetId}`);
};

export const createDataset = (
  projectId: string,
  body: DatasetCreateBody,
  client: ApiClient = apiClient,
): Promise<DatasetCreateResponse> => {
  return client.post<DatasetCreateResponse>(`/projects/${projectId}/datasets`, {
    body,
    idempotencyKey: `dataset-create-${projectId}-${body.name}-${body.files.map((file) => file.name).join(',')}`,
  });
};

export const completeDataset = (
  datasetId: string,
  body: DatasetCreateBody['files'],
  client: ApiClient = apiClient,
): Promise<DatasetVersion> => {
  return client.post<DatasetVersion>(`/datasets/${datasetId}/complete`, {
    body: { files: body },
    idempotencyKey: `dataset-complete-${datasetId}-${body.map((file) => file.name).join(',')}`,
  });
};

export const uploadToSignedUrl = async (
  target: { upload_url: string; method: string; headers: Record<string, string> | null },
  file: Blob,
): Promise<void> => {
  const response = await fetch(target.upload_url, {
    method: target.method,
    headers: target.headers ?? {},
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
};

export const fetchDatasetRecordings = (
  datasetId: string,
  client: ApiClient = apiClient,
): Promise<Page<Recording>> => {
  if (mocksEnabled()) {
    const dataset = datasetById(datasetId);
    return Promise.resolve(paged(dataset.recording ? [dataset.recording] : []));
  }
  return client.get<Page<Recording>>(`/datasets/${datasetId}/recordings`);
};

export const fetchDatasetVersions = (
  datasetId: string,
  client: ApiClient = apiClient,
): Promise<Page<DatasetVersion>> => {
  if (mocksEnabled()) {
    const dataset = datasetById(datasetId);
    return Promise.resolve(
      paged(dataset.current_dataset_version ? [dataset.current_dataset_version] : []),
    );
  }
  return client.get<Page<DatasetVersion>>(`/datasets/${datasetId}/versions`);
};

export const fetchDatasetAssets = (
  datasetVersionId: string,
  client: ApiClient = apiClient,
): Promise<Page<FileAsset>> => {
  if (mocksEnabled()) {
    const dataset = mockDatasets.find(
      (candidate) => candidate.current_dataset_version?.id === datasetVersionId,
    );
    return Promise.resolve(paged(dataset?.file_assets ?? []));
  }
  return client.get<Page<FileAsset>>(`/dataset-versions/${datasetVersionId}/file-assets`);
};

export const createUploadSession = (
  datasetId: string,
  body: UploadSessionCreateBody,
  client: ApiClient = apiClient,
): Promise<UploadSession> => {
  if (mocksEnabled()) {
    return Promise.resolve({
      upload_session_id: `ups_${Date.now().toString(16)}`,
      status: 'pending',
      upload_method: 'backend',
      upload_url: `#upload:${datasetId}`,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
  }
  return client.post<UploadSession>(`/datasets/${datasetId}/uploads`, { body });
};

export const fetchFileAssetDownloadUrl = (
  fileAssetId: string,
  client: ApiClient = apiClient,
): Promise<{ url: string; expires_at: string }> => {
  if (mocksEnabled()) {
    return Promise.resolve({
      url: `#download:${fileAssetId}`,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
  }
  return client.get<{ url: string; expires_at: string }>(
    `/file-assets/${fileAssetId}/download-url`,
  );
};
