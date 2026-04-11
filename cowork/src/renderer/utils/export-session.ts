/**
 * Session Export Utility — Format messages as Markdown or JSON
 */
import i18n from '../i18n/config';
import type { Message, TextContent, ToolUseContent, ToolResultContent, ThinkingContent } from '../types';
import { formatAppDateTime } from './i18n-format';

export function exportAsMarkdown(messages: Message[], sessionTitle: string): string {
  const lines: string[] = [];
  lines.push(`# ${sessionTitle}`);
  lines.push(`> ${i18n.t('exportSession.exportedOn', 'Exported on')} ${formatAppDateTime(new Date())}`);
  lines.push('');

  for (const msg of messages) {
    const roleLabel =
      msg.role === 'user'
        ? i18n.t('exportSession.user', 'User')
        : msg.role === 'assistant'
          ? i18n.t('exportSession.assistant', 'Assistant')
          : i18n.t('exportSession.system', 'System');
    lines.push(`## ${roleLabel}`);
    lines.push('');

    for (const block of msg.content) {
      switch (block.type) {
        case 'text':
          lines.push((block as TextContent).text);
          lines.push('');
          break;
        case 'tool_use': {
          const tu = block as ToolUseContent;
          lines.push(`**${i18n.t('exportSession.tool', 'Tool')}: ${tu.name}**`);
          lines.push('```json');
          lines.push(JSON.stringify(tu.input, null, 2));
          lines.push('```');
          lines.push('');
          break;
        }
        case 'tool_result': {
          const tr = block as ToolResultContent;
          const status = tr.isError
            ? i18n.t('exportSession.error', 'Error')
            : i18n.t('exportSession.result', 'Result');
          lines.push(`**${status}:**`);
          if (tr.content) {
            lines.push('```');
            lines.push(tr.content.length > 2000 ? tr.content.slice(0, 2000) + '\n...' : tr.content);
            lines.push('```');
          }
          lines.push('');
          break;
        }
        case 'thinking': {
          const th = block as ThinkingContent;
          lines.push('<details>');
          lines.push(`<summary>${i18n.t('exportSession.thinking', 'Thinking')}</summary>`);
          lines.push('');
          lines.push(th.thinking);
          lines.push('');
          lines.push('</details>');
          lines.push('');
          break;
        }
      }
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function exportAsJSON(messages: Message[], sessionTitle: string): string {
  return JSON.stringify({
    title: sessionTitle,
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    messages: messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      tokenUsage: msg.tokenUsage,
    })),
  }, null, 2);
}
