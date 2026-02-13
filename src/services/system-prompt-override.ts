/**
 * System Prompt Override
 *
 * Handles CLI flags for replacing or appending to the system prompt:
 * - --system-prompt <text>         → replace entire prompt
 * - --system-prompt-file <path>    → replace from file
 * - --append-system-prompt <text>  → append text to default prompt
 * - --append-system-prompt-file <path> → append file contents
 */

import * as fs from 'fs';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface OverrideOptions {
  /** Replace the entire system prompt with this text */
  systemPrompt?: string;
  /** Replace the entire system prompt with contents of this file */
  systemPromptFile?: string;
  /** Append this text to the default system prompt */
  appendSystemPrompt?: string;
  /** Append contents of this file to the default system prompt */
  appendSystemPromptFile?: string;
}

// ============================================================================
// Implementation
// ============================================================================

export class SystemPromptOverride {
  /**
   * Apply override options to a base system prompt.
   *
   * - If systemPrompt or systemPromptFile is set, the base prompt is REPLACED.
   * - If appendSystemPrompt or appendSystemPromptFile is set, content is APPENDED.
   * - Cannot use both replace and append simultaneously.
   * - If no overrides, returns the base prompt unchanged.
   */
  apply(basePrompt: string, options: OverrideOptions): string {
    const hasReplace = options.systemPrompt !== undefined || options.systemPromptFile !== undefined;
    const hasAppend = options.appendSystemPrompt !== undefined || options.appendSystemPromptFile !== undefined;

    // Validate: can't use both replace and append simultaneously
    if (hasReplace && hasAppend) {
      throw new Error(
        'Cannot use both replace (--system-prompt / --system-prompt-file) and append (--append-system-prompt / --append-system-prompt-file) simultaneously'
      );
    }

    // No overrides — return base prompt unchanged
    if (!hasReplace && !hasAppend) {
      return basePrompt;
    }

    // Replace mode
    if (hasReplace) {
      if (options.systemPromptFile) {
        return this.readFile(options.systemPromptFile);
      }
      return options.systemPrompt!;
    }

    // Append mode
    let result = basePrompt;

    if (options.appendSystemPrompt) {
      result += '\n\n' + options.appendSystemPrompt;
    }

    if (options.appendSystemPromptFile) {
      const fileContent = this.readFile(options.appendSystemPromptFile);
      result += '\n\n' + fileContent;
    }

    return result;
  }

  /**
   * Read a file from disk. Throws if the file does not exist.
   */
  private readFile(filePath: string): string {
    if (!fs.existsSync(filePath)) {
      throw new Error(`System prompt file not found: ${filePath}`);
    }
    logger.debug('Reading system prompt file', { path: filePath });
    return fs.readFileSync(filePath, 'utf-8');
  }
}
