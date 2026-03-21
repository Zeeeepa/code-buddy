/**
 * Tests for Proactive Context Compaction
 *
 * Validates token estimation heuristics and threshold-based compaction decisions.
 */

import { describe, it, expect } from 'vitest';
import {
  estimateToolResultTokens,
  shouldCompactBeforeToolExec,
} from '../../src/context/proactive-compaction.js';

describe('estimateToolResultTokens', () => {
  it('returns default estimate for unknown tools', () => {
    const tokens = estimateToolResultTokens('unknown_tool', {});
    expect(tokens).toBe(1000);
  });

  it('estimates bash at ~2000 tokens by default', () => {
    const tokens = estimateToolResultTokens('bash', { command: 'echo hello' });
    expect(tokens).toBe(2000);
  });

  it('estimates bash with large output commands higher', () => {
    const tokens = estimateToolResultTokens('bash', { command: 'npm test' });
    expect(tokens).toBe(5000);
  });

  it('estimates bash with find/tree at 4000', () => {
    const tokens = estimateToolResultTokens('bash', { command: 'find . -name "*.ts"' });
    expect(tokens).toBe(4000);
  });

  it('estimates bash with cat at 3000', () => {
    const tokens = estimateToolResultTokens('bash', { command: 'cat README.md' });
    expect(tokens).toBe(3000);
  });

  it('estimates view_file at default when no limit', () => {
    const tokens = estimateToolResultTokens('view_file', { path: 'file.ts' });
    expect(tokens).toBe(1500);
  });

  it('scales view_file estimate by line limit', () => {
    const tokens = estimateToolResultTokens('view_file', { path: 'file.ts', limit: 50 });
    expect(tokens).toBe(500); // 50 * 10
  });

  it('caps view_file estimate at 8000', () => {
    const tokens = estimateToolResultTokens('view_file', { path: 'file.ts', limit: 10000 });
    expect(tokens).toBe(8000);
  });

  it('estimates search at default for short patterns', () => {
    const tokens = estimateToolResultTokens('search', { pattern: 'foo' });
    expect(tokens).toBe(1000);
  });

  it('reduces search estimate for long patterns', () => {
    const tokens = estimateToolResultTokens('search', { pattern: 'a'.repeat(20) });
    expect(tokens).toBe(800);
  });

  it('reduces search estimate further for very specific patterns', () => {
    const tokens = estimateToolResultTokens('search', { pattern: 'a'.repeat(35) });
    expect(tokens).toBe(500);
  });

  it('scales search_multi by query count', () => {
    const tokens = estimateToolResultTokens('search_multi', {
      queries: ['foo', 'bar', 'baz'],
    });
    expect(tokens).toBe(2400); // 3 * 800
  });

  it('caps search_multi at 5000', () => {
    const tokens = estimateToolResultTokens('search_multi', {
      queries: Array(20).fill('query'),
    });
    expect(tokens).toBe(5000);
  });

  it('estimates web_fetch at 3000', () => {
    const tokens = estimateToolResultTokens('web_fetch', { url: 'https://example.com' });
    expect(tokens).toBe(3000);
  });

  it('estimates list_directory higher for recursive', () => {
    const tokens = estimateToolResultTokens('list_directory', { recursive: true });
    expect(tokens).toBe(2000);
  });

  it('estimates list_directory at default for non-recursive', () => {
    const tokens = estimateToolResultTokens('list_directory', {});
    expect(tokens).toBe(500);
  });

  it('estimates web_search at 2000', () => {
    const tokens = estimateToolResultTokens('web_search', { query: 'test' });
    expect(tokens).toBe(2000);
  });

  it('estimates find_bugs at 2000', () => {
    const tokens = estimateToolResultTokens('find_bugs', { path: 'src/' });
    expect(tokens).toBe(2000);
  });

  it('estimates reason at 3000', () => {
    const tokens = estimateToolResultTokens('reason', { problem: 'complex' });
    expect(tokens).toBe(3000);
  });

  it('handles shell_exec alias same as bash', () => {
    const tokens = estimateToolResultTokens('shell_exec', { command: 'echo hi' });
    expect(tokens).toBe(2000);
  });
});

describe('shouldCompactBeforeToolExec', () => {
  it('returns false when well below threshold', () => {
    const result = shouldCompactBeforeToolExec(10000, 2000, 128000);
    expect(result).toBe(false);
  });

  it('returns true when projected tokens exceed threshold', () => {
    // 128000 * (1 - 0.15) = 108800
    // 100000 + 10000 = 110000 > 108800
    const result = shouldCompactBeforeToolExec(100000, 10000, 128000);
    expect(result).toBe(true);
  });

  it('returns true at exact boundary', () => {
    // threshold = 128000 * 0.85 = 108800
    // 108000 + 1000 = 109000 > 108800
    const result = shouldCompactBeforeToolExec(108000, 1000, 128000);
    expect(result).toBe(true);
  });

  it('returns false just below boundary', () => {
    // threshold = 128000 * 0.85 = 108800
    // 107000 + 1000 = 108000 < 108800
    const result = shouldCompactBeforeToolExec(107000, 1000, 128000);
    expect(result).toBe(false);
  });

  it('supports custom reserve ratio', () => {
    // threshold = 100000 * (1 - 0.3) = 70000
    // 60000 + 15000 = 75000 > 70000
    const result = shouldCompactBeforeToolExec(60000, 15000, 100000, 0.3);
    expect(result).toBe(true);
  });

  it('returns false for zero context window', () => {
    const result = shouldCompactBeforeToolExec(10000, 2000, 0);
    expect(result).toBe(false);
  });

  it('returns false for zero current tokens', () => {
    const result = shouldCompactBeforeToolExec(0, 2000, 128000);
    expect(result).toBe(false);
  });

  it('handles small context windows correctly', () => {
    // threshold = 4096 * 0.85 = 3481.6
    // 3000 + 1000 = 4000 > 3481.6
    const result = shouldCompactBeforeToolExec(3000, 1000, 4096);
    expect(result).toBe(true);
  });

  it('handles large context windows (1M)', () => {
    // threshold = 1000000 * 0.85 = 850000
    // 800000 + 60000 = 860000 > 850000
    const result = shouldCompactBeforeToolExec(800000, 60000, 1000000);
    expect(result).toBe(true);
  });
});
