/**
 * Tests for Two-Phase Context Compaction
 * DeepAgents Sprint 1
 */

import { describe, it, expect, vi } from 'vitest';
import {
  truncateToolArgs,
  shouldRunPhase1,
  shouldRunPhase2,
} from '../../src/context/two-phase-compaction.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('truncateToolArgs', () => {
  it('should pass through messages with no tool content', () => {
    const messages = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];

    const { messages: result, truncated } = truncateToolArgs(messages);
    expect(truncated).toBe(0);
    expect(result).toEqual(messages);
  });

  it('should truncate tool results exceeding maxResultLength', () => {
    const longContent = 'x'.repeat(5000);
    const messages = [
      { role: 'user', content: 'Read file' },
      { role: 'tool', content: longContent, tool_call_id: 'tc-1' },
    ];

    const { messages: result, truncated } = truncateToolArgs(messages, 1000, 2000);
    expect(truncated).toBe(1);
    expect(result[1].content.length).toBeLessThan(longContent.length);
    expect(result[1].content).toContain('...truncated');
  });

  it('should not truncate tool results within limit', () => {
    const shortContent = 'x'.repeat(100);
    const messages = [
      { role: 'tool', content: shortContent, tool_call_id: 'tc-1' },
    ];

    const { messages: result, truncated } = truncateToolArgs(messages, 1000, 2000);
    expect(truncated).toBe(0);
    expect(result[0].content).toBe(shortContent);
  });

  it('should truncate tool call arguments exceeding maxArgLength', () => {
    const longArgs = JSON.stringify({ content: 'a'.repeat(5000) });
    const messages = [
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'tc-1',
          type: 'function',
          function: { name: 'write_file', arguments: longArgs },
        }],
      },
    ];

    const { messages: result, truncated } = truncateToolArgs(messages, 1000, 2000);
    expect(truncated).toBe(1);
    const args = result[0].tool_calls[0].function.arguments;
    expect(args.length).toBeLessThan(longArgs.length);
    expect(args).toContain('...[truncated]');
  });

  it('should not truncate tool call arguments within limit', () => {
    const shortArgs = JSON.stringify({ path: 'src/index.ts' });
    const messages = [
      {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'tc-1',
          type: 'function',
          function: { name: 'read_file', arguments: shortArgs },
        }],
      },
    ];

    const { messages: result, truncated } = truncateToolArgs(messages, 1000, 2000);
    expect(truncated).toBe(0);
    expect(result[0].tool_calls[0].function.arguments).toBe(shortArgs);
  });

  it('should handle multiple tool calls in one message', () => {
    const shortArgs = '{"path":"x"}';
    const longArgs = 'a'.repeat(2000);
    const messages = [
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'tc-1', type: 'function', function: { name: 'read', arguments: shortArgs } },
          { id: 'tc-2', type: 'function', function: { name: 'write', arguments: longArgs } },
        ],
      },
    ];

    const { messages: result, truncated } = truncateToolArgs(messages, 1000, 2000);
    expect(truncated).toBe(1);
    expect(result[0].tool_calls[0].function.arguments).toBe(shortArgs);
    expect(result[0].tool_calls[1].function.arguments).toContain('...[truncated]');
  });

  it('should not mutate original messages', () => {
    const longContent = 'x'.repeat(5000);
    const messages = [
      { role: 'tool', content: longContent, tool_call_id: 'tc-1' },
    ];
    const originalContent = messages[0].content;

    truncateToolArgs(messages, 1000, 2000);
    expect(messages[0].content).toBe(originalContent);
  });

  it('should handle empty messages array', () => {
    const { messages: result, truncated } = truncateToolArgs([]);
    expect(result).toEqual([]);
    expect(truncated).toBe(0);
  });

  it('should preserve head and tail of truncated tool results', () => {
    const head = 'HEAD_CONTENT_';
    const tail = '_TAIL_CONTENT';
    const middle = 'M'.repeat(5000);
    const content = head + middle + tail;
    const messages = [
      { role: 'tool', content, tool_call_id: 'tc-1' },
    ];

    const { messages: result } = truncateToolArgs(messages, 1000, 2000);
    expect(result[0].content).toContain('HEAD_CONTENT_');
    expect(result[0].content).toContain('_TAIL_CONTENT');
  });

  it('should use custom maxArgLength and maxResultLength', () => {
    const messages = [
      { role: 'tool', content: 'x'.repeat(600), tool_call_id: 'tc-1' },
    ];

    // With default 2000 limit — should not truncate
    const r1 = truncateToolArgs(messages, 1000, 2000);
    expect(r1.truncated).toBe(0);

    // With custom 500 limit — should truncate
    const r2 = truncateToolArgs(messages, 1000, 500);
    expect(r2.truncated).toBe(1);
  });
});

describe('shouldRunPhase1', () => {
  it('should return true when usage >= threshold', () => {
    expect(shouldRunPhase1(0.85, 0.80)).toBe(true);
    expect(shouldRunPhase1(0.80, 0.80)).toBe(true);
    expect(shouldRunPhase1(1.0, 0.80)).toBe(true);
  });

  it('should return false when usage < threshold', () => {
    expect(shouldRunPhase1(0.79, 0.80)).toBe(false);
    expect(shouldRunPhase1(0.50, 0.80)).toBe(false);
    expect(shouldRunPhase1(0, 0.80)).toBe(false);
  });

  it('should use default threshold of 0.80', () => {
    expect(shouldRunPhase1(0.80)).toBe(true);
    expect(shouldRunPhase1(0.79)).toBe(false);
  });
});

describe('shouldRunPhase2', () => {
  it('should return true when usage >= threshold', () => {
    expect(shouldRunPhase2(0.90, 0.85)).toBe(true);
    expect(shouldRunPhase2(0.85, 0.85)).toBe(true);
  });

  it('should return false when usage < threshold', () => {
    expect(shouldRunPhase2(0.84, 0.85)).toBe(false);
    expect(shouldRunPhase2(0.50, 0.85)).toBe(false);
  });

  it('should use default threshold of 0.85', () => {
    expect(shouldRunPhase2(0.85)).toBe(true);
    expect(shouldRunPhase2(0.84)).toBe(false);
  });
});
