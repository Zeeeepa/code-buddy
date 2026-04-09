import type { Message, Session, TraceStep } from '../../renderer/types';

export interface SessionInsightSummary {
  sessionId: string;
  title: string;
  status: Session['status'];
  model?: string;
  cwd?: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  tokenInput: number;
  tokenOutput: number;
  totalTokens: number;
  totalExecutionTimeMs: number;
  transcriptPreview: string;
}

export interface SessionInsightDetail {
  summary: SessionInsightSummary;
  messages: Message[];
  traceSteps: TraceStep[];
}

export interface SessionInsightsSource {
  listSessions(): Session[];
  getMessages(sessionId: string): Message[];
  getTraceSteps(sessionId: string): TraceStep[];
}

function flattenMessageText(message: Message): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === 'text') parts.push(block.text);
    if (block.type === 'thinking') parts.push(block.thinking);
    if (block.type === 'tool_result') parts.push(block.content);
    if (block.type === 'tool_use') parts.push(`[${block.name}]`);
    if (block.type === 'file_attachment') parts.push(block.filename);
  }
  return parts.join('\n').trim();
}

function buildPreview(messages: Message[]): string {
  const text = messages
    .map(flattenMessageText)
    .filter(Boolean)
    .join('\n\n')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

export function buildSessionInsightSummary(
  session: Session,
  messages: Message[],
  traceSteps: TraceStep[]
): SessionInsightSummary {
  const userMessageCount = messages.filter((message) => message.role === 'user').length;
  const assistantMessageCount = messages.filter((message) => message.role === 'assistant').length;
  const tokenInput = messages.reduce((sum, message) => sum + (message.tokenUsage?.input ?? 0), 0);
  const tokenOutput = messages.reduce((sum, message) => sum + (message.tokenUsage?.output ?? 0), 0);
  const totalExecutionTimeMs = messages.reduce(
    (sum, message) => sum + (message.executionTimeMs ?? 0),
    0
  );
  const toolCallCount = traceSteps.filter((step) => step.type === 'tool_call').length;

  return {
    sessionId: session.id,
    title: session.title,
    status: session.status,
    model: session.model,
    cwd: session.cwd,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: messages.length,
    userMessageCount,
    assistantMessageCount,
    toolCallCount,
    tokenInput,
    tokenOutput,
    totalTokens: tokenInput + tokenOutput,
    totalExecutionTimeMs,
    transcriptPreview: buildPreview(messages),
  };
}

export class SessionInsightsBridge {
  constructor(private readonly source: SessionInsightsSource) {}

  list(limit = 100): SessionInsightSummary[] {
    return this.source
      .listSessions()
      .map((session) =>
        buildSessionInsightSummary(
          session,
          this.source.getMessages(session.id),
          this.source.getTraceSteps(session.id)
        )
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, Math.max(1, limit));
  }

  search(query: string, limit = 50): SessionInsightSummary[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return this.list(limit);
    }

    return this.list(Number.MAX_SAFE_INTEGER)
      .filter((summary) => {
        const haystack = [summary.title, summary.model, summary.cwd, summary.transcriptPreview]
          .filter(Boolean)
          .join('\n')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, Math.max(1, limit));
  }

  getDetail(sessionId: string): SessionInsightDetail | null {
    const session = this.source.listSessions().find((entry) => entry.id === sessionId);
    if (!session) return null;
    const messages = this.source.getMessages(sessionId);
    const traceSteps = this.source.getTraceSteps(sessionId);
    return {
      summary: buildSessionInsightSummary(session, messages, traceSteps),
      messages,
      traceSteps,
    };
  }
}
