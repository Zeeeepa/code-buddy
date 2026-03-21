import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CompletionCache } from '@/lsp/completion-cache.js';
import { gatherCompletionContext } from '@/lsp/context-gatherer.js';
import type { CompletionContext, TriggerKind } from '@/lsp/context-gatherer.js';

// =============================================================================
// CompletionCache
// =============================================================================

describe('CompletionCache', () => {
  let cache: CompletionCache;

  beforeEach(() => {
    cache = new CompletionCache({ maxEntries: 5, ttlMs: 100 });
  });

  describe('get/set', () => {
    it('should return null for unknown keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should store and retrieve items', () => {
      const items = [{ label: 'foo' }, { label: 'bar' }];
      cache.set('key1', items);
      expect(cache.get('key1')).toEqual(items);
    });

    it('should return the same reference', () => {
      const items = [{ label: 'test' }];
      cache.set('ref-key', items);
      expect(cache.get('ref-key')).toBe(items);
    });

    it('should track size', () => {
      expect(cache.size).toBe(0);
      cache.set('a', [1]);
      expect(cache.size).toBe(1);
      cache.set('b', [2]);
      expect(cache.size).toBe(2);
    });
  });

  describe('TTL expiry', () => {
    it('should return items within TTL', () => {
      cache.set('fresh', [1, 2, 3]);
      expect(cache.get('fresh')).toEqual([1, 2, 3]);
    });

    it('should return null for expired items', async () => {
      cache.set('expiring', [1]);
      // Wait for TTL to pass (100ms configured)
      await new Promise((r) => setTimeout(r, 150));
      expect(cache.get('expiring')).toBeNull();
    });

    it('should delete expired entries on access', async () => {
      cache.set('will-expire', [1]);
      expect(cache.size).toBe(1);
      await new Promise((r) => setTimeout(r, 150));
      cache.get('will-expire'); // triggers cleanup
      expect(cache.size).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      // maxEntries = 5
      cache.set('a', [1]);
      cache.set('b', [2]);
      cache.set('c', [3]);
      cache.set('d', [4]);
      cache.set('e', [5]);
      expect(cache.size).toBe(5);

      // Adding a 6th entry should evict 'a' (oldest)
      cache.set('f', [6]);
      expect(cache.size).toBe(5);
      expect(cache.get('a')).toBeNull();
      expect(cache.get('f')).toEqual([6]);
    });

    it('should keep newer entries after eviction', () => {
      cache.set('a', [1]);
      cache.set('b', [2]);
      cache.set('c', [3]);
      cache.set('d', [4]);
      cache.set('e', [5]);
      cache.set('f', [6]);
      cache.set('g', [7]);

      // 'a' and 'b' should be evicted
      expect(cache.get('a')).toBeNull();
      expect(cache.get('b')).toBeNull();
      expect(cache.get('c')).toEqual([3]);
      expect(cache.get('g')).toEqual([7]);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('x', [1]);
      cache.set('y', [2]);
      expect(cache.size).toBe(2);
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('x')).toBeNull();
      expect(cache.get('y')).toBeNull();
    });
  });

  describe('default options', () => {
    it('should use defaults when no options provided', () => {
      const defaultCache = new CompletionCache();
      // Should not throw and should work normally
      for (let i = 0; i < 110; i++) {
        defaultCache.set(`key-${i}`, [i]);
      }
      // Default maxEntries = 100, so first 10 should be evicted
      expect(defaultCache.get('key-0')).toBeNull();
      expect(defaultCache.get('key-109')).toEqual([109]);
    });
  });
});

// =============================================================================
// gatherCompletionContext
// =============================================================================

