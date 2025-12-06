import { GrokToolCall } from "../grok/client.js";
import { ToolResult } from "../types/index.js";

/**
 * Represents a single entry in the chat history
 */
export interface ChatEntry {
  /** Type of chat entry */
  type: "user" | "assistant" | "tool_result" | "tool_call";
  /** Content of the message */
  content: string;
  /** When this entry was created */
  timestamp: Date;
  /** Tool calls made by the assistant (if any) */
  toolCalls?: GrokToolCall[];
  /** Single tool call (for tool_call type) */
  toolCall?: GrokToolCall;
  /** Result of tool execution (for tool_result type) */
  toolResult?: { success: boolean; output?: string; error?: string };
  /** Whether this entry is currently being streamed */
  isStreaming?: boolean;
}

/**
 * Represents a chunk of data in a streaming response
 */
export interface StreamingChunk {
  /** Type of streaming chunk */
  type: "content" | "tool_calls" | "tool_result" | "done" | "token_count";
  /** Text content (for content type) */
  content?: string;
  /** Tool calls made (for tool_calls type) */
  toolCalls?: GrokToolCall[];
  /** Single tool call (for tool_call type) */
  toolCall?: GrokToolCall;
  /** Result of tool execution (for tool_result type) */
  toolResult?: ToolResult;
  /** Current token count (for token_count type) */
  tokenCount?: number;
}
