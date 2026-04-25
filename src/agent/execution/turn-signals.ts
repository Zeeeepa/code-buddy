/**
 * Turn Signals — sentinel-prefixed tool outputs that interrupt the turn loop.
 *
 * A tool can write a marker at the start of its output to request a
 * specific control-flow action by the agent runner:
 *   __AGENT_TERMINATE__       → end the turn (both paths)
 *   __INTERACTIVE_SHELL_REQUEST__ → hand off to an interactive shell (streaming only)
 *   __PLAN_APPROVAL_REQUEST__ → ask the user to approve a plan (streaming only)
 *
 * UI surfacing of each signal stays at the call site (sequential pushes a
 * ChatEntry, streaming yields a chunk). This module exposes detection +
 * message extraction only.
 *
 * @module agent/execution/turn-signals
 */

export const TERMINATE_SIGNAL = '__AGENT_TERMINATE__';
export const INTERACTIVE_SHELL_SIGNAL = '__INTERACTIVE_SHELL_REQUEST__';
export const PLAN_APPROVAL_SIGNAL = '__PLAN_APPROVAL_REQUEST__';

/**
 * If `rawContent` begins with `signal`, return the trimmed remainder
 * (or `fallback` when empty). Returns null when the signal is absent.
 */
export function extractSignalMessage(
  rawContent: string,
  signal: string,
  fallback: string = ''
): string | null {
  if (!rawContent.startsWith(signal)) return null;
  const msg = rawContent.replace(signal, '').trim();
  return msg || fallback;
}

/** Convenience: extract the terminate message (defaults to "Task completed."). */
export function extractTerminateMessage(rawContent: string): string | null {
  return extractSignalMessage(rawContent, TERMINATE_SIGNAL, 'Task completed.');
}
