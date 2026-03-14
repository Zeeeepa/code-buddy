/**
 * Plan Mode — Read-only Research & Planning Mode
 *
 * When active, restricts available tools to read-only operations
 * (Read, Search, Think, Plan). Write/Execute tools are blocked
 * or have their descriptions modified to only allow .md plan files.
 *
 * Inspired by Gemini CLI's plan mode.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export enum AgentMode {
  DEFAULT = 'default',
  PLAN = 'plan',
  CODE = 'code',
  ASK = 'ask',
  ARCHITECT = 'architect',
}

/** Tool kinds for classification */
export enum ToolKind {
  Read = 'read',
  Edit = 'edit',
  Delete = 'delete',
  Search = 'search',
  Execute = 'execute',
  Think = 'think',
  Plan = 'plan',
  Communicate = 'communicate',
  Other = 'other',
}

/** Tools allowed in plan mode (by name) */
const PLAN_MODE_ALLOWED_TOOLS = new Set([
  // Read
  'read_file', 'view_file', 'file_read', 'list_files', 'get_file_info', 'tree',
  // Search
  'grep', 'glob', 'search_files', 'find_references', 'web_search', 'browser_search',
  // Think
  'reason', 'think',
  // Plan
  'plan',
  // Communicate
  'ask_human',
  // Knowledge
  'knowledge_search', 'knowledge_list', 'codebase_map', 'code_graph',
  // Other read-only
  'todo_update', 'lessons_search', 'lessons_list',
  'restore_context', 'memory_search',
]);

/** Tools that get modified descriptions in plan mode (limited to .md files) */
const PLAN_MODE_RESTRICTED_TOOLS = new Set([
  'create_file', 'str_replace_editor', 'file_write', 'write_file',
  'edit_file', 'multi_edit',
]);

// ============================================================================
// State
// ============================================================================

/**
 * Mode state. WARNING: These are module-level globals. In multi-session
 * server deployments, mode should be tracked per-session via SessionFacade.
 * These globals are safe for the single-user CLI but must be reset between sessions.
 */
let _currentMode: AgentMode = AgentMode.DEFAULT;
let _planPath: string | null = null;

// ============================================================================
// Public API
// ============================================================================

/**
 * Get the current agent mode.
 */
export function getAgentMode(): AgentMode {
  return _currentMode;
}

/**
 * Set the agent mode.
 */
export function setAgentMode(mode: AgentMode): void {
  const previous = _currentMode;
  _currentMode = mode;
  if (previous !== mode) {
    logger.info(`Agent mode changed: ${previous} → ${mode}`);
  }
}

/**
 * Check if we're in plan mode.
 */
export function isPlanMode(): boolean {
  return _currentMode === AgentMode.PLAN;
}

/**
 * Set the approved plan path (after user approves a plan).
 */
export function setApprovedPlanPath(planPath: string): void {
  _planPath = planPath;
}

/**
 * Get the approved plan path.
 */
export function getApprovedPlanPath(): string | null {
  return _planPath;
}

/**
 * Check if a tool is allowed in the current mode.
 * In plan mode, only read/search/think/plan tools are allowed.
 */
export function isToolAllowedInCurrentMode(toolName: string): boolean {
  if (_currentMode !== AgentMode.PLAN) return true;

  return PLAN_MODE_ALLOWED_TOOLS.has(toolName) ||
    PLAN_MODE_RESTRICTED_TOOLS.has(toolName);
}

/**
 * Get a modified tool description for plan mode.
 * Write tools get restricted to .md files in .codebuddy/plans/.
 * Returns null if no modification needed.
 */
export function getPlanModeToolDescription(
  toolName: string,
  originalDescription: string,
): string | null {
  if (_currentMode !== AgentMode.PLAN) return null;
  if (!PLAN_MODE_RESTRICTED_TOOLS.has(toolName)) return null;

  return `PLAN MODE ONLY: ${originalDescription}. You are in Plan Mode and may ONLY use this tool to write or update plan files (.md) in the .codebuddy/plans/ directory. You cannot modify source code directly.`;
}

/**
 * Filter tool definitions for the current mode.
 * In plan mode, removes disallowed tools and modifies restricted tool descriptions.
 */
export function filterToolsForMode<T extends { function: { name: string; description?: string } }>(
  tools: T[],
): T[] {
  if (_currentMode !== AgentMode.PLAN) return tools;

  return tools
    .filter(t => isToolAllowedInCurrentMode(t.function.name))
    .map(t => {
      const modified = getPlanModeToolDescription(
        t.function.name,
        t.function.description ?? '',
      );
      if (modified) {
        return {
          ...t,
          function: { ...t.function, description: modified },
        };
      }
      return t;
    });
}

/**
 * Get the plan mode system prompt injection.
 */
export function getPlanModePrompt(): string | null {
  if (_currentMode !== AgentMode.PLAN) return null;

  return `<plan_mode>
You are in PLAN MODE (read-only research phase).

Rules:
- Use ONLY read, search, and think tools to analyze the codebase
- Do NOT modify any source code files
- You MAY create/edit .md plan files in .codebuddy/plans/
- Focus on understanding the problem, identifying affected files, and designing a solution
- When your research is complete, present a plan to the user

Available operations: read files, search code, analyze dependencies, reason about architecture.
Blocked operations: edit code, run commands, create source files.
</plan_mode>`;
}

/**
 * Reset plan mode state. Must be called between sessions in multi-session
 * server deployments to prevent state leakage.
 */
export function resetPlanMode(): void {
  _currentMode = AgentMode.DEFAULT;
  _planPath = null;
}
