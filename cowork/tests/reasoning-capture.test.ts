import { describe, expect, it } from 'vitest';
import { createReasoningCapture } from '../src/main/reasoning/reasoning-capture';
import { getReasoningBridge } from '../src/main/reasoning/reasoning-bridge';

describe('ReasoningCapture', () => {
  it('buffers deltas into ordered reasoning nodes and completes the trace', () => {
    const bridge = getReasoningBridge();
    bridge.clear();

    const capture = createReasoningCapture({
      bridge,
      toolUseId: 'trace-1',
      sessionId: 'session-1',
      problem: 'Test prompt',
      mode: 'test-mode',
      flushThreshold: 20,
    });

    capture.push('First idea. ');
    capture.push('Second idea.\n');
    capture.push('Third idea without newline');
    capture.complete('Final answer');

    const trace = bridge.getTrace('trace-1');
    expect(trace).not.toBeNull();
    expect(trace?.problem).toBe('Test prompt');
    expect(trace?.mode).toBe('test-mode');
    expect(trace?.nodes).toHaveLength(2);
    expect(trace?.nodes[0]?.label).toContain('First idea.');
    expect(trace?.nodes[0]?.label).toContain('Second idea.');
    expect(trace?.nodes[1]?.label).toContain('Third idea without newline');
    expect(trace?.iterations).toBe(2);
    expect(trace?.finalAnswer).toBe('Final answer');
  });

  it('does not create an empty trace when no reasoning content arrives', () => {
    const bridge = getReasoningBridge();
    bridge.clear();

    const capture = createReasoningCapture({
      bridge,
      toolUseId: 'trace-2',
      sessionId: 'session-2',
      problem: 'Silent prompt',
      mode: 'silent',
    });

    capture.complete('Nothing to see');

    expect(bridge.getTrace('trace-2')).toBeNull();
  });
});
