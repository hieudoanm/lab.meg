/**
 * In-memory access-token holder used by the API client.
 *
 * Browser sessions are carried by an HttpOnly cookie owned by the Next.js BFF
 * (`/api/session`), so this holder is only used for token-authenticated server
 * calls and tests. The token is intentionally not persisted to `localStorage`.
 */

let accessToken: string | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const getAccessToken = (): string | null => {
  return accessToken;
};
