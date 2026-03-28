/**
 * Tests for repairToolCallPairs — Inline Dangling Tool Call Patching
 * DeepAgents Sprint 1
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
  it('should return empty array for empty input', () => {
    const result = repairToolCallPairs([]);
    expect(result).toEqual([]);
  });

  it('should pass through messages with no tool calls', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ];

    const result = repairToolCallPairs(messages);
    expect(result.length).toBe(3);
  });

  it('should pass through when all tool calls have results', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Read file' },
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
    ];

    const result = repairToolCallPairs(messages);
    expect(result.length).toBe(3);
  });

  it('should inject synthetic result for dangling tool call', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Run grep' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'tc-1', type: 'function', function: { name: 'grep', arguments: '{}' } }],
      } as unknown as CodeBuddyMessage,
      // No tool result for tc-1
    ];

    const result = repairToolCallPairs(messages);
    expect(result.length).toBe(3);
    expect(result[2].role).toBe('tool');
    expect((result[2] as any).tool_call_id).toBe('tc-1');
    expect(result[2].content).toBe('[result lost during compaction]');
  });

  it('should handle multiple dangling tool calls', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Do stuff' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'tc-1', type: 'function', function: { name: 'read_file', arguments: '{}' } },
          { id: 'tc-2', type: 'function', function: { name: 'grep', arguments: '{}' } },
        ],
      } as unknown as CodeBuddyMessage,
      // No results for either
    ];

    const result = repairToolCallPairs(messages);
    expect(result.length).toBe(4); // user + assistant + 2 synthetic
    expect(result[2].content).toBe('[result lost during compaction]');
    expect(result[3].content).toBe('[result lost during compaction]');
    expect((result[2] as any).tool_call_id).toBe('tc-1');
    expect((result[3] as any).tool_call_id).toBe('tc-2');
  });

  it('should patch all assistant messages with dangling tool_calls', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Step 1' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'tc-old', type: 'function', function: { name: 'bash', arguments: '{}' } }],
      } as unknown as CodeBuddyMessage,
      // tc-old has no result
      { role: 'user', content: 'Step 2' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'tc-new', type: 'function', function: { name: 'grep', arguments: '{}' } }],
      } as unknown as CodeBuddyMessage,
      // tc-new has no result
    ];

    const result = repairToolCallPairs(messages);
    // Should inject synthetic for both dangling tool calls
    const syntheticResults = result.filter(m => m.content === '[result lost during compaction]');
    expect(syntheticResults.length).toBe(2);
  });

  it('should not inject if tool result exists after the assistant message', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Read file' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 'tc-1', type: 'function', function: { name: 'read_file', arguments: '{}' } },
          { id: 'tc-2', type: 'function', function: { name: 'grep', arguments: '{}' } },
        ],
      } as unknown as CodeBuddyMessage,
      {
        role: 'tool',
        tool_call_id: 'tc-1',
        content: 'result 1',
      } as unknown as CodeBuddyMessage,
      // tc-2 is dangling
    ];

    const result = repairToolCallPairs(messages);
    expect(result.length).toBe(4); // user + assistant + result + 1 synthetic
    const synthetic = result.find(m => m.content === '[result lost during compaction]');
    expect(synthetic).toBeDefined();
    expect((synthetic as any).tool_call_id).toBe('tc-2');
  });

  it('should return a new array with synthetic results appended', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Do' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'tc-1', type: 'function', function: { name: 'bash', arguments: '{}' } }],
      } as unknown as CodeBuddyMessage,
    ];

    const originalLength = messages.length;
    const result = repairToolCallPairs(messages);
    // Original array should NOT be mutated
    expect(messages.length).toBe(originalLength);
    // Result should have the synthetic result
    expect(result.length).toBe(originalLength + 1);
    expect(result[result.length - 1].content).toBe('[result lost during compaction]');
  });

  it('should skip assistant messages without tool_calls', () => {
    const messages: CodeBuddyMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Just a text response with no tools' },
    ];

    const result = repairToolCallPairs(messages);
    expect(result.length).toBe(2);
  });
});
