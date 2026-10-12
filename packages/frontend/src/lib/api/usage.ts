import { ApiClient, apiClient } from './client';
import { mockQuotas, mockUsage, paged, mocksEnabled } from './mock-data';
import type { Page, Quota, UsageRecord } from './types';

export const fetchUsage = (client: ApiClient = apiClient): Promise<Page<UsageRecord>> => {
  if (mocksEnabled()) {
    return Promise.resolve(paged(mockUsage()));
  }
  return client.get<Page<UsageRecord>>('/usage');
};

export const fetchQuotas = (client: ApiClient = apiClient): Promise<Page<Quota>> => {
  if (mocksEnabled()) {
    return Promise.resolve(paged(mockQuotas));
  }
  return client.get<Page<Quota>>('/quotas');
};
