/**
 * Code Buddy Engine Runner
 *
 * Implements the AgentRunner interface used by Cowork's SessionManager,
 * delegating to the Code Buddy EngineAdapter for in-process execution.
 * Translates EngineStreamEvents back to Cowork ServerEvent format.
 *
 * @module main/engine/codebuddy-engine-runner
 */

import { v4 as uuidv4 } from 'uuid';
import { log, logError } from '../utils/logger';
import type { Session, Message, ServerEvent, ContentBlock, TextContent, ToolUseContent, ToolResultContent, ThinkingContent } from '../../renderer/types';

/** Minimal EngineAdapter interface (avoids direct import from Code Buddy src) */
interface EngineAdapter {
  runSession(
    sessionId: string,
    messages: Array<{ role: string; content: string }>,
    onEvent: (event: EngineStreamEvent) => void,
    options?: Record<string, unknown>,
  ): Promise<{ content: string; tokenCount?: number; toolCallCount?: number }>;
  cancel(sessionId: string): void;
  clearSession(sessionId: string): void;
}

interface EngineStreamEvent {
  type: string;
  content?: string;
  thinking?: string;
  tool?: {
    id: string;
    name: string;
    input?: string;
    output?: string;
    isError?: boolean;
    delta?: string;
  };
  tokenCount?: number;
  cost?: { inputTokens: number; outputTokens: number; totalCost: number };
  error?: string;
  askUser?: { question: string; options: string[] };
  planProgress?: { taskId: string; status: string; total: number; completed: number; message?: string };
  diffPreview?: { turnId: number; diffs: Array<Record<string, unknown>>; plan?: string };
}

/** Callbacks injected by SessionManager */
interface RunnerCallbacks {
  sendToRenderer: (event: ServerEvent) => void;
  saveMessage: (message: Message) => void;
  requestSudoPassword?: (sessionId: string, toolUseId: string, command: string) => Promise<string | null>;
}

/**
 * AgentRunner implementation that delegates to Code Buddy's engine.
 */
export class CodeBuddyEngineRunner {
  private adapter: EngineAdapter;
  private callbacks: RunnerCallbacks;

  constructor(adapter: EngineAdapter, callbacks: RunnerCallbacks) {
    this.adapter = adapter;
    this.callbacks = callbacks;
  }

