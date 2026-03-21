/**
 * Transcript Repair — Post-compaction validation
 *
 * After compaction, validates that every tool_result has a corresponding
 * tool_call, and vice versa. LLM providers reject malformed transcripts
 * (e.g., orphaned tool results without their calling assistant message).
 *
 * OpenClaw v2026.3.11 alignment.
 */

import type { CodeBuddyMessage } from '../codebuddy/client.js';
import { logger } from '../utils/logger.js';

/**
 * Repair tool call/result pairing in a message transcript.
 *
 * 1. Removes orphaned tool results (tool_call_id has no matching tool_call).
 * 2. Injects synthetic results for tool_calls that lost their results.
 *
 * @returns Repaired message array (new array, original not mutated).
 */
export function repairToolCallPairs(messages: CodeBuddyMessage[]): CodeBuddyMessage[] {
  // Collect all tool_call IDs from assistant messages
  const toolCallIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'assistant' && 'tool_calls' in msg && Array.isArray((msg as unknown as Record<string, unknown>).tool_calls)) {
      for (const tc of (msg as { tool_calls: Array<{ id: string }> }).tool_calls) {
        if (tc.id) toolCallIds.add(tc.id);
      }
    }
  }

  // Collect all tool_call_ids from tool result messages
  const toolResultIds = new Set<string>();
  for (const msg of messages) {
    if (msg.role === 'tool') {
      const callId = (msg as { tool_call_id?: string }).tool_call_id;
      if (callId) toolResultIds.add(callId);
    }
  }

  let removedOrphans = 0;
  let injectedSynthetics = 0;

  // Step 1: Remove orphaned tool results (no matching tool_call)
  const filtered = messages.filter(msg => {
    if (msg.role === 'tool') {
      const callId = (msg as { tool_call_id?: string }).tool_call_id;
      if (callId && !toolCallIds.has(callId)) {
        removedOrphans++;
        return false;
      }
    }
    return true;
  });

  // Step 2: Inject synthetic results for tool_calls without results
  const result: CodeBuddyMessage[] = [];
  for (const msg of filtered) {
    result.push(msg);

    if (msg.role === 'assistant' && 'tool_calls' in msg && Array.isArray((msg as unknown as Record<string, unknown>).tool_calls)) {
      const calls = (msg as { tool_calls: Array<{ id: string; function?: { name?: string } }> }).tool_calls;
      for (const tc of calls) {
        if (tc.id && !toolResultIds.has(tc.id)) {
          // Inject a synthetic result so the provider doesn't reject the transcript
          result.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: '[result lost during compaction]',
          } as CodeBuddyMessage);
          injectedSynthetics++;
        }
      }
    }
  }

  if (removedOrphans > 0 || injectedSynthetics > 0) {
    logger.info(
      `Transcript repair: removed ${removedOrphans} orphaned tool results, ` +
      `injected ${injectedSynthetics} synthetic results`
    );
  }

  return result;
}
