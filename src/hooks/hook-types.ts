/**
 * Hook Types — Enterprise-grade handler types and extended events
 *
 * This module defines the type system for the extended hook infrastructure.
 * It introduces 4 handler types (command, http, prompt, agent) beyond
 * the existing HookManager's command-only approach, and adds new events
 * like PreCompact, PostCompact, SubagentStart, SubagentStop, and
 * PermissionRequest.
 *
 * @module hook-types
 */

/**
 * Extended hook events — superset of HookManager's HookEvent.
 *
 * Includes the original events (PreToolUse, PostToolUse, Notification,
 * Stop, SessionStart, SessionEnd, PreEdit, PostEdit, ConfigChange)
 * plus new ones for compaction, sub-agent lifecycle, and permission flow.
 */
export type ExtendedHookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'PreCompact'
  | 'PostCompact'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'PermissionRequest'
  | 'Notification'
  | 'Stop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreEdit'
  | 'PostEdit'
  | 'ConfigChange'
  // CC12: New events for Enterprise parity
  | 'UserPromptSubmit'
  | 'TeammateIdle'
  | 'TaskCompleted'
  | 'WorktreeCreate'
  | 'WorktreeRemove'
  | 'InstructionsLoaded'
  | 'ModelRequest'
  | 'ModelResponse';

/**
 * The 4 handler types supported by the extended hook system.
 *
 * - `command` — Shell command executed with JSON context on stdin
 * - `http` — HTTP POST to a URL with JSON context as body
 * - `prompt` — Prompt text evaluated by a small/fast model
 * - `agent` — Delegates to a named agent with restricted tools
 */
export type HookHandlerType = 'command' | 'http' | 'prompt' | 'agent';

/**
 * Shell command handler — executes a command with context on stdin.
 *
 * Exit code protocol:
 * - 0 = success (stdout parsed as JSON if possible)
 * - 2 = block the operation
 * - other = error
 */
export interface CommandHandler {
  type: 'command';
  /** Shell command to execute */
  command: string;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * HTTP webhook handler — POSTs context JSON to a URL.
 *
 * Response protocol:
 * - 200 = success (body parsed as JSON if possible)
 * - 403 = block the operation
 * - other = error
 */
export interface HttpHandler {
  type: 'http';
  /** URL to POST to */
  url: string;
  /** Additional HTTP headers */
  headers?: Record<string, string>;
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Prompt handler — evaluates a prompt with a small/fast model.
 *
 * The prompt receives the hook context as template variables.
 * The model returns a structured decision (allow/deny/reason).
 */
export interface PromptHandler {
  type: 'prompt';
  /** Prompt text for small model evaluation */
  prompt: string;
  /** Model to use (default: fast model from config) */
  model?: string;
}

/**
 * Agent handler — delegates hook evaluation to a named agent.
 *
 * The agent runs with restricted tool access (default: read-only)
 * and returns a structured decision.
 */
export interface AgentHandler {
  type: 'agent';
  /** Agent name or ID from the agent registry */
  agent: string;
  /** Allowed tools for the agent (default: read-only) */
  tools?: string[];
}

/**
 * Union of all handler types.
 */
export type HookHandler = CommandHandler | HttpHandler | PromptHandler | AgentHandler;

/**
 * An extended hook definition — combines an event, handler, and optional
 * pattern filter. Stored in `.codebuddy/hooks.json` under `extendedHooks`.
 */
export interface ExtendedHook {
  /** The event that triggers this hook */
  event: ExtendedHookEvent;
  /** The handler to execute when the event fires */
  handler: HookHandler;
  /** Regex pattern to match tool names (for tool-related events) */
  pattern?: string;
  /** Whether this hook is active (default: true) */
  enabled?: boolean;
  /** Human-readable description of this hook's purpose */
  description?: string;
}

/**
 * Result returned from running an extended hook.
 */
export interface ExtendedHookResult {
  /** Whether the hook executed successfully */
  success: boolean;
  /** Output text from the hook */
  output?: string;
  /** Error message if the hook failed */
  error?: string;
  /** If true, the triggering operation should be blocked */
  blocked?: boolean;
  /** Modified input arguments (merged back into tool args) */
  updatedInput?: Record<string, unknown>;
  /** Permission decision from PermissionRequest hooks */
  permissionDecision?: 'allow' | 'deny' | 'ask';
  /** Human-readable reason for the decision */
  reason?: string;
}

/**
 * Context object passed to hook handlers.
 *
 * Contains all relevant information about the event that triggered
 * the hook, including tool details, session info, and timestamps.
 */
export interface ExtendedHookContext {
  /** The event that triggered the hook */
  event: ExtendedHookEvent;
  /** Tool name (for PreToolUse/PostToolUse/PostToolUseFailure events) */
  toolName?: string;
  /** Tool arguments (for PreToolUse events) */
  toolArgs?: Record<string, unknown>;
  /** Tool result (for PostToolUse events) */
  toolResult?: { success: boolean; output?: string; error?: string };
  /** Current session ID */
  sessionId?: string;
  /** Agent ID (for SubagentStart/SubagentStop events) */
  agentId?: string;
  /** Notification or stop message */
  message?: string;
  /** File path (for PreEdit/PostEdit events) */
  filePath?: string;
  /** Timestamp of the event */
  timestamp: Date;
  // CC12: New context fields
  /** User prompt text (for UserPromptSubmit) */
  userPrompt?: string;
  /** Model name (for ModelRequest/ModelResponse) */
  model?: string;
  /** Request/response token counts (for ModelRequest/ModelResponse) */
  tokenCount?: number;
  /** Worktree path (for WorktreeCreate/WorktreeRemove) */
  worktreePath?: string;
  /** Instruction file paths loaded (for InstructionsLoaded) */
  instructionFiles?: string[];
  /** Task ID (for TaskCompleted) */
  taskId?: string;
  /** Error details (for PostToolUseFailure) */
  error?: string;
}
