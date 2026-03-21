/**
 * WebSocket Origin Hardening Tests (GHSA-5wcw-8jjv-m286)
 *
 * Tests that:
 * - Origin spoofing via x-forwarded-host is rejected when IP is not in trustedProxies
 * - ['*'] + authEnabled emits a security warning at startup
 * - Legitimate origins are accepted normally
 * - Default origins only allow localhost
 * - Trusted proxy IP allows forwarded headers through
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOriginAllowed, DEFAULT_WS_CONFIG } from '../../src/gateway/ws-transport';

// ============================================================================
// isOriginAllowed helper
// ============================================================================

describe('isOriginAllowed', () => {
  it('should reject empty origin', () => {
    expect(isOriginAllowed('', ['http://localhost:*'])).toBe(false);
  });

  it('should accept any origin when pattern is *', () => {
    expect(isOriginAllowed('http://evil.com', ['*'])).toBe(true);
    expect(isOriginAllowed('http://localhost:3000', ['*'])).toBe(true);
  });

  it('should accept exact match', () => {
    expect(isOriginAllowed('http://localhost:3000', ['http://localhost:3000'])).toBe(true);
  });

  it('should reject non-matching origin', () => {
    expect(isOriginAllowed('http://evil.com', ['http://localhost:3000'])).toBe(false);
  });

  it('should support wildcard port patterns', () => {
    expect(isOriginAllowed('http://localhost:3000', ['http://localhost:*'])).toBe(true);
    expect(isOriginAllowed('http://localhost:18789', ['http://localhost:*'])).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:8080', ['http://127.0.0.1:*'])).toBe(true);
  });

  it('should reject origin that does not match wildcard pattern', () => {
    expect(isOriginAllowed('http://evil.com:3000', ['http://localhost:*'])).toBe(false);
    expect(isOriginAllowed('https://localhost:3000', ['http://localhost:*'])).toBe(false);
  });

  it('should check multiple patterns', () => {
    const patterns = ['http://localhost:*', 'http://127.0.0.1:*', 'https://app.example.com'];
    expect(isOriginAllowed('http://localhost:3000', patterns)).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:8080', patterns)).toBe(true);
    expect(isOriginAllowed('https://app.example.com', patterns)).toBe(true);
    expect(isOriginAllowed('http://evil.com', patterns)).toBe(false);
  });
});

// ============================================================================
// Default config
// ============================================================================

describe('DEFAULT_WS_CONFIG', () => {
  it('should default corsOrigins to localhost only (not wildcard)', () => {
    expect(DEFAULT_WS_CONFIG.corsOrigins).toEqual(['http://localhost:*', 'http://127.0.0.1:*']);
    expect(DEFAULT_WS_CONFIG.corsOrigins).not.toContain('*');
  });
});

// ============================================================================
// verifyClient proxy header stripping + origin validation
// ============================================================================

describe('WebSocketGateway verifyClient', () => {
  // We test the verifyClient logic by simulating what the WebSocketServer would do.
  // We extract the verification logic by constructing a gateway and intercepting.

  // Mock ws, http, and logger to avoid real server creation
  vi.mock('ws', () => {
    class MockWebSocketServer {
      static __lastVerifyClient: Function | undefined;
      constructor(opts: { verifyClient?: Function }) {
        MockWebSocketServer.__lastVerifyClient = opts?.verifyClient;
      }
      on() {}
      close(cb: Function) { cb(); }
    }
    return {
      default: { OPEN: 1 },
      WebSocketServer: MockWebSocketServer,
      __esModule: true,
    };
  });

  vi.mock('http', () => ({
    createServer: vi.fn(() => ({
      listen: vi.fn((_port: number, _host: string, cb: Function) => cb()),
      on: vi.fn(),
      close: vi.fn((cb: Function) => cb()),
      listening: true,
    })),
  }));

  let loggerWarnSpy: ReturnType<typeof vi.fn>;

  vi.mock('../../src/utils/logger.js', () => {
    const warnFn = vi.fn();
    return {
      logger: {
        warn: warnFn,
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper: create a gateway and extract the verifyClient callback.
   */
  async function getVerifyClient(configOverrides: Record<string, unknown> = {}) {
    // Dynamic import to get fresh module with mocks applied
    const { WebSocketGateway } = await import('../../src/gateway/ws-transport');
    const { WebSocketServer } = await import('ws');

    const gw = new WebSocketGateway({
      port: 0, // avoid real bind
      ...configOverrides,
    } as any);

    // Call start to trigger WSS creation (mocked, no real server)
    await gw.start();

    const verifyClientFn = (WebSocketServer as any).__lastVerifyClient;
    expect(verifyClientFn).toBeDefined();

    // Stop to clean up
    await gw.stop();

    return verifyClientFn as (
      info: { origin: string; req: { socket: { remoteAddress?: string }; headers: Record<string, string> } },
      callback: (allowed: boolean, code?: number, message?: string) => void
    ) => void;
  }

  it('should reject origin not in default cors list', async () => {
    const verifyClient = await getVerifyClient();

    const callback = vi.fn();
    verifyClient(
      {
        origin: 'http://evil.com',
        req: {
          socket: { remoteAddress: '192.168.1.100' },
          headers: {},
        },
      },
      callback
    );

    expect(callback).toHaveBeenCalledWith(false, 403, 'Origin not allowed');
  });

  it('should accept localhost origins by default', async () => {
    const verifyClient = await getVerifyClient();

    const callback = vi.fn();
    verifyClient(
      {
        origin: 'http://localhost:3000',
        req: {
          socket: { remoteAddress: '127.0.0.1' },
          headers: {},
        },
      },
      callback
    );

    expect(callback).toHaveBeenCalledWith(true, undefined, undefined);
  });

  it('should accept 127.0.0.1 origins by default', async () => {
    const verifyClient = await getVerifyClient();

    const callback = vi.fn();
    verifyClient(
      {
        origin: 'http://127.0.0.1:18789',
        req: {
          socket: { remoteAddress: '127.0.0.1' },
          headers: {},
        },
      },
      callback
    );

    expect(callback).toHaveBeenCalledWith(true, undefined, undefined);
  });

  it('should strip x-forwarded-host from untrusted IP', async () => {
    const verifyClient = await getVerifyClient();

    const headers: Record<string, string> = {
      'x-forwarded-host': 'spoofed.evil.com',
      'x-forwarded-proto': 'https',
    };

    const callback = vi.fn();
    verifyClient(
      {
        origin: 'http://evil.com',
        req: {
          socket: { remoteAddress: '10.0.0.99' },
          headers,
        },
      },
      callback
    );

    // Headers should have been stripped
    expect(headers['x-forwarded-host']).toBeUndefined();
    expect(headers['x-forwarded-proto']).toBeUndefined();
    // And the origin should be rejected (not in default cors list)
    expect(callback).toHaveBeenCalledWith(false, 403, 'Origin not allowed');
  });

  it('should preserve x-forwarded headers from trusted proxy IP', async () => {
    const verifyClient = await getVerifyClient({
      trustedProxies: ['10.0.0.1'],
      corsOrigins: ['http://localhost:*'],
    });

    const headers: Record<string, string> = {
      'x-forwarded-host': 'internal.proxy.com',
      'x-forwarded-proto': 'https',
    };

    const callback = vi.fn();
    verifyClient(
      {
        origin: 'http://localhost:3000',
        req: {
          socket: { remoteAddress: '10.0.0.1' },
          headers,
        },
      },
      callback
    );

    // Headers should NOT have been stripped (trusted proxy)
    expect(headers['x-forwarded-host']).toBe('internal.proxy.com');
    expect(headers['x-forwarded-proto']).toBe('https');
    // Origin is legitimate
    expect(callback).toHaveBeenCalledWith(true, undefined, undefined);
  });

  it('should emit warning when corsOrigins is ["*"] with authEnabled', async () => {
    const { logger: mockedLogger } = await import('../../src/utils/logger.js');

    await getVerifyClient({
      corsOrigins: ['*'],
      authEnabled: true,
    });

    expect(mockedLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('corsOrigins is set to ["*"] with authentication enabled')
    );
  });

  it('should NOT emit warning when corsOrigins is ["*"] with authEnabled=false', async () => {
    const { logger: mockedLogger } = await import('../../src/utils/logger.js');

    await getVerifyClient({
      corsOrigins: ['*'],
      authEnabled: false,
    });

    expect(mockedLogger.warn).not.toHaveBeenCalled();
  });

  it('should NOT emit warning when corsOrigins is restricted with authEnabled', async () => {
    const { logger: mockedLogger } = await import('../../src/utils/logger.js');

    await getVerifyClient({
      corsOrigins: ['http://localhost:*'],
      authEnabled: true,
    });

    expect(mockedLogger.warn).not.toHaveBeenCalled();
  });
});
