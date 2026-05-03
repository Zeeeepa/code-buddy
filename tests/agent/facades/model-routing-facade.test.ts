/**
 * Phase T3 — Tests for src/agent/facades/model-routing-facade.ts.
 *
 * ModelRoutingFacade is the brain of model selection: it picks which
 * model to use per task, tracks per-session cost, and gates the
 * `architect/editor` pair routing + the `/switch` mid-conversation
 * override. Indirect coverage through agent integration tests existed,
 * but no dedicated unit tests — bugs here silently route to the wrong
 * model, drop cost limits, or shadow a /switch with auto-routing.
 *
 * Test scope:
 * - Construction defaults + dep wiring.
 * - setModelRouting / setAutoRouting toggles + side-effect on modelRouter.
 * - autoRouteIfEnabled: disabled-path returns null, < 2 models returns null,
 *   normal path delegates to selectModel and stashes lastDecision.
 * - getStats / formatStats render cost + savings + last decision banner.
 * - classifyIntent across the 4 buckets (planning / reasoning / editing /
 *   general) + ordering precedence (planning beats editing in mixed match).
 * - resolveModelForIntent priority cascade:
 *     /switch > architect-pair > editor-pair > auto-routing > null.
 * - setSwitchedModel(null) clears the override.
 * - Cost management: addSessionCost guards (negative, Infinity, NaN ignored).
 * - isSessionCostLimitReached at the boundary (== should be true).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---- mocks for the model-routing module ------------------------------

const routingMocks = vi.hoisted(() => ({
  classifyTaskComplexityMock: vi.fn((_msg: string) => 'medium' as const),
  selectModelMock: vi.fn((_classification: unknown, _arg: unknown, _models: string[]) => ({
    recommendedModel: 'grok-3-mini-fast',
    reason: 'medium complexity → mini-fast',
    confidence: 0.9,
    alternativeModels: [],
  })),
  GROK_MODELS_REF: { 'grok-3': {}, 'grok-3-mini-fast': {}, 'grok-2': {} },
}));

vi.mock('../../../src/optimization/model-routing.js', () => ({
  classifyTaskComplexity: routingMocks.classifyTaskComplexityMock,
  selectModel: routingMocks.selectModelMock,
  GROK_MODELS: routingMocks.GROK_MODELS_REF,
}));

// ---- imports under test (after the mock above) -----------------------

import {
  ModelRoutingFacade,
  type ModelRoutingFacadeDeps,
  type TaskIntent,
} from '../../../src/agent/facades/model-routing-facade.js';

// ---- helpers ---------------------------------------------------------

function buildDeps(): {
  deps: ModelRoutingFacadeDeps;
  routerMocks: {
    updateConfig: ReturnType<typeof vi.fn>;
    getTotalCost: ReturnType<typeof vi.fn>;
    getEstimatedSavings: ReturnType<typeof vi.fn>;
    getUsageStats: ReturnType<typeof vi.fn>;
  };
} {
  const updateConfig = vi.fn();
  const getTotalCost = vi.fn(() => 0.1234);
  const getEstimatedSavings = vi.fn(() => ({ saved: 0.5, percentage: 25 }));
  const getUsageStats = vi.fn(() => new Map([['grok-3', { calls: 10, cost: 0.1 }]]));

  const modelRouter = {
    updateConfig,
    getTotalCost,
    getEstimatedSavings,
    getUsageStats,
  } as unknown as ModelRoutingFacadeDeps['modelRouter'];

  const costTracker = {} as unknown as ModelRoutingFacadeDeps['costTracker'];

  return {
    deps: { modelRouter, costTracker },
    routerMocks: { updateConfig, getTotalCost, getEstimatedSavings, getUsageStats },
  };
}

// ---- tests -----------------------------------------------------------

describe('ModelRoutingFacade — Phase T3', () => {
  beforeEach(() => {
    routingMocks.classifyTaskComplexityMock
      .mockReset()
      .mockReturnValue('medium' as ReturnType<typeof routingMocks.classifyTaskComplexityMock>);
    routingMocks.selectModelMock.mockReset().mockReturnValue({
      recommendedModel: 'grok-3-mini-fast',
      reason: 'medium complexity → mini-fast',
      confidence: 0.9,
      alternativeModels: [],
    });
  });

  describe('construction', () => {
    it('uses safe defaults (routing/auto disabled, cost 0/limit 10, no last decision)', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      expect(f.isModelRoutingEnabled()).toBe(false);
      expect(f.isAutoRoutingEnabled()).toBe(false);
      expect(f.getSessionCost()).toBe(0);
      expect(f.getSessionCostLimit()).toBe(10);
      expect(f.getLastRoutingDecision()).toBeNull();
      expect(f.getModelPairs()).toBeNull();
      expect(f.getSwitchedModel()).toBeNull();
    });

    it('exposes the wired dependencies via getters', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      expect(f.getModelRouter()).toBe(deps.modelRouter);
      expect(f.getCostTracker()).toBe(deps.costTracker);
    });
  });

  describe('routing toggles', () => {
    it('setModelRouting flips the public flag without touching the router', () => {
      const { deps, routerMocks } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setModelRouting(true);
      expect(f.isModelRoutingEnabled()).toBe(true);
      expect(routerMocks.updateConfig).not.toHaveBeenCalled();
    });

    it('setAutoRouting(true) cascades: enables both flags AND calls modelRouter.updateConfig', () => {
      const { deps, routerMocks } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setAutoRouting(true);
      expect(f.isAutoRoutingEnabled()).toBe(true);
      expect(f.isModelRoutingEnabled()).toBe(true); // cascaded
      expect(routerMocks.updateConfig).toHaveBeenCalledWith({ enabled: true });
    });

    it('setAutoRouting(false) cascades the disable to both flags + router config', () => {
      const { deps, routerMocks } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setAutoRouting(true);
      f.setAutoRouting(false);
      expect(f.isAutoRoutingEnabled()).toBe(false);
      expect(f.isModelRoutingEnabled()).toBe(false);
      expect(routerMocks.updateConfig).toHaveBeenLastCalledWith({ enabled: false });
    });
  });

  describe('autoRouteIfEnabled', () => {
    it('returns null when auto-routing is disabled (no classify call)', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      const result = f.autoRouteIfEnabled('any message');
      expect(result).toBeNull();
      expect(routingMocks.classifyTaskComplexityMock).not.toHaveBeenCalled();
    });

    it('returns null when fewer than 2 models are available (no useful routing decision)', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setAutoRouting(true);
      const result = f.autoRouteIfEnabled('any message', ['grok-3']);
      expect(result).toBeNull();
      expect(routingMocks.classifyTaskComplexityMock).not.toHaveBeenCalled();
    });

    it('classifies + selects + stashes lastDecision when enabled with multiple models', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setAutoRouting(true);
      const model = f.autoRouteIfEnabled('refactor this please', ['grok-3', 'grok-3-mini-fast']);
      expect(model).toBe('grok-3-mini-fast');
      expect(routingMocks.classifyTaskComplexityMock).toHaveBeenCalledWith('refactor this please');
      expect(routingMocks.selectModelMock).toHaveBeenCalled();
      const last = f.getLastRoutingDecision();
      expect(last?.recommendedModel).toBe('grok-3-mini-fast');
    });

    it('falls back to GROK_MODELS keys when availableModels is omitted', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setAutoRouting(true);
      f.autoRouteIfEnabled('q');
      // GROK_MODELS_REF has 3 keys → length ≥ 2 → routing happens
      expect(routingMocks.selectModelMock).toHaveBeenCalledOnce();
      const passedModels = routingMocks.selectModelMock.mock.calls[0][2];
      expect(passedModels).toEqual(['grok-3', 'grok-3-mini-fast', 'grok-2']);
    });
  });

  describe('lastRoutingDecision setter', () => {
    it('setLastRoutingDecision overrides the cached decision', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      const decision = {
        recommendedModel: 'grok-2',
        reason: 'manual',
        confidence: 1,
        alternativeModels: [],
      };
      f.setLastRoutingDecision(decision);
      expect(f.getLastRoutingDecision()).toBe(decision);
    });
  });

  describe('stats / formatStats', () => {
    it('getStats aggregates router state + last decision', () => {
      const { deps, routerMocks } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setModelRouting(true);
      const stats = f.getStats();
      expect(stats.enabled).toBe(true);
      expect(stats.totalCost).toBe(0.1234);
      expect(stats.savings).toEqual({ saved: 0.5, percentage: 25 });
      expect(stats.usageByModel).toEqual({ 'grok-3': { calls: 10, cost: 0.1 } });
      expect(stats.lastDecision).toBeNull();
      expect(routerMocks.getTotalCost).toHaveBeenCalledOnce();
      expect(routerMocks.getEstimatedSavings).toHaveBeenCalledOnce();
      expect(routerMocks.getUsageStats).toHaveBeenCalledOnce();
    });

    it('formatStats shows "No routing decisions yet" when lastDecision is null', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      const out = f.formatStats();
      expect(out).toContain('Model Routing Statistics');
      expect(out).toContain('Enabled: No');
      expect(out).toContain('No routing decisions yet');
    });

    it('formatStats shows the last decision when set', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setModelRouting(true);
      f.setLastRoutingDecision({
        recommendedModel: 'grok-3-mini-fast',
        reason: 'simple task',
        confidence: 0.95,
        alternativeModels: [],
      });
      const out = f.formatStats();
      expect(out).toContain('Enabled: Yes');
      expect(out).toContain('Last Model: grok-3-mini-fast');
      expect(out).toContain('Reason: simple task');
      expect(out).toContain('Total Cost: $0.1234');
      expect(out).toContain('Savings: $0.5000');
    });
  });

  describe('classifyIntent', () => {
    const { deps } = buildDeps();
    const f = new ModelRoutingFacade(deps);

    it('classifies planning keywords', () => {
      for (const msg of ['plan the architecture', 'design a strategy', 'what approach should we take']) {
        expect(f.classifyIntent(msg)).toBe('planning');
      }
    });

    it('classifies reasoning keywords', () => {
      for (const msg of ['why does this fail', 'explain the bug', 'analyze this code']) {
        expect(f.classifyIntent(msg)).toBe('reasoning');
      }
    });

    it('classifies editing keywords', () => {
      for (const msg of ['fix the test', 'add a function', 'refactor this module', 'rename the variable']) {
        expect(f.classifyIntent(msg)).toBe('editing');
      }
    });

    it('falls back to "general" for unclassifiable messages', () => {
      expect(f.classifyIntent('hello there')).toBe('general');
      expect(f.classifyIntent('')).toBe('general');
    });

    it('planning takes precedence over editing in a mixed-keyword message', () => {
      // "plan to write a fix" — has 'plan' (planning) + 'write'/'fix' (editing).
      // Iteration order in the source asserts planning wins.
      expect(f.classifyIntent('plan to write a fix')).toBe('planning');
    });

    it('reasoning takes precedence over editing', () => {
      // "why fix this" — has 'why' (reasoning) + 'fix' (editing).
      expect(f.classifyIntent('why fix this')).toBe('reasoning');
    });

    it('is case-insensitive', () => {
      expect(f.classifyIntent('FIX THE BUG')).toBe('editing');
      expect(f.classifyIntent('PLAN the design')).toBe('planning');
    });
  });

  describe('resolveModelForIntent — priority cascade', () => {
    it('1) /switch override beats everything else', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setSwitchedModel('claude-3-5-sonnet');
      f.setModelPairs({ architect: 'grok-4', editor: 'grok-3' } as Parameters<typeof f.setModelPairs>[0]);
      f.setAutoRouting(true);
      // Even with pair + auto-routing in play, /switch wins
      expect(f.resolveModelForIntent('planning' as TaskIntent, 'plan stuff')).toBe('claude-3-5-sonnet');
      expect(f.resolveModelForIntent('editing' as TaskIntent, 'fix stuff')).toBe('claude-3-5-sonnet');
    });

    it('2a) architect pair routes planning intent', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setModelPairs({ architect: 'grok-4', editor: 'grok-3' } as Parameters<typeof f.setModelPairs>[0]);
      expect(f.resolveModelForIntent('planning' as TaskIntent)).toBe('grok-4');
    });

    it('2b) architect pair routes reasoning intent (same model as planning)', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setModelPairs({ architect: 'grok-4', editor: 'grok-3' } as Parameters<typeof f.setModelPairs>[0]);
      expect(f.resolveModelForIntent('reasoning' as TaskIntent)).toBe('grok-4');
    });

    it('2c) editor pair routes editing intent', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setModelPairs({ architect: 'grok-4', editor: 'grok-3' } as Parameters<typeof f.setModelPairs>[0]);
      expect(f.resolveModelForIntent('editing' as TaskIntent)).toBe('grok-3');
    });

    it('2d) "general" intent falls THROUGH the pair config (returns null without auto-routing)', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setModelPairs({ architect: 'grok-4', editor: 'grok-3' } as Parameters<typeof f.setModelPairs>[0]);
      expect(f.resolveModelForIntent('general' as TaskIntent)).toBeNull();
    });

    it('2e) pair-only config without architect set falls through for planning/reasoning', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setModelPairs({ editor: 'grok-3' } as Parameters<typeof f.setModelPairs>[0]);
      expect(f.resolveModelForIntent('planning' as TaskIntent)).toBeNull();
    });

    it('3) auto-routing kicks in when no pair + userMessage + autoRouting enabled', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setAutoRouting(true);
      const result = f.resolveModelForIntent('general' as TaskIntent, 'tell me about graphs');
      expect(result).toBe('grok-3-mini-fast'); // from selectModel mock
    });

    it('3b) auto-routing requires both userMessage AND autoRoutingEnabled', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      // autoRouting OFF
      expect(f.resolveModelForIntent('general' as TaskIntent, 'msg')).toBeNull();
      // Now ON but no message
      f.setAutoRouting(true);
      expect(f.resolveModelForIntent('general' as TaskIntent)).toBeNull();
    });

    it('4) returns null when nothing applies (no /switch, no pair, no auto)', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      expect(f.resolveModelForIntent('editing' as TaskIntent)).toBeNull();
    });
  });

  describe('switched model setter', () => {
    it('setSwitchedModel(string) then getSwitchedModel returns it', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setSwitchedModel('grok-2');
      expect(f.getSwitchedModel()).toBe('grok-2');
    });

    it('setSwitchedModel(null) clears the override', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setSwitchedModel('grok-2');
      f.setSwitchedModel(null);
      expect(f.getSwitchedModel()).toBeNull();
    });
  });

  describe('cost management — addSessionCost guards', () => {
    it('accumulates positive finite costs', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.addSessionCost(1.5);
      f.addSessionCost(0.25);
      expect(f.getSessionCost()).toBe(1.75);
    });

    it('rejects negative costs (silent ignore)', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.addSessionCost(1.0);
      f.addSessionCost(-0.5);
      expect(f.getSessionCost()).toBe(1.0);
    });

    it('rejects Infinity and NaN', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.addSessionCost(1.0);
      f.addSessionCost(Infinity);
      f.addSessionCost(NaN);
      expect(f.getSessionCost()).toBe(1.0);
    });

    it('setSessionCost replaces with positive finite value', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.addSessionCost(1.0);
      f.setSessionCost(5.5);
      expect(f.getSessionCost()).toBe(5.5);
    });

    it('setSessionCost rejects negative / Infinity / NaN (cost preserved)', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setSessionCost(2.0);
      f.setSessionCost(-1);
      f.setSessionCost(Infinity);
      f.setSessionCost(NaN);
      expect(f.getSessionCost()).toBe(2.0);
    });
  });

  describe('cost management — limit', () => {
    it('setSessionCostLimit / getSessionCostLimit round-trip', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setSessionCostLimit(50);
      expect(f.getSessionCostLimit()).toBe(50);
    });

    it('isSessionCostLimitReached returns true exactly at the boundary (>=)', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      f.setSessionCostLimit(10);
      f.setSessionCost(9.99);
      expect(f.isSessionCostLimitReached()).toBe(false);
      f.setSessionCost(10);
      expect(f.isSessionCostLimitReached()).toBe(true);
      f.setSessionCost(11);
      expect(f.isSessionCostLimitReached()).toBe(true);
    });
  });

  describe('model pairs', () => {
    it('setModelPairs / getModelPairs round-trip and accept null reset', () => {
      const { deps } = buildDeps();
      const f = new ModelRoutingFacade(deps);
      const pairs = { architect: 'grok-4', editor: 'grok-3' } as Parameters<typeof f.setModelPairs>[0];
      f.setModelPairs(pairs);
      expect(f.getModelPairs()).toBe(pairs);
      f.setModelPairs(null);
      expect(f.getModelPairs()).toBeNull();
    });
  });
});
