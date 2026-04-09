import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listLmStudioModels } from '../src/main/config/lmstudio-api';

describe('lmstudio api helpers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('lists models from the configured lmstudio base url without requiring authorization', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          object: 'list',
          data: [
            { id: 'local-model', object: 'model' },
            { id: 'qwen2.5-coder', object: 'model' },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const result = await listLmStudioModels({
      baseUrl: 'http://localhost:1234',
      apiKey: '',
    });

    expect(result).toEqual([
      { id: 'local-model', name: 'local-model' },
      { id: 'qwen2.5-coder', name: 'qwen2.5-coder' },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:1234/v1/models',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('passes authorization headers through when provided', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          object: 'list',
          data: [{ id: 'local-model', object: 'model' }],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    await listLmStudioModels({
      baseUrl: 'https://relay.example.internal/lmstudio',
      apiKey: 'sk-lmstudio-relay',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://relay.example.internal/lmstudio/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-lmstudio-relay',
        }),
      })
    );
  });
});
