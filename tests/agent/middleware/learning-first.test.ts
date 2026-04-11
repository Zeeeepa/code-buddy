/**
 * Tests for Learning-First Memory Middleware
 * DeepAgents Sprint 1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  LearningFirstMiddleware,
  createLearningFirstMiddleware,
} from '../../../src/agent/middleware/learning-first-middleware.js';
import type { MiddlewareContext } from '../../../src/agent/middleware/types.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock fs/promises (prevent actual file writes)
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(''),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

function makeContext(history: Array<{ type: string; content: string }>): MiddlewareContext {
  return {
    toolRound: 0,
    maxToolRounds: 50,
    sessionCost: 0,
    sessionCostLimit: 10,
    inputTokens: 0,
    outputTokens: 0,
    history: history.map(h => ({ ...h, timestamp: new Date() })) as any,
    messages: [],
    isStreaming: false,
  };
}

describe('LearningFirstMiddleware', () => {
  let middleware: LearningFirstMiddleware;

  beforeEach(() => {
    middleware = new LearningFirstMiddleware();
  });

  it('should have correct name and priority', () => {
    expect(middleware.name).toBe('learning-first');
    expect(middleware.priority).toBe(35);
  });

  it('should return continue when disabled', async () => {
    const disabled = new LearningFirstMiddleware({ enabled: false });
    const ctx = makeContext([{ type: 'user', content: 'no that is wrong' }]);
    const result = await disabled.beforeTurn!(ctx);
    expect(result.action).toBe('continue');
  });

  it('should return continue when no user messages', async () => {
    const ctx = makeContext([{ type: 'assistant', content: 'Hello' }]);
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('continue');
  });

  it('should return continue when no correction signal detected', async () => {
    const ctx = makeContext([{ type: 'user', content: 'Please read this file for me' }]);
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('continue');
  });

  it('should detect "no" correction signal', async () => {
    const ctx = makeContext([{ type: 'user', content: 'No, that is the wrong file' }]);
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('warn');
    expect(result.message).toContain('learned_correction');
  });

  it('should detect "actually" correction signal', async () => {
    const ctx = makeContext([{ type: 'user', content: 'Actually, I meant the other one' }]);
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('warn');
    expect(result.message).toContain('learned_correction');
  });

  it('should detect "use X instead" correction signal', async () => {
    const ctx = makeContext([{ type: 'user', content: 'Use TypeScript instead of JavaScript' }]);
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('warn');
    expect(result.message).toContain('learned_correction');
  });

  it('should detect "I said" correction signal', async () => {
    const ctx = makeContext([{ type: 'user', content: 'I said to use single quotes' }]);
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('warn');
    expect(result.message).toContain('learned_correction');
  });

  it('should detect "don\'t do that" correction signal', async () => {
    const ctx = makeContext([{ type: 'user', content: "Don't do that, it breaks the tests" }]);
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('warn');
    expect(result.message).toContain('learned_correction');
  });

  it('should detect "prefer" correction signal', async () => {
    const ctx = makeContext([{ type: 'user', content: 'I prefer tabs over spaces' }]);
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('warn');
    expect(result.message).toContain('learned_correction');
  });

  it('should not duplicate the same correction', async () => {
    const ctx = makeContext([{ type: 'user', content: 'No, that is wrong' }]);
    const result1 = await middleware.beforeTurn!(ctx);
    expect(result1.action).toBe('warn');

    // Same correction again
    const result2 = await middleware.beforeTurn!(ctx);
    expect(result2.action).toBe('continue');
  });

  it('should track correction count', async () => {
    expect(middleware.getCorrectionCount()).toBe(0);

    const ctx = makeContext([{ type: 'user', content: 'No, that is wrong' }]);
    await middleware.beforeTurn!(ctx);
    expect(middleware.getCorrectionCount()).toBe(1);

    const ctx2 = makeContext([{ type: 'user', content: 'Actually, use the other file' }]);
    await middleware.beforeTurn!(ctx2);
    expect(middleware.getCorrectionCount()).toBe(2);
  });

  it('should respect maxCorrections limit', async () => {
    const mw = new LearningFirstMiddleware({ maxCorrections: 2 });

    const ctx1 = makeContext([{ type: 'user', content: 'No, wrong file' }]);
    const r1 = await mw.beforeTurn!(ctx1);
    expect(r1.action).toBe('warn');

    const ctx2 = makeContext([{ type: 'user', content: 'Actually, use tabs' }]);
    const r2 = await mw.beforeTurn!(ctx2);
    expect(r2.action).toBe('warn');

    // Third correction should be ignored (max 2)
    const ctx3 = makeContext([{ type: 'user', content: 'Instead, do X' }]);
    const r3 = await mw.beforeTurn!(ctx3);
    expect(r3.action).toBe('continue');
  });

  it('should reset corrections', async () => {
    const ctx = makeContext([{ type: 'user', content: 'No, wrong approach' }]);
    await middleware.beforeTurn!(ctx);
    expect(middleware.getCorrectionCount()).toBe(1);

    middleware.resetCorrections();
    expect(middleware.getCorrectionCount()).toBe(0);

    // Same correction should now be detected again
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('warn');
  });

  it('hasCorrectionSignal returns false for non-correction messages', () => {
    expect(middleware.hasCorrectionSignal('Read the file src/index.ts')).toBe(false);
    expect(middleware.hasCorrectionSignal('What does this function do?')).toBe(false);
    expect(middleware.hasCorrectionSignal('Please help me debug this')).toBe(false);
  });

  it('hasCorrectionSignal returns true for correction messages', () => {
    expect(middleware.hasCorrectionSignal('No, that is wrong')).toBe(true);
    expect(middleware.hasCorrectionSignal('Actually use Python')).toBe(true);
    expect(middleware.hasCorrectionSignal('I said single quotes')).toBe(true);
    expect(middleware.hasCorrectionSignal("Don't do that")).toBe(true);
    expect(middleware.hasCorrectionSignal('Correction: use tabs')).toBe(true);
  });

  it('createLearningFirstMiddleware factory works', () => {
    const mw = createLearningFirstMiddleware({ maxCorrections: 5 });
    expect(mw).toBeInstanceOf(LearningFirstMiddleware);
    expect(mw.getConfig().maxCorrections).toBe(5);
  });

  it('should use the latest user message from history', async () => {
    const ctx = makeContext([
      { type: 'user', content: 'Read the file' },
      { type: 'assistant', content: 'Here is the file' },
      { type: 'user', content: 'No, that is the wrong file!' },
    ]);
    const result = await middleware.beforeTurn!(ctx);
    expect(result.action).toBe('warn');
    expect(result.message).toContain('wrong file');
  });
});
