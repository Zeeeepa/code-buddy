/**
 * Agent Executor Module
 *
 * Implements the core agentic loop for processing user messages,
 * both sequential and streaming. Handles tool execution rounds,
 * token counting, cost tracking, and context management.
 *
 * @module agent/execution
 */

import { CodeBuddyClient, CodeBuddyMessage } from "../../codebuddy/client.js";
import { ChatEntry, StreamingChunk } from "../types.js";
import { ToolHandler } from "../tool-handler.js";
import { ToolSelectionStrategy } from "./tool-selection-strategy.js";
import { StreamingHandler, RawStreamingChunk } from "../streaming/index.js";
import { ContextManagerV2 } from "../../context/context-manager-v2.js";
import { TokenCounter } from "../../utils/token-counter.js";
import { logger } from "../../utils/logger.js";
import { getErrorMessage } from "../../errors/index.js";
import { sanitizeToolResult } from "../../utils/sanitize.js";
import {
  prepareTurnMessages,
  injectInitialContext,
  injectNextRoundContext,
  sanitizeAssistantOutput,
} from "./context-pipeline.js";
import { extractYieldChildId, processYieldSignal } from "./yield-coordinator.js";
import {
  runPreToolUseHook,
  pushBlockedToolMessage,
  runPostToolUseHook,
  recordToolMetric,
} from "./tool-hooks.js";
import {
  extractTerminateMessage,
  extractSignalMessage,
  INTERACTIVE_SHELL_SIGNAL,
  PLAN_APPROVAL_SIGNAL,
} from "./turn-signals.js";
import {
  persistToolResult,
  applyObservationVariator,
  logYoloCostIfEnabled,
} from "./post-tool-handlers.js";
import type { LaneQueue } from "../../concurrency/lane-queue.js";
import type { MiddlewarePipeline, MiddlewareContext } from "../middleware/index.js";
import type { MessageQueue } from "../message-queue.js";
import { semanticTruncate } from "../../utils/head-tail-truncation.js";
import { getRestorableCompressor } from "../../context/restorable-compression.js";
import { getResponseConstraintStack, resolveToolChoice } from "../response-constraint.js";
import type { ICMBridge } from "../../memory/icm-bridge.js";
import { shouldCompactBeforeToolExec, estimateToolResultTokens } from "../../context/proactive-compaction.js";
import { formatTokenUsage, estimateCost } from "../../utils/token-display.js";
import { classifyQuery } from "./query-classifier.js";

/**
 * Race a promise against a timeout, returning the fallback value if the
 * promise doesn't settle within `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Lazy-loaded workspace context to avoid blocking tests.
// Includes a 3s hard timeout so git commands never stall the agent loop.
let _getWorkspaceContext: ((cwd: string) => Promise<string>) | null = null;
async function lazyGetWorkspaceContext(cwd: string): Promise<string> {
  try {
    if (!_getWorkspaceContext) {
      const mod = await import("../../context/workspace-context.js");
      _getWorkspaceContext = mod.getWorkspaceContext;
    }
    const result = await Promise.race([
      _getWorkspaceContext(cwd),
      new Promise<string>((resolve) => setTimeout(() => resolve(''), 3000)),
    ]);
    return result;
  } catch {
    return '';
  }
}

/**
 * Register an ICM bridge provider for cross-session memory.
 * Called by CodeBuddyAgent to wire up ICM without tight coupling.
 */
let _icmBridgeProvider: (() => ICMBridge | null) | null = null;
export function setICMBridgeProvider(
  provider: () => ICMBridge | null
): void {
  _icmBridgeProvider = provider;
}

/**
 * Register a code graph context provider for per-turn injection.
 * Called by CodeBuddyAgent to wire up code graph without tight coupling.
 */
let _codeGraphContextProvider: ((message: string) => string | null) | null = null;
export function setCodeGraphContextProvider(
  provider: (message: string) => string | null
): void {
  _codeGraphContextProvider = provider;
}

/** Register a docs context provider for per-turn injection. */
let _docsContextProvider: ((message: string) => string | null) | null = null;
export function setDocsContextProvider(
  provider: (message: string) => string | null
): void {
  _docsContextProvider = provider;
}

/**
 * Register a decision-context provider for the executor.
 * Called externally (e.g., by CodeBuddyAgent) to wire up decision memory
 * without incurring dynamic import cost in the hot loop.
 */
let _decisionContextProvider: ((query: string) => Promise<string | null>) | null = null;
export function setDecisionContextProvider(
  provider: (query: string) => Promise<string | null>
): void {
  _decisionContextProvider = provider;
}

/**
 * Dependencies injected into the AgentExecutor
 */
export interface ExecutorDependencies {
  /** API client for LLM communication */
  client: CodeBuddyClient;
  /** Dispatcher for tool execution */
  toolHandler: ToolHandler;
  /** RAG-based tool selection for query optimization */
  toolSelectionStrategy: ToolSelectionStrategy;
  /** Handles streaming response accumulation */
  streamingHandler: StreamingHandler;
  /** Manages context window and message compression */
  contextManager: ContextManagerV2;
  /** Counts tokens for cost calculation */
  tokenCounter: TokenCounter;
  /** Optional: ICM cross-session memory bridge */
  icmBridgeProvider?: () => ICMBridge | null;
  /** Optional: Code graph context provider */
  codeGraphContextProvider?: (message: string) => string | null;
  /** Optional: Documentation context provider */
  docsContextProvider?: (message: string) => string | null;
  /** Optional: Decision memory context provider */
  decisionContextProvider?: (query: string) => Promise<string | null>;
  /** Optional lane queue for serialized tool execution */
  laneQueue?: LaneQueue;
  /** Lane ID for tool execution serialization (defaults to 'default') */
  laneId?: string;
  /** Optional middleware pipeline for composable loop control */
  middlewarePipeline?: MiddlewarePipeline;
  /** Optional message queue for steer/followup/collect modes */
  messageQueue?: MessageQueue;
}

/**
 * Runtime configuration for the AgentExecutor
 */
export interface ExecutorConfig {
  /** Maximum tool execution rounds before stopping (prevents infinite loops) */
  maxToolRounds: number;
  /** Returns true if current model is a Grok model (enables web search) */
  isGrokModel: () => boolean;
  /** Records token usage for cost tracking (additive — call once per turn) */
  recordSessionCost: (input: number, output: number) => void;
  /** Returns true if session cost limit has been reached */
  isSessionCostLimitReached: () => boolean;
  /** Estimate whether cost limit would be reached after recording given tokens (no side effects) */
  estimateSessionCostLimitReached: (input: number, output: number) => boolean;
  /** Returns current accumulated session cost in USD */
  getSessionCost: () => number;
  /** Returns maximum allowed session cost in USD */
  getSessionCostLimit: () => number;
  /** Enable auto-discovery hint when tool confidence is low */
  enableAutoDiscovery?: boolean;
  /** Confidence threshold below which the auto-discovery hint is injected (default: 0.3) */
  skillDiscoveryThreshold?: number;
  /**
   * Single-tool mode (Manus AI pattern): only execute toolCalls[0] per iteration,
   * re-enqueue remaining calls for the next round. Useful for complex orchestration
   * where sequential tool execution is preferred.
   */
  singleToolMode?: boolean;
}

/**
 * AgentExecutor implements the core agentic loop
 *
 * The agentic loop follows this pattern:
 * 1. Select relevant tools for the query (RAG-based)
 * 2. Send message to LLM with selected tools
 * 3. If LLM requests tool calls, execute them
 * 4. Send tool results back to LLM
 * 5. Repeat until LLM responds without tool calls or max rounds reached
 *
 * Supports both sequential (processUserMessage) and streaming
 * (processUserMessageStream) execution modes.
 */
export class AgentExecutor {
  private static parseTimeoutEnv(varName: string, fallbackMs: number): number {
    const value = Number(process.env[varName]);
    return Number.isFinite(value) && value >= 1000 ? value : fallbackMs;
  }

