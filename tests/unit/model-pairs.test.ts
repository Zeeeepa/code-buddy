/**
 * Unit Tests for Architect/Editor Model Pairs and Mid-Conversation Switching
 *
 * Tests cover:
 * - ModelRoutingFacade architect/editor model pair routing
 * - Intent classification (planning, reasoning, editing, general)
 * - resolveModelForIntent priority chain
 * - Mid-conversation model switching (/switch)
 * - ModelPairsConfig in TOML config
 * - handleSwitch command handler
 */

import { ModelRoutingFacade, type TaskIntent } from '../../src/agent/facades/model-routing-facade';
import { handleSwitch, setSwitchModelProvider, type SwitchModelProvider } from '../../src/commands/handlers/switch-handler';

// Mock dependencies for ModelRoutingFacade
const mockModelRouter = {
  getTotalCost: jest.fn(() => 0),
  getEstimatedSavings: jest.fn(() => ({ saved: 0, percentage: 0 })),
  getUsageStats: jest.fn(() => new Map()),
  updateConfig: jest.fn(),
};

const mockCostTracker = {
  trackRequest: jest.fn(),
  getTotalCost: jest.fn(() => 0),
};

describe('ModelRoutingFacade — Architect/Editor Model Pairs', () => {
  let facade: ModelRoutingFacade;

  beforeEach(() => {
    facade = new ModelRoutingFacade({
      modelRouter: mockModelRouter as any,
      costTracker: mockCostTracker as any,
    });
  });

  describe('setModelPairs / getModelPairs', () => {
    it('should store and retrieve model pairs', () => {
      expect(facade.getModelPairs()).toBeNull();

      facade.setModelPairs({ architect: 'claude-opus', editor: 'grok-code-fast' });
      expect(facade.getModelPairs()).toEqual({
        architect: 'claude-opus',
        editor: 'grok-code-fast',
      });
    });

    it('should clear model pairs when set to null', () => {
      facade.setModelPairs({ architect: 'claude-opus', editor: 'grok-code-fast' });
      facade.setModelPairs(null);
      expect(facade.getModelPairs()).toBeNull();
    });

    it('should support partial pairs (architect only)', () => {
      facade.setModelPairs({ architect: 'claude-opus' });
      expect(facade.getModelPairs()?.architect).toBe('claude-opus');
      expect(facade.getModelPairs()?.editor).toBeUndefined();
    });

    it('should support partial pairs (editor only)', () => {
      facade.setModelPairs({ editor: 'grok-code-fast' });
      expect(facade.getModelPairs()?.editor).toBe('grok-code-fast');
      expect(facade.getModelPairs()?.architect).toBeUndefined();
    });
  });

  describe('classifyIntent', () => {
    it('should classify planning intents', () => {
      expect(facade.classifyIntent('plan the architecture for the new service')).toBe('planning');
      expect(facade.classifyIntent('how should we design the database schema?')).toBe('planning');
      expect(facade.classifyIntent('what approach should we take for caching?')).toBe('planning');
      expect(facade.classifyIntent('outline the strategy for migration')).toBe('planning');
    });

    it('should classify reasoning intents', () => {
      expect(facade.classifyIntent('why is this function slow?')).toBe('reasoning');
      expect(facade.classifyIntent('explain how the middleware pipeline works')).toBe('reasoning');
      expect(facade.classifyIntent('debug this error: TypeError undefined')).toBe('reasoning');
      expect(facade.classifyIntent('analyze the performance bottleneck')).toBe('reasoning');
    });

    it('should classify editing intents', () => {
      expect(facade.classifyIntent('fix the bug in login.ts')).toBe('editing');
      expect(facade.classifyIntent('implement the user registration feature')).toBe('editing');
      expect(facade.classifyIntent('refactor the database module')).toBe('editing');
      expect(facade.classifyIntent('add error handling to the API endpoint')).toBe('editing');
      expect(facade.classifyIntent('create a new test file for utils')).toBe('editing');
    });

    it('should classify general intents', () => {
      expect(facade.classifyIntent('hello')).toBe('general');
      expect(facade.classifyIntent('what time is it?')).toBe('general');
      expect(facade.classifyIntent('thanks!')).toBe('general');
    });
  });

  describe('resolveModelForIntent', () => {
    it('should return null when no pairs or switch configured', () => {
      expect(facade.resolveModelForIntent('planning')).toBeNull();
      expect(facade.resolveModelForIntent('editing')).toBeNull();
      expect(facade.resolveModelForIntent('general')).toBeNull();
    });

    it('should route planning to architect model', () => {
      facade.setModelPairs({ architect: 'claude-opus', editor: 'grok-code-fast' });
      expect(facade.resolveModelForIntent('planning')).toBe('claude-opus');
    });

    it('should route reasoning to architect model', () => {
      facade.setModelPairs({ architect: 'claude-opus', editor: 'grok-code-fast' });
      expect(facade.resolveModelForIntent('reasoning')).toBe('claude-opus');
    });

    it('should route editing to editor model', () => {
      facade.setModelPairs({ architect: 'claude-opus', editor: 'grok-code-fast' });
      expect(facade.resolveModelForIntent('editing')).toBe('grok-code-fast');
    });

    it('should return null for general intent even with pairs configured', () => {
      facade.setModelPairs({ architect: 'claude-opus', editor: 'grok-code-fast' });
      expect(facade.resolveModelForIntent('general')).toBeNull();
    });

    it('should prioritize /switch override over model pairs', () => {
      facade.setModelPairs({ architect: 'claude-opus', editor: 'grok-code-fast' });
      facade.setSwitchedModel('gpt-5');

      // Even for planning intent, switched model takes priority
      expect(facade.resolveModelForIntent('planning')).toBe('gpt-5');
      expect(facade.resolveModelForIntent('editing')).toBe('gpt-5');
      expect(facade.resolveModelForIntent('general')).toBe('gpt-5');
    });

    it('should fall through to null when pair is partially configured', () => {
      facade.setModelPairs({ architect: 'claude-opus' }); // no editor
      expect(facade.resolveModelForIntent('editing')).toBeNull();
    });
  });

  describe('setSwitchedModel / getSwitchedModel', () => {
    it('should store and retrieve switched model', () => {
      expect(facade.getSwitchedModel()).toBeNull();

      facade.setSwitchedModel('gpt-5');
      expect(facade.getSwitchedModel()).toBe('gpt-5');
    });

    it('should clear switched model when set to null', () => {
      facade.setSwitchedModel('gpt-5');
      facade.setSwitchedModel(null);
      expect(facade.getSwitchedModel()).toBeNull();
    });
  });
});

