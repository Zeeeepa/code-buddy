import type { Message } from '../types';

export function extractMessageSearchText(message: Message): string {
  return message.content
    .map((block) => {
      if (block.type === 'text') return block.text;
      if (block.type === 'thinking') return block.thinking;
      if (block.type === 'tool_result') return block.content;
      if (block.type === 'tool_use') return `${block.name} ${JSON.stringify(block.input)}`;
      if (block.type === 'file_attachment') return block.filename;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function findMessageSearchMatches(messages: Message[], query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  return messages
    .filter((message) => extractMessageSearchText(message).toLowerCase().includes(normalizedQuery))
    .map((message) => message.id);
}