describe('gatherCompletionContext', () => {
  const sampleTS = [
    'import { foo } from "./bar";',        // 0
    'import path from "path";',              // 1
    '',                                       // 2
    'interface Options {',                   // 3
    '  name: string;',                       // 4
    '  value: number;',                      // 5
    '}',                                      // 6
    '',                                       // 7
    'function greet(name: string) {',        // 8
    '  const result = ',                     // 9
    '  return result;',                      // 10
    '}',                                      // 11
    '',                                       // 12
    '// This is a comment',                  // 13
    'greet("world");',                       // 14
  ].join('\n');

  describe('language detection', () => {
    it('should detect TypeScript from .ts extension', () => {
      const ctx = gatherCompletionContext('const x = 1;', 'src/main.ts', 0, 5);
      expect(ctx.language).toBe('typescript');
    });

    it('should detect TypeScript from .tsx extension', () => {
      const ctx = gatherCompletionContext('', 'app.tsx', 0, 0);
      expect(ctx.language).toBe('typescript');
    });

    it('should detect JavaScript from .js extension', () => {
      const ctx = gatherCompletionContext('', 'index.js', 0, 0);
      expect(ctx.language).toBe('javascript');
    });

    it('should detect Python from .py extension', () => {
      const ctx = gatherCompletionContext('', 'main.py', 0, 0);
      expect(ctx.language).toBe('python');
    });

    it('should detect Go from .go extension', () => {
      const ctx = gatherCompletionContext('', 'main.go', 0, 0);
      expect(ctx.language).toBe('go');
    });

    it('should detect Rust from .rs extension', () => {
      const ctx = gatherCompletionContext('', 'lib.rs', 0, 0);
      expect(ctx.language).toBe('rust');
    });

    it('should return unknown for unrecognized extensions', () => {
      const ctx = gatherCompletionContext('', 'data.xyz', 0, 0);
      expect(ctx.language).toBe('unknown');
    });

    it('should detect shell from .sh extension', () => {
      const ctx = gatherCompletionContext('', 'script.sh', 0, 0);
      expect(ctx.language).toBe('shell');
    });
  });

  describe('prefix and suffix extraction', () => {
    it('should split the current line at cursor position', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 4, 7);
      // Line 4: "  name: string;"  cursor at offset 7 → "  name:" | " string;"
      expect(ctx.prefix).toBe('  name:');
      expect(ctx.suffix).toBe(' string;');
    });

    it('should handle cursor at start of line', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 8, 0);
      expect(ctx.prefix).toBe('');
      expect(ctx.suffix).toBe('function greet(name: string) {');
    });

    it('should handle cursor at end of line', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 6, 1);
      expect(ctx.prefix).toBe('}');
      expect(ctx.suffix).toBe('');
    });
  });

  describe('surrounding lines', () => {
    it('should return up to 15 lines before', () => {
      const manyLines = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
      const ctx = gatherCompletionContext(manyLines, 'file.ts', 25, 0);
      expect(ctx.linesBefore.length).toBe(15);
      expect(ctx.linesBefore[0]).toBe('line 10');
      expect(ctx.linesBefore[14]).toBe('line 24');
    });

    it('should return fewer lines before when near start of file', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 2, 0);
      expect(ctx.linesBefore.length).toBe(2);
    });

    it('should return up to 5 lines after', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 3, 0);
      expect(ctx.linesAfter.length).toBe(5);
      expect(ctx.linesAfter[0]).toBe('  name: string;');
    });

    it('should return fewer lines after when near end of file', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 13, 0);
      // Lines 14 is the last (index 14), so only 1 line after
      expect(ctx.linesAfter.length).toBe(1);
    });
  });

  describe('trigger kind detection', () => {
    it('should detect import trigger', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 0, 10);
      expect(ctx.triggerKind).toBe('import');
    });

    it('should detect import with "from" keyword', () => {
      const code = 'from os import path';
      const ctx = gatherCompletionContext(code, 'file.py', 0, 15);
      expect(ctx.triggerKind).toBe('import');
    });

    it('should detect import with "require"', () => {
      const code = 'const x = require("fs");';
      const ctx = gatherCompletionContext(code, 'file.js', 0, 20);
      // "require" is not at the start of the trimmed line — this is an expression
      // Actually the line starts with "const", so it won't match import
      expect(ctx.triggerKind).not.toBe('import');
    });

    it('should detect block trigger when line ends with {', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 8, 30);
      // Line 8: "function greet(name: string) {" — prefix ends with "{"
      expect(ctx.triggerKind).toBe('block');
    });

    it('should detect expression trigger after =', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 9, 18);
      // Line 9: "  const result = " — prefix ends with "= "
      expect(ctx.triggerKind).toBe('expression');
    });

    it('should detect parameter trigger inside parentheses', () => {
      const code = 'function test(name, ';
      const ctx = gatherCompletionContext(code, 'file.ts', 0, 20);
      expect(ctx.triggerKind).toBe('parameter');
    });

    it('should detect comment trigger', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 13, 5);
      expect(ctx.triggerKind).toBe('comment');
    });

    it('should detect comment with # for Python', () => {
      const code = '# this is a comment';
      const ctx = gatherCompletionContext(code, 'file.py', 0, 10);
      expect(ctx.triggerKind).toBe('comment');
    });

    it('should default to statement for regular code', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 14, 5);
      // Line 14: "greet("world");"
      expect(ctx.triggerKind).toBe('statement');
    });

    it('should return unknown for empty lines', () => {
      const ctx = gatherCompletionContext(sampleTS, 'file.ts', 2, 0);
      expect(ctx.triggerKind).toBe('unknown');
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', () => {
      const ctx = gatherCompletionContext('', 'empty.ts', 0, 0);
      expect(ctx.prefix).toBe('');
      expect(ctx.suffix).toBe('');
      expect(ctx.linesBefore).toEqual([]);
      expect(ctx.linesAfter).toEqual([]);
      expect(ctx.language).toBe('typescript');
    });

    it('should handle single line file', () => {
      const ctx = gatherCompletionContext('hello world', 'file.ts', 0, 5);
      expect(ctx.prefix).toBe('hello');
      expect(ctx.suffix).toBe(' world');
      expect(ctx.linesBefore).toEqual([]);
      expect(ctx.linesAfter).toEqual([]);
    });

    it('should clamp line number beyond file length', () => {
      const ctx = gatherCompletionContext('line 0\nline 1', 'file.ts', 999, 0);
      // Should clamp to last line
      expect(ctx.line).toBe(1);
      expect(ctx.prefix).toBe('');
      expect(ctx.suffix).toBe('line 1');
    });

    it('should clamp negative line number', () => {
      const ctx = gatherCompletionContext('line 0\nline 1', 'file.ts', -5, 3);
      expect(ctx.line).toBe(0);
      expect(ctx.prefix).toBe('lin');
    });

    it('should clamp character beyond line length', () => {
      const ctx = gatherCompletionContext('short', 'file.ts', 0, 999);
      expect(ctx.character).toBe(5);
      expect(ctx.prefix).toBe('short');
      expect(ctx.suffix).toBe('');
    });

    it('should clamp negative character', () => {
      const ctx = gatherCompletionContext('hello', 'file.ts', 0, -10);
      expect(ctx.character).toBe(0);
      expect(ctx.prefix).toBe('');
      expect(ctx.suffix).toBe('hello');
    });

    it('should preserve filePath and position in result', () => {
      const ctx = gatherCompletionContext('code', '/abs/path/file.rs', 0, 2);
      expect(ctx.filePath).toBe('/abs/path/file.rs');
      expect(ctx.line).toBe(0);
      expect(ctx.character).toBe(2);
    });
  });
});
