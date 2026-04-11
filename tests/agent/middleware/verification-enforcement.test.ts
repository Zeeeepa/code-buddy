/**
 * Tests for Verification Enforcement Middleware
 */

import {
  VerificationEnforcementMiddleware,
  createVerificationEnforcementMiddleware,
  DEFAULT_VERIFICATION_CONFIG,
} from '../../../src/agent/middleware/verification-enforcement.js';
import type { MiddlewareContext } from '../../../src/agent/middleware/types.js';
import type { ChatEntry } from '../../../src/agent/types.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeContext(overrides: Partial<MiddlewareContext> = {}): MiddlewareContext {
  const state = new Map<string, unknown>();
  return {
    toolRound: 5,
    maxToolRounds: 50,
    sessionCost: 0.1,
    sessionCostLimit: 10,
    inputTokens: 1000,
    outputTokens: 500,
    history: [],
    messages: [],
    isStreaming: false,
    state,
    getState<T>(key: string): T | undefined { return state.get(key) as T | undefined; },
    setState<T>(key: string, value: T): void { state.set(key, value); },
    ...overrides,
  };
}

function fileEditEntry(filePath: string): ChatEntry {
  return {
    type: 'tool_result',
    content: 'File written successfully',
    timestamp: new Date(),
    toolCall: {
      id: `call-${Math.random()}`,
      type: 'function',
      function: { name: 'write_file', arguments: JSON.stringify({ path: filePath }) },
    },
  };
}

function verificationEntry(): ChatEntry {
  return {
    type: 'tool_result',
    content: 'All tests passed',
    timestamp: new Date(),
    toolCall: {
      id: 'call-verify',
      type: 'function',
      function: { name: 'task_verify', arguments: '{}' },
    },
  };
}

function userMessage(content: string): ChatEntry {
  return {
    type: 'user',
    content,
    timestamp: new Date(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('VerificationEnforcementMiddleware', () => {
  describe('constructor', () => {
    it('uses default config when none provided', () => {
      const mw = new VerificationEnforcementMiddleware();
      expect(mw.getConfig()).toEqual(DEFAULT_VERIFICATION_CONFIG);
    });

    it('has correct name and priority', () => {
      const mw = new VerificationEnforcementMiddleware();
      expect(mw.name).toBe('verification-enforcement');
      expect(mw.priority).toBe(155);
    });
  });

  describe('afterTurn', () => {
    it('returns continue when disabled', async () => {
      const mw = new VerificationEnforcementMiddleware({ enabled: false });
      const result = await mw.afterTurn(makeContext({ changedFiles: ['a.ts', 'b.ts', 'c.ts'] }));
      expect(result.action).toBe('continue');
    });

    it('returns continue when fewer than threshold files changed', async () => {
      const mw = new VerificationEnforcementMiddleware();
      const result = await mw.afterTurn(makeContext({ changedFiles: ['a.ts', 'b.ts'] }));
      expect(result.action).toBe('continue');
    });

    it('warns when >= threshold files changed and no verification', async () => {
      const mw = new VerificationEnforcementMiddleware();
      const result = await mw.afterTurn(makeContext({ changedFiles: ['a.ts', 'b.ts', 'c.ts'] }));
      expect(result.action).toBe('warn');
      expect(result.message).toContain('task_verify');
      expect(result.message).toContain('3');
    });

    it('warns only once per task', async () => {
      const mw = new VerificationEnforcementMiddleware();
      const ctx = makeContext({ changedFiles: ['a.ts', 'b.ts', 'c.ts'] });

      const first = await mw.afterTurn(ctx);
      expect(first.action).toBe('warn');

      const second = await mw.afterTurn(ctx);
      expect(second.action).toBe('continue');
    });

    it('does not warn when verification was already run', async () => {
      const mw = new VerificationEnforcementMiddleware();
      const ctx = makeContext({
        changedFiles: ['a.ts', 'b.ts', 'c.ts'],
        history: [
          fileEditEntry('a.ts'),
          fileEditEntry('b.ts'),
          fileEditEntry('c.ts'),
          verificationEntry(),
        ],
      });

      const result = await mw.afterTurn(ctx);
      expect(result.action).toBe('continue');
    });

    it('does not warn when user said "skip verification"', async () => {
      const mw = new VerificationEnforcementMiddleware();
      const ctx = makeContext({
        changedFiles: ['a.ts', 'b.ts', 'c.ts'],
        history: [
          userMessage('Please skip verification for now'),
        ],
      });

      const result = await mw.afterTurn(ctx);
      expect(result.action).toBe('continue');
    });

    it('counts files from history when changedFiles not provided', async () => {
      const mw = new VerificationEnforcementMiddleware();
      const ctx = makeContext({
        history: [
          fileEditEntry('src/a.ts'),
          fileEditEntry('src/b.ts'),
          fileEditEntry('src/c.ts'),
        ],
      });

      const result = await mw.afterTurn(ctx);
      expect(result.action).toBe('warn');
    });

    it('reset clears warning flag', async () => {
      const mw = new VerificationEnforcementMiddleware();
      await mw.afterTurn(makeContext({ changedFiles: ['a.ts', 'b.ts', 'c.ts'] }));
      expect(mw.hasWarnedAlready()).toBe(true);

      mw.reset();
      expect(mw.hasWarnedAlready()).toBe(false);

      const result = await mw.afterTurn(makeContext({ changedFiles: ['a.ts', 'b.ts', 'c.ts'] }));
      expect(result.action).toBe('warn');
    });
  });

  describe('factory', () => {
    it('createVerificationEnforcementMiddleware returns instance', () => {
      const mw = createVerificationEnforcementMiddleware({ fileThreshold: 5 });
      expect(mw).toBeInstanceOf(VerificationEnforcementMiddleware);
      expect(mw.getConfig().fileThreshold).toBe(5);
    });
  });
});
