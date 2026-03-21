/**
 * Tests for Phase 6 — Per-Agent Parameter Overrides
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the config manager before imports
const mockConfig = {
  active_model: 'grok-3',
  providers: {},
  models: {},
  tool_config: {},
  middleware: {},
  ui: {},
  agent: {},
  integrations: {},
  agent_defaults: {
    imageGenerationModel: 'dall-e-3',
    agents: {
      swe: { temperature: 0.2, maxTokens: 8192, model: 'grok-4' },
      'security-review': { temperature: 0.0 },
    },
  },
};

vi.mock('../../src/config/toml-config.js', () => ({
  getConfigManager: () => ({
    getConfig: () => mockConfig,
    saveUserConfig: vi.fn(),
  }),
}));

import { getAgentParams, getImageGenerationModel } from '../../src/config/agent-defaults.js';

describe('Per-Agent Parameter Overrides', () => {
  describe('getAgentParams', () => {
    it('should return params for configured agent', () => {
      const params = getAgentParams('swe');
      expect(params).toEqual({
        temperature: 0.2,
        maxTokens: 8192,
        model: 'grok-4',
      });
    });

    it('should return partial params for partially configured agent', () => {
      const params = getAgentParams('security-review');
      expect(params).toEqual({ temperature: 0.0 });
    });

    it('should return undefined for unconfigured agent', () => {
      const params = getAgentParams('pdf');
      expect(params).toBeUndefined();
    });

    it('should return undefined for invalid agent ID', () => {
      const params = getAgentParams('nonexistent-agent');
      expect(params).toBeUndefined();
    });

    it('should not break getImageGenerationModel', () => {
      const model = getImageGenerationModel();
      expect(model).toBe('dall-e-3');
    });
  });

  describe('AgentDefaultsConfig types', () => {
    it('should accept agents record in config', () => {
      expect(mockConfig.agent_defaults.agents).toBeDefined();
      expect(mockConfig.agent_defaults.agents.swe).toBeDefined();
      expect(typeof mockConfig.agent_defaults.agents.swe.temperature).toBe('number');
      expect(typeof mockConfig.agent_defaults.agents.swe.maxTokens).toBe('number');
      expect(typeof mockConfig.agent_defaults.agents.swe.model).toBe('string');
    });
  });
});

describe('AgentRegistry config override application', () => {
  it('should store override params in agent config options', async () => {
    // Dynamically import to pick up mocked config
    const { AgentRegistry } = await import('../../src/agent/specialized/agent-registry.js');
    const { SpecializedAgent } = await import('../../src/agent/specialized/types.js');

    // Create a minimal mock agent
    class MockAgent extends SpecializedAgent {
      async initialize(): Promise<void> { this.isInitialized = true; }
      async execute(): Promise<any> { return { success: true, output: 'done' }; }
      getSupportedActions(): string[] { return ['test']; }
      getActionHelp(): string { return 'test action'; }
    }

    const agent = new MockAgent({
      id: 'swe',
      name: 'SWE Agent',
      description: 'Test',
      capabilities: ['code-edit' as any],
      fileExtensions: ['ts'],
    });

    const registry = new AgentRegistry();
    registry.register(agent);

    const registered = registry.get('swe');
    expect(registered).toBeDefined();
    const options = registered!.getConfig().options;
    expect(options).toBeDefined();
    expect(options!.temperature).toBe(0.2);
    expect(options!.maxTokens).toBe(8192);
    expect(options!.model).toBe('grok-4');
  });

  it('should not add options for unconfigured agent', async () => {
    const { AgentRegistry } = await import('../../src/agent/specialized/agent-registry.js');
    const { SpecializedAgent } = await import('../../src/agent/specialized/types.js');

    class MockAgent extends SpecializedAgent {
      async initialize(): Promise<void> { this.isInitialized = true; }
      async execute(): Promise<any> { return { success: true, output: 'done' }; }
      getSupportedActions(): string[] { return ['test']; }
      getActionHelp(): string { return 'test action'; }
    }

    const agent = new MockAgent({
      id: 'pdf',
      name: 'PDF Agent',
      description: 'Test',
      capabilities: ['data-extract' as any],
      fileExtensions: ['pdf'],
    });

    const registry = new AgentRegistry();
    registry.register(agent);

    const registered = registry.get('pdf');
    expect(registered).toBeDefined();
    // options should remain undefined since no config overrides for 'pdf'
    expect(registered!.getConfig().options).toBeUndefined();
  });
});