  private getLaneTaskTimeoutMs(isParallel: boolean): number {
    const readTimeoutMs = AgentExecutor.parseTimeoutEnv(
      'CODEBUDDY_LANE_READ_TIMEOUT_MS',
      120000
    );
    const toolTimeoutMs = AgentExecutor.parseTimeoutEnv(
      'CODEBUDDY_LANE_TOOL_TIMEOUT_MS',
      300000
    );
    return isParallel ? readTimeoutMs : toolTimeoutMs;
  }

  constructor(
    private deps: ExecutorDependencies,
    private config: ExecutorConfig
  ) {}

  /** Get ICM bridge provider (DI first, then global fallback) */
  private getICMBridgeProvider(): (() => ICMBridge | null) | null {
    return this.deps.icmBridgeProvider ?? _icmBridgeProvider;
  }

  /** Get code graph context provider (DI first, then global fallback) */
  private getCodeGraphContextProvider(): ((message: string) => string | null) | null {
    return this.deps.codeGraphContextProvider ?? _codeGraphContextProvider;
  }

  /** Get docs context provider (DI first, then global fallback) */
  private getDocsContextProvider(): ((message: string) => string | null) | null {
    return this.deps.docsContextProvider ?? _docsContextProvider;
  }

  /** Get decision context provider (DI first, then global fallback) */
  private getDecisionContextProvider(): ((query: string) => Promise<string | null>) | null {
    return this.deps.decisionContextProvider ?? _decisionContextProvider;
  }

  /**
   * Get or set the middleware pipeline.
   * Used by CodeBuddyAgent.enableAutoObservation() to inject middleware.
   */
  getMiddlewarePipeline(): MiddlewarePipeline | undefined {
    return this.deps.middlewarePipeline;
  }

  setMiddlewarePipeline(pipeline: MiddlewarePipeline): void {
    this.deps.middlewarePipeline = pipeline;
  }

  /**
   * Build a MiddlewareContext from current loop state.
   */
  private buildMiddlewareContext(
    toolRound: number,
    inputTokens: number,
    outputTokens: number,
    history: ChatEntry[],
    messages: CodeBuddyMessage[],
    isStreaming: boolean,
    abortController?: AbortController | null
  ): MiddlewareContext {
    return {
      toolRound,
      maxToolRounds: this.config.maxToolRounds,
      sessionCost: this.config.getSessionCost(),
      sessionCostLimit: this.config.getSessionCostLimit(),
      inputTokens,
      outputTokens,
      history,
      messages,
      isStreaming,
      abortController,
    };
  }

  /**
   * Determine if a tool call can run in parallel.
   * Uses `wait_for_previous` from tool args (Gemini CLI pattern) with fallback to static set.
   */
  private isToolParallelizable(toolCall: { function: { name: string; arguments?: string } }): boolean {
    // Check explicit wait_for_previous flag in args (LLM-controlled parallelism)
    try {
      const args = JSON.parse(toolCall.function.arguments || '{}');
      if (typeof args.wait_for_previous === 'boolean') {
        return !args.wait_for_previous;
      }
    } catch { /* parse failure — use fallback */ }

    // Fallback: read-only tools are parallel-safe
    const readOnlyTools = new Set([
      'grep', 'glob', 'read_file', 'list_files', 'search_files',
      'get_file_info', 'tree', 'find_references',
    ]);
    return readOnlyTools.has(toolCall.function.name);
  }

  /**
   * Execute a tool call, optionally through the LaneQueue for serialization.
   * Supports LLM-controlled parallelism via `wait_for_previous` parameter.
   */
  private executeToolViaLane(toolCall: Parameters<ToolHandler['executeTool']>[0]): ReturnType<ToolHandler['executeTool']> {
    const laneQueue = this.deps.laneQueue;
    if (!laneQueue) {
      return this.deps.toolHandler.executeTool(toolCall);
    }

    const laneId = this.deps.laneId ?? 'default';
    const isParallel = this.isToolParallelizable(toolCall);
    const timeoutMs = this.getLaneTaskTimeoutMs(isParallel);

    return laneQueue.enqueue(
      laneId,
      () => this.deps.toolHandler.executeTool(toolCall),
      {
        parallel: isParallel,
        category: toolCall.function.name,
        timeout: timeoutMs,
      }
    );
  }

  /**
   * Compute adaptive compaction threshold based on the model's context window.
   * Reserves ~30% of context for tool results; rest for system prompt + history.
   * Falls back to 70K chars if model info unavailable.
   */
  private getAdaptiveCompactionThreshold(): number {
    try {
      const modelName = this.deps.client.getCurrentModel();
      const { getModelToolConfig } = require('../../config/model-tools.js');
      const config = getModelToolConfig(modelName);
      const contextChars = (config.contextWindow ?? 128_000) * 4; // ~4 chars/token
      // Allocate 30% of context window for tool results
      return Math.max(40_000, Math.floor(contextChars * 0.3));
    } catch {
      return 70_000; // Fallback
    }
  }

  /**
   * Tool Result Compaction Guard (Native Engine / Manus AI #13)
   *
   * Before each model call, scan accumulated tool result messages.
   * If their total size exceeds an adaptive threshold (scaled to model context),
   * compress the oldest ones using RestorableCompressor — replacing full content
   * with a compact stub referencing the callId. The content remains restorable
   * via the `restore_context` tool.
   *
   * This prevents deep agent chains from silently overflowing the context window.
   */
  private compactLargeToolResults(
    preparedMessages: CodeBuddyMessage[],
    maxToolResultChars?: number
  ): CodeBuddyMessage[] {
    const threshold = maxToolResultChars ?? this.getAdaptiveCompactionThreshold();
    // Sum characters from tool result messages
    let totalToolChars = 0;
    for (const m of preparedMessages) {
      if (m.role === 'tool' && typeof m.content === 'string') {
        totalToolChars += m.content.length;
      }
    }

    if (totalToolChars <= threshold) return preparedMessages;

    const compressor = getRestorableCompressor();
    // Compress oldest tool results first (front of the list)
    const result = [...preparedMessages];
    let charsToFree = totalToolChars - threshold;

    for (let i = 0; i < result.length && charsToFree > 0; i++) {
      const m = result[i];
      if (m.role === 'tool' && typeof m.content === 'string' && m.content.length > 500) {
        const callId = (m as { tool_call_id?: string }).tool_call_id || `tool_${i}`;
        const compressed = compressor.compress([{
          role: m.role,
          content: m.content,
          tool_call_id: callId,
        }]);
        if (compressed.messages[0]) {
          charsToFree -= (m.content.length - (compressed.messages[0].content?.length ?? 0));
          result[i] = { ...m, content: compressed.messages[0].content ?? m.content };
        }
      }
    }

    logger.debug(`ToolResultCompactionGuard: compacted tool results`, {
      before: totalToolChars,
      freed: totalToolChars - charsToFree,
    });

    return result;
  }

  /**
   * Process a user message sequentially (non-streaming)
   *
   * @param message - The user's input message
   * @param history - Chat history array (modified in place)
   * @param messages - LLM message array (modified in place)
   * @returns Array of new chat entries created during this turn
   */
  /**
   * Shared pre-processing for user messages across the sequential and
   * streaming agentic loops.
   *
   * Extracted from previously-duplicated code in processUserMessage and
   * processUserMessageStream (F10): handles @mention expansion, fires
   * persona auto-selection, and feeds the knowledge graph in the
   * background. Returns the cleaned message (with `@web` / `@git` /
   * `@terminal` markers removed). Both paths must call this before
   * entering their respective main loops so the loops stay parity.
   *
   * All sub-steps are best-effort: any individual failure is swallowed at
   * debug level so a broken plugin cannot break the main loop.
   */
  private async preprocessUserMessage(
    message: string,
    messages: CodeBuddyMessage[],
  ): Promise<string> {
    // 1. Process @mentions and inject context blocks
    try {
      const { processMentions } = await import('../../input/context-mentions.js');
      const mentionResult = await processMentions(message);
      if (mentionResult.contextBlocks.length > 0) {
        message = mentionResult.cleanedMessage;
        // Update the last user message in the messages array to match
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg && typeof lastUserMsg.content === 'string') {
          lastUserMsg.content = message;
        }
        for (const block of mentionResult.contextBlocks) {
          messages.push({
            role: 'system' as const,
            content: `<context type="${block.type}" source="${block.source}">\n${block.content}\n</context>`,
          });
        }
      }
    } catch { /* mention processing optional */ }

