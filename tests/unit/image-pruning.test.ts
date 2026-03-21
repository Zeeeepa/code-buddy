import { describe, it, expect } from 'vitest';
import { pruneImageContent } from '../../src/context/tool-output-masking.js';

/**
 * Helper to create a mock assistant message with tool_calls
 */
function makeAssistantMsg(toolCalls: Array<{ id: string; name: string }>) {
  return {
    role: 'assistant' as const,
    content: 'Using tools...',
    tool_calls: toolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: { name: tc.name, arguments: '{}' },
    })),
  };
}

/**
 * Helper to create a tool result message with image_url content parts
 */
function makeImageToolResult(
  toolCallId: string,
  toolName: string,
  base64Length = 10000,
) {
  const fakeBase64 = 'A'.repeat(base64Length);
  return {
    role: 'tool' as const,
    content: [
      {
        type: 'image_url' as const,
        image_url: { url: `data:image/png;base64,${fakeBase64}` },
      },
    ],
    tool_call_id: toolCallId,
    name: toolName,
  };
}

/**
 * Helper to create a tool result message with data URI inline in text
 */
function makeInlineImageToolResult(
  toolCallId: string,
  toolName: string,
  base64Length = 10000,
) {
  const fakeBase64 = 'A'.repeat(base64Length);
  return {
    role: 'tool' as const,
    content: `Screenshot captured:\ndata:image/png;base64,${fakeBase64}\nDone.`,
    tool_call_id: toolCallId,
    name: toolName,
  };
}

/**
 * Helper to create a text-only tool result
 */
function makeTextToolResult(toolCallId: string, toolName: string, content: string) {
  return {
    role: 'tool' as const,
    content,
    tool_call_id: toolCallId,
    name: toolName,
  };
}

