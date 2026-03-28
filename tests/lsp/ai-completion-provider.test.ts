/**
 * Tests for AI Completion Provider
 *
 * Covers:
 * - Debounce behavior
 * - Cache hits
 * - Cancellation
 * - FIM format construction
 * - Standard prompt construction
 * - Response parsing
 * - Disabled state
 * - Short prefix rejection
 * - Multi-line snippet formatting
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock CodeBuddyClient before importing provider
// ---------------------------------------------------------------------------

const mockChat = vi.fn();

vi.mock('../../src/codebuddy/client.js', () => ({
  CodeBuddyClient: vi.fn().mockImplementation(() => ({
    chat: mockChat,
    getCurrentModel: vi.fn().mockReturnValue('grok-code-fast-1'),
  })),
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  AICompletionProvider,
  buildFIMPrompt,
  buildStandardPrompt,
  parseCompletionResponse,
  isFIMCapable,
  DEFAULT_AI_COMPLETION_CONFIG,
} from '../../src/lsp/ai-completion-provider.js';
import type {
  AICompletionContext,
  CancellationToken,
} from '../../src/lsp/ai-completion-provider.js';
import { CompletionCache } from '../../src/lsp/completion-cache.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides?: Partial<AICompletionContext>): AICompletionContext {
  return {
    prefix: 'const result = ',
    suffix: ';',
    language: 'typescript',
    filePath: 'src/main.ts',
    linesBefore: ['import { foo } from "./foo";', ''],
    linesAfter: ['console.log(result);'],
    ...overrides,
  };
}

function makeMockClient(): any {
  return {
    chat: mockChat,
    getCurrentModel: vi.fn().mockReturnValue('grok-code-fast-1'),
  };
}

function makeResponse(content: string) {
  return {
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AICompletionProvider', () => {
  let provider: AICompletionProvider;
  let cache: CompletionCache;
  let client: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    cache = new CompletionCache({ maxEntries: 100, ttlMs: 5000 });
    client = makeMockClient();
    provider = new AICompletionProvider(client, cache, {
      enabled: true,
      debounceMs: 300,
      maxSuggestions: 3,
      maxTokens: 200,
    });
  });

  afterEach(() => {
    provider.dispose();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------------

  describe('disabled state', () => {
    it('should return empty when disabled', async () => {
      provider.updateConfig({ enabled: false });
      const result = await provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 10 },
        makeContext(),
      );
      expect(result).toEqual([]);
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('should return empty when client is null', async () => {
      const noClientProvider = new AICompletionProvider(null, cache);
      const result = await noClientProvider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 10 },
        makeContext(),
      );
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Short prefix rejection
  // -----------------------------------------------------------------------

  describe('short prefix rejection', () => {
    it('should return empty when prefix is too short', async () => {
      const result = await provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 1 },
        makeContext({ prefix: ' ' }),
      );
      expect(result).toEqual([]);
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('should return empty when prefix is whitespace only', async () => {
      const result = await provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 3 },
        makeContext({ prefix: '   ' }),
      );
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Debounce behavior
  // -----------------------------------------------------------------------

  describe('debounce behavior', () => {
    it('should debounce requests by configured delay', async () => {
      mockChat.mockResolvedValue(makeResponse('computeResult()'));

      const promise = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );

      // Chat should not be called immediately
      expect(mockChat).not.toHaveBeenCalled();

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(300);

      const result = await promise;
      expect(mockChat).toHaveBeenCalledTimes(1);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should cancel previous debounced request when new one arrives', async () => {
      mockChat.mockResolvedValue(makeResponse('first()'));

      // Fire first request
      const promise1 = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext({ prefix: 'const a = ' }),
      );

      // Fire second request before debounce expires
      await vi.advanceTimersByTimeAsync(100);

      mockChat.mockResolvedValue(makeResponse('second()'));
      const promise2 = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 20 },
        makeContext({ prefix: 'const result = foo.' }),
      );

      // Advance past debounce for second request
      await vi.advanceTimersByTimeAsync(300);

      const result1 = await promise1;
      const result2 = await promise2;

      // First request should resolve with empty (cancelled by second)
      expect(result1).toEqual([]);
      // Second request should have real results
      expect(result2.length).toBeGreaterThan(0);
      // Only one API call should have been made (the second)
      expect(mockChat).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Cache hits
  // -----------------------------------------------------------------------

  describe('cache hits', () => {
    it('should return cached results without calling API', async () => {
      mockChat.mockResolvedValue(makeResponse('cachedResult()'));

      // First call — populates cache
      const promise1 = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );
      await vi.advanceTimersByTimeAsync(300);
      const result1 = await promise1;

      expect(result1.length).toBeGreaterThan(0);
      expect(mockChat).toHaveBeenCalledTimes(1);

      // Second call — same key, should use cache
      const result2 = await provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );

      expect(result2).toEqual(result1);
      // mockChat should NOT have been called again
      expect(mockChat).toHaveBeenCalledTimes(1);
    });

    it('should not cache empty results', async () => {
      mockChat.mockResolvedValue(makeResponse(''));

      const promise1 = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );
      await vi.advanceTimersByTimeAsync(300);
      await promise1;

      // Call again — should try API again since empty results were not cached
      mockChat.mockResolvedValue(makeResponse('realResult()'));
      const promise2 = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );
      await vi.advanceTimersByTimeAsync(300);
      const result2 = await promise2;

      expect(mockChat).toHaveBeenCalledTimes(2);
      expect(result2.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Cancellation
  // -----------------------------------------------------------------------

  describe('cancellation', () => {
    it('should return empty when cancelled before debounce', async () => {
      const token: CancellationToken = { isCancellationRequested: true };

      const result = await provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
        token,
      );

      expect(result).toEqual([]);
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('should return empty when cancelled during debounce', async () => {
      const token = { isCancellationRequested: false };

      const promise = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
        token,
      );

      // Cancel after partial debounce
      await vi.advanceTimersByTimeAsync(150);
      token.isCancellationRequested = true;

      await vi.advanceTimersByTimeAsync(150);
      const result = await promise;

      expect(result).toEqual([]);
      expect(mockChat).not.toHaveBeenCalled();
    });

    it('should handle cancel() method', async () => {
      mockChat.mockResolvedValue(makeResponse('test()'));

      const promise = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );

      // Cancel before debounce fires
      provider.cancel();

      const result = await promise;
      expect(result).toEqual([]);
      expect(mockChat).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // API errors
  // -----------------------------------------------------------------------

  describe('error handling', () => {
    it('should return empty on API error', async () => {
      mockChat.mockRejectedValue(new Error('API Error'));

      const promise = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );
      await vi.advanceTimersByTimeAsync(300);
      const result = await promise;

      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Completion item format
  // -----------------------------------------------------------------------

  describe('completion item format', () => {
    it('should produce CompletionItems with correct fields', async () => {
      mockChat.mockResolvedValue(makeResponse('computeResult()'));

      const promise = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );
      await vi.advanceTimersByTimeAsync(300);
      const items = await promise;

      expect(items.length).toBe(1);
      expect(items[0].label).toBe('computeResult()');
      expect(items[0].detail).toContain('Code Buddy');
      expect(items[0].sortText).toMatch(/^zzz_ai_/);
      expect(items[0].data).toEqual({ source: 'ai-completion', index: 0 });
    });

    it('should use snippet format for multi-line completions', async () => {
      mockChat.mockResolvedValue(makeResponse('{\n  return 42;\n}'));

      const promise = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );
      await vi.advanceTimersByTimeAsync(300);
      const items = await promise;

      expect(items.length).toBe(1);
      // InsertTextFormat.Snippet = 2
      expect(items[0].insertTextFormat).toBe(2);
      // Should have $0 tab stop at end
      expect(items[0].insertText).toContain('$0');
    });

    it('should use plain text format for single-line completions', async () => {
      mockChat.mockResolvedValue(makeResponse('getValue()'));

      const promise = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );
      await vi.advanceTimersByTimeAsync(300);
      const items = await promise;

      expect(items.length).toBe(1);
      // InsertTextFormat.PlainText = 1
      expect(items[0].insertTextFormat).toBe(1);
      expect(items[0].insertText).toBe('getValue()');
    });

    it('should return multiple suggestions when separated by ---', async () => {
      mockChat.mockResolvedValue(makeResponse('foo()\n---\nbar()\n---\nbaz()'));

      const promise = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );
      await vi.advanceTimersByTimeAsync(300);
      const items = await promise;

      expect(items.length).toBe(3);
      expect(items[0].insertText).toBe('foo()');
      expect(items[1].insertText).toBe('bar()');
      expect(items[2].insertText).toBe('baz()');
    });

    it('should limit suggestions to maxSuggestions', async () => {
      provider.updateConfig({ maxSuggestions: 2 });
      mockChat.mockResolvedValue(makeResponse('a()\n---\nb()\n---\nc()'));

      const promise = provider.provideCompletions(
        'file:///test.ts',
        { line: 0, character: 15 },
        makeContext(),
      );
      await vi.advanceTimersByTimeAsync(300);
      const items = await promise;

      expect(items.length).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // Config management
  // -----------------------------------------------------------------------

  describe('config management', () => {
    it('should expose readonly config', () => {
      const config = provider.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.debounceMs).toBe(300);
      expect(config.maxSuggestions).toBe(3);
      expect(config.maxTokens).toBe(200);
    });

    it('should merge partial config updates', () => {
      provider.updateConfig({ debounceMs: 500 });
      expect(provider.getConfig().debounceMs).toBe(500);
      // Other fields should remain unchanged
      expect(provider.getConfig().enabled).toBe(true);
    });

    it('should use default config when none provided', () => {
      const p = new AICompletionProvider(null);
      expect(p.getConfig()).toEqual(DEFAULT_AI_COMPLETION_CONFIG);
    });
  });
});

// ---------------------------------------------------------------------------
// Pure function tests
// ---------------------------------------------------------------------------

describe('isFIMCapable', () => {
  it('should detect FIM-capable models', () => {
    expect(isFIMCapable('grok-code-fast-1')).toBe(true);
    expect(isFIMCapable('codestral-latest')).toBe(true);
    expect(isFIMCapable('deepseek-coder-v2')).toBe(true);
    expect(isFIMCapable('starcoder2-15b')).toBe(true);
    expect(isFIMCapable('codellama-34b')).toBe(true);
    expect(isFIMCapable('qwen2.5-coder-32b')).toBe(true);
  });

  it('should reject non-FIM models', () => {
    expect(isFIMCapable('grok-3-latest')).toBe(false);
    expect(isFIMCapable('claude-3.5-sonnet')).toBe(false);
    expect(isFIMCapable('gpt-4o')).toBe(false);
    expect(isFIMCapable('gemini-2.0-flash')).toBe(false);
  });
});

describe('buildFIMPrompt', () => {
  it('should construct FIM format with prefix/suffix', () => {
    const ctx = makeContext();
    const result = buildFIMPrompt(ctx, { line: 2, character: 15 });

    expect(result).toContain('<|fim_prefix|>');
    expect(result).toContain('<|fim_suffix|>');
    expect(result).toContain('<|fim_middle|>');

    // Prefix should include linesBefore + prefix
    expect(result).toContain('import { foo } from "./foo";');
    expect(result).toContain('const result = ');

    // Suffix should include suffix + linesAfter
    expect(result).toContain(';');
    expect(result).toContain('console.log(result);');
  });

  it('should handle empty linesBefore/linesAfter', () => {
    const ctx = makeContext({ linesBefore: undefined, linesAfter: undefined });
    const result = buildFIMPrompt(ctx, { line: 0, character: 15 });

    expect(result).toContain('<|fim_prefix|>const result = ');
    expect(result).toContain('<|fim_suffix|>;');
    expect(result).toContain('<|fim_middle|>');
  });
});

describe('buildStandardPrompt', () => {
  it('should construct system + user messages', () => {
    const ctx = makeContext();
    const messages = buildStandardPrompt(ctx, { line: 2, character: 15 });

    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');

    // System message should mention the language
    const sysContent = messages[0].content as string;
    expect(sysContent).toContain('typescript');

    // User message should include file path and line
    const userContent = messages[1].content as string;
    expect(userContent).toContain('src/main.ts');
    expect(userContent).toContain('line 3'); // 0-indexed line 2 → display line 3
    expect(userContent).toContain('█'); // cursor marker
  });
});

describe('parseCompletionResponse', () => {
  it('should parse single completion', () => {
    const result = parseCompletionResponse('getValue()', 3);
    expect(result).toEqual(['getValue()']);
  });

  it('should parse multiple completions separated by ---', () => {
    const result = parseCompletionResponse('foo()\n---\nbar()\n---\nbaz()', 3);
    expect(result).toEqual(['foo()', 'bar()', 'baz()']);
  });

  it('should limit to maxSuggestions', () => {
    const result = parseCompletionResponse('a\n---\nb\n---\nc\n---\nd', 2);
    expect(result).toEqual(['a', 'b']);
  });

  it('should strip markdown code fences', () => {
    const result = parseCompletionResponse('```typescript\ngetValue()\n```', 3);
    expect(result).toEqual(['getValue()']);
  });

  it('should return empty for empty input', () => {
    expect(parseCompletionResponse('', 3)).toEqual([]);
    expect(parseCompletionResponse('   ', 3)).toEqual([]);
  });

  it('should handle multi-line completion', () => {
    const result = parseCompletionResponse('{\n  const x = 1;\n  return x;\n}', 3);
    expect(result.length).toBe(1);
    expect(result[0]).toContain('const x = 1;');
    expect(result[0]).toContain('return x;');
  });

  it('should filter empty parts after splitting', () => {
    const result = parseCompletionResponse('foo()\n---\n\n---\nbar()', 3);
    expect(result).toEqual(['foo()', 'bar()']);
  });
});
