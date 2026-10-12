import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { ApiError } from '@/lib/api/errors';
import { endSession, login } from '@/lib/api/identity';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  USER_COOKIE_NAME,
  USER_COOKIE_OPTIONS,
  encodeSessionUserHint,
} from '@/lib/session';

const errorResponse = (status: number, code: string, message: string) => {
  return NextResponse.json({ error: { code, message, details: [], request_id: null } }, { status });
};

export const POST = async (request: Request) => {
  let payload: { email?: unknown; password?: unknown };
  try {
    payload = (await request.json()) as { email?: unknown; password?: unknown };
  } catch {
    return errorResponse(400, 'invalid_request', 'A JSON request body is required.');
  }

  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';
  if (email.length === 0 || password.length === 0) {
    return errorResponse(422, 'validation_error', 'Email and password are required.');
  }

  let token: Awaited<ReturnType<typeof login>>;
  try {
    token = await login({ email, password });
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error.status || 502, error.code, error.message);
    }
    return errorResponse(503, 'network_error', 'The authentication service is unavailable.');
  }

  const expires = new Date(token.expires_at);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token.access_token, {
    ...SESSION_COOKIE_OPTIONS,
    ...(Number.isNaN(expires.getTime()) ? {} : { expires }),
  });
  store.set(
    USER_COOKIE_NAME,
    encodeSessionUserHint({
      displayName: token.user?.display_name ?? email.split('@')[0] ?? email,
      email,
    }),
    USER_COOKIE_OPTIONS,
  );

  return new NextResponse(null, { status: 204 });
};

export const DELETE = async () => {
  try {
    await endSession();
  } catch {
    // Sign-out must succeed locally even if the upstream session is already gone.
  }

  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  store.delete(USER_COOKIE_NAME);
  return new NextResponse(null, { status: 204 });
};
