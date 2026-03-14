/**
 * Tool Output Masking Service
 *
 * Replaces bulky old tool outputs in conversation history with
 * head/tail previews + file references. Uses a "Hybrid Backward
 * Scanned FIFO" algorithm: newest outputs are protected, oldest
 * are replaced with summaries.
 *
 * Inspired by Gemini CLI's toolOutputMaskingService.ts
 */

import { logger } from '../utils/logger.js';
import type { CodeBuddyMessage } from '../codebuddy/client.js';

/** Tokens worth of newest tool outputs to protect from masking */
const PROTECTION_THRESHOLD_CHARS = 200_000; // ~50K tokens * 4 chars/token

/** Only trigger masking if total prunable chars exceeds this */
const MIN_PRUNABLE_CHARS = 120_000; // ~30K tokens

/** Whether to always protect the latest turn's outputs */
const PROTECT_LATEST_TURN = true;

/** Maximum lines for head preview */
const HEAD_PREVIEW_LINES = 10;

/** Maximum lines for tail preview */
const TAIL_PREVIEW_LINES = 10;

/** Maximum chars for short content preview */
const SHORT_PREVIEW_CHARS = 250;

/** Tools whose output should never be masked */
const EXEMPT_TOOLS = new Set([
  'ask_human',
  'plan',
  'reason',
  'terminate',
  'todo_update',
  'lessons_add',
]);

export const MASKING_TAG = '<tool_output_masked>';
export const MASKING_TAG_END = '</tool_output_masked>';

/**
 * Generate a head/tail preview of content.
 */
function generatePreview(content: string): string {
  const lines = content.split('\n');

  if (lines.length <= HEAD_PREVIEW_LINES + TAIL_PREVIEW_LINES) {
    // Short enough — use char-based preview
    if (content.length <= SHORT_PREVIEW_CHARS * 2) return content;
    return content.substring(0, SHORT_PREVIEW_CHARS) +
      '\n...\n' +
      content.substring(content.length - SHORT_PREVIEW_CHARS);
  }

  const head = lines.slice(0, HEAD_PREVIEW_LINES).join('\n');
  const tail = lines.slice(-TAIL_PREVIEW_LINES).join('\n');
  const omitted = lines.length - HEAD_PREVIEW_LINES - TAIL_PREVIEW_LINES;

  return `${head}\n\n... (${omitted} lines omitted) ...\n\n${tail}`;
}

/**
 * Apply tool output masking to conversation messages.
 * Scans backward from the most recent message, protecting the newest
 * outputs and replacing older ones with previews.
 *
 * @param messages - Mutable message array (modified in place)
 * @returns Number of messages masked
 */
export function applyToolOutputMasking(messages: CodeBuddyMessage[]): number {
  // Find tool result messages and their char counts
  const toolMessages: Array<{
    index: number;
    chars: number;
    toolName: string;
  }> = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'tool' || typeof msg.content !== 'string') continue;

    // Extract tool name from preceding assistant message
    let toolName = '';
    const toolCallId = (msg as { tool_call_id?: string }).tool_call_id;
    for (let j = i - 1; j >= 0; j--) {
      const prev = messages[j];
      if (prev.role === 'assistant' && 'tool_calls' in prev && Array.isArray(prev.tool_calls)) {
        const tc = (prev.tool_calls as Array<{ id: string; function?: { name: string } }>)
          .find(t => t.id === toolCallId);
        if (tc) {
          toolName = tc.function?.name ?? '';
        }
        break;
      }
    }

    // Skip exempt tools
    if (EXEMPT_TOOLS.has(toolName)) continue;

    // Skip already masked
    if (msg.content.includes(MASKING_TAG)) continue;

    toolMessages.push({
      index: i,
      chars: msg.content.length,
      toolName,
    });
  }

  if (toolMessages.length === 0) return 0;

  // Backward scan: protect newest outputs
  let cumulativeChars = 0;
  let protectionBoundary = -1;

  // If protecting latest turn, start from second-to-last tool message
  const startIdx = PROTECT_LATEST_TURN && toolMessages.length > 1
    ? toolMessages.length - 2
    : toolMessages.length - 1;

  for (let i = startIdx; i >= 0; i--) {
    cumulativeChars += toolMessages[i].chars;
    if (cumulativeChars > PROTECTION_THRESHOLD_CHARS) {
      protectionBoundary = i;
      break;
    }
  }

  // No boundary reached — everything fits in protection window
  if (protectionBoundary < 0) return 0;

  // Calculate total prunable chars
  let totalPrunable = 0;
  for (let i = 0; i <= protectionBoundary; i++) {
    totalPrunable += toolMessages[i].chars;
  }

  // Only mask if enough prunable content
  if (totalPrunable < MIN_PRUNABLE_CHARS) return 0;

  // Mask old outputs (validate index bounds before access)
  let masked = 0;
  for (let i = 0; i <= protectionBoundary; i++) {
    const { index, toolName } = toolMessages[i];
    if (index < 0 || index >= messages.length) continue;
    const msg = messages[index];
    if (!msg || typeof msg.content !== 'string') continue;

    const preview = generatePreview(msg.content);
    const originalChars = msg.content.length;

    msg.content = [
      MASKING_TAG,
      `Tool: ${toolName || 'unknown'}`,
      `Original size: ${originalChars} chars`,
      '',
      preview,
      MASKING_TAG_END,
    ].join('\n');

    masked++;
  }

  if (masked > 0) {
    logger.debug(`Tool output masking: masked ${masked} outputs, freed ~${(totalPrunable / 4).toFixed(0)} tokens`);
  }

  return masked;
}
