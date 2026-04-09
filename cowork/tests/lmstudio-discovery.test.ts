import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/main/utils/logger', () => ({
  log: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { discoverLocalLmStudio } from '../src/main/config/api-diagnostics';

describe('discoverLocalLmStudio', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns unavailable when service is not reachable', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('fetch failed'));

    const result = await discoverLocalLmStudio();
    expect(result.available).toBe(false);
    expect(result.status).toBe('unavailable');
  });

  it('returns service_available when models list is empty', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    const result = await discoverLocalLmStudio();
    expect(result.available).toBe(true);
    expect(result.status).toBe('service_available');
    expect(result.models).toEqual([]);
  });

  it('returns models_available when the endpoint exposes models', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'local-model' }] }), { status: 200 })
    );

    const result = await discoverLocalLmStudio();
    expect(result.available).toBe(true);
    expect(result.status).toBe('models_available');
    expect(result.models).toEqual(['local-model']);
  });

  it('uses the caller-provided loopback endpoint when discovering LM Studio', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'qwen2.5-coder' }] }), { status: 200 })
    );

    const result = await discoverLocalLmStudio({
      baseUrl: 'http://127.0.0.1:1234/models',
    });

    expect(result).toEqual({
      available: true,
      baseUrl: 'http://127.0.0.1:1234/v1',
      models: ['qwen2.5-coder'],
      status: 'models_available',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:1234/v1/models',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('falls back to the default local endpoint when a remote base url is passed', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'local-model' }] }), { status: 200 })
    );

    const result = await discoverLocalLmStudio({
      baseUrl: 'https://lmstudio.example.internal/v1',
    });

    expect(result).toEqual({
      available: true,
      baseUrl: 'http://localhost:1234/v1',
      models: ['local-model'],
      status: 'models_available',
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:1234/v1/models',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    );
  });
});
