/**
 * Phase T2 (re-cadré, ex-T3) — Tests for src/agent/facades/agent-context-facade.ts.
 *
 * Original T2 (write-policy.ts) was already at 100% coverage — the audit
 * subagent had a false negative. Promoted T3 to T2.
 *
 * AgentContextFacade encapsulates token counting, context-window stats,
 * and the memory subsystem. No dedicated tests existed; bugs here =
 * silent token-budget miscount → context overflow, OR memory writes
 * lost / read fallback to "" without surfacing.
 *
 * Test scope:
 * - Constructor wires deps + memory lazy-loads (NOT in constructor).
 * - getStats / formatStats — delegate to ContextManager + format the
 *   3 status thresholds (Critical / Warning / Normal).
 * - updateConfig — delegate.
 * - Memory ops gated on `memoryEnabled` (remember throws, recall→[],
 *   getMemoryContext→'', storeConversationSummary→noop, getMemoryStats→null,
 *   formatMemoryStatus→'Disabled').
 * - setMemoryEnabled(false) when memory was instantiated → dispose + nullify.
 * - storeConversationSummary uses sessionId callback OR generates one.
 * - dispose() chains tokenCounter + contextManager + memory.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---- mocks ------------------------------------------------------------

const memoryMock = vi.hoisted(() => {
  const store = vi.fn(async (entry: unknown) => ({ id: 'mem-1', ...((entry as object) ?? {}) }));
  const recall = vi.fn(async () => [] as unknown[]);
  const buildContext = vi.fn(async () => 'memory-context-string');
  const storeSummary = vi.fn(async () => undefined);
  const setProjectContext = vi.fn(async () => undefined);
  const getStats = vi.fn(() => ({
    totalMemories: 42,
    byType: { episode: 10, fact: 32 },
    projects: 1,
    summaries: 3,
  }));
  const formatStatus = vi.fn(() => '🧠 Memory: 42 entries');
  const dispose = vi.fn(() => undefined);

  const instance = {
    store,
    recall,
    buildContext,
    storeSummary,
    setProjectContext,
    getStats,
    formatStatus,
    dispose,
  };

  return {
    instance,
    store,
    recall,
    buildContext,
    storeSummary,
    setProjectContext,
    getStats,
    formatStatus,
    dispose,
    getEnhancedMemorySpy: vi.fn(() => instance),
  };
});

vi.mock('../../../src/memory/index.js', () => ({
  getEnhancedMemory: memoryMock.getEnhancedMemorySpy,
  EnhancedMemory: class {},
}));

// ---- imports under test ------------------------------------------------

import {
  AgentContextFacade,
  type AgentContextFacadeDeps,
  type ContextStats,
} from '../../../src/agent/facades/agent-context-facade.js';

// ---- helpers -----------------------------------------------------------

function buildDeps(overrides: Partial<AgentContextFacadeDeps> = {}): {
  deps: AgentContextFacadeDeps;
  tokenCounterDispose: ReturnType<typeof vi.fn>;
  ctxGetStats: ReturnType<typeof vi.fn>;
  ctxUpdateConfig: ReturnType<typeof vi.fn>;
  ctxDispose: ReturnType<typeof vi.fn>;
  sessionIdCb: ReturnType<typeof vi.fn>;
} {
  const tokenCounterDispose = vi.fn();
  const tokenCounter = { dispose: tokenCounterDispose } as unknown as AgentContextFacadeDeps['tokenCounter'];

  const ctxGetStats = vi.fn(
    (): ContextStats => ({
      totalTokens: 1000,
      maxTokens: 10000,
      usagePercent: 10,
      isCritical: false,
      isNearLimit: false,
      messageCount: 5,
      summarizedSessions: 0,
    }),
  );
  const ctxUpdateConfig = vi.fn();
  const ctxDispose = vi.fn();
  const contextManager = {
    getStats: ctxGetStats,
    updateConfig: ctxUpdateConfig,
    dispose: ctxDispose,
  } as unknown as AgentContextFacadeDeps['contextManager'];

  const sessionIdCb = vi.fn(() => 'session-abc');

  return {
    deps: {
      tokenCounter,
      contextManager,
      getSessionId: sessionIdCb,
      ...overrides,
    },
    tokenCounterDispose,
    ctxGetStats,
    ctxUpdateConfig,
    ctxDispose,
    sessionIdCb,
  };
}

// ---- tests -------------------------------------------------------------

describe('AgentContextFacade — Phase T2', () => {
  beforeEach(() => {
    memoryMock.getEnhancedMemorySpy.mockClear();
    memoryMock.store.mockClear();
    memoryMock.recall.mockClear();
    memoryMock.buildContext.mockClear();
    memoryMock.storeSummary.mockClear();
    memoryMock.setProjectContext.mockClear();
    memoryMock.getStats.mockClear();
    memoryMock.formatStatus.mockClear();
    memoryMock.dispose.mockClear();
  });

  describe('construction', () => {
    it('does NOT instantiate memory eagerly (lazy load)', () => {
      const { deps } = buildDeps();
      new AgentContextFacade(deps);
      expect(memoryMock.getEnhancedMemorySpy).not.toHaveBeenCalled();
    });

    it('exposes the wired tokenCounter and contextManager via getters', () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      expect(f.getTokenCounter()).toBe(deps.tokenCounter);
      expect(f.getContextManager()).toBe(deps.contextManager);
    });

    it('memory starts enabled by default', () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      expect(f.isMemoryEnabled()).toBe(true);
    });
  });

  describe('context stats / format', () => {
    it('getStats delegates to contextManager.getStats with the messages array', () => {
      const { deps, ctxGetStats } = buildDeps();
      const f = new AgentContextFacade(deps);
      const messages = [{ role: 'user', content: 'hi' }] as Parameters<typeof f.getStats>[0];
      f.getStats(messages);
      expect(ctxGetStats).toHaveBeenCalledOnce();
      expect(ctxGetStats).toHaveBeenCalledWith(messages);
    });

    it('formatStats labels normal usage with the green dot', () => {
      const { deps, ctxGetStats } = buildDeps();
      ctxGetStats.mockReturnValueOnce({
        totalTokens: 1000,
        maxTokens: 10000,
        usagePercent: 10,
        isCritical: false,
        isNearLimit: false,
        messageCount: 3,
        summarizedSessions: 0,
      });
      const f = new AgentContextFacade(deps);
      const out = f.formatStats([]);
      expect(out).toContain('🟢 Normal');
      expect(out).toContain('1000/10000 tokens');
      expect(out).toContain('Messages: 3');
    });

    it('formatStats labels near-limit with the yellow dot', () => {
      const { deps, ctxGetStats } = buildDeps();
      ctxGetStats.mockReturnValueOnce({
        totalTokens: 8500,
        maxTokens: 10000,
        usagePercent: 85,
        isCritical: false,
        isNearLimit: true,
        messageCount: 12,
        summarizedSessions: 1,
      });
      const f = new AgentContextFacade(deps);
      expect(f.formatStats([])).toContain('🟡 Warning');
    });

    it('formatStats labels critical with the red dot (critical takes priority over near-limit)', () => {
      const { deps, ctxGetStats } = buildDeps();
      ctxGetStats.mockReturnValueOnce({
        totalTokens: 9800,
        maxTokens: 10000,
        usagePercent: 98,
        isCritical: true,
        isNearLimit: true, // both flags set — critical wins
        messageCount: 30,
        summarizedSessions: 4,
      });
      const f = new AgentContextFacade(deps);
      expect(f.formatStats([])).toContain('🔴 Critical');
    });

    it('updateConfig delegates to contextManager.updateConfig', () => {
      const { deps, ctxUpdateConfig } = buildDeps();
      const f = new AgentContextFacade(deps);
      const cfg = { maxContextTokens: 50_000 };
      f.updateConfig(cfg);
      expect(ctxUpdateConfig).toHaveBeenCalledWith(cfg);
    });
  });

  describe('memory operations — enabled path', () => {
    it('remember() stores via the memory subsystem (lazy-init triggered on first use)', async () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      const result = await f.remember('episode' as unknown as Parameters<typeof f.remember>[0], 'hello', {
        importance: 5,
        tags: ['t1'],
      });
      expect(memoryMock.getEnhancedMemorySpy).toHaveBeenCalledOnce();
      expect(memoryMock.store).toHaveBeenCalledWith({
        type: 'episode',
        content: 'hello',
        importance: 5,
        tags: ['t1'],
      });
      expect((result as { id: string }).id).toBe('mem-1');
    });

    it('recall() delegates with merged options', async () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      await f.recall('search me', { limit: 7 });
      expect(memoryMock.recall).toHaveBeenCalledWith({ query: 'search me', limit: 7 });
    });

    it('getMemoryContext returns the buildContext output', async () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      const ctx = await f.getMemoryContext('topic');
      expect(ctx).toBe('memory-context-string');
      expect(memoryMock.buildContext).toHaveBeenCalledWith({
        query: 'topic',
        includePreferences: true,
        includeProject: true,
        includeRecentSummaries: true,
      });
    });

    it('storeConversationSummary uses the sessionId callback when it returns a value', async () => {
      const { deps, sessionIdCb } = buildDeps();
      const f = new AgentContextFacade(deps);
      await f.storeConversationSummary('summary text', ['topicA'], ['decision-1'], 12);
      expect(sessionIdCb).toHaveBeenCalledOnce();
      expect(memoryMock.storeSummary).toHaveBeenCalledWith({
        sessionId: 'session-abc',
        summary: 'summary text',
        topics: ['topicA'],
        decisions: ['decision-1'],
        messageCount: 12,
      });
    });

    it('storeConversationSummary falls back to a generated sessionId when callback returns undefined', async () => {
      const { deps } = buildDeps({ getSessionId: () => undefined });
      const f = new AgentContextFacade(deps);
      await f.storeConversationSummary('s', [], undefined, 0);
      const args = memoryMock.storeSummary.mock.calls[0][0] as { sessionId: string };
      expect(args.sessionId).toMatch(/^session-\d+$/);
    });

    it('getMemoryStats returns the underlying stats', () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      const stats = f.getMemoryStats();
      expect(stats).toEqual({
        totalMemories: 42,
        byType: { episode: 10, fact: 32 },
        projects: 1,
        summaries: 3,
      });
    });

    it('formatMemoryStatus delegates to memory.formatStatus when enabled', () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      expect(f.formatMemoryStatus()).toBe('🧠 Memory: 42 entries');
    });
  });

  describe('memory operations — disabled path', () => {
    it('remember() throws when memory is disabled', async () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      f.setMemoryEnabled(false);
      await expect(
        f.remember('episode' as unknown as Parameters<typeof f.remember>[0], 'x'),
      ).rejects.toThrow(/disabled/);
    });

    it('recall() returns an empty array when memory is disabled', async () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      f.setMemoryEnabled(false);
      const result = await f.recall('x');
      expect(result).toEqual([]);
      expect(memoryMock.recall).not.toHaveBeenCalled();
    });

    it('getMemoryContext returns an empty string when memory is disabled', async () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      f.setMemoryEnabled(false);
      expect(await f.getMemoryContext('q')).toBe('');
      expect(memoryMock.buildContext).not.toHaveBeenCalled();
    });

    it('storeConversationSummary becomes a no-op when memory is disabled', async () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      f.setMemoryEnabled(false);
      await f.storeConversationSummary('s', [], undefined, 0);
      expect(memoryMock.storeSummary).not.toHaveBeenCalled();
    });

    it('getMemoryStats returns null when memory is disabled', () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      f.setMemoryEnabled(false);
      expect(f.getMemoryStats()).toBeNull();
    });

    it('formatMemoryStatus returns the disabled banner', () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      f.setMemoryEnabled(false);
      expect(f.formatMemoryStatus()).toBe('🧠 Memory: Disabled');
    });
  });

  describe('setMemoryEnabled side-effects', () => {
    it('setMemoryEnabled(false) disposes a previously instantiated memory and clears the cache', async () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      // Touch memory once to trigger lazy init
      await f.recall('x');
      expect(memoryMock.getEnhancedMemorySpy).toHaveBeenCalledOnce();
      // Now disable — should call dispose on the cached instance
      f.setMemoryEnabled(false);
      expect(memoryMock.dispose).toHaveBeenCalledOnce();
      expect(f.isMemoryEnabled()).toBe(false);
    });

    it('setMemoryEnabled(false) before any memory access does NOT call dispose (no instance to clean up)', () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      f.setMemoryEnabled(false);
      expect(memoryMock.dispose).not.toHaveBeenCalled();
    });
  });

  describe('lazy-init contract', () => {
    it('memory is instantiated EXACTLY ONCE across multiple operations', async () => {
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      await f.recall('a');
      await f.recall('b');
      await f.getMemoryContext('c');
      f.getMemoryStats();
      expect(memoryMock.getEnhancedMemorySpy).toHaveBeenCalledOnce();
    });

    it('on lazy init, setProjectContext is fire-and-forget (errors swallowed via .catch)', async () => {
      memoryMock.setProjectContext.mockRejectedValueOnce(new Error('write failed'));
      const { deps } = buildDeps();
      const f = new AgentContextFacade(deps);
      // Triggering lazy init must not throw despite the rejected setProjectContext
      expect(() => f.getMemoryStats()).not.toThrow();
      // give the promise a tick to reject — should be caught silently
      await new Promise((r) => setImmediate(r));
    });
  });

  describe('dispose lifecycle', () => {
    it('dispose chains tokenCounter + contextManager + memory (when memory was loaded)', async () => {
      const { deps, tokenCounterDispose, ctxDispose } = buildDeps();
      const f = new AgentContextFacade(deps);
      await f.recall('x'); // trigger memory init
      f.dispose();
      expect(tokenCounterDispose).toHaveBeenCalledOnce();
      expect(ctxDispose).toHaveBeenCalledOnce();
      expect(memoryMock.dispose).toHaveBeenCalledOnce();
    });

    it('dispose does NOT touch memory if it was never lazy-loaded', () => {
      const { deps, tokenCounterDispose, ctxDispose } = buildDeps();
      const f = new AgentContextFacade(deps);
      f.dispose();
      expect(tokenCounterDispose).toHaveBeenCalledOnce();
      expect(ctxDispose).toHaveBeenCalledOnce();
      expect(memoryMock.dispose).not.toHaveBeenCalled();
    });
  });
});
