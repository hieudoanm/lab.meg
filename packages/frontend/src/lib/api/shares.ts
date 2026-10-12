import { ApiClient, apiClient } from './client';
import { mockShares, paged, mocksEnabled } from './mock-data';
import type { Page, Share, ShareCreateBody } from './types';

export const fetchShares = (
  projectId: string,
  client: ApiClient = apiClient,
): Promise<Page<Share>> => {
  if (mocksEnabled()) {
    return Promise.resolve(paged(mockShares.filter((share) => share.project_id === projectId)));
  }
  return client.get<Page<Share>>(`/projects/${projectId}/shares`);
};

export const createShare = (
  projectId: string,
  body: ShareCreateBody,
  client: ApiClient = apiClient,
): Promise<Share> => {
  if (mocksEnabled()) {
    const now = new Date().toISOString();
    const share: Share = {
      share_id: `sh_${Date.now().toString(36)}`,
      project_id: projectId,
      share_url: `https://meg-lab.example.com/share/sh_${Date.now().toString(36)}`,
      scope: body.scope,
      expires_at: body.expires_at ?? new Date(Date.now() + 14 * 86_400_000).toISOString(),
      revoked_at: null,
      created_at: now,
    };
    return Promise.resolve(share);
  }
  return client.post<Share>(`/projects/${projectId}/shares`, { body });
};

export const revokeShare = (shareId: string, client: ApiClient = apiClient): Promise<Share> => {
  if (mocksEnabled()) {
    const share = mockShares.find((candidate) => candidate.share_id === shareId);
    if (share) {
      return Promise.resolve({ ...share, revoked_at: new Date().toISOString() });
    }
    return Promise.resolve({
      share_id: shareId,
      project_id: 'proj_003',
      share_url: '',
      scope: 'read_only',
      expires_at: new Date().toISOString(),
      revoked_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  }
  return client.post<Share>(`/shares/${shareId}/revoke`);
};
