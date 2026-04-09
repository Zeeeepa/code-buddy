import { describe, expect, it } from 'vitest';
import { CodeBuddyEngineRunner } from '../src/main/engine/codebuddy-engine-runner';
import { getReasoningBridge } from '../src/main/reasoning/reasoning-bridge';
import type { Message, Session, ServerEvent } from '../src/renderer/types';

describe('CodeBuddyEngineRunner reasoning capture', () => {
  it('persists thinking deltas into the reasoning bridge', async () => {
    const reasoningBridge = getReasoningBridge();
    reasoningBridge.clear();

    const adapter = {
      async runSession(
        _sessionId: string,
        _messages: Array<{ role: string; content: string }>,
        onEvent: (event: { type: string; thinking?: string; content?: string }) => void
      ) {
        onEvent({ type: 'thinking', thinking: 'First thought. ' });
        onEvent({ type: 'thinking', thinking: 'Second thought.\n' });
        onEvent({ type: 'content', content: 'Final answer.' });
        return { content: 'Final answer.', tokenCount: 42, toolCallCount: 0 };
      },
      cancel() {},
      clearSession() {},
    };

    const events: ServerEvent[] = [];
    const savedMessages: Message[] = [];
    const runner = new CodeBuddyEngineRunner(adapter, {
      sendToRenderer: (event) => {
        events.push(event);
      },
      saveMessage: (message) => {
        savedMessages.push(message);
      },
    });

    const session: Session = {
      id: 'session-1',
      title: 'Reasoning test',
      status: 'idle',
      mountedPaths: [],
      allowedTools: [],
      memoryEnabled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'codebuddy-test',
    };

    await runner.run(session, 'Solve this carefully', []);

    const traces = reasoningBridge.listTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0]?.problem).toBe('Solve this carefully');
    expect(traces[0]?.iterations).toBe(1);

    const trace = reasoningBridge.getTrace(traces[0]!.toolUseId);
    expect(trace?.nodes).toHaveLength(1);
    expect(trace?.nodes[0]?.label).toContain('First thought.');
    expect(trace?.nodes[0]?.label).toContain('Second thought.');
    expect(trace?.finalAnswer).toBe('Final answer.');

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'stream.thinking',
        }),
      ])
    );
    expect(savedMessages).toHaveLength(2);
  });
});
