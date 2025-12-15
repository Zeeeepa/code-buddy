/**
 * Session Handlers
 *
 * Manage session history with replay capability (Mistral Vibe-style).
 */

import { ChatEntry } from '../../agent/codebuddy-agent.js';
import {
  InteractionLogger,
  SessionData,
  SessionMetadata,
} from '../../logging/interaction-logger.js';

export interface CommandHandlerResult {
  handled: boolean;
  entry?: ChatEntry;
  sendToAI?: boolean;
}

/**
 * Format a session list for display
 */
function formatSessionList(sessions: SessionMetadata[]): string {
  if (sessions.length === 0) {
    return 'No sessions found.';
  }

  const lines: string[] = ['Recent Sessions:', ''];

  for (const session of sessions) {
    const date = new Date(session.started_at);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const duration = session.duration_ms
      ? `${Math.round(session.duration_ms / 1000)}s`
      : 'ongoing';
    const cost = `$${session.estimated_cost.toFixed(4)}`;

    lines.push(
      `  ${session.short_id}  ${dateStr} ${timeStr}  ${session.model.padEnd(20)}  ` +
      `${session.turns} turns  ${session.tool_calls} tools  ${cost}  ${duration}`
    );

    if (session.description) {
      lines.push(`          └─ ${session.description}`);
    }
  }

  lines.push('');
  lines.push('Use /sessions show <id> to view details');
  lines.push('Use /sessions replay <id> to format for replay');
  lines.push('Use /sessions delete <id> to delete a session');

  return lines.join('\n');
}

/**
 * Format a session for replay (as AI-consumable context)
 */
function formatSessionForReplay(session: SessionData): string {
  const lines: string[] = [];

  lines.push('# Session Replay');
  lines.push(`Session ID: ${session.metadata.short_id}`);
  lines.push(`Model: ${session.metadata.model}`);
  lines.push(`Directory: ${session.metadata.cwd}`);
  lines.push('');
  lines.push('## Conversation');
  lines.push('');

  for (const msg of session.messages) {
    if (msg.role === 'system') continue; // Skip system messages

    const roleLabel = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'Tool';
    lines.push(`### ${roleLabel}`);

    if (msg.content) {
      lines.push(msg.content);
    }

    if (msg.tool_calls?.length) {
      lines.push('');
      lines.push('**Tool calls:**');
      for (const tc of msg.tool_calls) {
        lines.push(`- \`${tc.name}\`: ${tc.success ? '✓' : '✗'}`);
        if (tc.output) {
          lines.push('  ```');
          lines.push('  ' + tc.output.substring(0, 200) + (tc.output.length > 200 ? '...' : ''));
          lines.push('  ```');
        }
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Handle /sessions command
 */
export function handleSessions(args: string[]): CommandHandlerResult {
  const action = args[0]?.toLowerCase() || 'list';
  const param = args.slice(1).join(' ');

  switch (action) {
    case 'list': {
      const limit = parseInt(param) || 10;
      const { sessions, total } = InteractionLogger.listSessions({ limit });

      const content = formatSessionList(sessions);
      const footer = total > sessions.length
        ? `\nShowing ${sessions.length} of ${total} sessions. Use /sessions list <n> for more.`
        : '';

      return {
        handled: true,
        entry: {
          type: 'assistant',
          content: content + footer,
          timestamp: new Date(),
        },
      };
    }

    case 'show': {
      if (!param) {
        return {
          handled: true,
          entry: {
            type: 'assistant',
            content: 'Usage: /sessions show <session-id>',
            timestamp: new Date(),
          },
        };
      }

      const session = InteractionLogger.loadSession(param);
      if (!session) {
        return {
          handled: true,
          entry: {
            type: 'assistant',
            content: `Session not found: ${param}`,
            timestamp: new Date(),
          },
        };
      }

      return {
        handled: true,
        entry: {
          type: 'assistant',
          content: InteractionLogger.formatSession(session),
          timestamp: new Date(),
        },
      };
    }

    case 'replay': {
      if (!param) {
        return {
          handled: true,
          entry: {
            type: 'assistant',
            content: 'Usage: /sessions replay <session-id>',
            timestamp: new Date(),
          },
        };
      }

      const session = InteractionLogger.loadSession(param);
      if (!session) {
        return {
          handled: true,
          entry: {
            type: 'assistant',
            content: `Session not found: ${param}`,
            timestamp: new Date(),
          },
        };
      }

      return {
        handled: true,
        entry: {
          type: 'assistant',
          content: formatSessionForReplay(session),
          timestamp: new Date(),
        },
      };
    }

    case 'delete': {
      if (!param) {
        return {
          handled: true,
          entry: {
            type: 'assistant',
            content: 'Usage: /sessions delete <session-id>',
            timestamp: new Date(),
          },
        };
      }

      const deleted = InteractionLogger.deleteSession(param);
      return {
        handled: true,
        entry: {
          type: 'assistant',
          content: deleted
            ? `Session ${param} deleted.`
            : `Session not found: ${param}`,
          timestamp: new Date(),
        },
      };
    }

    case 'latest': {
      const session = InteractionLogger.getLatestSession();
      if (!session) {
        return {
          handled: true,
          entry: {
            type: 'assistant',
            content: 'No sessions found.',
            timestamp: new Date(),
          },
        };
      }

      return {
        handled: true,
        entry: {
          type: 'assistant',
          content: InteractionLogger.formatSession(session),
          timestamp: new Date(),
        },
      };
    }

    case 'search': {
      if (!param) {
        return {
          handled: true,
          entry: {
            type: 'assistant',
            content: 'Usage: /sessions search <partial-id>',
            timestamp: new Date(),
          },
        };
      }

      const sessions = InteractionLogger.searchSessions(param);
      if (sessions.length === 0) {
        return {
          handled: true,
          entry: {
            type: 'assistant',
            content: `No sessions found matching: ${param}`,
            timestamp: new Date(),
          },
        };
      }

      return {
        handled: true,
        entry: {
          type: 'assistant',
          content: formatSessionList(sessions.map(s => s.metadata)),
          timestamp: new Date(),
        },
      };
    }

    default:
      return {
        handled: true,
        entry: {
          type: 'assistant',
          content: `Unknown action: ${action}\n\nAvailable actions:\n  list [n]       - List recent sessions (default: 10)\n  show <id>      - Show session details\n  replay <id>    - Format session for AI context\n  delete <id>    - Delete a session\n  latest         - Show the most recent session\n  search <text>  - Search sessions by partial ID`,
          timestamp: new Date(),
        },
      };
  }
}
