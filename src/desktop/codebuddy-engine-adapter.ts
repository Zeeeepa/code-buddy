/**
 * Code Buddy Engine Adapter
 *
 * Wraps CodeBuddyAgent for direct in-process usage from the
 * Electron main process. Translates the AsyncGenerator<StreamingChunk>
 * interface into EngineStreamEvent callbacks.
 *
 * @module desktop/codebuddy-engine-adapter
 */

import { logger } from '../utils/logger.js';
import type {
  EngineAdapter,
  EngineStreamCallback,
  EnginePermissionCallback,
} from './engine-adapter.js';
import type {
  EngineMessage,
  EngineSessionConfig,
  EngineSessionResult,
  EngineModelInfo,
} from '../shared/engine-types.js';

/**
 * Concrete implementation of EngineAdapter that wraps CodeBuddyAgent.
 *
 * Each session gets its own CodeBuddyAgent instance (stored in a Map).
 * The agent is lazily created on the first runSession() call to avoid
 * slowing down Electron startup.
 */
export class CodeBuddyEngineAdapter implements EngineAdapter {
  private config: EngineSessionConfig;
  private agents: Map<string, unknown> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private permissionCallback: EnginePermissionCallback | null = null;
  private ready = true;
  private disposed = false;

  constructor(config: EngineSessionConfig) {
    this.config = config;
    logger.info('[CodeBuddyEngineAdapter] initialized', {
      model: config.model,
      baseURL: config.baseURL,
      embedded: config.embedded,
    });
  }

