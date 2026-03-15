/**
 * Per-Tool Execution Metrics
 *
 * Tracks latency, success rate, and invocation count per tool.
 * Used to optimize RAG tool selection (boost reliable tools)
 * and diagnose performance bottlenecks.
 *
 * Identified as a gap by DeepWiki analysis.
 */

// logger available for debug output if needed
// import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ToolMetric {
  /** Tool name */
  name: string;
  /** Total invocations */
  totalCalls: number;
  /** Successful invocations */
  successCount: number;
  /** Failed invocations */
  failureCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average execution time (ms) */
  avgLatencyMs: number;
  /** P95 execution time (ms) */
  p95LatencyMs: number;
  /** Min/max latency */
  minLatencyMs: number;
  maxLatencyMs: number;
  /** Last invocation timestamp */
  lastInvokedAt: Date | null;
}

interface ToolRecord {
  totalCalls: number;
  successCount: number;
  failureCount: number;
  latencies: number[]; // Rolling window of recent latencies
  lastInvokedAt: Date | null;
}

// ============================================================================
// Tool Metrics Tracker
// ============================================================================

/** Maximum latencies to keep per tool (for percentile calculation) */
const MAX_LATENCY_HISTORY = 100;

export class ToolMetricsTracker {
  private records = new Map<string, ToolRecord>();

  /**
   * Record a tool execution.
   */
  record(toolName: string, success: boolean, latencyMs: number): void {
    let rec = this.records.get(toolName);
    if (!rec) {
      rec = { totalCalls: 0, successCount: 0, failureCount: 0, latencies: [], lastInvokedAt: null };
      this.records.set(toolName, rec);
    }

    rec.totalCalls++;
    if (success) rec.successCount++;
    else rec.failureCount++;

    rec.latencies.push(latencyMs);
    if (rec.latencies.length > MAX_LATENCY_HISTORY) {
      rec.latencies.shift();
    }

    rec.lastInvokedAt = new Date();
  }

  /**
   * Get metrics for a specific tool.
   */
  getMetric(toolName: string): ToolMetric | null {
    const rec = this.records.get(toolName);
    if (!rec) return null;
    return this.buildMetric(toolName, rec);
  }

  /**
   * Get metrics for all tools, sorted by total calls descending.
   */
  getAllMetrics(): ToolMetric[] {
    const metrics: ToolMetric[] = [];
    for (const [name, rec] of this.records) {
      metrics.push(this.buildMetric(name, rec));
    }
    return metrics.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  /**
   * Get the reliability score for a tool (0-1).
   * Used to boost RAG selection for reliable tools.
   */
  getReliabilityScore(toolName: string): number {
    const rec = this.records.get(toolName);
    if (!rec || rec.totalCalls === 0) return 0.5; // Unknown = neutral
    // Weighted: 80% success rate + 20% speed (normalized to 0-1)
    const successRate = rec.successCount / rec.totalCalls;
    const avgLatency = rec.latencies.reduce((a, b) => a + b, 0) / rec.latencies.length;
    const speedScore = Math.max(0, 1 - avgLatency / 30_000); // 30s = score 0
    return successRate * 0.8 + speedScore * 0.2;
  }

  /**
   * Format metrics as a human-readable summary.
   */
  formatSummary(): string {
    const metrics = this.getAllMetrics();
    if (metrics.length === 0) return 'No tool metrics recorded.';

    const lines = ['Tool Execution Metrics:', ''];
    for (const m of metrics.slice(0, 20)) {
      const rate = (m.successRate * 100).toFixed(0);
      lines.push(`  ${m.name}: ${m.totalCalls} calls, ${rate}% success, avg ${m.avgLatencyMs.toFixed(0)}ms, p95 ${m.p95LatencyMs.toFixed(0)}ms`);
    }
    return lines.join('\n');
  }

  /**
   * Reset all metrics (for testing).
   */
  reset(): void {
    this.records.clear();
  }

  private buildMetric(name: string, rec: ToolRecord): ToolMetric {
    const sorted = [...rec.latencies].sort((a, b) => a - b);
    const avg = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
    const p95Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));

    return {
      name,
      totalCalls: rec.totalCalls,
      successCount: rec.successCount,
      failureCount: rec.failureCount,
      successRate: rec.totalCalls > 0 ? rec.successCount / rec.totalCalls : 0,
      avgLatencyMs: avg,
      p95LatencyMs: sorted[p95Idx] ?? 0,
      minLatencyMs: sorted[0] ?? 0,
      maxLatencyMs: sorted[sorted.length - 1] ?? 0,
      lastInvokedAt: rec.lastInvokedAt,
    };
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _instance: ToolMetricsTracker | null = null;

export function getToolMetricsTracker(): ToolMetricsTracker {
  if (!_instance) {
    _instance = new ToolMetricsTracker();
  }
  return _instance;
}

export function resetToolMetricsTracker(): void {
  _instance?.reset();
  _instance = null;
}
