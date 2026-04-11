/**
 * Verification Enforcement Middleware
 *
 * Checks if multiple files have been changed without running task_verify.
 * Warns the agent to consider running verification after modifying >= 3 files.
 *
 * Priority 155 — runs after auto-repair (150) to suggest verification
 * as a follow-up to successful repairs.
 */

import type {
  ConversationMiddleware,
  MiddlewareContext,
  MiddlewareResult,
} from './types.js';
import { logger } from '../../utils/logger.js';

// ── Configuration ──────────────────────────────────────────────────

export interface VerificationEnforcementConfig {
  /** Enable/disable verification enforcement (default: true) */
  enabled: boolean;
  /** Minimum files changed before suggesting verification (default: 3) */
  fileThreshold: number;
  /** Tool names that count as verification (default: ['task_verify', 'run_tests']) */
  verificationTools: string[];
  /** History window to search for verification tool calls (default: 20) */
  historyWindow: number;
}

export const DEFAULT_VERIFICATION_CONFIG: VerificationEnforcementConfig = {
  enabled: true,
  fileThreshold: 3,
  verificationTools: ['task_verify', 'run_tests'],
  historyWindow: 20,
};

// ── Middleware ──────────────────────────────────────────────────────

export class VerificationEnforcementMiddleware implements ConversationMiddleware {
  readonly name = 'verification-enforcement';
  readonly priority = 155;

  private config: VerificationEnforcementConfig;
  private hasWarned = false;

  constructor(config: Partial<VerificationEnforcementConfig> = {}) {
    this.config = { ...DEFAULT_VERIFICATION_CONFIG, ...config };
  }

  async afterTurn(context: MiddlewareContext): Promise<MiddlewareResult> {
    if (!this.config.enabled) {
      return { action: 'continue' };
    }

    // Only warn once per task
    if (this.hasWarned) {
      return { action: 'continue' };
    }

    // Check if user explicitly skipped verification
    if (this.userSkippedVerification(context)) {
      return { action: 'continue' };
    }

    // Count changed files from context
    const changedCount = this.countChangedFiles(context);
    if (changedCount < this.config.fileThreshold) {
      return { action: 'continue' };
    }

    // Check if verification was already run recently
    if (this.hasRecentVerification(context)) {
      return { action: 'continue' };
    }

    // All conditions met: warn
    this.hasWarned = true;

    logger.info('Verification enforcement triggered', {
      changedFiles: changedCount,
      threshold: this.config.fileThreshold,
    });

    return {
      action: 'warn',
      message:
        `Multiple files changed (${changedCount}). ` +
        `Consider running \`task_verify\` to ensure changes are correct.`,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private countChangedFiles(context: MiddlewareContext): number {
    // Use changedFiles from context if available
    if (context.changedFiles && context.changedFiles.length > 0) {
      return context.changedFiles.length;
    }

    // Fall back: scan history for file-modifying tool calls
    const fileModifyingTools = new Set([
      'write_file', 'edit_file', 'str_replace', 'create_file',
      'apply_patch', 'file_write', 'str_replace_editor',
    ]);
    const modifiedFiles = new Set<string>();

    const window = context.history.slice(-this.config.historyWindow);
    for (const entry of window) {
      if (entry.type !== 'tool_result' && entry.type !== 'tool_call') continue;
      const toolName = entry.toolCall?.function?.name;
      if (!toolName || !fileModifyingTools.has(toolName)) continue;

      // Extract file path from arguments
      try {
        const args = JSON.parse(entry.toolCall?.function?.arguments || '{}');
        const filePath = args.path || args.file_path || args.file || args.filename;
        if (filePath) {
          modifiedFiles.add(filePath);
        }
      } catch {
        // Ignore parse errors
      }
    }

    return modifiedFiles.size;
  }

  private hasRecentVerification(context: MiddlewareContext): boolean {
    const window = context.history.slice(-this.config.historyWindow);

    for (const entry of window) {
      if (entry.type !== 'tool_result' && entry.type !== 'tool_call') continue;
      const toolName = entry.toolCall?.function?.name;
      if (toolName && this.config.verificationTools.includes(toolName)) {
        return true;
      }
    }

    return false;
  }

  private userSkippedVerification(context: MiddlewareContext): boolean {
    const skipPatterns = [
      /skip\s+verification/i,
      /no\s+need\s+to\s+verify/i,
      /don'?t\s+verify/i,
      /skip\s+tests?/i,
    ];

    // Check recent user messages
    const recent = context.history.slice(-10);
    for (const entry of recent) {
      if (entry.type !== 'user') continue;
      const content = typeof entry.content === 'string' ? entry.content : '';
      if (skipPatterns.some(p => p.test(content))) {
        return true;
      }
    }

    return false;
  }

  // ── Public API ─────────────────────────────────────────────────────

  /** Reset the warning flag (e.g., on new task) */
  reset(): void {
    this.hasWarned = false;
  }

  /** Check if warning has been issued */
  hasWarnedAlready(): boolean {
    return this.hasWarned;
  }

  /** Get configuration */
  getConfig(): VerificationEnforcementConfig {
    return { ...this.config };
  }
}

/**
 * Factory function for creating the verification enforcement middleware.
 */
export function createVerificationEnforcementMiddleware(
  config?: Partial<VerificationEnforcementConfig>,
): VerificationEnforcementMiddleware {
  return new VerificationEnforcementMiddleware(config);
}