  async runSession(
    sessionId: string,
    messages: EngineMessage[],
    onEvent: EngineStreamCallback,
    options?: Partial<EngineSessionConfig>,
  ): Promise<EngineSessionResult> {
    if (this.disposed) {
      throw new Error('Engine adapter has been disposed');
    }

    const config = { ...this.config, ...options };
    let fullContent = '';
    let totalTokens = 0;
    let toolCallCount = 0;

    try {
      // Lazy-import CodeBuddyAgent to avoid loading heavy modules at startup
      const { CodeBuddyAgent } = await import('../agent/codebuddy-agent.js');

      // Get or create agent for this session
      let agent = this.agents.get(sessionId) as InstanceType<typeof CodeBuddyAgent> | undefined;
      if (!agent) {
        agent = new CodeBuddyAgent(
          config.apiKey,
          config.baseURL,
          config.model,
          config.maxToolRounds,
        );

        this.agents.set(sessionId, agent);

        // Load prior conversation history into the agent (for session restore)
        if (messages.length > 1) {
          for (let i = 0; i < messages.length - 1; i++) {
            const msg = messages[i];
            if (msg.content) {
              agent.addToHistory({
                role: msg.role as 'user' | 'assistant' | 'system',
                content: msg.content,
              });
            }
          }
        }
      }

      // The last message must be the user's current prompt
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('Last message must be a user message');
      }

      // Create abort controller for this session
      const abortController = new AbortController();
      this.abortControllers.set(sessionId, abortController);

      // Intercept /ultraplan
      if (lastMessage.content.trim().startsWith('/ultraplan')) {
          const { handleUltraplan } = await import('../commands/handlers/ultraplan-handler.js');
          const args = lastMessage.content.trim().replace('/ultraplan', '').trim().split(' ');
          
          await handleUltraplan(args, (msg: string) => {
              // Strip ANSI escape codes for cleaner UI display
              const cleanMsg = msg.replace(/\x1b\[[0-9;]*m/g, '');
              fullContent += cleanMsg;
              onEvent({ type: 'content', content: cleanMsg });
          });

          return {
            content: fullContent,
            tokenCount: totalTokens,
            toolCallCount,
          };
      }

      // Stream the response
      const stream = agent.processUserMessageStream(lastMessage.content);

      for await (const chunk of stream) {
        // Check for abort
        if (abortController.signal.aborted) {
          break;
        }

        switch (chunk.type) {
          case 'content':
            if (chunk.content) {
              fullContent += chunk.content;
              onEvent({ type: 'content', content: chunk.content });
            }
            break;

          case 'reasoning':
            if (chunk.reasoning) {
              onEvent({ type: 'thinking', thinking: chunk.reasoning });
            }
            break;

          case 'tool_calls':
            if (chunk.toolCalls) {
              for (const tc of chunk.toolCalls) {
                toolCallCount++;
                onEvent({
                  type: 'tool_start',
                  tool: {
                    id: tc.id,
                    name: tc.function.name,
                    input: tc.function.arguments,
                  },
                });
              }
            }
            break;

          case 'tool_result':
            if (chunk.toolCall && chunk.toolResult) {
              onEvent({
                type: 'tool_end',
                tool: {
                  id: chunk.toolCall.id,
                  name: chunk.toolCall.function.name,
                  output: chunk.toolResult.output || chunk.toolResult.error,
                  isError: !chunk.toolResult.success,
                },
              });
            }
            break;

          case 'tool_stream':
            if (chunk.toolStreamData) {
              onEvent({
                type: 'tool_stream',
                tool: {
                  id: chunk.toolStreamData.toolCallId,
                  name: chunk.toolStreamData.toolName,
                  delta: chunk.toolStreamData.delta,
                },
              });
            }
            break;

          case 'token_count':
            if (chunk.tokenCount !== undefined) {
              totalTokens = chunk.tokenCount;
              onEvent({ type: 'token_count', tokenCount: chunk.tokenCount });
            }
            break;

          case 'ask_user':
            if (chunk.askUser) {
              onEvent({ type: 'ask_user', askUser: chunk.askUser });
            }
            break;

          case 'plan_progress':
            if (chunk.planProgress) {
              onEvent({ type: 'plan_progress', planProgress: chunk.planProgress });
            }
            break;

          case 'diff_preview':
            if (chunk.diffPreview) {
              onEvent({ type: 'diff_preview', diffPreview: chunk.diffPreview });
            }
            break;

          case 'done':
            onEvent({ type: 'done' });
            break;
        }
      }

      return {
        content: fullContent,
        tokenCount: totalTokens,
        toolCallCount,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      onEvent({ type: 'error', error: errorMsg });
      return {
        content: fullContent,
        tokenCount: totalTokens,
        toolCallCount,
      };
    } finally {
      this.abortControllers.delete(sessionId);
    }
  }

  cancel(sessionId: string): void {
    const controller = this.abortControllers.get(sessionId);
    if (controller) {
      controller.abort();
      logger.info('[CodeBuddyEngineAdapter] cancelled session', { sessionId });
    }
  }

  clearSession(sessionId: string): void {
    const agent = this.agents.get(sessionId);
    if (agent && typeof (agent as { dispose?: () => void }).dispose === 'function') {
      (agent as { dispose: () => void }).dispose();
    }
    this.agents.delete(sessionId);
    this.abortControllers.delete(sessionId);
    logger.debug('[CodeBuddyEngineAdapter] cleared session', { sessionId });
  }

  async getModels(): Promise<EngineModelInfo[]> {
    try {
      const { SUPPORTED_MODELS } = await import('../config/constants.js');
      return Object.entries(SUPPORTED_MODELS).map(([id, info]) => ({
        id,
        name: (info as { name?: string }).name || id,
        provider: (info as { provider?: string }).provider,
      }));
    } catch {
      return [{ id: this.config.model || 'default' }];
    }
  }

  isReady(): boolean {
    return this.ready && !this.disposed;
  }

  setPermissionCallback(callback: EnginePermissionCallback): void {
    this.permissionCallback = callback;
    logger.debug('[CodeBuddyEngineAdapter] permission callback set');
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Cancel all running sessions
    for (const [sessionId, controller] of this.abortControllers) {
      controller.abort();
      logger.debug('[CodeBuddyEngineAdapter] aborted session on dispose', { sessionId });
    }

    // Dispose all agents
    for (const [sessionId, agent] of this.agents) {
      if (typeof (agent as { dispose?: () => void }).dispose === 'function') {
        (agent as { dispose: () => void }).dispose();
      }
      logger.debug('[CodeBuddyEngineAdapter] disposed agent', { sessionId });
    }

    this.agents.clear();
    this.abortControllers.clear();
    this.permissionCallback = null;
    logger.info('[CodeBuddyEngineAdapter] disposed');
  }

  /**
   * Update the engine configuration (e.g., when user changes API key or model).
   * Existing sessions are not affected; new sessions will use the updated config.
   */
  updateConfig(config: Partial<EngineSessionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('[CodeBuddyEngineAdapter] config updated', {
      model: this.config.model,
    });
  }
}