describe('handleSwitch — /switch command', () => {
  let mockProvider: SwitchModelProvider;

  beforeEach(() => {
    mockProvider = {
      getAvailableModels: jest.fn(() => ['grok-code-fast', 'claude-opus', 'gpt-5', 'gemini-2.5']),
      getCurrentModel: jest.fn(() => 'grok-code-fast'),
      setSwitchedModel: jest.fn(),
      getSwitchedModel: jest.fn(() => null),
    };
    setSwitchModelProvider(mockProvider);
  });

  afterEach(() => {
    setSwitchModelProvider(null);
  });

  it('should show current status when no args', async () => {
    const result = await handleSwitch([]);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Model Switching');
    expect(result.entry?.content).toContain('grok-code-fast');
    expect(result.entry?.content).toContain('none');
  });

  it('should switch to a valid model', async () => {
    const result = await handleSwitch(['claude-opus']);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Model switched to: claude-opus');
    expect(mockProvider.setSwitchedModel).toHaveBeenCalledWith('claude-opus');
  });

  it('should handle case-insensitive model names', async () => {
    const result = await handleSwitch(['CLAUDE-OPUS']);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Model switched to: claude-opus');
    expect(mockProvider.setSwitchedModel).toHaveBeenCalledWith('claude-opus');
  });

  it('should handle /switch auto', async () => {
    const result = await handleSwitch(['auto']);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('override cleared');
    expect(mockProvider.setSwitchedModel).toHaveBeenCalledWith(null);
  });

  it('should resolve prefix matches', async () => {
    const result = await handleSwitch(['gem']);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Model switched to: gemini-2.5');
  });

  it('should report ambiguous prefix matches', async () => {
    // 'g' matches grok-code-fast, gpt-5, gemini-2.5
    const result = await handleSwitch(['g']);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Ambiguous');
  });

  it('should allow unknown models with a warning', async () => {
    const result = await handleSwitch(['custom-model-42']);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Model switched to: custom-model-42');
    expect(result.entry?.content).toContain('not in the configured list');
  });

  it('should show available models in status', async () => {
    const result = await handleSwitch([]);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('claude-opus');
    expect(result.entry?.content).toContain('gpt-5');
    expect(result.entry?.content).toContain('gemini-2.5');
  });

  it('should indicate switched model in status output', async () => {
    (mockProvider.getSwitchedModel as jest.Mock).mockReturnValue('gpt-5');

    const result = await handleSwitch([]);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('gpt-5');
    expect(result.entry?.content).toContain('switched');
  });
});

describe('ModelPairsConfig integration', () => {
  it('should be importable from toml-config', async () => {
    const { DEFAULT_CONFIG } = await import('../../src/config/toml-config');
    // model_pairs is optional and not in default config
    expect(DEFAULT_CONFIG.model_pairs).toBeUndefined();
  });

  it('AgentBehaviorConfig should have architect_model and editor_model fields', async () => {
    const config: import('../../src/config/toml-config').AgentBehaviorConfig = {
      yolo_mode: false,
      architect_model: 'claude-opus',
      editor_model: 'grok-code-fast',
    };
    expect(config.architect_model).toBe('claude-opus');
    expect(config.editor_model).toBe('grok-code-fast');
  });
});
