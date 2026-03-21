/**
 * Tests for HTTP Proxy Support
 *
 * Tests the proxy configuration module: configureProxy(),
 * getProxyUrl(), shouldBypassProxy(), and getProxyConfig().
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock undici to avoid actual network changes
vi.mock('undici', () => ({
  ProxyAgent: vi.fn(),
  setGlobalDispatcher: vi.fn(),
}));

// Mock logger to suppress output
vi.mock('@/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Proxy Support', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset module state for each test
    vi.resetModules();
    // Clear proxy env vars
    delete process.env.HTTP_PROXY;
    delete process.env.http_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.NO_PROXY;
    delete process.env.no_proxy;
  });

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach(key => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.entries(originalEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });
  });

  it('should return undefined proxy URL when no env vars set', async () => {
    const { getProxyUrl, configureProxy } = await import('@/utils/proxy-support.js');
    configureProxy();
    expect(getProxyUrl()).toBeUndefined();
  });

  it('should detect HTTPS_PROXY env var', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
    const { getProxyUrl, configureProxy } = await import('@/utils/proxy-support.js');
    configureProxy();
    expect(getProxyUrl()).toBe('http://proxy.example.com:8080');
  });

  it('should prefer HTTPS_PROXY over HTTP_PROXY', async () => {
    process.env.HTTP_PROXY = 'http://http-proxy.example.com:8080';
    process.env.HTTPS_PROXY = 'http://https-proxy.example.com:8443';
    const { getProxyUrl, configureProxy } = await import('@/utils/proxy-support.js');
    configureProxy();
    expect(getProxyUrl()).toBe('http://https-proxy.example.com:8443');
  });

  it('should support lowercase env var names', async () => {
    process.env.https_proxy = 'http://lower-proxy.example.com:8080';
    const { getProxyUrl, configureProxy } = await import('@/utils/proxy-support.js');
    configureProxy();
    expect(getProxyUrl()).toBe('http://lower-proxy.example.com:8080');
  });

  it('should always bypass localhost', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
    const { shouldBypassProxy, configureProxy } = await import('@/utils/proxy-support.js');
    configureProxy();
    expect(shouldBypassProxy('localhost')).toBe(true);
    expect(shouldBypassProxy('127.0.0.1')).toBe(true);
    expect(shouldBypassProxy('::1')).toBe(true);
  });

  it('should parse NO_PROXY hostnames correctly', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
    process.env.NO_PROXY = 'api.internal.com,.local.dev,*.test.org';
    const { shouldBypassProxy, configureProxy } = await import('@/utils/proxy-support.js');
    configureProxy();

    expect(shouldBypassProxy('api.internal.com')).toBe(true);
    expect(shouldBypassProxy('sub.local.dev')).toBe(true);
    expect(shouldBypassProxy('external.com')).toBe(false);
  });

  it('should handle wildcard NO_PROXY', async () => {
    process.env.HTTPS_PROXY = 'http://proxy.example.com:8080';
    process.env.NO_PROXY = '*';
    const { shouldBypassProxy, configureProxy } = await import('@/utils/proxy-support.js');
    configureProxy();
    expect(shouldBypassProxy('any.hostname.com')).toBe(true);
  });

  it('should return full proxy config', async () => {
    process.env.HTTP_PROXY = 'http://http-proxy.example.com:8080';
    process.env.HTTPS_PROXY = 'http://https-proxy.example.com:8443';
    process.env.NO_PROXY = 'localhost,internal.com';
    const { getProxyConfig, configureProxy } = await import('@/utils/proxy-support.js');
    configureProxy();

    const config = getProxyConfig();
    expect(config.httpProxy).toBe('http://http-proxy.example.com:8080');
    expect(config.httpsProxy).toBe('http://https-proxy.example.com:8443');
    expect(config.noProxy).toEqual(['localhost', 'internal.com']);
  });
});
