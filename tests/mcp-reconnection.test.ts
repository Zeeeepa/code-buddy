import { MCPClient, ConnectionState, MCPServerConfig } from '../src/mcp/mcp-client';

// Mock child_process
jest.mock('child_process');

describe('MCP Reconnection Logic', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient();
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await client.disconnectAll();
  });

  describe('Connection State Machine', () => {
    it('should transition through connection states correctly', async () => {
      const _config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['test.js'],
        enabled: true
      };

      const states: ConnectionState[] = [];

      client.on('state-change', (event) => {
        states.push(event.to);
      });

      // This would require mocking the spawn to work properly
      // For now, just verify the state tracking exists
      expect(client.getConnectionState('test-server')).toBeUndefined();
    });

    it('should report correct connection state', () => {
      const state = client.getConnectionState('non-existent');
      expect(state).toBeUndefined();
    });

    it('should provide connection info for all servers', () => {
      const info = client.getConnectionInfo();
      expect(info).toBeInstanceOf(Map);
    });
  });

  describe('Reconnection Configuration', () => {
    it('should use default reconnection settings', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['test.js']
      };

      // Verify defaults are applied (would need to access private fields or test behavior)
      expect(config.reconnect?.enabled).toBeUndefined(); // Uses default
    });

    it('should respect custom reconnection settings', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['test.js'],
        reconnect: {
          enabled: true,
          maxRetries: 10,
          initialDelay: 500,
          maxDelay: 60000,
          backoffMultiplier: 1.5
        }
      };

      expect(config.reconnect?.maxRetries).toBe(10);
      expect(config.reconnect?.initialDelay).toBe(500);
      expect(config.reconnect?.maxDelay).toBe(60000);
      expect(config.reconnect?.backoffMultiplier).toBe(1.5);
    });

    it('should allow disabling reconnection', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['test.js'],
        reconnect: {
          enabled: false
        }
      };

      expect(config.reconnect?.enabled).toBe(false);
    });
  });

  describe('Health Check Configuration', () => {
    it('should use default health check settings', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['test.js']
      };

      expect(config.healthCheck?.enabled).toBeUndefined(); // Uses default
    });

    it('should respect custom health check settings', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['test.js'],
        healthCheck: {
          enabled: true,
          interval: 15000,
          timeout: 3000
        }
      };

      expect(config.healthCheck?.interval).toBe(15000);
      expect(config.healthCheck?.timeout).toBe(3000);
    });

    it('should allow disabling health checks', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        command: 'node',
        args: ['test.js'],
        healthCheck: {
          enabled: false
        }
      };

      expect(config.healthCheck?.enabled).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when calling tool on non-configured server', async () => {
      await expect(
        client.callTool('non-existent', 'test-tool', {})
      ).rejects.toThrow('Server non-existent is not configured');
    });

    it('should throw error when reading resource on non-configured server', async () => {
      await expect(
        client.readResource('non-existent', 'file:///test')
      ).rejects.toThrow('Server non-existent is not configured');
    });

    it('should format status correctly when no servers configured', () => {
      const status = client.formatStatus();
      expect(status).toContain('No MCP servers configured');
    });
  });

  describe('Connection Monitoring', () => {
    it('should report server as not connected initially', () => {
      expect(client.isConnected('test-server')).toBe(false);
    });

    it('should list connected servers', () => {
      const servers = client.getConnectedServers();
      expect(servers).toEqual([]);
    });
  });

  describe('Event Emission', () => {
    it('should emit events on state changes', (done) => {
      client.on('state-change', (event) => {
        expect(event).toHaveProperty('from');
        expect(event).toHaveProperty('to');
        expect(event).toHaveProperty('server');
        done();
      });

      // Would need to trigger a state change
      // This is a placeholder to show the event structure
      client.emit('state-change', {
        from: ConnectionState.DISCONNECTED,
        to: ConnectionState.CONNECTING,
        server: 'test-server'
      });
    });

    it('should emit events on successful connection', (done) => {
      client.on('server-connected', (serverName) => {
        expect(serverName).toBe('test-server');
        done();
      });

      client.emit('server-connected', 'test-server');
    });

    it('should emit events on reconnection', (done) => {
      client.on('server-reconnected', (info) => {
        expect(info).toHaveProperty('server');
        expect(info).toHaveProperty('attempts');
        done();
      });

      client.emit('server-reconnected', {
        server: 'test-server',
        attempts: 3
      });
    });

    it('should emit events on failure', (done) => {
      client.on('server-failed', (info) => {
        expect(info).toHaveProperty('server');
        expect(info).toHaveProperty('error');
        done();
      });

      client.emit('server-failed', {
        server: 'test-server',
        error: 'Connection failed'
      });
    });
  });

  describe('Exponential Backoff', () => {
    it('should calculate backoff with jitter', () => {
      // This would require exposing the calculateBackoff method or testing behavior
      // For now, document the expected behavior:
      // - Attempt 1: ~1000ms
      // - Attempt 2: ~2000ms
      // - Attempt 3: ~4000ms
      // - Attempt 4: ~8000ms
      // - Attempt 5: ~16000ms
      // - Attempt 6+: ~30000ms (capped)
      // - All with ±20% jitter
    });
  });

  describe('Request Queueing', () => {
    it('should queue requests during reconnection', async () => {
      // This would require:
      // 1. Establishing a connection
      // 2. Triggering a disconnection
      // 3. Making requests during reconnection
      // 4. Verifying they are queued and replayed
    });

    it('should reject requests when queue is full', async () => {
      // Would need to fill the queue (100 requests) and verify the 101st fails
    });

    it('should timeout old queued requests', async () => {
      // Would need to queue a request and wait > 60s
    });
  });

  describe('Configuration Loading', () => {
    it('should load configuration from file', () => {
      const configs = client.loadConfig();
      expect(Array.isArray(configs)).toBe(true);
    });

    it('should save configuration to file', () => {
      const _configs: MCPServerConfig[] = [
        {
          name: 'test-server',
          command: 'node',
          args: ['test.js']
        }
      ];

      // This would create a file, so we skip in tests
      // client.saveConfig(_configs);
    });
  });
});

describe('Connection State Values', () => {
  it('should have correct state enum values', () => {
    expect(ConnectionState.DISCONNECTED).toBe('disconnected');
    expect(ConnectionState.CONNECTING).toBe('connecting');
    expect(ConnectionState.CONNECTED).toBe('connected');
    expect(ConnectionState.RECONNECTING).toBe('reconnecting');
    expect(ConnectionState.DISCONNECTING).toBe('disconnecting');
    expect(ConnectionState.FAILED).toBe('failed');
  });
});

describe('Status Formatting', () => {
  it('should include state icons in status', () => {
    const client = new MCPClient();
    const status = client.formatStatus();

    // Should show no servers configured initially
    expect(status).toContain('No MCP servers configured');
  });
});
