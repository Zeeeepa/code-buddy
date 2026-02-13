/**
 * Stream JSON Formatter
 *
 * Formats streaming output as newline-delimited JSON (NDJSON).
 * Each event is a JSON object on its own line, suitable for
 * machine-readable streaming output via --output-format stream-json.
 */

// ============================================================================
// Event Types
// ============================================================================

export interface StartEvent {
  type: 'start';
  session_id: string;
  model: string;
}

export interface TextEvent {
  type: 'text';
  content: string;
}

export interface ToolUseEvent {
  type: 'tool_use';
  tool: string;
  input: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'tool_result';
  tool: string;
  output: string;
  success: boolean;
}

export interface ThinkingEvent {
  type: 'thinking';
  content: string;
}

export interface DoneEvent {
  type: 'done';
  cost: number;
  tokens: {
    input: number;
    output: number;
  };
}

export type StreamEvent =
  | StartEvent
  | TextEvent
  | ToolUseEvent
  | ToolResultEvent
  | ThinkingEvent
  | DoneEvent;

// ============================================================================
// Formatter
// ============================================================================

export class StreamJsonFormatter {
  /**
   * Format a single event as an NDJSON line (JSON + newline).
   */
  formatEvent(event: StreamEvent): string {
    return JSON.stringify(event) + '\n';
  }

  /**
   * Format multiple events as NDJSON.
   */
  formatEvents(events: StreamEvent[]): string {
    return events.map(e => this.formatEvent(e)).join('');
  }

  /**
   * Create a start event.
   */
  start(sessionId: string, model: string): string {
    return this.formatEvent({ type: 'start', session_id: sessionId, model });
  }

  /**
   * Create a text event.
   */
  text(content: string): string {
    return this.formatEvent({ type: 'text', content });
  }

  /**
   * Create a tool_use event.
   */
  toolUse(tool: string, input: Record<string, unknown>): string {
    return this.formatEvent({ type: 'tool_use', tool, input });
  }

  /**
   * Create a tool_result event.
   */
  toolResult(tool: string, output: string, success: boolean): string {
    return this.formatEvent({ type: 'tool_result', tool, output, success });
  }

  /**
   * Create a thinking event.
   */
  thinking(content: string): string {
    return this.formatEvent({ type: 'thinking', content });
  }

  /**
   * Create a done event.
   */
  done(cost: number, tokens: { input: number; output: number }): string {
    return this.formatEvent({ type: 'done', cost, tokens });
  }
}
