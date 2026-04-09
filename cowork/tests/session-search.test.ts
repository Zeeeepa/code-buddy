import { describe, expect, it } from 'vitest';
import {
  extractMessageSearchText,
  findMessageSearchMatches,
} from '../src/renderer/utils/session-search';
import type { Message } from '../src/renderer/types';

const messages: Message[] = [
  {
    id: 'm1',
    sessionId: 's1',
    role: 'assistant',
    timestamp: 1,
    content: [{ type: 'text', text: 'First plain response' }],
  },
  {
    id: 'm2',
    sessionId: 's1',
    role: 'assistant',
    timestamp: 2,
    content: [
      { type: 'thinking', thinking: 'Investigating auth bug deeply' },
      { type: 'tool_use', id: 'tool-1', name: 'Read', input: { path: 'src/auth.ts' } },
    ],
  },
  {
    id: 'm3',
    sessionId: 's1',
    role: 'assistant',
    timestamp: 3,
    content: [
      {
        type: 'tool_result',
        toolUseId: 'tool-1',
        content: 'Authentication failed due to stale token cache',
      },
    ],
  },
];

describe('session search utilities', () => {
  it('flattens message content into searchable text', () => {
    expect(extractMessageSearchText(messages[1])).toContain('Investigating auth bug deeply');
    expect(extractMessageSearchText(messages[1])).toContain('Read');
    expect(extractMessageSearchText(messages[1])).toContain('src/auth.ts');
  });

  it('finds matches across text, thinking, tool use, and tool result blocks', () => {
    expect(findMessageSearchMatches(messages, 'plain')).toEqual(['m1']);
    expect(findMessageSearchMatches(messages, 'auth bug')).toEqual(['m2']);
    expect(findMessageSearchMatches(messages, 'stale token')).toEqual(['m3']);
    expect(findMessageSearchMatches(messages, 'src/auth.ts')).toEqual(['m2']);
  });
});
