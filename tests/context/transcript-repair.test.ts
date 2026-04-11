/**
 * Tests for Transcript Repair — Post-compaction validation
 * (Native Engine v2026.3.11 alignment)
 */

import { describe, it, expect, vi } from 'vitest';
import { repairToolCallPairs } from '../../src/context/transcript-repair.js';
import type { CodeBuddyMessage } from '../../src/codebuddy/client.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('repairToolCallPairs', () => {
  it('should pass through valid messages unchanged', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'tc-1', type: 'function', function: { name: 'read_file', arguments: '{}' } }],
      } as unknown as CodeBuddyMessage,
      {
        role: 'tool',
        tool_call_id: 'tc-1',
        content: 'file contents',
      } as unknown as CodeBuddyMessage,
      { role: 'assistant', content: 'Here are the contents.' },
    ];

    const result = repairToolCallPairs(messages);
    expect(result.length).toBe(5);
    expect(result).toEqual(messages);
  });

  it('should remove orphaned tool results (tool_call_id with no matching tool_call)', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Hello' },
      {
        role: 'tool',
        tool_call_id: 'orphan-1',
        content: 'orphaned result',
      } as unknown as CodeBuddyMessage,
      { role: 'assistant', content: 'Hi' },
    ];

    const result = repairToolCallPairs(messages);
    expect(result.length).toBe(2);
    expect(result.every(m => m.role !== 'tool')).toBe(true);
  });

  it('should inject synthetic results for tool_calls without matching results', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Run a tool' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'tc-1', type: 'function', function: { name: 'bash', arguments: '{}' } },
          { id: 'tc-2', type: 'function', function: { name: 'read_file', arguments: '{}' } },
        ],
      } as unknown as CodeBuddyMessage,
      {
        role: 'tool',
        tool_call_id: 'tc-1',
        content: 'bash result',
      } as unknown as CodeBuddyMessage,
      // tc-2 result is missing (lost during compaction)
      { role: 'assistant', content: 'Done.' },
    ];

    const result = repairToolCallPairs(messages);
    // Should inject synthetic result for tc-2
    expect(result.length).toBe(5);

    const syntheticResult = result.find(
      m => m.role === 'tool' && (m as { tool_call_id?: string }).tool_call_id === 'tc-2'
    );
    expect(syntheticResult).toBeDefined();
    expect(syntheticResult!.content).toBe('[result lost during compaction]');
  });

  it('should handle both orphaned results and missing results simultaneously', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Test' },
      {
        role: 'tool',
        tool_call_id: 'orphan-1',
        content: 'orphaned',
      } as unknown as CodeBuddyMessage,
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'tc-1', type: 'function', function: { name: 'grep', arguments: '{}' } }],
      } as unknown as CodeBuddyMessage,
      // tc-1 result missing
    ];

    const result = repairToolCallPairs(messages);
    // Should remove orphan + inject synthetic for tc-1
    expect(result.length).toBe(3); // user + assistant + synthetic
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('tool');
    expect(result[2].content).toBe('[result lost during compaction]');
  });

  it('should handle empty messages array', () => {
    const result = repairToolCallPairs([]);
    expect(result).toEqual([]);
  });

  it('should handle messages with no tool interactions', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
    ];

    const result = repairToolCallPairs(messages);
    expect(result).toEqual(messages);
  });

  it('should not mutate the original messages array', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Test' },
      {
        role: 'tool',
        tool_call_id: 'orphan-1',
        content: 'orphaned',
      } as unknown as CodeBuddyMessage,
    ];

    const originalLength = messages.length;
    repairToolCallPairs(messages);
    expect(messages.length).toBe(originalLength);
  });
});
