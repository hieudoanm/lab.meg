import 'server-only';

import { cookies } from 'next/headers';

/**
 * Name of the HttpOnly session cookie held by the Next.js BFF.
 *
 * The BFF (`/api/session`) writes the upstream access token into this cookie and
 * the proxy route (`/api/proxy`) forwards it as a bearer token to the REST API.
 */
export const SESSION_COOKIE_NAME = 'meg-lab_session';

/** Non-sensitive cookie used only to render the account name in the top bar. */
export const USER_COOKIE_NAME = 'meg-lab_user';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
} as const;

export const USER_COOKIE_OPTIONS = {
  httpOnly: false,
  sameSite: 'lax',
  path: '/',
  secure: process.env.NODE_ENV === 'production',
} as const;

export interface SessionUserHint {
  displayName: string;
  email: string;
}

/**
 * Read the raw session token, or `null` when the caller is unauthenticated.
 *
 * Intended for server-side proxies (such as the API proxy route handler) that
 * must forward the bearer token to the API without triggering a redirect.
 */
export const getSessionToken = async (): Promise<string | null> => {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
};

/** Read the non-sensitive display hint for the account menu, if present. */
export const getSessionUserHint = async (): Promise<SessionUserHint | null> => {
  const store = await cookies();
  const raw = store.get(USER_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }
  return decodeSessionUserHint(raw);
};

export const encodeSessionUserHint = (hint: SessionUserHint): string => {
  return Buffer.from(JSON.stringify(hint)).toString('base64');
};

export const decodeSessionUserHint = (encoded: string): SessionUserHint | null => {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json) as Partial<SessionUserHint>;
    if (typeof parsed.displayName === 'string' && typeof parsed.email === 'string') {
      return { displayName: parsed.displayName, email: parsed.email };
    }
  } catch {
    return null;
  }
  return null;
};
