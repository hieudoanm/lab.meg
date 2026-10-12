import { ApiClient, apiClient, resolveApiBaseUrl } from './client';
import { mockCurrentUser, mocksEnabled } from './mock-data';
import type { CurrentUser, IsoTimestamp } from './types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AccessTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_at: IsoTimestamp;
  user: {
    id: string;
    email: string;
    display_name: string | null;
  };
}

export interface RegisterRequest {
  email: string;
  password: string;
  display_name: string;
}

const getServerClient = () => new ApiClient({ baseUrl: resolveApiBaseUrl() });

export const fetchCurrentUser = (client: ApiClient = apiClient): Promise<CurrentUser> => {
  if (mocksEnabled()) {
    return Promise.resolve(mockCurrentUser);
  }
  return client.get<CurrentUser>('/me');
};

export const login = (
  payload: LoginRequest,
  client: ApiClient = getServerClient(),
): Promise<AccessTokenResponse> => {
  if (mocksEnabled()) {
    return Promise.resolve({
      access_token: 'mock-access-token',
      token_type: 'Bearer',
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      user: {
        id: 'mock-user-id',
        email: payload.email,
        display_name: 'Mock User',
      },
    });
  }
  return client.post<AccessTokenResponse>('/auth/login', { body: payload });
};

export const register = (
  payload: RegisterRequest,
  client: ApiClient = getServerClient(),
): Promise<CurrentUser> => {
  if (mocksEnabled()) {
    return Promise.resolve({
      ...mockCurrentUser,
      email: payload.email,
      display_name: payload.display_name || mockCurrentUser.display_name,
    });
  }
  return client.post<CurrentUser>('/auth/register', { body: payload });
};

export const endSession = (client: ApiClient = getServerClient()): Promise<void> => {
  if (mocksEnabled()) {
    return Promise.resolve();
  }
  return client.post<void>('/auth/logout');
};
