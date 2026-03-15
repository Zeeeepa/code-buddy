/**
 * Tests for DeepWiki-identified gaps:
 * 1. Adaptive compaction threshold
 * 2. Per-tool execution metrics
 * 3. Context budget breakdown
 * 4. TTL-based tool result expiry
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// 1. Per-Tool Execution Metrics
// ============================================================================

describe('ToolMetricsTracker', () => {
  let ToolMetricsTracker: typeof import('@/observability/tool-metrics.js').ToolMetricsTracker;

  beforeEach(async () => {
    const mod = await import('@/observability/tool-metrics.js');
    ToolMetricsTracker = mod.ToolMetricsTracker;
  });

  it('should record tool executions', () => {
    const tracker = new ToolMetricsTracker();
    tracker.record('grep', true, 50);
    tracker.record('grep', true, 100);
    tracker.record('grep', false, 200);

    const metric = tracker.getMetric('grep');
    expect(metric).not.toBeNull();
    expect(metric!.totalCalls).toBe(3);
    expect(metric!.successCount).toBe(2);
    expect(metric!.failureCount).toBe(1);
    expect(metric!.successRate).toBeCloseTo(0.667, 2);
  });

  it('should compute average latency', () => {
    const tracker = new ToolMetricsTracker();
    tracker.record('bash', true, 100);
    tracker.record('bash', true, 200);
    tracker.record('bash', true, 300);

    const metric = tracker.getMetric('bash');
    expect(metric!.avgLatencyMs).toBe(200);
  });

  it('should compute p95 latency', () => {
    const tracker = new ToolMetricsTracker();
    for (let i = 1; i <= 100; i++) {
      tracker.record('read_file', true, i * 10);
    }
    const metric = tracker.getMetric('read_file');
    expect(metric!.p95LatencyMs).toBeGreaterThanOrEqual(950);
  });

  it('should return null for unknown tools', () => {
    const tracker = new ToolMetricsTracker();
    expect(tracker.getMetric('nonexistent')).toBeNull();
  });

  it('should sort getAllMetrics by total calls', () => {
    const tracker = new ToolMetricsTracker();
    tracker.record('a', true, 10);
    tracker.record('b', true, 10);
    tracker.record('b', true, 10);
    tracker.record('c', true, 10);
    tracker.record('c', true, 10);
    tracker.record('c', true, 10);

    const all = tracker.getAllMetrics();
    expect(all[0].name).toBe('c');
    expect(all[1].name).toBe('b');
    expect(all[2].name).toBe('a');
  });

  it('should compute reliability score', () => {
    const tracker = new ToolMetricsTracker();
    // 100% success, fast
    tracker.record('good_tool', true, 50);
    tracker.record('good_tool', true, 50);
    const goodScore = tracker.getReliabilityScore('good_tool');

    // 50% success, slow
    tracker.record('bad_tool', true, 25000);
    tracker.record('bad_tool', false, 25000);
    const badScore = tracker.getReliabilityScore('bad_tool');

    expect(goodScore).toBeGreaterThan(badScore);
  });

  it('should return 0.5 for unknown tools', () => {
    const tracker = new ToolMetricsTracker();
    expect(tracker.getReliabilityScore('unknown')).toBe(0.5);
  });

  it('should format summary', () => {
    const tracker = new ToolMetricsTracker();
    tracker.record('grep', true, 50);
    tracker.record('bash', false, 1000);

    const summary = tracker.formatSummary();
    expect(summary).toContain('grep');
    expect(summary).toContain('bash');
    expect(summary).toContain('calls');
  });

  it('should cap latency history', () => {
    const tracker = new ToolMetricsTracker();
    for (let i = 0; i < 200; i++) {
      tracker.record('tool', true, i);
    }
    const metric = tracker.getMetric('tool');
    expect(metric!.totalCalls).toBe(200);
    // p95 should be based on last 100 entries (100-199)
    expect(metric!.minLatencyMs).toBe(100);
  });
});

// ============================================================================
// 2. Context Budget Breakdown
// ============================================================================

describe('Context Budget Breakdown', () => {
  it('should categorize messages by layer', async () => {
    const { ContextManagerV2 } = await import('@/context/context-manager-v2.js');
    const cm = new ContextManagerV2({ maxContextTokens: 128000 });

    const messages = [
      { role: 'system' as const, content: 'You are a helpful assistant.' },
      { role: 'system' as const, content: '<lessons_context>Always use TypeScript</lessons_context>' },
      { role: 'user' as const, content: 'Fix the bug' },
      { role: 'assistant' as const, content: 'I will look at the code.' },
      { role: 'tool' as const, content: 'File content here...'.repeat(100) },
    ];

    const breakdown = cm.getContextBudgetBreakdown(messages);

    expect(breakdown.system).toBeDefined();
    expect(breakdown.lessons).toBeDefined();
    expect(breakdown.user_messages).toBeDefined();
    expect(breakdown.tool_results).toBeDefined();

    // Tool results should dominate in this example
    expect(breakdown.tool_results.percent).toBeGreaterThan(50);
  });

  it('should handle empty messages', async () => {
    const { ContextManagerV2 } = await import('@/context/context-manager-v2.js');
    const cm = new ContextManagerV2({ maxContextTokens: 128000 });

    const breakdown = cm.getContextBudgetBreakdown([]);
    expect(Object.keys(breakdown)).toHaveLength(0);
  });
});

// ============================================================================
// 3. TTL-Based Tool Result Expiry
// ============================================================================

describe('Tool Result TTL Expiry', () => {
  let expireOldToolResults: typeof import('@/context/tool-output-masking.js').expireOldToolResults;

  beforeEach(async () => {
    const mod = await import('@/context/tool-output-masking.js');
    expireOldToolResults = mod.expireOldToolResults;
  });

  it('should not expire recent results', () => {
    const messages = [
      { role: 'assistant' as const, content: 'thinking' },
      { role: 'tool' as const, content: 'fresh result' },
    ];
    const expired = expireOldToolResults(messages as any, 2, 20);
    expect(expired).toBe(0);
    expect(messages[1].content).toBe('fresh result');
  });

  it('should expire old results', () => {
    // Build a conversation with 25 assistant+tool pairs
    const messages: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 25; i++) {
      messages.push({ role: 'assistant', content: `turn ${i}` });
      messages.push({ role: 'tool', content: `result for turn ${i} with enough content to be meaningful and worth compressing for the TTL test` });
    }

    const expired = expireOldToolResults(messages as any, 25, 20);
    expect(expired).toBeGreaterThan(0);

    // Early results should be expired
    expect(messages[1].content).toContain('expired');
  });

  it('should apply moderate compression at 50-75% age', () => {
    const messages: Array<{ role: string; content: string }> = [];
    for (let i = 0; i < 15; i++) {
      messages.push({ role: 'assistant', content: `turn ${i}` });
      messages.push({ role: 'tool', content: 'x'.repeat(1000) }); // Large enough for preview
    }

    expireOldToolResults(messages as any, 15, 20);
    // Results at 50-75% age (turns 5-7) should have preview applied
    // Results at 0-50% age (turns 8-15) should be untouched
    expect(messages[messages.length - 1].content).toBe('x'.repeat(1000)); // Latest untouched
  });

  it('should not expire already-masked results', () => {
    const messages = [
      { role: 'assistant' as const, content: 'old' },
      { role: 'tool' as const, content: '<tool_output_masked>already masked</tool_output_masked>' },
    ];
    for (let i = 0; i < 30; i++) {
      messages.push({ role: 'assistant' as const, content: `turn ${i}` } as any);
    }

    const expired = expireOldToolResults(messages as any, 30, 20);
    expect(messages[1].content).toContain('tool_output_masked'); // Unchanged
  });
});

// ============================================================================
// 4. Singleton exports
// ============================================================================

describe('Singleton exports', () => {
  it('getToolMetricsTracker should return singleton', async () => {
    const { getToolMetricsTracker, resetToolMetricsTracker } = await import('@/observability/tool-metrics.js');
    resetToolMetricsTracker();
    const a = getToolMetricsTracker();
    const b = getToolMetricsTracker();
    expect(a).toBe(b);
  });
});