describe('pruneImageContent', () => {
  it('should keep only 2 most recent image results intact when there are 5', () => {
    const messages: any[] = [];

    // Create 5 screenshot tool call + result pairs
    for (let i = 0; i < 5; i++) {
      messages.push(makeAssistantMsg([{ id: `call_${i}`, name: 'browser_screenshot' }]));
      messages.push(makeImageToolResult(`call_${i}`, 'browser_screenshot', 5000));
    }

    const result = pruneImageContent(messages);

    // 3 oldest should be pruned (indices 1, 3, 5 = tool results at positions 0, 1, 2)
    expect(result.prunedCount).toBe(3);
    expect(result.tokensSaved).toBeGreaterThan(0);

    // The 2 most recent image results (last 2) should still have image content
    const toolMsgs = messages.filter(m => m.role === 'tool');
    expect(toolMsgs).toHaveLength(5);

    // Last 2 should still have array content with image_url
    const last = toolMsgs[4];
    const secondLast = toolMsgs[3];
    expect(Array.isArray(last.content)).toBe(true);
    expect(Array.isArray(secondLast.content)).toBe(true);

    // First 3 should be pruned (content replaced with stub string)
    for (let i = 0; i < 3; i++) {
      const content = toolMsgs[i].content;
      expect(typeof content).toBe('string');
      expect(content).toContain('[Image pruned:');
      expect(content).toContain('saved ~');
      expect(content).toContain('tokens]');
    }
  });

  it('should not touch text-only tool results', () => {
    const messages: any[] = [
      makeAssistantMsg([{ id: 'call_1', name: 'read_file' }]),
      makeTextToolResult('call_1', 'read_file', 'File contents here'),
      makeAssistantMsg([{ id: 'call_2', name: 'grep' }]),
      makeTextToolResult('call_2', 'grep', 'Search results here'),
      makeAssistantMsg([{ id: 'call_3', name: 'glob' }]),
      makeTextToolResult('call_3', 'glob', 'Matching files: a.ts, b.ts'),
    ];

    const result = pruneImageContent(messages);

    expect(result.prunedCount).toBe(0);
    expect(result.tokensSaved).toBe(0);

    // All tool results should be unchanged
    expect(messages[1].content).toBe('File contents here');
    expect(messages[3].content).toBe('Search results here');
    expect(messages[5].content).toBe('Matching files: a.ts, b.ts');
  });

  it('should return correct estimation of tokens saved', () => {
    const base64Len = 20000;
    const messages: any[] = [];

    for (let i = 0; i < 4; i++) {
      messages.push(makeAssistantMsg([{ id: `call_${i}`, name: 'screenshot' }]));
      messages.push(makeImageToolResult(`call_${i}`, 'screenshot', base64Len));
    }

    const result = pruneImageContent(messages);

    // 2 oldest pruned, 2 most recent kept
    expect(result.prunedCount).toBe(2);

    // Each image URL is "data:image/png;base64," + base64Len chars
    // Token estimate = length * 0.75
    const dataUriPrefix = 'data:image/png;base64,';
    const expectedPerImage = Math.ceil((dataUriPrefix.length + base64Len) * 0.75);
    expect(result.tokensSaved).toBe(expectedPerImage * 2);
  });

  it('should handle mixed content parts (text + image) correctly', () => {
    const fakeBase64 = 'B'.repeat(8000);
    const messages: any[] = [
      makeAssistantMsg([{ id: 'call_1', name: 'computer_use' }]),
      {
        role: 'tool',
        content: [
          { type: 'text', text: 'Action completed successfully' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${fakeBase64}` } },
        ],
        tool_call_id: 'call_1',
        name: 'computer_use',
      },
      makeAssistantMsg([{ id: 'call_2', name: 'computer_use' }]),
      {
        role: 'tool',
        content: [
          { type: 'text', text: 'Click completed' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${fakeBase64}` } },
        ],
        tool_call_id: 'call_2',
        name: 'computer_use',
      },
      makeAssistantMsg([{ id: 'call_3', name: 'computer_use' }]),
      {
        role: 'tool',
        content: [
          { type: 'text', text: 'Screenshot taken' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${fakeBase64}` } },
        ],
        tool_call_id: 'call_3',
        name: 'computer_use',
      },
    ];

    const result = pruneImageContent(messages);

    // 1 should be pruned (3 total - 2 kept = 1)
    expect(result.prunedCount).toBe(1);

    // First tool result (pruned): should keep the text part and add stub
    const prunedMsg = messages[1];
    expect(Array.isArray(prunedMsg.content)).toBe(true);
    const prunedParts = prunedMsg.content as Array<{ type: string; text?: string }>;
    expect(prunedParts.some(p => p.type === 'text' && p.text === 'Action completed successfully')).toBe(true);
    expect(prunedParts.some(p => p.type === 'text' && p.text?.includes('[Image pruned:'))).toBe(true);
    // No image_url parts should remain
    expect(prunedParts.some(p => p.type === 'image_url')).toBe(false);

    // Last two should be intact
    const lastMsg = messages[5];
    const lastParts = lastMsg.content as Array<{ type: string }>;
    expect(lastParts.some(p => p.type === 'image_url')).toBe(true);
  });

  it('should handle empty messages array', () => {
    const result = pruneImageContent([]);
    expect(result.prunedCount).toBe(0);
    expect(result.tokensSaved).toBe(0);
    expect(result.messages).toEqual([]);
  });

  it('should pass through messages with no images unchanged', () => {
    const messages: any[] = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
      makeAssistantMsg([{ id: 'call_1', name: 'read_file' }]),
      makeTextToolResult('call_1', 'read_file', 'const x = 1;'),
    ];

    const original = JSON.parse(JSON.stringify(messages));
    const result = pruneImageContent(messages);

    expect(result.prunedCount).toBe(0);
    expect(result.tokensSaved).toBe(0);
    expect(messages).toEqual(original);
  });

  it('should handle data URI base64 inline images in text content', () => {
    const messages: any[] = [];

    for (let i = 0; i < 4; i++) {
      messages.push(makeAssistantMsg([{ id: `call_${i}`, name: 'browser_screenshot' }]));
      messages.push(makeInlineImageToolResult(`call_${i}`, 'browser_screenshot', 15000));
    }

    const result = pruneImageContent(messages);

    // 2 oldest pruned
    expect(result.prunedCount).toBe(2);
    expect(result.tokensSaved).toBeGreaterThan(0);

    // Pruned messages should have stub text replacing the data URI
    const firstToolMsg = messages[1];
    expect(typeof firstToolMsg.content).toBe('string');
    expect(firstToolMsg.content).toContain('[Image pruned:');
    expect(firstToolMsg.content).not.toMatch(/data:image\/png;base64,[A-Za-z0-9+/=]{100,}/);
    // Text around the data URI should be preserved
    expect(firstToolMsg.content).toContain('Screenshot captured:');
    expect(firstToolMsg.content).toContain('Done.');

    // Last 2 should still have inline images
    const lastToolMsg = messages[7];
    expect(lastToolMsg.content).toMatch(/data:image\/png;base64,/);
  });

  it('should handle exactly 2 image results without pruning', () => {
    const messages: any[] = [
      makeAssistantMsg([{ id: 'call_1', name: 'screenshot' }]),
      makeImageToolResult('call_1', 'screenshot'),
      makeAssistantMsg([{ id: 'call_2', name: 'screenshot' }]),
      makeImageToolResult('call_2', 'screenshot'),
    ];

    const result = pruneImageContent(messages);

    expect(result.prunedCount).toBe(0);
    expect(result.tokensSaved).toBe(0);
  });

  it('should handle single image result without pruning', () => {
    const messages: any[] = [
      makeAssistantMsg([{ id: 'call_1', name: 'screenshot' }]),
      makeImageToolResult('call_1', 'screenshot'),
    ];

    const result = pruneImageContent(messages);

    expect(result.prunedCount).toBe(0);
    expect(result.tokensSaved).toBe(0);
  });

  it('should only prune image tool results, leaving text tools interleaved', () => {
    const messages: any[] = [
      // Image 1 (oldest)
      makeAssistantMsg([{ id: 'call_1', name: 'browser_screenshot' }]),
      makeImageToolResult('call_1', 'browser_screenshot'),
      // Text
      makeAssistantMsg([{ id: 'call_2', name: 'read_file' }]),
      makeTextToolResult('call_2', 'read_file', 'File contents'),
      // Image 2
      makeAssistantMsg([{ id: 'call_3', name: 'screenshot' }]),
      makeImageToolResult('call_3', 'screenshot'),
      // Image 3 (most recent)
      makeAssistantMsg([{ id: 'call_4', name: 'screenshot' }]),
      makeImageToolResult('call_4', 'screenshot'),
    ];

    const result = pruneImageContent(messages);

    // Only 1 pruned (3 images - 2 kept = 1, the oldest)
    expect(result.prunedCount).toBe(1);

    // Text tool result should be untouched
    expect(messages[3].content).toBe('File contents');

    // Oldest image pruned
    expect(typeof messages[1].content).toBe('string');
    expect(messages[1].content).toContain('[Image pruned:');

    // Last 2 images intact
    expect(Array.isArray(messages[5].content)).toBe(true);
    expect(Array.isArray(messages[7].content)).toBe(true);
  });
});