  /**
   * Run a session using the Code Buddy engine.
   * Translates EngineStreamEvents to Cowork ServerEvents.
   */
  async run(session: Session, prompt: string, existingMessages: Message[]): Promise<void> {
    const { sendToRenderer, saveMessage } = this.callbacks;

    // Notify session is running
    sendToRenderer({
      type: 'session.status',
      payload: { sessionId: session.id, status: 'running' },
    } as ServerEvent);

    // Save user message
    const userMessage: Message = {
      id: uuidv4(),
      sessionId: session.id,
      role: 'user',
      content: [{ type: 'text', text: prompt } as TextContent],
      timestamp: Date.now(),
    };
    saveMessage(userMessage);

    // Create checkpoint before this turn (ghost snapshot)
    try {
      if (session.cwd) {
        const { getGhostSnapshotManager } = await import(
          /* webpackIgnore: true */ '../../../src/checkpoints/ghost-snapshot.js'
        );
        const gsm = getGhostSnapshotManager(session.cwd);
        const snapshot = await gsm.createSnapshot(`Turn: ${prompt.slice(0, 60)}`);
        if (snapshot) {
          sendToRenderer({
            type: 'checkpoint.created',
            payload: {
              sessionId: session.id,
              snapshot: {
                id: snapshot.id,
                commitHash: snapshot.commitHash,
                description: snapshot.description,
                timestamp: snapshot.timestamp,
                turn: snapshot.turn,
              },
            },
          } as ServerEvent);
        }
      }
    } catch {
      // Checkpoint creation is best-effort — don't block the session
    }

    // Convert existing messages to engine format
    const engineMessages = this.convertMessages(existingMessages, prompt);

    let fullContent = '';
    const contentBlocks: ContentBlock[] = [];

    try {
      await this.adapter.runSession(
        session.id,
        engineMessages,
        (event: EngineStreamEvent) => {
          switch (event.type) {
            case 'content':
              if (event.content) {
                fullContent += event.content;
                sendToRenderer({
                  type: 'stream.partial',
                  payload: { sessionId: session.id, content: event.content },
                } as ServerEvent);
              }
              break;

            case 'thinking':
              if (event.thinking) {
                sendToRenderer({
                  type: 'stream.partial',
                  payload: { sessionId: session.id, thinking: event.thinking },
                } as ServerEvent);
              }
              break;

            case 'tool_start':
              if (event.tool) {
                const step = {
                  id: event.tool.id,
                  type: 'tool_call' as const,
                  status: 'running' as const,
                  title: event.tool.name,
                  toolName: event.tool.name,
                  toolInput: event.tool.input ? tryParseJSON(event.tool.input) : undefined,
                  timestamp: Date.now(),
                };
                sendToRenderer({
                  type: 'trace.step',
                  payload: { sessionId: session.id, step },
                } as ServerEvent);

                // Add tool_use content block
                contentBlocks.push({
                  type: 'tool_use',
                  id: event.tool.id,
                  name: event.tool.name,
                  input: event.tool.input ? tryParseJSON(event.tool.input) : {},
                } as ToolUseContent);
              }
              break;

            case 'tool_end':
              if (event.tool) {
                sendToRenderer({
                  type: 'trace.update',
                  payload: {
                    stepId: event.tool.id,
                    updates: {
                      status: event.tool.isError ? 'error' : 'completed',
                      toolOutput: event.tool.output,
                      isError: event.tool.isError,
                      duration: 0,
                    },
                  },
                } as ServerEvent);

                // Add tool_result content block
                contentBlocks.push({
                  type: 'tool_result',
                  toolUseId: event.tool.id,
                  content: event.tool.output || '',
                  isError: event.tool.isError,
                } as ToolResultContent);
              }
              break;

            case 'tool_stream':
              if (event.tool?.delta) {
                sendToRenderer({
                  type: 'trace.update',
                  payload: {
                    stepId: event.tool.id,
                    updates: { toolOutput: event.tool.delta },
                  },
                } as ServerEvent);
              }
              break;

            case 'token_count':
              if (event.tokenCount !== undefined) {
                sendToRenderer({
                  type: 'session.contextInfo',
                  payload: { sessionId: session.id, tokenCount: event.tokenCount },
                } as ServerEvent);
              }
              break;

            case 'diff_preview':
              if (event.diffPreview) {
                sendToRenderer({
                  type: 'diff.preview',
                  payload: {
                    sessionId: session.id,
                    diffPreview: {
                      turnId: event.diffPreview.turnId ?? 0,
                      sessionId: session.id,
                      diffs: (event.diffPreview.diffs || []).map((d: Record<string, unknown>) => ({
                        path: String(d.path || ''),
                        action: String(d.action || 'modify') as 'create' | 'modify' | 'delete' | 'rename',
                        linesAdded: Number(d.linesAdded || 0),
                        linesRemoved: Number(d.linesRemoved || 0),
                        excerpt: String(d.excerpt || ''),
                      })),
                      plan: event.diffPreview.plan as string | undefined,
                      timestamp: Date.now(),
                      status: 'pending' as const,
                    },
                  },
                } as ServerEvent);
              }
              break;

            case 'done':
              sendToRenderer({
                type: 'stream.done',
                payload: { sessionId: session.id },
              } as ServerEvent);
              break;

            case 'error':
              sendToRenderer({
                type: 'error',
                payload: { message: event.error || 'Unknown error', sessionId: session.id },
              } as ServerEvent);
              break;
          }
        },
        {
          workingDirectory: session.cwd,
          model: session.model,
        },
      );

      // Save assistant message
      const assistantContent: ContentBlock[] = [];
      if (fullContent) {
        assistantContent.push({ type: 'text', text: fullContent } as TextContent);
      }
      assistantContent.push(...contentBlocks);

      const assistantMessage: Message = {
        id: uuidv4(),
        sessionId: session.id,
        role: 'assistant',
        content: assistantContent.length > 0
          ? assistantContent
          : [{ type: 'text', text: fullContent || '' } as TextContent],
        timestamp: Date.now(),
      };
      saveMessage(assistantMessage);

      // Send final message
      sendToRenderer({
        type: 'stream.message',
        payload: {
          sessionId: session.id,
          message: assistantMessage,
        },
      } as ServerEvent);

    } catch (error) {
      logError('[CodeBuddyEngineRunner] session error', error);
      sendToRenderer({
        type: 'error',
        payload: {
          message: error instanceof Error ? error.message : String(error),
          sessionId: session.id,
        },
      } as ServerEvent);
    } finally {
      // Notify session is idle
      sendToRenderer({
        type: 'session.status',
        payload: { sessionId: session.id, status: 'idle' },
      } as ServerEvent);
    }
  }

  /**
   * Cancel a running session.
   */
  cancel(sessionId: string): void {
    this.adapter.cancel(sessionId);
    log('[CodeBuddyEngineRunner] cancelled', sessionId);
  }

  /**
   * Clear session state.
   */
  clearSdkSession(sessionId: string): void {
    this.adapter.clearSession(sessionId);
    log('[CodeBuddyEngineRunner] cleared', sessionId);
  }

  /**
   * Convert Cowork messages to engine format.
   * Preserves tool_use/tool_result context as text annotations
   * so the engine can understand prior tool interactions.
   */
  private convertMessages(
    messages: Message[],
    currentPrompt: string,
  ): Array<{ role: string; content: string }> {
    const result: Array<{ role: string; content: string }> = [];

    for (const msg of messages) {
      const parts: string[] = [];

      for (const block of msg.content) {
        switch (block.type) {
          case 'text':
            parts.push((block as TextContent).text);
            break;
          case 'tool_use': {
            const tu = block as ToolUseContent;
            parts.push(`[Tool call: ${tu.name}(${JSON.stringify(tu.input)})]`);
            break;
          }
          case 'tool_result': {
            const tr = block as ToolResultContent;
            const status = tr.isError ? 'error' : 'success';
            const preview = tr.content.length > 500
              ? tr.content.slice(0, 500) + '...'
              : tr.content;
            parts.push(`[Tool result (${status}): ${preview}]`);
            break;
          }
          case 'thinking':
            // Thinking blocks are internal — skip
            break;
        }
      }

      const content = parts.join('\n');
      if (content) {
        result.push({ role: msg.role, content });
      }
    }

    // Add current prompt
    result.push({ role: 'user', content: currentPrompt });

    return result;
  }
}

/**
 * Try to parse a JSON string, returning the string as-is if parsing fails.
 */
function tryParseJSON(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return { raw: str };
  }
}
