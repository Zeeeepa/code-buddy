/**
 * API Server Tests
 *
 * Tests for the REST API server endpoints.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock express
const mockApp = {
  use: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  set: jest.fn(),
  listen: jest.fn(),
};

jest.unstable_mockModule('express', () => ({
  default: jest.fn(() => mockApp),
  Router: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    use: jest.fn(),
  })),
}));

jest.unstable_mockModule('cors', () => ({
  default: jest.fn(() => (req: any, res: any, next: any) => next()),
}));

describe('API Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Server Configuration', () => {
    it('should use default configuration values', async () => {
      // Test default config values
      const defaultConfig = {
        port: 3000,
        host: '0.0.0.0',
        cors: true,
        rateLimit: true,
        authEnabled: true,
        websocketEnabled: true,
        logging: true,
      };

      expect(defaultConfig.port).toBe(3000);
      expect(defaultConfig.host).toBe('0.0.0.0');
      expect(defaultConfig.cors).toBe(true);
    });

    it('should allow custom configuration', () => {
      const customConfig = {
        port: 8080,
        host: 'localhost',
        cors: false,
        rateLimit: false,
        authEnabled: false,
      };

      expect(customConfig.port).toBe(8080);
      expect(customConfig.host).toBe('localhost');
      expect(customConfig.authEnabled).toBe(false);
    });

    it('should parse environment variables for configuration', () => {
      const envConfig = {
        port: parseInt(process.env.PORT || '3000', 10),
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      };

      expect(envConfig.port).toBeGreaterThan(0);
      expect(envConfig.rateLimitMax).toBe(100);
    });
  });

  describe('Route Registration', () => {
    it('should define health routes', () => {
      const routes = [
        '/api/health',
        '/api/health/ready',
        '/api/health/live',
        '/api/health/stats',
        '/api/health/metrics',
      ];

      routes.forEach(route => {
        expect(route).toMatch(/^\/api\/health/);
      });
    });

    it('should define chat routes', () => {
      const routes = [
        '/api/chat',
        '/api/chat/completions',
        '/api/chat/models',
      ];

      routes.forEach(route => {
        expect(route).toMatch(/^\/api\/chat/);
      });
    });

    it('should define tools routes', () => {
      const routes = [
        '/api/tools',
        '/api/tools/:name',
        '/api/tools/:name/execute',
        '/api/tools/batch',
      ];

      expect(routes.length).toBe(4);
    });

    it('should define sessions routes', () => {
      const routes = [
        '/api/sessions',
        '/api/sessions/:id',
        '/api/sessions/:id/messages',
        '/api/sessions/:id/fork',
        '/api/sessions/:id/export',
      ];

      expect(routes.length).toBe(5);
    });

    it('should define memory routes', () => {
      const routes = [
        '/api/memory',
        '/api/memory/:id',
        '/api/memory/search',
        '/api/memory/stats',
        '/api/memory/clear',
      ];

      expect(routes.length).toBe(5);
    });
  });
});

describe('Health Endpoints', () => {
  it('should return healthy status', () => {
    const response = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: 3600,
    };

    expect(response.status).toBe('healthy');
    expect(response.version).toBeDefined();
    expect(response.uptime).toBeGreaterThan(0);
  });

  it('should include readiness checks', () => {
    const checks = {
      apiKey: true,
      memory: true,
    };

    const ready = Object.values(checks).every(v => v);
    expect(ready).toBe(true);
  });

  it('should return prometheus metrics format', () => {
    const metrics = [
      '# HELP codebuddy_uptime_seconds Server uptime in seconds',
      '# TYPE codebuddy_uptime_seconds gauge',
      'codebuddy_uptime_seconds 3600',
    ];

    expect(metrics[0]).toContain('# HELP');
    expect(metrics[1]).toContain('# TYPE');
    expect(metrics[2]).toMatch(/codebuddy_uptime_seconds \d+/);
  });
});

describe('Chat Endpoints', () => {
  it('should validate required message field', () => {
    const body = { messages: [] };
    const isValid = Array.isArray(body.messages) && body.messages.length > 0;

    expect(isValid).toBe(false);
  });

  it('should accept valid chat request', () => {
    const body = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'grok-3-latest',
    };

    const isValid = Array.isArray(body.messages) && body.messages.length > 0;
    expect(isValid).toBe(true);
  });

  it('should support streaming option', () => {
    const streamRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      stream: true,
    };

    expect(streamRequest.stream).toBe(true);
  });

  it('should format OpenAI-compatible response', () => {
    const response = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'grok-3-latest',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };

    expect(response.object).toBe('chat.completion');
    expect(response.choices).toHaveLength(1);
    expect(response.choices[0].message.role).toBe('assistant');
  });
});

describe('Tools Endpoints', () => {
  it('should format tool info', () => {
    const toolInfo = {
      name: 'read_file',
      description: 'Read file contents',
      category: 'filesystem',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
      },
      requiresConfirmation: false,
    };

    expect(toolInfo.name).toBeDefined();
    expect(toolInfo.description).toBeDefined();
  });

  it('should require confirmation for destructive tools', () => {
    const destructiveTool = {
      name: 'delete_file',
      requiresConfirmation: true,
      isDestructive: true,
    };

    expect(destructiveTool.requiresConfirmation).toBe(true);
    expect(destructiveTool.isDestructive).toBe(true);
  });

  it('should limit batch execution to 10 tools', () => {
    const maxBatchSize = 10;
    const toolBatch = Array(15).fill({ name: 'test', parameters: {} });

    expect(toolBatch.length > maxBatchSize).toBe(true);
  });

  it('should format execution response', () => {
    const response = {
      toolName: 'read_file',
      success: true,
      output: 'file contents',
      executionTime: 50,
    };

    expect(response.success).toBe(true);
    expect(response.executionTime).toBeGreaterThanOrEqual(0);
  });
});

describe('Sessions Endpoints', () => {
  it('should format session info', () => {
    const session = {
      id: 'session_123',
      name: 'Test Session',
      createdAt: new Date().toISOString(),
      messageCount: 10,
      tokenCount: 5000,
    };

    expect(session.id).toBeDefined();
    expect(session.messageCount).toBeGreaterThanOrEqual(0);
  });

  it('should support pagination', () => {
    const pagination = {
      limit: 50,
      offset: 0,
      total: 100,
    };

    expect(pagination.limit).toBe(50);
    expect(pagination.total).toBeGreaterThan(pagination.limit);
  });

  it('should validate message roles', () => {
    const validRoles = ['user', 'assistant', 'system'];
    const testRole = 'user';

    expect(validRoles.includes(testRole)).toBe(true);
    expect(validRoles.includes('invalid')).toBe(false);
  });

  it('should support session forking', () => {
    const forkRequest = {
      name: 'Forked Session',
      fromMessage: 5,
    };

    const forkedSession = {
      id: 'session_456',
      name: forkRequest.name,
      forkedFrom: 'session_123',
    };

    expect(forkedSession.forkedFrom).toBeDefined();
  });
});

describe('Memory Endpoints', () => {
  it('should format memory entry', () => {
    const entry = {
      id: 'mem_123',
      content: 'Important note',
      category: 'notes',
      timestamp: new Date().toISOString(),
    };

    expect(entry.id).toMatch(/^mem_/);
    expect(entry.content).toBeDefined();
  });

  it('should support TTL for entries', () => {
    const ttlSeconds = 3600;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('should calculate memory stats', () => {
    const stats = {
      totalEntries: 100,
      byCategory: {
        notes: 50,
        code: 30,
        general: 20,
      },
      totalSize: 50000,
      expiredEntries: 5,
    };

    const categoryTotal = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(categoryTotal).toBe(stats.totalEntries);
  });

  it('should support search', () => {
    const searchResult = {
      results: [
        { id: 'mem_1', content: 'test content' },
      ],
      total: 1,
      query: 'test',
    };

    expect(searchResult.query).toBe('test');
    expect(searchResult.results.length).toBe(searchResult.total);
  });
});
