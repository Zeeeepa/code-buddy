/**
 * SessionExportService — Claude Cowork parity Phase 2 step 16
 *
 * Formats session messages into Markdown, JSON, or standalone HTML and
 * optionally writes them to disk. Supports basic redaction of secrets
 * (API keys, tokens, password fields) and an option to include or
 * skip checkpoint metadata.
 *
 * @module main/session/session-export-service
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SessionManager } from './session-manager';

export type ExportFormat = 'markdown' | 'json' | 'html';

export interface ExportOptions {
  format: ExportFormat;
  redactSecrets?: boolean;
  includeCheckpoints?: boolean;
}

export interface ExportResult {
  success: boolean;
  content: string;
  filename: string;
  error?: string;
}

/** Patterns matched and replaced with `[REDACTED]` when redactSecrets is true */
const REDACTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /sk-[A-Za-z0-9]{20,}/g, label: 'OPENAI_KEY' },
  { pattern: /xai-[A-Za-z0-9]{20,}/g, label: 'XAI_KEY' },
  { pattern: /sk-ant-[A-Za-z0-9-_]{20,}/g, label: 'ANTHROPIC_KEY' },
  { pattern: /AIza[A-Za-z0-9_-]{20,}/g, label: 'GOOGLE_KEY' },
  { pattern: /ghp_[A-Za-z0-9]{20,}/g, label: 'GITHUB_TOKEN' },
  { pattern: /github_pat_[A-Za-z0-9_]{20,}/g, label: 'GITHUB_PAT' },
  { pattern: /ya29\.[A-Za-z0-9_-]{20,}/g, label: 'GOOGLE_OAUTH' },
  { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g, label: 'SLACK_TOKEN' },
  { pattern: /\bpassword\s*[:=]\s*['"][^'"]+['"]/gi, label: 'PASSWORD_LITERAL' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: 'EMAIL' },
];

function redact(text: string): string {
  let out = text;
  for (const { pattern, label } of REDACTION_PATTERNS) {
    out = out.replace(pattern, `[REDACTED:${label}]`);
  }
  return out;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface MessageLike {
  role: string;
  content: unknown;
  timestamp?: number;
  id?: string;
}

function extractMessageText(message: MessageLike): string {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return (message.content as Array<{ type?: string; text?: string }>)
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text ?? '')
      .join('\n\n');
  }
  return JSON.stringify(message.content);
}

function toMarkdown(
  sessionTitle: string,
  messages: MessageLike[],
  options: ExportOptions
): string {
  const lines: string[] = [];
  lines.push(`# ${sessionTitle}`);
  lines.push('');
  lines.push(`_Exported ${new Date().toISOString()}_`);
  lines.push('');
  for (const msg of messages) {
    const text = options.redactSecrets ? redact(extractMessageText(msg)) : extractMessageText(msg);
    if (!text.trim()) continue;
    const role = msg.role === 'user' ? '**You**' : msg.role === 'assistant' ? '**Assistant**' : `**${msg.role}**`;
    lines.push(`## ${role}`);
    if (msg.timestamp) {
      lines.push(`_${new Date(msg.timestamp).toISOString()}_`);
    }
    lines.push('');
    lines.push(text);
    lines.push('');
  }
  return lines.join('\n');
}

function toJson(
  sessionTitle: string,
  messages: MessageLike[],
  options: ExportOptions
): string {
  const sanitized = options.redactSecrets
    ? messages.map((m) => ({
        ...m,
        content:
          typeof m.content === 'string'
            ? redact(m.content)
            : Array.isArray(m.content)
              ? (m.content as Array<{ type?: string; text?: string }>).map((b) =>
                  b.type === 'text' && typeof b.text === 'string'
                    ? { ...b, text: redact(b.text) }
                    : b
                )
              : m.content,
      }))
    : messages;

  const payload = {
    title: sessionTitle,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: sanitized,
  };
  return JSON.stringify(payload, null, 2);
}

function toHtml(
  sessionTitle: string,
  messages: MessageLike[],
  options: ExportOptions
): string {
  const messagesHtml = messages
    .map((msg) => {
      const text = options.redactSecrets
        ? redact(extractMessageText(msg))
        : extractMessageText(msg);
      if (!text.trim()) return '';
      const escaped = escapeHtml(text).replace(/\n/g, '<br/>');
      const roleLabel =
        msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Assistant' : msg.role;
      const timestamp = msg.timestamp
        ? `<time>${new Date(msg.timestamp).toISOString()}</time>`
        : '';
      return `<article class="${msg.role}"><header>${escapeHtml(roleLabel)}${timestamp}</header><div>${escaped}</div></article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(sessionTitle)}</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; line-height: 1.6; }
    h1 { font-size: 1.5rem; }
    article { padding: 1rem; border-radius: 8px; margin: 1rem 0; }
    article.user { background: #eef2ff; }
    article.assistant { background: #f4f4f5; }
    article header { font-weight: 600; margin-bottom: 0.5rem; display: flex; justify-content: space-between; }
    article time { font-weight: normal; color: #666; font-size: 0.85em; }
    article div { white-space: pre-wrap; word-wrap: break-word; }
    footer { text-align: center; color: #999; font-size: 0.85em; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(sessionTitle)}</h1>
  <p><em>Exported ${new Date().toISOString()}</em></p>
  ${messagesHtml}
  <footer>Generated by Code Buddy Cowork</footer>
</body>
</html>`;
}

function buildFilename(sessionTitle: string, format: ExportFormat): string {
  const safe = sessionTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'session';
  const ext = format === 'markdown' ? 'md' : format === 'html' ? 'html' : 'json';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${safe}_${stamp}.${ext}`;
}

export class SessionExportService {
  constructor(private sessionManager: SessionManager) {}

  exportSession(sessionId: string, options: ExportOptions): ExportResult {
    try {
      const sm = this.sessionManager as unknown as {
        getMessages?: (id: string) => unknown[];
        getSession?: (id: string) => { title?: string } | null;
      };
      const messages = (sm.getMessages?.(sessionId) ?? []) as MessageLike[];
      const session = sm.getSession?.(sessionId);
      const title = session?.title ?? `Session ${sessionId}`;

      let content: string;
      if (options.format === 'markdown') {
        content = toMarkdown(title, messages, options);
      } else if (options.format === 'html') {
        content = toHtml(title, messages, options);
      } else {
        content = toJson(title, messages, options);
      }

      return {
        success: true,
        content,
        filename: buildFilename(title, options.format),
      };
    } catch (err) {
      return {
        success: false,
        content: '',
        filename: '',
        error: (err as Error).message ?? 'Export failed',
      };
    }
  }

  saveToFile(targetPath: string, content: string): { success: boolean; error?: string } {
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message ?? 'Write failed' };
    }
  }
}
