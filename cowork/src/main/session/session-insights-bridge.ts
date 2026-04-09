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
  matchSnippet?: string;
  matchCount?: number;
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

function buildMatchSnippet(text: string, query: string): string {
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  if (!normalizedText) return '';
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return normalizedText.slice(0, 160);

  const lower = normalizedText.toLowerCase();
  const index = lower.indexOf(normalizedQuery);
  if (index < 0) {
    return normalizedText.length > 160 ? `${normalizedText.slice(0, 157)}...` : normalizedText;
  }

  const start = Math.max(0, index - 60);
  const end = Math.min(normalizedText.length, index + normalizedQuery.length + 80);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < normalizedText.length ? '...' : '';
  return `${prefix}${normalizedText.slice(start, end)}${suffix}`;
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

    const results: SessionInsightSummary[] = [];

    for (const session of this.source.listSessions()) {
      const messages = this.source.getMessages(session.id);
      const traceSteps = this.source.getTraceSteps(session.id);
      const summary = buildSessionInsightSummary(session, messages, traceSteps);
      const transcriptEntries = messages
        .map((message) => flattenMessageText(message))
        .filter(Boolean);
      const fullTranscript = transcriptEntries.join('\n\n');
      const metadataHaystack = [summary.title, summary.model, summary.cwd]
        .filter(Boolean)
        .join('\n')
        .toLowerCase();
      const transcriptLower = fullTranscript.toLowerCase();
      const metadataMatch = metadataHaystack.includes(normalizedQuery);
      const transcriptMatch = transcriptLower.includes(normalizedQuery);
      if (!metadataMatch && !transcriptMatch) {
        continue;
      }

      const matchCount = transcriptEntries.filter((entry) =>
        entry.toLowerCase().includes(normalizedQuery)
      ).length;

      results.push({
        ...summary,
        matchSnippet: transcriptMatch
          ? buildMatchSnippet(fullTranscript, normalizedQuery)
          : undefined,
        matchCount,
      });
    }

    return results
      .sort((a, b) => {
        const aScore = a.matchCount ?? 0;
        const bScore = b.matchCount ?? 0;
        if (aScore !== bScore) {
          return bScore - aScore;
        }
        return b.updatedAt - a.updatedAt;
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
