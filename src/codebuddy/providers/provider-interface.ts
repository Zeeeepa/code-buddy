/**
 * Provider strategy interface — Vague 2 of the v2 refactor.
 *
 * Each provider strategy implements this interface and is selected at
 * construction time by `client.ts` based on the baseURL / model. The hub
 * (`CodeBuddyClient`) becomes a thin dispatcher that delegates `chat()` and
 * `chatStream()` to the active strategy.
 *
 * Phase B introduces only what `provider-gemini-native.ts` needs. The
 * `provider-openai-compat.ts` strategy will land in Phase C and may grow
 * this interface (e.g. a `probeToolSupport()` method, capability hooks) at
 * that point — kept minimal here to avoid speculative surface.
 */

import type { ChatCompletionChunk } from 'openai/resources/chat';
import type {
  CodeBuddyMessage,
  CodeBuddyTool,
  CodeBuddyResponse,
  ChatOptions,
  GeminiThinkingLevel,
} from '../client.js';

export interface Provider {
  /** Non-streaming chat completion. */
  chat(
    messages: CodeBuddyMessage[],
    tools?: CodeBuddyTool[],
    opts?: ChatOptions,
  ): Promise<CodeBuddyResponse>;

  /** Streaming chat completion — yields OpenAI-shaped chunks regardless of provider. */
  chatStream(
    messages: CodeBuddyMessage[],
    tools?: CodeBuddyTool[],
    opts?: ChatOptions,
  ): AsyncGenerator<ChatCompletionChunk, void, unknown>;

  /** Update the active model (called by `client.setModel`). */
  setModel(model: string): void;

  /** Optional Gemini-specific knob — not on the strategy contract for non-Gemini providers. */
  setDefaultThinkingLevel?(level: GeminiThinkingLevel): void;
}
