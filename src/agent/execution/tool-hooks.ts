/**
 * Tool Hooks — extracted user-hook + metric helpers around tool execution.
 *
 * Sequential and streaming paths run identical PreToolUse / PostToolUse
 * checks and per-tool metric recording around `executeTool`. This module
 * factors those side-effects out so both paths share one source of truth.
 *
 * UI surfacing of a PreToolUse block stays at the call site (sequential
 * mutates the entry history; streaming yields a content chunk).
 *
 * @module agent/execution/tool-hooks
 */

import type { CodeBuddyMessage } from '../../codebuddy/client.js';
import { getUserHooksManager } from '../../hooks/user-hooks.js';

export interface PreHookResult {
  /** True when the tool call is allowed to proceed. */
  allowed: boolean;
  /** Hook-supplied message when blocked (may be undefined). */
  feedback?: string;
}

/**
 * Run PreToolUse hooks for a tool call. Hook errors are swallowed
 * (non-critical) and treated as "allowed".
 */
export async function runPreToolUseHook(
  cwd: string,
  toolCall: { function: { name: string; arguments?: string } }
): Promise<PreHookResult> {
  try {
    const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
    const r = await getUserHooksManager(cwd).executeHooks('PreToolUse', {
      toolName: toolCall.function.name,
      toolInput: toolArgs,
    });
    return { allowed: r.allowed, feedback: r.feedback };
  } catch {
    return { allowed: true };
  }
}

/**
 * Append a "tool blocked by PreToolUse" message to the conversation.
 * Both paths use this shape; only the UI surfacing differs.
 */
export function pushBlockedToolMessage(
  messages: CodeBuddyMessage[],
  toolCall: { id: string },
  feedback: string | undefined
): void {
  messages.push({
    role: 'tool',
    tool_call_id: toolCall.id,
    content: feedback ?? 'Action blocked by PreToolUse hook',
  } as CodeBuddyMessage);
}

/**
 * Run PostToolUse / PostToolUseFailure hooks based on tool result. Hook
 * errors are swallowed (non-critical).
 */
export async function runPostToolUseHook(
  cwd: string,
  toolCall: { function: { name: string } },
  result: { success: boolean; output?: string }
): Promise<void> {
  try {
    const event = result.success ? 'PostToolUse' : 'PostToolUseFailure';
    await getUserHooksManager(cwd).executeHooks(event, {
      toolName: toolCall.function.name,
      toolResult: { success: result.success, output: result.output },
    });
  } catch { /* user hooks are non-critical */ }
}

/**
 * Record a per-tool metric (success + duration). Errors are swallowed
 * (metrics are optional).
 */
export async function recordToolMetric(
  toolName: string,
  success: boolean,
  durationMs: number
): Promise<void> {
  try {
    const { getToolMetricsTracker } = await import('../../observability/tool-metrics.js');
    getToolMetricsTracker().record(toolName, success, durationMs);
  } catch { /* metrics are optional */ }
}
