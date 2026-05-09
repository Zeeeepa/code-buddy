/**
 * Tests for the prompt dry-run path in `hooks-bridge.ts:test()`.
 * `dryRunPromptHook` is mocked so the test never hits a real LLM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HooksBridge, type UserHookHandler } from '../src/main/hooks/hooks-bridge';

const mkBridge = () => {
  const b = new HooksBridge();
  (b as unknown as { workspaceDir: string }).workspaceDir = '/tmp';
  return b;
};

describe('HooksBridge / prompt dry-run', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the LLM text on success', async () => {
    vi.doMock('../src/main/claude/claude-sdk-one-shot', () => ({
      dryRunPromptHook: vi.fn(async () => ({
        text: 'Salut Patrice — dry-run OK',
        hasThinking: false,
        durationMs: 142,
      })),
    }));
    vi.doMock('../src/main/config/config-store', () => ({
      configStore: { getAll: () => ({ provider: 'ollama', model: 'qwen3:4b' }) },
    }));

    const { HooksBridge: HB } = await import('../src/main/hooks/hooks-bridge');
    const b = new HB();
    (b as unknown as { workspaceDir: string }).workspaceDir = '/tmp';

    const handler: UserHookHandler = {
      type: 'prompt',
      prompt: 'Say hello',
    };
    const result = await b.test(handler);
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('Salut Patrice — dry-run OK');
    expect(result.durationMs).toBe(142);
  });

  it('marks empty prompt as failure (no LLM round-trip)', async () => {
    const handler: UserHookHandler = {
      type: 'prompt',
      prompt: '',
    };
    const result = await mkBridge().test(handler);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Empty prompt');
  });

  it('reports an error when the LLM call rejects', async () => {
    vi.doMock('../src/main/claude/claude-sdk-one-shot', () => ({
      dryRunPromptHook: vi.fn(async () => {
        throw new Error('connection refused');
      }),
    }));
    vi.doMock('../src/main/config/config-store', () => ({
      configStore: { getAll: () => ({}) },
    }));

    const { HooksBridge: HB } = await import('../src/main/hooks/hooks-bridge');
    const b = new HB();
    (b as unknown as { workspaceDir: string }).workspaceDir = '/tmp';

    const result = await b.test({ type: 'prompt', prompt: 'hi' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('connection refused');
  });

  it('falls back to a thinking-only message when text is empty', async () => {
    vi.doMock('../src/main/claude/claude-sdk-one-shot', () => ({
      dryRunPromptHook: vi.fn(async () => ({
        text: '',
        hasThinking: true,
        durationMs: 50,
      })),
    }));
    vi.doMock('../src/main/config/config-store', () => ({
      configStore: { getAll: () => ({}) },
    }));

    const { HooksBridge: HB } = await import('../src/main/hooks/hooks-bridge');
    const b = new HB();
    (b as unknown as { workspaceDir: string }).workspaceDir = '/tmp';

    const result = await b.test({ type: 'prompt', prompt: 'hi' });
    expect(result.success).toBe(true);
    expect(result.stdout).toMatch(/thinking block/);
  });
});
