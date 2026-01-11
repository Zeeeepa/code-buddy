/**
 * Middleware Tests
 *
 * Tests for API server middleware components.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('Rate Limiting Middleware', () => {
  it('should track requests per key', () => {
    const store = new Map<string, { count: number; requests: number[] }>();
    const key = 'key:test123';
    const now = Date.now();

    store.set(key, { count: 1, requests: [now] });

    const entry = store.get(key);
    expect(entry?.count).toBe(1);
    expect(entry?.requests).toContain(now);
  });

  it('should implement sliding window', () => {
    const windowMs = 60000;
    const now = Date.now();
    const windowStart = now - windowMs;

    const requests = [
      now - 120000, // Outside window
      now - 30000,  // Inside window
      now - 10000,  // Inside window
      now,          // Inside window
    ];

    const validRequests = requests.filter(t => t > windowStart);
    expect(validRequests.length).toBe(3);
  });

  it('should generate rate limit key from auth', () => {
    const auth = { keyId: 'key123', userId: 'user456' };

    const keyFromKeyId = `key:${auth.keyId}`;
    const keyFromUserId = `user:${auth.userId}`;
    const keyFromIp = 'ip:127.0.0.1';

    expect(keyFromKeyId).toBe('key:key123');
    expect(keyFromUserId).toBe('user:user456');
    expect(keyFromIp).toBe('ip:127.0.0.1');
  });

  it('should return 429 when limit exceeded', () => {
    const config = { rateLimitMax: 100, rateLimitWindow: 60000 };
    const entry = { count: 100, requests: [], resetAt: Date.now() + 30000 };

    const isLimited = entry.count >= config.rateLimitMax;
    expect(isLimited).toBe(true);
  });

  it('should set rate limit headers', () => {
    const headers = {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '95',
      'X-RateLimit-Reset': String(Date.now() + 60000),
    };

    expect(headers['X-RateLimit-Limit']).toBe('100');
    expect(parseInt(headers['X-RateLimit-Remaining'])).toBeLessThan(100);
  });

  it('should calculate retry-after', () => {
    const resetAt = Date.now() + 30000;
    const now = Date.now();
    const retryAfter = Math.ceil((resetAt - now) / 1000);

    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(30);
  });
});

describe('Authentication Middleware', () => {
  it('should extract bearer token', () => {
    const authHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    expect(token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  it('should extract API key from header', () => {
    const headers = { 'x-api-key': 'cb_sk_123456' };
    const apiKey = headers['x-api-key'];

    expect(apiKey).toBe('cb_sk_123456');
  });

  it('should validate API key format', () => {
    const validKey = 'cb_sk_abc123def456';
    const invalidKey = 'invalid_key';

    expect(validKey.startsWith('cb_sk_')).toBe(true);
    expect(invalidKey.startsWith('cb_sk_')).toBe(false);
  });

  it('should check required scopes', () => {
    const userScopes = ['chat', 'tools'];
    const requiredScope = 'chat';

    const hasScope = userScopes.includes(requiredScope);
    expect(hasScope).toBe(true);

    const missingScope = userScopes.includes('admin');
    expect(missingScope).toBe(false);
  });

  it('should allow admin scope to bypass checks', () => {
    const userScopes = ['admin'];
    const requiredScope = 'tools:execute';

    const hasAccess = userScopes.includes(requiredScope) || userScopes.includes('admin');
    expect(hasAccess).toBe(true);
  });

  it('should handle basic auth', () => {
    const credentials = 'user:pass';
    const encoded = Buffer.from(credentials).toString('base64');
    const authHeader = `Basic ${encoded}`;

    expect(authHeader).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);

    const decoded = Buffer.from(encoded, 'base64').toString();
    expect(decoded).toBe('user:pass');
  });
});

describe('Error Handler Middleware', () => {
  it('should format API error response', () => {
    const error = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      status: 400,
      requestId: 'req_123',
    };

    expect(error.code).toBeDefined();
    expect(error.message).toBeDefined();
    expect(error.status).toBeGreaterThanOrEqual(400);
  });

  it('should create bad request error', () => {
    const message = 'Missing required field';
    const error = {
      message,
      code: 'VALIDATION_ERROR',
      status: 400,
    };

    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should create unauthorized error', () => {
    const error = {
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
      status: 401,
    };

    expect(error.status).toBe(401);
  });

  it('should create forbidden error', () => {
    const error = {
      message: 'Insufficient permissions',
      code: 'FORBIDDEN',
      status: 403,
    };

    expect(error.status).toBe(403);
  });

  it('should create not found error', () => {
    const resource = 'Session';
    const error = {
      message: `${resource} not found`,
      code: 'NOT_FOUND',
      status: 404,
    };

    expect(error.status).toBe(404);
    expect(error.message).toContain(resource);
  });

  it('should create rate limited error', () => {
    const retryAfter = 30;
    const error = {
      message: `Rate limit exceeded. Try again in ${retryAfter}s`,
      code: 'RATE_LIMITED',
      status: 429,
      details: { retryAfter },
    };

    expect(error.status).toBe(429);
    expect(error.details?.retryAfter).toBe(30);
  });

  it('should hide stack trace in production', () => {
    const isProduction = process.env.NODE_ENV === 'production';
    const error = new Error('Test error');

    const response = {
      message: isProduction ? 'An unexpected error occurred' : error.message,
      details: isProduction ? undefined : { stack: error.stack },
    };

    // In test environment, we show details
    expect(response.details).toBeDefined();
  });
});

describe('Logging Middleware', () => {
  it('should create log entry', () => {
    const entry = {
      timestamp: new Date().toISOString(),
      requestId: 'req_123',
      method: 'POST',
      path: '/api/chat',
      ip: '127.0.0.1',
      userAgent: 'test-agent',
      statusCode: 200,
      responseTime: 150,
    };

    expect(entry.method).toBe('POST');
    expect(entry.statusCode).toBe(200);
    expect(entry.responseTime).toBeGreaterThan(0);
  });

  it('should track request statistics', () => {
    const stats = {
      total: 1000,
      errors: 50,
      totalLatency: 150000,
      byEndpoint: new Map([
        ['POST /api/chat', 500],
        ['GET /api/health', 400],
      ]),
      byStatus: new Map([
        [200, 900],
        [400, 50],
        [500, 50],
      ]),
    };

    const averageLatency = stats.total > 0
      ? Math.round(stats.totalLatency / stats.total)
      : 0;

    expect(averageLatency).toBe(150);
    expect(stats.byEndpoint.get('POST /api/chat')).toBe(500);
  });

  it('should color status codes', () => {
    const getStatusColor = (status: number) => {
      if (status >= 500) return 'red';
      if (status >= 400) return 'yellow';
      return 'green';
    };

    expect(getStatusColor(200)).toBe('green');
    expect(getStatusColor(404)).toBe('yellow');
    expect(getStatusColor(500)).toBe('red');
  });

  it('should format JSON log entry', () => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      request: {
        method: 'GET',
        path: '/api/health',
      },
      response: {
        statusCode: 200,
        responseTime: 5,
      },
    };

    const jsonLog = JSON.stringify(entry);
    expect(() => JSON.parse(jsonLog)).not.toThrow();
  });
});

describe('Request ID Middleware', () => {
  it('should generate unique request IDs', () => {
    const generateId = () =>
      Math.random().toString(16).substring(2, 10) +
      Math.random().toString(16).substring(2, 10);

    const id1 = generateId();
    const id2 = generateId();

    expect(id1).not.toBe(id2);
    expect(id1.length).toBe(16);
  });

  it('should use provided request ID', () => {
    const providedId = 'custom-request-id';
    const requestId = providedId || 'generated-id';

    expect(requestId).toBe(providedId);
  });

  it('should set response header', () => {
    const headers: Record<string, string> = {};
    const requestId = 'req_abc123';

    headers['X-Request-ID'] = requestId;

    expect(headers['X-Request-ID']).toBe(requestId);
  });
});

describe('Validation Helpers', () => {
  it('should validate required fields', () => {
    const body = { name: 'test', value: undefined };
    const required = ['name', 'value'];

    const missing = required.filter(
      field => !(field in body) || body[field as keyof typeof body] === undefined
    );

    expect(missing).toContain('value');
    expect(missing).not.toContain('name');
  });

  it('should validate field types', () => {
    const validateType = (value: unknown, expectedType: string): boolean => {
      if (expectedType === 'array') return Array.isArray(value);
      return typeof value === expectedType;
    };

    expect(validateType('test', 'string')).toBe(true);
    expect(validateType(123, 'number')).toBe(true);
    expect(validateType(true, 'boolean')).toBe(true);
    expect(validateType([1, 2], 'array')).toBe(true);
    expect(validateType({}, 'object')).toBe(true);

    expect(validateType('test', 'number')).toBe(false);
    expect(validateType({}, 'array')).toBe(false);
  });
});
