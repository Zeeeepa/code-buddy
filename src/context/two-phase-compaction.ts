/**
 * Two-Phase Context Compaction
 *
 * Phase 1 (cheap, O(n)): Truncate oversized tool arguments and results
 *   without an LLM call. Runs at ~80% context usage.
 *
 * Phase 2 (standard): Delegates to the existing enhanced/legacy compaction
 *   pipeline in ContextManagerV2. Runs at ~85% context usage.
 *
 * DeepAgents Sprint 1 — Two-Phase Context Compaction.
 */

import { logger } from '../utils/logger.js';

/**
 * Phase 1: Truncate oversized tool call arguments and tool result content.
 *
 * - Tool results longer than `maxResultLength` are replaced with head/tail
 *   previews (first/last portion joined by "[...truncated]").
 * - Tool call arguments longer than `maxArgLength` are truncated with a
 *   trailing "[...truncated]" marker.
 *
 * O(n) scan — no LLM call required.
 *
 * @param messages  LLM message array (shallow-cloned; originals not mutated).
 * @param maxArgLength     Max characters for tool call arguments (default 1000).
 * @param maxResultLength  Max characters for tool result content (default 2000).
 * @returns New messages array and count of truncated items.
 */
export function truncateToolArgs(
  messages: any[],
  maxArgLength: number = 1000,
  maxResultLength: number = 2000,
): { messages: any[]; truncated: number } {
  let truncated = 0;
  const headTailSize = Math.min(500, Math.floor(maxResultLength / 4));

  const result = messages.map(msg => {
    // ── Tool result truncation ──
    if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > maxResultLength) {
      const head = msg.content.slice(0, headTailSize);
      const tail = msg.content.slice(-headTailSize);
      truncated++;
      return {
        ...msg,
        content: `${head}\n\n[...truncated ${msg.content.length - headTailSize * 2} chars...]\n\n${tail}`,
      };
    }

    // ── Tool call argument truncation ──
    if (
      msg.role === 'assistant' &&
      Array.isArray(msg.tool_calls) &&
      msg.tool_calls.length > 0
    ) {
      let anyTruncated = false;
      const newToolCalls = msg.tool_calls.map((tc: any) => {
        const args = tc.function?.arguments;
        if (typeof args === 'string' && args.length > maxArgLength) {
          anyTruncated = true;
          truncated++;
          return {
            ...tc,
            function: {
              ...tc.function,
              arguments: args.slice(0, maxArgLength) + '...[truncated]',
            },
          };
        }
        return tc;
      });

      if (anyTruncated) {
        return { ...msg, tool_calls: newToolCalls };
      }
    }

    return msg;
  });

  if (truncated > 0) {
    logger.debug(`Two-phase compaction phase 1: truncated ${truncated} tool args/results`);
  }

  return { messages: result, truncated };
}

/**
 * Check whether Phase 1 (cheap truncation) should run.
 * Triggers at the lower threshold to avoid an expensive LLM-based compaction.
 *
 * @param tokenUsagePercent  Current token usage as a ratio (0..1).
 * @param phase1Threshold    Threshold ratio (default 0.80).
 */
export function shouldRunPhase1(
  tokenUsagePercent: number,
  phase1Threshold: number = 0.80,
): boolean {
  return tokenUsagePercent >= phase1Threshold;
}

/**
 * Check whether Phase 2 (full LLM-based compaction) should run.
 * Triggers at the higher threshold, after Phase 1 has already run.
 *
 * @param tokenUsagePercent  Current token usage as a ratio (0..1).
 * @param phase2Threshold    Threshold ratio (default 0.85).
 */
export function shouldRunPhase2(
  tokenUsagePercent: number,
  phase2Threshold: number = 0.85,
): boolean {
  return tokenUsagePercent >= phase2Threshold;
}
