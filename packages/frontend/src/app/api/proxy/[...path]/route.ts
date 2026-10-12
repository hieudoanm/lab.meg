import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { DEFAULT_API_BASE_URL } from '@/lib/api/client';
import { SESSION_COOKIE_NAME } from '@/lib/session';

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

const resolveTarget = (): string => {
  const internal = process.env.API_INTERNAL_BASE_URL?.trim();
  return (internal && internal.length > 0 ? internal : DEFAULT_API_BASE_URL).replace(/\/+$/, '');
};

/**
 * Same-origin BFF proxy for browser API calls.
 *
 * The HttpOnly session cookie is exchanged for a bearer token here, so browser
 * clients never handle the token directly and CORS is avoided.
 */
const forward = async (request: Request, context: RouteContext): Promise<Response> => {
  const { path } = await context.params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  const url = new URL(request.url);
  const targetUrl = `${resolveTarget()}/${path.join('/')}${url.search}`;

  const headers = new Headers();
  headers.set('accept', 'application/json');
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }
  const idempotencyKey = request.headers.get('idempotency-key');
  if (idempotencyKey) {
    headers.set('idempotency-key', idempotencyKey);
  }
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text();

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, { method: request.method, headers, body, cache: 'no-store' });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: 'network_error',
          message: 'The API could not be reached.',
          details: [],
          request_id: null,
        },
      },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers();
  const upstreamContentType = upstream.headers.get('content-type');
  if (upstreamContentType) {
    responseHeaders.set('content-type', upstreamContentType);
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
};

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
