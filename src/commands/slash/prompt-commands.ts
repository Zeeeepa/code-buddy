/**
 * /prompt Slash Commands
 *
 * Manages custom user prompts with YAML frontmatter support.
 * Commands: /prompt list, /prompt use <id>, /prompt info <id>
 *
 * Inspired by Codex CLI's $CODEX_HOME/prompts/*.md with frontmatter.
 */

import type { SlashCommand } from './types.js';

// ============================================================================
// Command Definitions
// ============================================================================

export const promptCommands: SlashCommand[] = [
  {
    name: 'prompt',
    description: 'Manage custom prompts: list, use <id>, info <id>',
    prompt: '__PROMPT__',
    filePath: '',
    isBuiltin: true,
    arguments: [
      { name: 'action', description: 'list | use <id> | info <id>', required: false },
    ],
  },
];

// ============================================================================
// Handler
// ============================================================================

/**
 * Handle /prompt commands. Returns a user-facing string.
 */
export async function handlePromptCommand(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const action = parts[0] || 'list';
  const id = parts[1];

  const { getPromptManager } = await import('../../prompts/prompt-manager.js');
  const pm = getPromptManager();

  switch (action) {
    case 'list': {
      const prompts = await pm.listPrompts();
      if (prompts.length === 0) {
        return 'No custom prompts found. Create one in ~/.codebuddy/prompts/<name>.md';
      }
      const lines = prompts.map(p => {
        const meta = pm.getPromptMeta(p.id);
        const desc = meta?.description ? ` — ${meta.description}` : '';
        const tags = meta?.tags?.length ? ` [${meta.tags.join(', ')}]` : '';
        return `  ${p.source === 'user' ? '*' : ' '} ${p.id}${desc}${tags}`;
      });
      return `Available prompts (* = user-defined):\n${lines.join('\n')}`;
    }

    case 'use': {
      if (!id) return 'Usage: /prompt use <id>';
      try {
        await pm.loadPrompt(id);
        return `Prompt "${id}" loaded. It will be used for the next system prompt build.`;
      } catch {
        return `Prompt "${id}" not found. Run /prompt list to see available prompts.`;
      }
    }

    case 'info': {
      if (!id) return 'Usage: /prompt info <id>';
      const meta = pm.getPromptMeta(id);
      if (!meta) {
        // Try loading it to populate meta
        try {
          await pm.loadPrompt(id);
        } catch {
          return `Prompt "${id}" not found.`;
        }
        const freshMeta = pm.getPromptMeta(id);
        if (!freshMeta) return `Prompt "${id}" has no frontmatter metadata.`;
        return formatMeta(id, freshMeta);
      }
      return formatMeta(id, meta);
    }

    default:
      return 'Usage: /prompt list | /prompt use <id> | /prompt info <id>';
  }
}

function formatMeta(id: string, meta: { description?: string; argumentHint?: string; tags?: string[] }): string {
  const lines = [`Prompt: ${id}`];
  if (meta.description) lines.push(`  Description: ${meta.description}`);
  if (meta.argumentHint) lines.push(`  Argument hint: ${meta.argumentHint}`);
  if (meta.tags?.length) lines.push(`  Tags: ${meta.tags.join(', ')}`);
  return lines.join('\n');
}
