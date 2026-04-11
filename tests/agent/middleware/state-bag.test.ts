/**
 * Tests for State Bag in MiddlewareContext
 */

import type { MiddlewareContext } from '../../../src/agent/middleware/types.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeContextWithState(): MiddlewareContext {
  const state = new Map<string, unknown>();
  return {
    toolRound: 1,
    maxToolRounds: 50,
    sessionCost: 0,
    sessionCostLimit: 10,
    inputTokens: 0,
    outputTokens: 0,
    history: [],
    messages: [],
    isStreaming: false,
    state,
    getState<T>(key: string): T | undefined {
      return state.get(key) as T | undefined;
    },
    setState<T>(key: string, value: T): void {
      state.set(key, value);
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('MiddlewareContext state bag', () => {
  it('state starts as empty Map', () => {
    const ctx = makeContextWithState();
    expect(ctx.state).toBeInstanceOf(Map);
    expect(ctx.state.size).toBe(0);
  });

  it('setState stores and getState retrieves values', () => {
    const ctx = makeContextWithState();
    ctx.setState('counter', 42);
    expect(ctx.getState<number>('counter')).toBe(42);
  });

  it('getState returns undefined for missing keys', () => {
    const ctx = makeContextWithState();
    expect(ctx.getState<string>('nonexistent')).toBeUndefined();
  });

  it('supports complex types', () => {
    const ctx = makeContextWithState();
    const errorMap = new Map<string, number>([['error-a', 3], ['error-b', 1]]);
    ctx.setState('errors', errorMap);

    const retrieved = ctx.getState<Map<string, number>>('errors');
    expect(retrieved).toBeInstanceOf(Map);
    expect(retrieved!.get('error-a')).toBe(3);
  });

  it('setState overwrites previous values', () => {
    const ctx = makeContextWithState();
    ctx.setState('key', 'first');
    ctx.setState('key', 'second');
    expect(ctx.getState<string>('key')).toBe('second');
  });

  it('multiple keys are independent', () => {
    const ctx = makeContextWithState();
    ctx.setState('a', 1);
    ctx.setState('b', 'two');
    ctx.setState('c', true);

    expect(ctx.getState<number>('a')).toBe(1);
    expect(ctx.getState<string>('b')).toBe('two');
    expect(ctx.getState<boolean>('c')).toBe(true);
    expect(ctx.state.size).toBe(3);
  });
});
