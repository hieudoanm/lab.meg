import { ApiClient, apiClient } from './client';
import { mockProjects, paged, projectById, mocksEnabled } from './mock-data';
import type {
  Page,
  ProjectCreateBody,
  ProjectMember,
  ProjectSummary,
  ProjectUpdateBody,
} from './types';

export interface ProjectListOptions {
  limit?: number;
  cursor?: string | null;
  search?: string;
  includeArchived?: boolean;
}

export const fetchProjects = (
  options: ProjectListOptions = {},
  client: ApiClient = apiClient,
): Promise<Page<ProjectSummary>> => {
  if (mocksEnabled()) {
    const query = options.search?.toLowerCase() ?? '';
    const projects = mockProjects.filter((project) => {
      const visible = options.includeArchived ? true : project.archived_at === null;
      const matches =
        query.length === 0 ||
        project.name.toLowerCase().includes(query) ||
        (project.description?.toLowerCase().includes(query) ?? false);
      return visible && matches;
    });
    return Promise.resolve(paged(projects));
  }
  return client.get<Page<ProjectSummary>>('/projects', {
    query: {
      limit: options.limit,
      cursor: options.cursor,
      search: options.search,
      include_archived: options.includeArchived,
    },
  });
};

export const fetchProject = (
  projectId: string,
  client: ApiClient = apiClient,
): Promise<ProjectSummary> => {
  if (mocksEnabled()) {
    return Promise.resolve(projectById(projectId));
  }
  return client.get<ProjectSummary>(`/projects/${projectId}`);
};

export const createProject = (
  body: ProjectCreateBody,
  client: ApiClient = apiClient,
): Promise<ProjectSummary> => {
  if (mocksEnabled()) {
    const now = new Date().toISOString();
    const project: ProjectSummary = {
      id: `proj_${(mockProjects.length + 1).toString().padStart(3, '0')}`,
      owner_id: 'usr_9a7f',
      name: body.name,
      description: body.description ?? null,
      visibility: body.visibility ?? 'private',
      role: 'owner',
      dataset_count: 0,
      run_count: 0,
      created_at: now,
      updated_at: now,
      archived_at: null,
    };
    return Promise.resolve(project);
  }
  return client.post<ProjectSummary>('/projects', { body });
};

export const updateProject = (
  projectId: string,
  body: ProjectUpdateBody,
  client: ApiClient = apiClient,
): Promise<ProjectSummary> => {
  if (mocksEnabled()) {
    const base = projectById(projectId);
    return Promise.resolve({ ...base, ...body, archived_at: body.archived_at ?? base.archived_at });
  }
  return client.patch<ProjectSummary>(`/projects/${projectId}`, { body });
};

export const archiveProject = (
  projectId: string,
  client: ApiClient = apiClient,
): Promise<ProjectSummary> => {
  if (mocksEnabled()) {
    const base = projectById(projectId);
    return Promise.resolve({ ...base, archived_at: new Date().toISOString() });
  }
  return client.patch<ProjectSummary>(`/projects/${projectId}`, {
    body: { archived_at: new Date().toISOString() },
  });
};

export const fetchProjectMembers = (
  projectId: string,
  client: ApiClient = apiClient,
): Promise<Page<ProjectMember>> => {
  if (mocksEnabled()) {
    return Promise.resolve(paged([]));
  }
  return client.get<Page<ProjectMember>>(`/projects/${projectId}/members`);
};
