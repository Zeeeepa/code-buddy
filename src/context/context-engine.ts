/**
 * ContextEngine — Pluggable context pipeline interface
 *
 * OpenClaw v2026.3.7 alignment: plugins can replace the entire context pipeline
 * via `plugins.slots.contextEngine`. Defines 6 lifecycle hooks.
 */

import type { CodeBuddyMessage } from '../codebuddy/client.js';

/**
 * Metadata passed alongside messages during context operations
 */
export interface ContextMeta {
  /** Current user query */
  userMessage?: string;
  /** Current model name */
  model?: string;
  /** Available token budget */
  tokenBudget?: number;
  /** Current turn number */
  turnNumber?: number;
  /** Additional metadata from plugins */
  [key: string]: unknown;
}

/**
 * Result of the assemble() hook
 */
export interface AssembleResult {
  /** Final assembled messages ready for LLM */
  messages: CodeBuddyMessage[];
  /** Token count of assembled messages */
  tokenCount: number;
}

/**
 * ContextEngine interface — 7 lifecycle hooks for full context pipeline control
 *
 * Plugins implement this interface to replace or wrap the default context pipeline.
 * Only one engine can be active at a time (last-registered wins).
 *
 * OpenClaw v2026.3.13-1 alignment: added onSubagentEnded (7th hook) and ownsCompaction flag.
 */
export interface ContextEngine {
  /** Unique identifier for this engine */
  readonly id: string;

  /**
   * When true, the runtime skips built-in auto-compact and delegates compaction
   * entirely to this engine's compact() hook. Without this, the runtime's
   * prepareMessagesRaw() would overwrite plugin-managed compaction.
   *
   * OpenClaw v2026.3.13-1 alignment.
   */
  readonly ownsCompaction?: boolean;

  /**
   * bootstrap — Called once when the engine is registered.
   * Use for initialization, loading caches, etc.
   */
  bootstrap(config: Record<string, unknown>): Promise<void> | void;

  /**
   * ingest — Called when new content enters the conversation.
   * Opportunity to index, tag, or transform incoming messages.
   */
  ingest(messages: CodeBuddyMessage[], meta: ContextMeta): CodeBuddyMessage[];

  /**
   * assemble — Build the final prompt from conversation history.
   * This is the main hook that replaces prepareMessages().
   * Must return messages that fit within the token budget.
   */
  assemble(messages: CodeBuddyMessage[], budget: number): AssembleResult;

  /**
   * compact — Compress messages when approaching context limits.
   * Called explicitly (e.g., /compact) or automatically by auto-compact.
   */
  compact(messages: CodeBuddyMessage[], targetTokens: number): CodeBuddyMessage[];

  /**
   * afterTurn — Post-processing after each LLM response.
   * Opportunity to extract facts, update indices, etc.
   */
  afterTurn(messages: CodeBuddyMessage[], response: CodeBuddyMessage): void;

  /**
   * prepareSubagentSpawn — Prepare context for a sub-agent.
   * Called when spawn_agent is invoked to create a context subset for the child.
   */
  prepareSubagentSpawn(messages: CodeBuddyMessage[], role: string): CodeBuddyMessage[];

  /**
   * onSubagentEnded — Cleanup after a sub-agent finishes or is closed.
   * Called from completeAgent() and closeAgent() in agent-tools.
   * Opportunity to merge sub-agent findings, release caches, etc.
   *
   * OpenClaw v2026.3.13-1 alignment (7th lifecycle hook).
   */
  onSubagentEnded?(agentId: string, messages: CodeBuddyMessage[], result?: string): void;
}
