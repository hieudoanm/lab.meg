import { describe, expect, it, vi } from 'vitest';

import { ApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response => {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
};

const createClient = () => {
  const fetchImpl = vi.fn();
  const client = new ApiClient({
    baseUrl: 'https://api.test/api/v1',
    getToken: () => 'token-123',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, fetchImpl };
};

describe('ApiClient', () => {
  it('builds the URL, query string, and bearer header', async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await client.get('/projects', { query: { limit: 10, search: '', include_archived: false } });

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.test/api/v1/projects?limit=10&include_archived=false');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('serialises a JSON body and adds an idempotency key', async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(jsonResponse({ id: 'run-1' }, { status: 201 }));

    await client.post('/runs', { body: { dataset_version_id: 'v1' }, idempotencyKey: 'key-1' });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ dataset_version_id: 'v1' }));
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toBe('key-1');
  });

  it('returns undefined for a 204 response', async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(client.delete('/sessions/current')).resolves.toBeUndefined();
  });

  it('maps an error envelope onto ApiError', async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: 'not_found',
            message: 'Recording not found.',
            details: [{ field: 'recording_id', code: 'invalid', message: 'Unknown recording' }],
            request_id: 'req-9',
          },
        },
        { status: 404 },
      ),
    );

    await expect(client.get('/recordings/missing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
      message: 'Recording not found.',
      requestId: 'req-9',
    });
  });

  it('wraps transport failures as a network error', async () => {
    const { client, fetchImpl } = createClient();
    fetchImpl.mockRejectedValueOnce(new TypeError('fetch failed'));

    const error = await client.get('/projects').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('network_error');
  });
});