    // 2. Auto-select persona (fire-and-forget, no await needed)
    try {
      const { getPersonaManager } = await import('../../personas/persona-manager.js');
      getPersonaManager().autoSelectPersona({ message });
    } catch { /* persona auto-select optional */ }

    // 3. Auto-extract entities into the knowledge graph (background)
    try {
      const { getKnowledgeGraph, isTrivialMessage } = await import('../../memory/knowledge-graph.js');
      if (!isTrivialMessage(message)) {
        const kg = getKnowledgeGraph();
        await kg.load();
        kg.extractFromMessageDeduped(message);
      }
    } catch { /* non-critical */ }

    return message;
  }

  async processUserMessage(
    message: string,
    history: ChatEntry[],
    messages: CodeBuddyMessage[]
  ): Promise<ChatEntry[]> {
    const newEntries: ChatEntry[] = [];
    const maxToolRounds = this.config.maxToolRounds;
    let toolRounds = 0;

    // Shared pre-processing: @mentions, persona auto-select, knowledge
    // graph extraction. Factored into preprocessUserMessage so the
    // streaming path stays in parity with this one (F10).
    message = await this.preprocessUserMessage(message, messages);

    // Track token usage for cost calculation (recalculated each round for accuracy)
    let inputTokens = this.deps.tokenCounter.countMessageTokens(messages as Parameters<typeof this.deps.tokenCounter.countMessageTokens>[0]);
    let totalOutputTokens = 0;

    try {
      // Use RAG-based tool selection for initial query
      const selectionResult = await this.deps.toolSelectionStrategy.selectToolsForQuery(message);
      const tools = selectionResult.tools;
      this.deps.toolSelectionStrategy.cacheTools(tools);

      // Auto-discovery hint: if confidence is low, nudge agent to discover skills
      const enableAutoDiscovery = this.config.enableAutoDiscovery ?? true;
      const threshold = this.config.skillDiscoveryThreshold ?? 0.3;
      if (enableAutoDiscovery && selectionResult.confidence !== undefined && selectionResult.confidence < threshold) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user' && typeof lastMsg.content === 'string') {
          messages.push({
            role: 'system' as const,
            content: '<context type="observation">\nLow tool confidence for this query. Consider using the `skill_discover` tool to search the Skills Hub for relevant capabilities.\n</context>',
          });
        }
      }

      // Persona auto-select + knowledge graph extraction moved to
      // preprocessUserMessage() above (F10).

      // Run before_turn middleware (sequential path)
      const pipeline = this.deps.middlewarePipeline;
      if (pipeline) {
        const ctx = this.buildMiddlewareContext(
          toolRounds, inputTokens, totalOutputTokens, history, messages, false
        );
        const mwResult = await pipeline.runBeforeTurn(ctx);
        if (mwResult.action === 'stop') {
          if (mwResult.message) {
            const stopEntry: ChatEntry = { type: 'assistant', content: mwResult.message, timestamp: new Date() };
            history.push(stopEntry);
            messages.push({ role: 'assistant', content: mwResult.message });
            return [stopEntry];
          }
          return [];
        }
        if (mwResult.action === 'compact') {
          this.deps.contextManager.prepareMessages(messages);
        }
        if (mwResult.action === 'warn' && mwResult.message) {
          logger.warn(`Middleware warning: ${mwResult.message}`);
          // Surface the warning to the user via a visible ChatEntry so the
          // Ink TUI renders it (previously the message was only pushed to
          // the system context for the LLM; the user saw nothing — defeating
          // the whole point of ContextWarningMiddleware).
          const warnEntry: ChatEntry = {
            type: 'assistant',
            content: `⚠️  ${mwResult.message}`,
            timestamp: new Date(),
          };
          history.push(warnEntry);
          newEntries.push(warnEntry);
          messages.push({
            role: 'system' as const,
            content: `<context type="middleware-hint">\n${mwResult.message}\n</context>`,
          });
        }
      }

      // Apply context management + transcript repair (Native Engine v2026.3.11)
      const preparedMessages = prepareTurnMessages(this.deps.contextManager, messages);

      // --- Query-aware context injection (saves ~15-20K tokens for trivial messages) ---
      const { injection: ctxLevel, complexity: queryComplexity } = classifyQuery(message);
      logger.debug(`Query classified as '${queryComplexity}' — context injection level: ${JSON.stringify(ctxLevel)}`);

      await injectInitialContext(preparedMessages, {
        message,
        cwd: process.cwd(),
        ctxLevel,
        loadWorkspaceContext: lazyGetWorkspaceContext,
        decisionContextProvider: this.getDecisionContextProvider(),
        icmBridgeProvider: this.getICMBridgeProvider(),
        codeGraphContextProvider: this.getCodeGraphContextProvider(),
        docsContextProvider: this.getDocsContextProvider(),
      });

      // Check for context warnings
      const contextWarning = this.deps.contextManager.shouldWarn(preparedMessages);
      if (contextWarning.warn) {
        logger.warn(contextWarning.message);

        // --- Native Engine pre-compaction memory flush (NO_REPLY pattern) ---
        // Run a silent background turn to extract facts to MEMORY.md before context is compacted.
        try {
          const { getPrecompactionFlusher } = await import('../../context/precompaction-flush.js');
          const flusher = getPrecompactionFlusher();
          const flushResult = await flusher.flush(
            preparedMessages.filter(m => m.role !== 'system').map(m => ({
              role: m.role as 'user' | 'assistant',
              content: typeof m.content === 'string' ? m.content : '',
            })),
            async (flushMsgs) => {
              const r = await this.deps.client.chat(
                flushMsgs.map(m => ({ role: m.role, content: m.content })),
                [],
              );
              return r.choices[0]?.message?.content ?? 'NO_REPLY';
            }
          );
          if (flushResult.flushed) {
            logger.info(`Pre-compaction flush: saved ${flushResult.factsCount} facts to ${flushResult.writtenTo}`);
          }
        } catch (flushErr) {
          logger.debug('Pre-compaction flush failed (non-critical)', { flushErr });
        }
      }

      // Pre-call cost estimation: warn if estimated cost would exceed limit
      const estimatedInputTokens = this.deps.tokenCounter.countMessageTokens(
        preparedMessages as Parameters<typeof this.deps.tokenCounter.countMessageTokens>[0]
      );
      if (estimatedInputTokens > 0) {
        // Rough estimate: input cost + expected output cost (~1/4 of input)
        const estimatedTotalTokens = estimatedInputTokens + Math.floor(estimatedInputTokens * 0.25);
        logger.debug(`Pre-call cost estimate: ~${estimatedInputTokens} input tokens, ~${estimatedTotalTokens} total`);
      }

      // Apply response constraint (Manus AI response prefill / tool_choice control)
      const activeConstraint = getResponseConstraintStack().current();
      const toolNames = tools.map(t => t.function.name);
      const toolChoiceOverride = resolveToolChoice(activeConstraint, toolNames);

      let currentResponse = await this.deps.client.chat(
        preparedMessages,
        tools,
        { tool_choice: toolChoiceOverride !== 'auto' ? toolChoiceOverride : undefined } as never,
        this.config.isGrokModel() && this.deps.toolSelectionStrategy.shouldUseSearchFor(message)
          ? { search_parameters: { mode: "auto" } }
          : { search_parameters: { mode: "off" } }
      );

      // Agent loop
      let terminateDetected = false;
      while (toolRounds < maxToolRounds) {
        const assistantMessage = currentResponse.choices[0]?.message;

        if (!assistantMessage) {
          throw new Error("No response received from AI. The API may be unavailable or the request was incomplete. Please try again.");
        }

        // Sanitize assistant content: strip model control tokens and invisible chars
        if (assistantMessage.content) {
          assistantMessage.content = sanitizeAssistantOutput(assistantMessage.content);
        }

        // Track output tokens
        if (currentResponse.usage) {
          totalOutputTokens += currentResponse.usage.completion_tokens || 0;
        } else if (assistantMessage.content) {
          totalOutputTokens += this.deps.tokenCounter.countTokens(assistantMessage.content);
        }

        // Handle tool calls
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          toolRounds++;

          // Add assistant message with tool calls
          const assistantEntry: ChatEntry = {
            type: "assistant",
            content: assistantMessage.content || "Using tools to help you...",
            timestamp: new Date(),
            toolCalls: assistantMessage.tool_calls,
          };
          history.push(assistantEntry);
          newEntries.push(assistantEntry);

          // Add assistant message to conversation
          messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
            tool_calls: assistantMessage.tool_calls,
          });

          // Pre-check cost limit before executing tools (estimate only — no side effects)
          if (this.config.estimateSessionCostLimitReached(inputTokens, totalOutputTokens)) {
            const sessionCost = this.config.getSessionCost();
            const sessionCostLimit = this.config.getSessionCostLimit();
            const costEntry: ChatEntry = {
              type: "assistant",
              content: `Session cost limit reached ($${sessionCost.toFixed(2)} / $${sessionCostLimit.toFixed(2)}). Stopping before tool execution.`,
              timestamp: new Date(),
            };
            history.push(costEntry);
            messages.push({ role: "assistant", content: costEntry.content });
            newEntries.push(costEntry);
            break;
          }

          // Single-tool mode: only execute first tool call, re-enqueue rest for next round
          const toolCallsToExecute = this.config.singleToolMode
            ? [assistantMessage.tool_calls[0]]
            : assistantMessage.tool_calls;

          // Re-enqueue deferred calls as synthetic assistant message for next iteration
          if (this.config.singleToolMode && assistantMessage.tool_calls.length > 1) {
            const deferred = assistantMessage.tool_calls.slice(1);
            messages.push({
              role: 'assistant',
              content: null,
              tool_calls: deferred,
            } as CodeBuddyMessage);
            logger.debug(`Single-tool mode: deferred ${deferred.length} tool calls to next round`);
          }

          // Execute tool calls
          for (const toolCall of toolCallsToExecute) {
            // --- Proactive context compaction: predict overflow before tool runs ---
            try {
              const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
              const estimatedTokens = estimateToolResultTokens(toolCall.function.name, toolArgs);
              const modelName = this.deps.client.getCurrentModel();
              const { getModelToolConfig } = await import('../../config/model-tools.js');
              const modelConfig = getModelToolConfig(modelName);
              const contextWindow = modelConfig.contextWindow ?? 128_000;
              if (shouldCompactBeforeToolExec(inputTokens, estimatedTokens, contextWindow)) {
                logger.debug('Proactive compaction: compacting before tool execution', {
                  toolName: toolCall.function.name,
                  inputTokens,
                  estimatedTokens,
                  contextWindow,
                });
                this.deps.contextManager.prepareMessages(messages);
                inputTokens = this.deps.tokenCounter.countMessageTokens(
                  messages as Parameters<typeof this.deps.tokenCounter.countMessageTokens>[0]
                );
              }
            } catch { /* proactive compaction is non-critical */ }

            const toolCallEntry: ChatEntry = {
              type: "tool_call",
              content: "Executing...",
              timestamp: new Date(),
              toolCall: toolCall,
            };
            const histIdx = history.length;
            history.push(toolCallEntry);
            const newIdx = newEntries.length;
            newEntries.push(toolCallEntry);

            // --- User hooks: PreToolUse ---
            const preHookResult = await runPreToolUseHook(process.cwd(), toolCall);
            if (!preHookResult.allowed) {
              const blockedEntry: ChatEntry = {
                ...toolCallEntry,
                type: 'tool_result',
                content: preHookResult.feedback ?? 'Action blocked by PreToolUse hook',
                toolResult: { success: false, error: preHookResult.feedback ?? 'Blocked by hook' },
              };
              history[histIdx] = blockedEntry;
              newEntries[newIdx] = blockedEntry;
              pushBlockedToolMessage(messages, toolCall, preHookResult.feedback);
              continue;
            }

            const _toolStartMs = Date.now();
            const result = await this.executeToolViaLane(toolCall);
            // --- User hooks: PostToolUse / PostToolUseFailure ---
            await runPostToolUseHook(process.cwd(), toolCall, result);
            // --- Per-tool metrics (DeepWiki gap #3) ---
            await recordToolMetric(toolCall.function.name, result.success, Date.now() - _toolStartMs);

            // --- Track file access for code graph context (incremental update) ---
            try {
              const fileTools = new Set(['view_file', 'create_file', 'str_replace_editor', 'file_read', 'file_write']);
              if (fileTools.has(toolCall.function.name)) {
                const args = JSON.parse(toolCall.function.arguments || '{}');
                const filePath = args.path || args.file_path || args.target_file || '';
                if (filePath) {
                  const { trackRecentFile } = await import('../../knowledge/code-graph-context-provider.js');
                  trackRecentFile(filePath);
                  // Incremental graph update for write operations
                  if (['create_file', 'str_replace_editor', 'file_write'].includes(toolCall.function.name)) {
                    const { getKnowledgeGraph } = await import('../../knowledge/knowledge-graph.js');
                    const kg = getKnowledgeGraph();
                    if (kg.getStats().tripleCount > 0) {
                      const { updateGraphForFile } = await import('../../knowledge/graph-updater.js');
                      const path = await import('path');
                      const absPath = path.default.resolve(process.cwd(), filePath);
                      updateGraphForFile(kg, absPath, process.cwd());
                    }
                  }
                }
              }
            } catch { /* file tracking is optional */ }

            // --- JIT context discovery: load subdirectory context files ---
            try {
              const fileToolsJit = new Set(['view_file', 'create_file', 'str_replace_editor', 'file_read', 'file_write', 'read_file', 'grep', 'glob']);
              if (fileToolsJit.has(toolCall.function.name)) {
                const args = JSON.parse(toolCall.function.arguments || '{}');
                const filePath = args.path || args.file_path || args.target_file || args.pattern || '';
                if (filePath) {
                  const { discoverJitContext } = await import('../../context/jit-context.js');
                  const jitContext = discoverJitContext(filePath);
                  if (jitContext) {
                    preparedMessages.push({ role: 'system', content: jitContext });
                  }
                }
              }
            } catch { /* JIT context is optional */ }

            // --- Disk-backed tool result (Manus AI #19) ---
            const rawToolContent = sanitizeToolResult(result.success ? result.output || "Success" : result.error || "Error");
            persistToolResult(toolCall.id, rawToolContent);

            // --- Observation Variator (Manus AI #17) ---
            const variedContent = applyObservationVariator(toolCall.function.name, rawToolContent);

            // Update entry with result
            const updatedEntry: ChatEntry = {
              ...toolCallEntry,
              type: "tool_result",
              content: result.success ? result.output || "Success" : result.error || "Error occurred",
              toolResult: result,
            };

            // Replace in history and newEntries using tracked indices (O(1))
            history[histIdx] = updatedEntry;
            newEntries[newIdx] = updatedEntry;

            // Add tool result to messages (with observation variation applied)
            // Note: 'name' is required for Gemini API to match functionResponse with functionCall
            messages.push({
              role: "tool",
              content: variedContent,
              tool_call_id: toolCall.id || `tool_${Date.now()}`,
              name: toolCall.function.name,
            } as CodeBuddyMessage);

            // --- Auto-commit after file-modifying tools ---
            if (result.success) {
              try {
                const { maybeAutoCommit } = await import('../../tools/auto-commit.js');
                const acResult = await maybeAutoCommit(
                  toolCall.function.name,
                  toolCall.function.arguments || '{}',
                  rawToolContent.substring(0, 120),
                );
                if (acResult?.success) {
                  logger.debug('Auto-commit:', { hash: acResult.commitHash });
                } else if (acResult && acResult.message && /failed/i.test(acResult.message)) {
                  // A real commit failure (stage/commit error) — not a benign
                  // "no files to commit" or "not a git repo". Surface it to the
                  // user so disk-full / repo-lock / pre-commit-hook issues are
                  // not silently swallowed.
                  logger.warn(`Auto-commit failed: ${acResult.message}`);
                }
              } catch (err) {
                logger.debug('Auto-commit threw', { err: err instanceof Error ? err.message : String(err) });
              }
            }

            // --- Fix 11: YOLO cost display after each tool ---
            await logYoloCostIfEnabled(this.config);

            // --- Terminate signal detection (OpenManus #5) ---
            const terminateMsg = extractTerminateMessage(rawToolContent);
            if (terminateMsg !== null) {
              const terminateEntry: ChatEntry = {
                type: 'assistant',
                content: terminateMsg,
                timestamp: new Date(),
              };
              history.push(terminateEntry);
              messages.push({ role: 'assistant', content: terminateEntry.content });
              newEntries.push(terminateEntry);
              terminateDetected = true;
              break;
            }

            // --- Yield signal detection (Native Engine v2026.3.14) ---
            const yieldChildId = extractYieldChildId(rawToolContent);
            if (yieldChildId) {
              await processYieldSignal(yieldChildId, messages);
            }
          }

          // Break outer loop if terminate tool was called
          if (terminateDetected) break;

          // Run after_turn middleware (sequential path)
          if (pipeline) {
            const ctx = this.buildMiddlewareContext(
              toolRounds, inputTokens, totalOutputTokens, history, messages, false
            );
            const mwResult = await pipeline.runAfterTurn(ctx);
            if (mwResult.action === 'stop') {
              if (mwResult.message) {
                const stopEntry: ChatEntry = { type: 'assistant', content: mwResult.message, timestamp: new Date() };
                history.push(stopEntry);
                messages.push({ role: 'assistant', content: mwResult.message });
                newEntries.push(stopEntry);
              }
              break;
            }
            if (mwResult.action === 'warn' && mwResult.message) {
              logger.warn(`Middleware after-turn warning: ${mwResult.message}`);
              // Surface after-turn warnings to the user (parity with before-turn).
              const warnEntry: ChatEntry = {
                type: 'assistant',
                content: `⚠️  ${mwResult.message}`,
                timestamp: new Date(),
              };
              history.push(warnEntry);
              newEntries.push(warnEntry);
            }
          }
          // Note: cost is recorded once at end-of-loop, not here (avoids double-counting)

          // Apply TTL-based tool result expiry + image pruning + backward-scanned FIFO masking before compaction
          try {
            const { applyToolOutputMasking, expireOldToolResults, pruneImageContent } = await import('../../context/tool-output-masking.js');
            expireOldToolResults(messages, toolRounds);
            pruneImageContent(messages);
            applyToolOutputMasking(messages);
          } catch { /* masking is optional */ }

          // Get next response (with tool result compaction guard + transcript repair)
          const nextPreparedMessages = this.compactLargeToolResults(
            prepareTurnMessages(this.deps.contextManager, messages)
          );

          await injectNextRoundContext(nextPreparedMessages, {
            message,
            cwd: process.cwd(),
            queryComplexity,
          });

          currentResponse = await this.deps.client.chat(
            nextPreparedMessages,
            tools,
            undefined,
            this.config.isGrokModel() && this.deps.toolSelectionStrategy.shouldUseSearchFor(message)
              ? { search_parameters: { mode: "auto" } }
              : { search_parameters: { mode: "off" } }
          );
        } else {
          // No more tool calls
          const finalEntry: ChatEntry = {
            type: "assistant",
            content: assistantMessage.content || "I understand, but I don't have a specific response.",
            timestamp: new Date(),
          };
          history.push(finalEntry);
          messages.push({
            role: "assistant",
            content: assistantMessage.content || "",
          });
          newEntries.push(finalEntry);

          // Fire-and-forget auto-capture on final assistant response
          try {
            const { getAutoCaptureManager } = await import('../../memory/auto-capture.js');
            const acm = getAutoCaptureManager();
            if (acm) {
              acm.processMessage('assistant', assistantMessage.content || '').catch(err => logger.debug('Auto-capture failed', { error: String(err) }));
            }
          } catch { /* auto-capture optional */ }

          // Fire-and-forget ICM episode storage
          if (this.getICMBridgeProvider()) {
            try {
              const icm = this.getICMBridgeProvider()!();
              if (icm?.isAvailable()) {
                const episode = `User: ${message}\nAssistant: ${(assistantMessage.content || '').substring(0, 500)}`;
                icm.storeEpisode(episode, {
                  source: 'agent-executor',
                  sessionId: process.env.CODEBUDDY_SESSION_ID,
                  turnNumber: toolRounds,
                }).catch(err => logger.debug('ICM episode store failed', { error: String(err) }));
              }
            } catch { /* ICM store optional */ }
          }

          // Context engine afterTurn hook (Native Engine v2026.3.7)
          try {
            const engine = this.deps.contextManager.getContextEngine?.();
            if (engine) {
              engine.afterTurn(messages, { role: 'assistant' as const, content: assistantMessage.content || '' });
            }
          } catch { /* afterTurn hook optional */ }

          break;
        }
      }

      if (toolRounds >= maxToolRounds) {
        const warningEntry: ChatEntry = {
          type: "assistant",
          content: "Maximum tool execution rounds reached. Stopping to prevent infinite loops.",
          timestamp: new Date(),
        };
        history.push(warningEntry);
        messages.push({ role: "assistant", content: warningEntry.content });
        newEntries.push(warningEntry);
      }

      // Recalculate input tokens at end of loop (messages grew during tool rounds)
      inputTokens = this.deps.tokenCounter.countMessageTokens(messages as Parameters<typeof this.deps.tokenCounter.countMessageTokens>[0]);
      // Record session cost
      this.config.recordSessionCost(inputTokens, totalOutputTokens);

      // Display per-turn token usage
      const turnCost = estimateCost(inputTokens, totalOutputTokens);
      const usageDisplay = formatTokenUsage({ inputTokens, outputTokens: totalOutputTokens, cost: turnCost });
      logger.info(`Token usage: ${usageDisplay}`);

      if (this.config.isSessionCostLimitReached()) {
        const sessionCost = this.config.getSessionCost();
        const sessionCostLimit = this.config.getSessionCostLimit();
        const costEntry: ChatEntry = {
          type: "assistant",
          content: `Session cost limit reached ($${sessionCost.toFixed(2)} / $${sessionCostLimit.toFixed(2)}). Please start a new session.`,
          timestamp: new Date(),
        };
        history.push(costEntry);
        messages.push({ role: "assistant", content: costEntry.content });
        newEntries.push(costEntry);

        // Fix 3: YOLO session summary on cost limit
        try {
          const { getAutonomyManager } = await import('../../utils/autonomy-manager.js');
          const am = getAutonomyManager();
          if (am.isYOLOEnabled()) {
            const summary = am.getSessionSummary(sessionCost);
            const summaryEntry: ChatEntry = { type: 'assistant', content: summary, timestamp: new Date() };
            history.push(summaryEntry);
            newEntries.push(summaryEntry);
          }
        } catch { /* non-critical */ }
      }

      return newEntries;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}`,
        timestamp: new Date(),
      };
      history.push(errorEntry);
      messages.push({ role: "assistant", content: errorEntry.content });
      return [errorEntry];
    }
  }

  /**
   * Process a user message with streaming response
   *
   * Yields chunks as they arrive from the LLM, enabling real-time UI updates.
   * Chunk types: 'content', 'tool_calls', 'tool_result', 'token_count', 'done'
   *
   * @param message - The user's input message
   * @param history - Chat history array (modified in place)
   * @param messages - LLM message array (modified in place)
   * @param abortController - Controller to cancel the operation
   * @yields Streaming chunks for UI consumption
   */
  async *processUserMessageStream(
    message: string,
    history: ChatEntry[],
    messages: CodeBuddyMessage[],
    abortController: AbortController | null
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    // Shared pre-processing with the sequential path (@mentions, persona
    // auto-select, knowledge graph extraction). Single source of truth in
    // preprocessUserMessage (F10).
    message = await this.preprocessUserMessage(message, messages);

    // Calculate input tokens
    let inputTokens = this.deps.tokenCounter.countMessageTokens(messages as Parameters<typeof this.deps.tokenCounter.countMessageTokens>[0]);
    yield {
      type: "token_count",
      tokenCount: inputTokens,
    };

    const maxToolRounds = this.config.maxToolRounds;
    let toolRounds = 0;
    let totalOutputTokens = 0;

    try {
      const pipeline = this.deps.middlewarePipeline;

      let terminateDetectedStreaming = false;
      while (toolRounds < maxToolRounds) {
        if (abortController?.signal.aborted) {
          yield { type: "content", content: "\n\n[Operation cancelled by user]" };
          yield { type: "done" };
          return;
        }

        // Run before_turn middleware
        if (pipeline) {
          const ctx = this.buildMiddlewareContext(
            toolRounds, inputTokens, totalOutputTokens, history, messages, true, abortController
          );
          const mwResult = await pipeline.runBeforeTurn(ctx);
          if (mwResult.action === 'stop') {
            if (mwResult.message) yield { type: "content", content: `\n\n${mwResult.message}` };
            yield { type: "done" };
            return;
          }
          if (mwResult.action === 'compact') {
            // Trigger context compaction
            this.deps.contextManager.prepareMessages(messages);
          }
          if (mwResult.action === 'warn' && mwResult.message) {
            yield { type: "content", content: `\n${mwResult.message}\n` };
            messages.push({
              role: 'system' as const,
              content: `<context type="middleware-hint">\n${mwResult.message}\n</context>`,
            });
          }
        }

        const selectionResult = await this.deps.toolSelectionStrategy.selectToolsForQuery(message);
        const tools = selectionResult.tools;
        if (toolRounds === 0) this.deps.toolSelectionStrategy.cacheTools(tools);

        const preparedMessages = prepareTurnMessages(this.deps.contextManager, messages);

        // --- Query-aware context injection (saves ~15-20K tokens for trivial messages) ---
        const { injection: ctxLevel, complexity: queryComplexity } = classifyQuery(message);
        logger.debug(`Query classified as '${queryComplexity}' — context injection level: ${JSON.stringify(ctxLevel)}`);

        await injectInitialContext(preparedMessages, {
          message,
          cwd: process.cwd(),
          ctxLevel,
          loadWorkspaceContext: lazyGetWorkspaceContext,
          decisionContextProvider: this.getDecisionContextProvider(),
          icmBridgeProvider: this.getICMBridgeProvider(),
          codeGraphContextProvider: this.getCodeGraphContextProvider(),
          docsContextProvider: this.getDocsContextProvider(),
        });

        // Context warning — always check regardless of pipeline state
        {
          const contextWarning = this.deps.contextManager.shouldWarn(preparedMessages);
          if (contextWarning.warn) {
            yield { type: "content", content: `\n${contextWarning.message}\n` };

            // --- Native Engine pre-compaction memory flush (streaming path) ---
            try {
              const { getPrecompactionFlusher } = await import('../../context/precompaction-flush.js');
              const flusher = getPrecompactionFlusher();
              await flusher.flush(
                preparedMessages.filter(m => m.role !== 'system').map(m => ({
                  role: m.role as 'user' | 'assistant',
                  content: typeof m.content === 'string' ? m.content : '',
                })),
                async (flushMsgs) => {
                  const r = await this.deps.client.chat(
                    flushMsgs.map(m => ({ role: m.role, content: m.content })),
                    [],
                  );
                  return r.choices[0]?.message?.content ?? 'NO_REPLY';
                }
              );
            } catch {
              // non-critical
            }
          }
        }

        const stream = this.deps.client.chatStream(
          preparedMessages,
          tools,
          undefined,
          this.config.isGrokModel() && this.deps.toolSelectionStrategy.shouldUseSearchFor(message)
            ? { search_parameters: { mode: "auto" } }
            : { search_parameters: { mode: "off" } }
        );
        
        this.deps.streamingHandler.reset();

        for await (const chunk of stream) {
          if (abortController?.signal.aborted) {
            yield { type: "content", content: "\n\n[Operation cancelled by user]" };
            yield { type: "done" };
            return;
          }

          const result = this.deps.streamingHandler.accumulateChunk(chunk as RawStreamingChunk);

          if (result.reasoningContent) {
            yield { type: "reasoning", reasoning: result.reasoningContent };
          }

          if (result.hasNewToolCalls && result.toolCalls) {
            yield { type: "tool_calls", toolCalls: result.toolCalls };
          }

          if (result.displayContent) {
            yield { type: "content", content: result.displayContent };
          }

          if (result.shouldEmitTokenCount && result.tokenCount !== undefined) {
            yield { type: "token_count", tokenCount: inputTokens + result.tokenCount };
          }
        }

        if (!this.deps.streamingHandler.hasYieldedToolCalls()) {
          const extracted = this.deps.streamingHandler.extractToolCalls();
          if (extracted.toolCalls.length > 0) {
            yield { type: "tool_calls", toolCalls: extracted.toolCalls };
          }
        }

        const accumulatedMessage = this.deps.streamingHandler.getAccumulatedMessage();
        // Sanitize streamed assistant content: strip model control tokens and invisible chars
        const rawStreamedContent = accumulatedMessage.content || "Using tools to help you...";
        const content = sanitizeAssistantOutput(rawStreamedContent);
        const toolCalls = accumulatedMessage.tool_calls;

        const assistantEntry: ChatEntry = {
          type: "assistant",
          content: content,
          timestamp: new Date(),
          toolCalls: toolCalls,
        };
        history.push(assistantEntry);
        messages.push({ role: "assistant", content: content, tool_calls: toolCalls });

        if (toolCalls && toolCalls.length > 0) {
          toolRounds++;

          // Pre-check cost limit before executing tools (estimate only — no side effects)
          if (this.config.estimateSessionCostLimitReached(inputTokens, totalOutputTokens)) {
            const sessionCost = this.config.getSessionCost();
            const sessionCostLimit = this.config.getSessionCostLimit();
            yield { type: "content", content: `\n\nSession cost limit reached ($${sessionCost.toFixed(2)} / $${sessionCostLimit.toFixed(2)}). Stopping before tool execution.` };
            yield { type: "done" };
            return;
          }

          // Check for steering messages (steer mode: interrupt execution)
          const mq = this.deps.messageQueue;
          if (mq?.hasSteeringMessage()) {
            const steering = mq.consumeSteeringMessage();
            if (steering) {
              yield { type: "steer", steer: { content: steering.content, source: steering.source } };
              // Inject as user message and skip remaining tool calls
              messages.push({ role: "user", content: steering.content });
              history.push({
                type: "user",
                content: steering.content,
                timestamp: new Date(),
              });
              // Rollback toolRounds since we didn't actually execute any tools
              toolRounds--;
              continue; // Re-enter loop to get new LLM response
            }
          }

          // Single-tool mode: only execute first tool call, re-enqueue rest
          const streamToolCallsToExecute = this.config.singleToolMode
            ? [toolCalls[0]]
            : toolCalls;

          if (this.config.singleToolMode && toolCalls.length > 1) {
            const deferred = toolCalls.slice(1);
            preparedMessages.push({
              role: 'assistant',
              content: null,
              tool_calls: deferred,
            } as CodeBuddyMessage);
            logger.debug(`Single-tool mode (stream): deferred ${deferred.length} tool calls`);
          }

          if (!this.deps.streamingHandler.hasYieldedToolCalls()) {
            yield { type: "tool_calls", toolCalls: streamToolCallsToExecute };
          }

          // Buffer for streaming adapter chunks (cannot yield from inside a callback)
          const streamChunkBuffer: Array<{ type: "tool_stream"; toolStreamData: { toolCallId: string; toolName: string; delta: string } }> = [];

          for (const toolCall of streamToolCallsToExecute) {
            if (abortController?.signal.aborted) {
              yield { type: "content", content: "\n\n[Operation cancelled by user]" };
              yield { type: "done" };
              return;
            }

            // --- Proactive context compaction (streaming path) ---
            try {
              const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
              const estimatedTokens = estimateToolResultTokens(toolCall.function.name, toolArgs);
              const modelName = this.deps.client.getCurrentModel();
              const { getModelToolConfig } = await import('../../config/model-tools.js');
              const modelConfig = getModelToolConfig(modelName);
              const contextWindow = modelConfig.contextWindow ?? 128_000;
              if (shouldCompactBeforeToolExec(inputTokens, estimatedTokens, contextWindow)) {
                logger.debug('Proactive compaction (stream): compacting before tool execution', {
                  toolName: toolCall.function.name,
                  inputTokens,
                  estimatedTokens,
                  contextWindow,
                });
                this.deps.contextManager.prepareMessages(messages);
                inputTokens = this.deps.tokenCounter.countMessageTokens(
                  messages as Parameters<typeof this.deps.tokenCounter.countMessageTokens>[0]
                );
              }
            } catch { /* proactive compaction is non-critical */ }

            // --- User hooks: PreToolUse (streaming path) ---
            const streamPreHook = await runPreToolUseHook(process.cwd(), toolCall);
            if (!streamPreHook.allowed) {
              const blockedContent = streamPreHook.feedback ?? 'Action blocked by PreToolUse hook';
              yield { type: "content", content: `\n[Hook blocked: ${blockedContent}]\n` };
              pushBlockedToolMessage(messages, toolCall, blockedContent);
              continue;
            }

            // Use streaming execution for tools that support it (bash, reason, + adapter-based)
            let result;
            const _streamToolStartMs = Date.now();
            const STREAMING_TOOLS = ['bash', 'reason'];
            if (STREAMING_TOOLS.includes(toolCall.function.name)) {
              const gen = this.deps.toolHandler.executeToolStreaming(toolCall);
              let genResult = await gen.next();
              while (!genResult.done) {
                // Check abort between stream chunks
                if (abortController?.signal.aborted) {
                  await gen.return({ success: false, error: 'Aborted' });
                  yield { type: "content", content: "\n\n[Operation cancelled by user]" };
                  yield { type: "done" };
                  return;
                }
                yield {
                  type: "tool_stream",
                  toolStreamData: {
                    toolCallId: toolCall.id,
                    toolName: toolCall.function.name,
                    delta: genResult.value,
                  },
                };
                genResult = await gen.next();
              }
              result = genResult.value ?? { success: false, error: 'Tool returned no result' };
            } else {
              // Check if the streaming adapter supports this tool
              const { getStreamingAdapter } = await import('../../tools/streaming-adapter.js');
              const streamingAdapter = getStreamingAdapter();
              if (streamingAdapter.supportsStreaming(toolCall.function.name)) {
                const tc = toolCall; // capture for closure
                result = await streamingAdapter.wrapWithStreaming(
                  tc.function.name,
                  () => this.executeToolViaLane(tc),
                  (chunk: string) => {
                    // We cannot yield from inside a callback, so we accumulate
                    // chunks and emit them after. Instead, use a buffer approach.
                    streamChunkBuffer.push({
                      type: "tool_stream" as const,
                      toolStreamData: {
                        toolCallId: tc.id,
                        toolName: tc.function.name,
                        delta: chunk,
                      },
                    });
                  },
                );
                // Flush buffered streaming chunks
                for (const chunk of streamChunkBuffer) {
                  yield chunk;
                }
                streamChunkBuffer.length = 0;
              } else {
                result = await this.executeToolViaLane(toolCall);
              }
            }

            // --- User hooks: PostToolUse / PostToolUseFailure (streaming path) ---
            await runPostToolUseHook(process.cwd(), toolCall, result);
            // --- Per-tool metrics (streaming path, DeepWiki gap #3) ---
            await recordToolMetric(toolCall.function.name, result.success, Date.now() - _streamToolStartMs);

            // --- Track file access for code graph context (streaming, incremental update) ---
            try {
              const fileToolsStream = new Set(['view_file', 'create_file', 'str_replace_editor', 'file_read', 'file_write']);
              if (fileToolsStream.has(toolCall.function.name)) {
                const args = JSON.parse(toolCall.function.arguments || '{}');
                const filePath = args.path || args.file_path || args.target_file || '';
                if (filePath) {
                  const { trackRecentFile } = await import('../../knowledge/code-graph-context-provider.js');
                  trackRecentFile(filePath);
                  if (['create_file', 'str_replace_editor', 'file_write'].includes(toolCall.function.name)) {
                    const { getKnowledgeGraph } = await import('../../knowledge/knowledge-graph.js');
                    const kg = getKnowledgeGraph();
                    if (kg.getStats().tripleCount > 0) {
                      const { updateGraphForFile } = await import('../../knowledge/graph-updater.js');
                      const pathMod = await import('path');
                      const absPath = pathMod.default.resolve(process.cwd(), filePath);
                      updateGraphForFile(kg, absPath, process.cwd());
                    }
                  }
                }
              }
            } catch { /* file tracking is optional */ }

            // Check abort after tool execution completes
            if (abortController?.signal.aborted) {
              yield { type: "content", content: "\n\n[Operation cancelled by user]" };
              yield { type: "done" };
              return;
            }

            // Apply semantic truncation if tool output is very large (> 20k chars)
            const RAW_OUTPUT_LIMIT = 20_000;
            if (result?.output && result.output.length > RAW_OUTPUT_LIMIT) {
              const truncResult = semanticTruncate(result.output, { maxChars: RAW_OUTPUT_LIMIT });
              if (truncResult.truncated) {
                result = {
                  ...result,
                  output: truncResult.output,
                };
              }
            }

            // --- Disk-backed tool result (Manus AI #19) ---
            const rawStreamContent = sanitizeToolResult(result?.success ? result.output || "Success" : result?.error || "Error");
            persistToolResult(toolCall.id, rawStreamContent);

            // --- Observation Variator (Manus AI #17) ---
            const variedStreamContent = applyObservationVariator(toolCall.function.name, rawStreamContent);

            const toolResultEntry: ChatEntry = {
              type: "tool_result",
              content: result?.success ? result.output || "Success" : result?.error || "Error occurred",
              timestamp: new Date(),
              toolCall: toolCall,
              toolResult: result,
            };
            history.push(toolResultEntry);
            yield { type: "tool_result", toolCall, toolResult: result };

            // Note: 'name' is required for Gemini API to match functionResponse with functionCall
            messages.push({
              role: "tool",
              content: variedStreamContent,
              tool_call_id: toolCall.id || `tool_${Date.now()}`,
              name: toolCall.function.name,
            } as CodeBuddyMessage);

            // --- Auto-commit after file-modifying tools (streaming path) ---
            if (result?.success) {
              try {
                const { maybeAutoCommit } = await import('../../tools/auto-commit.js');
                const acResult = await maybeAutoCommit(
                  toolCall.function.name,
                  toolCall.function.arguments || '{}',
                  rawStreamContent.substring(0, 120),
                );
                if (acResult?.success) {
                  logger.debug('Auto-commit (stream):', { hash: acResult.commitHash });
                } else if (acResult && acResult.message && /failed/i.test(acResult.message)) {
                  // Real commit failure — surface to the user (see sequential path above).
                  logger.warn(`Auto-commit failed: ${acResult.message}`);
                }
              } catch (err) {
                logger.debug('Auto-commit threw (stream)', { err: err instanceof Error ? err.message : String(err) });
              }
            }

            // --- Fix 11: YOLO cost display after each tool (streaming path) ---
            await logYoloCostIfEnabled(this.config);

            // --- Terminate signal detection (OpenManus #5, streaming path) ---
            const streamTerminateMsg = extractTerminateMessage(rawStreamContent);
            if (streamTerminateMsg !== null) {
              yield { type: "content", content: `\n\n${streamTerminateMsg}` };
              terminateDetectedStreaming = true;
              break;
            }

            // --- Interactive Shell Handoff detection (streaming path) ---
            const shellRequestMsg = extractSignalMessage(rawStreamContent, INTERACTIVE_SHELL_SIGNAL);
            if (shellRequestMsg !== null) {
              yield { type: "content", content: `\n\n⚠️ **INTERACTIVE SHELL HANDOFF REQUESTED**\n\n${shellRequestMsg}` };
              yield {
                type: "ask_user",
                askUser: {
                  question: "Do you want to open an interactive terminal to perform this action? (Type 'exit' in the terminal when done to return control to the AI)",
                  options: ["Yes, open interactive shell", "No, cancel tool"]
                }
              };
              terminateDetectedStreaming = true;
              break;
            }

            // --- Plan Approval detection (streaming path) ---
            const planMsg = extractSignalMessage(rawStreamContent, PLAN_APPROVAL_SIGNAL);
            if (planMsg !== null) {
              yield { type: "content", content: `\n\n⚠️ **PLAN APPROVAL REQUIRED**\n\n${planMsg}` };
              yield {
                type: "ask_user",
                askUser: {
                  question: "Do you approve this plan? (Yes to execute, No to cancel, or provide feedback)",
                  options: ["Approve", "Reject"]
                }
              };
              terminateDetectedStreaming = true;
              break;
            }

            // --- Yield signal detection (Native Engine v2026.3.14, streaming path) ---
            const streamYieldChildId = extractYieldChildId(rawStreamContent);
            if (streamYieldChildId) {
              yield { type: "content", content: `\n[Waiting for sub-agent to complete...]` };
              await processYieldSignal(streamYieldChildId, messages);
            }
          }

          if (terminateDetectedStreaming) break;

          inputTokens = this.deps.tokenCounter.countMessageTokens(messages as Parameters<typeof this.deps.tokenCounter.countMessageTokens>[0]);
          const currentOutputTokens = this.deps.streamingHandler.getTokenCount() || 0;
          totalOutputTokens += currentOutputTokens;
          yield { type: "token_count", tokenCount: inputTokens + totalOutputTokens };

          // Run after_turn middleware (handles cost recording + limit)
          if (pipeline) {
            const ctx = this.buildMiddlewareContext(
              toolRounds, inputTokens, totalOutputTokens, history, messages, true, abortController
            );
            const mwResult = await pipeline.runAfterTurn(ctx);
            if (mwResult.action === 'stop') {
              if (mwResult.message) yield { type: "content", content: `\n\n${mwResult.message}` };
              yield { type: "done" };
              return;
            }
            if (mwResult.action === 'warn' && mwResult.message) {
              yield { type: "content", content: `\n${mwResult.message}\n` };
            }
          }
          // Note: cost is recorded once at end-of-loop, not here (avoids double-counting)

          // Apply TTL-based tool result expiry + image pruning + backward-scanned FIFO masking (streaming path)
          try {
            const { applyToolOutputMasking, expireOldToolResults, pruneImageContent } = await import('../../context/tool-output-masking.js');
            expireOldToolResults(messages, toolRounds);
            pruneImageContent(messages);
            applyToolOutputMasking(messages);
          } catch { /* masking is optional */ }
        } else {
          // Fire-and-forget auto-capture on final assistant response (streaming)
          try {
            const { getAutoCaptureManager } = await import('../../memory/auto-capture.js');
            const acm = getAutoCaptureManager();
            if (acm) {
              acm.processMessage('assistant', content || '').catch(err => logger.debug('Auto-capture failed', { error: String(err) }));
            }
          } catch { /* auto-capture optional */ }

          // Fire-and-forget ICM episode storage (streaming path)
          if (this.getICMBridgeProvider()) {
            try {
              const icm = this.getICMBridgeProvider()!();
              if (icm?.isAvailable()) {
                const episode = `User: ${message}\nAssistant: ${(content || '').substring(0, 500)}`;
                icm.storeEpisode(episode, {
                  source: 'agent-executor-stream',
                  sessionId: process.env.CODEBUDDY_SESSION_ID,
                  turnNumber: toolRounds,
                }).catch(err => logger.debug('ICM episode store failed', { error: String(err) }));
              }
            } catch { /* ICM store optional */ }
          }

          // Context engine afterTurn hook (Native Engine v2026.3.7 — streaming path)
          try {
            const engine = this.deps.contextManager.getContextEngine?.();
            if (engine) {
              engine.afterTurn(messages, { role: 'assistant' as const, content: content || '' });
            }
          } catch { /* afterTurn hook optional */ }

          break;
        }
      }

      if (toolRounds >= maxToolRounds) {
        yield { type: "content", content: "\n\nMaximum tool execution rounds reached." };
      }

      this.config.recordSessionCost(inputTokens, totalOutputTokens);

      // Display per-turn token usage (streaming path)
      const streamTurnCost = estimateCost(inputTokens, totalOutputTokens);
      const streamUsageDisplay = formatTokenUsage({ inputTokens, outputTokens: totalOutputTokens, cost: streamTurnCost });
      logger.info(`Token usage: ${streamUsageDisplay}`);
      yield { type: "content", content: `\n${streamUsageDisplay}` };

      if (this.config.isSessionCostLimitReached()) {
        const sessionCost = this.config.getSessionCost();
        const sessionCostLimit = this.config.getSessionCostLimit();
        yield {
          type: "content",
          content: `\n\n💸 Session cost limit reached ($${sessionCost.toFixed(2)} / $${sessionCostLimit.toFixed(2)}).`,
        };
      }

      // Process followup/collect messages if any are queued
      const mqEnd = this.deps.messageQueue;
      if (mqEnd?.hasPendingMessages()) {
        const mode = mqEnd.getMode();
        if (mode === 'followup') {
          const followups = mqEnd.drain();
          for (const msg of followups) {
            messages.push({ role: "user", content: msg.content });
            history.push({ type: "user", content: msg.content, timestamp: msg.timestamp });
          }
          // Signal that followup messages need re-processing (caller handles)
          yield { type: "steer", steer: { content: `${followups.length} followup message(s) queued`, source: 'queue' } };
        } else if (mode === 'collect') {
          const collected = mqEnd.collect();
          if (collected) {
            messages.push({ role: "user", content: collected });
            history.push({ type: "user", content: collected, timestamp: new Date() });
            yield { type: "steer", steer: { content: collected, source: 'collect' } };
          }
        }
      }

      yield { type: "done" };
    } catch (error) {
      if (abortController?.signal.aborted) {
        yield { type: "content", content: "\n\n[Operation cancelled by user]" };
        yield { type: "done" };
        return;
      }

      const errorMessage = getErrorMessage(error);
      const errorEntry: ChatEntry = {
        type: "assistant",
        content: `Sorry, I encountered an error: ${errorMessage}`,
        timestamp: new Date(),
      };
      history.push(errorEntry);
      messages.push({ role: "assistant", content: errorEntry.content });
      yield { type: "content", content: errorEntry.content };
      yield { type: "done" };
    }
  }
}
