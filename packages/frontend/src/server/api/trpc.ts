import 'server-only';

import { initTRPC, TRPCError } from '@trpc/server';

import { ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { fetchCurrentUser } from '@/lib/api/identity';
import type { CurrentUser } from '@/lib/api/types';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  USER_COOKIE_NAME,
  USER_COOKIE_OPTIONS,
} from '@/lib/session';
import { cookies } from 'next/headers';

/**
 * Per-request context for the tRPC Backend-for-Frontend.
 *
 * The context owns everything that is specific to a single request: the bearer
 * token read from the HttpOnly session cookie, an upstream {@link ApiClient}
 * authenticated with that token, and cookie writers used by the identity mutations.
 */
export interface TRPCContext {
  token: string | null;
  client: ApiClient;
  setSessionToken: (token: string, maxAgeSeconds: number) => Promise<void>;
  clearSessionToken: () => Promise<void>;
  setUserCookie: (displayName: string, email: string) => Promise<void>;
  clearUserCookie: () => Promise<void>;
}

export const createTRPCContext = async (): Promise<TRPCContext> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value ?? null;

  return {
    token,
    client: new ApiClient({ getToken: () => token }),
    setSessionToken: async (value, maxAgeSeconds) => {
      store.set(SESSION_COOKIE_NAME, value, { ...SESSION_COOKIE_OPTIONS, maxAge: maxAgeSeconds });
    },
    clearSessionToken: async () => {
      store.delete(SESSION_COOKIE_NAME);
    },
    setUserCookie: async (displayName, email) => {
      store.set(
        USER_COOKIE_NAME,
        Buffer.from(JSON.stringify({ displayName, email })).toString('base64'),
        USER_COOKIE_OPTIONS,
      );
    },
    clearUserCookie: async () => {
      store.delete(USER_COOKIE_NAME);
    },
  };
};

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const mapStatusToCode = (status: number): TRPCError['code'] => {
  if (status === 401) {
    return 'UNAUTHORIZED';
  }
  if (status === 403) {
    return 'FORBIDDEN';
  }
  if (status === 404) {
    return 'NOT_FOUND';
  }
  if (status === 409) {
    return 'CONFLICT';
  }
  if (status === 413) {
    return 'PAYLOAD_TOO_LARGE';
  }
  if (status === 422) {
    return 'UNPROCESSABLE_CONTENT';
  }
  if (status >= 500) {
    return 'INTERNAL_SERVER_ERROR';
  }
  return 'BAD_REQUEST';
};

/**
 * Translate an upstream REST failure into a tRPC error.
 *
 * The original {@link ApiError} is attached as the error cause so server-side
 * callers (React Server Components) can still surface the request identifier.
 */
export const toTRPCError = (error: ApiError): TRPCError => {
  return new TRPCError({
    code: mapStatusToCode(error.status),
    message: error.message,
    cause: error,
  });
};

/**
 * Run an upstream REST call, converting any {@link ApiError} into a tRPC error.
 */
export const guard = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) {
      throw toTRPCError(error);
    }
    throw error;
  }
};

const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.token) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' });
  }

  let user: CurrentUser;
  try {
    user = await fetchCurrentUser(ctx.client);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in to continue.' });
    }
    throw error;
  }

  return next({ ctx: { user } });
});

/** Requires an authenticated session and attaches the resolved user. */
export const protectedProcedure = publicProcedure.use(requireUser);
