/**
 * MentionProcessor — Claude Cowork parity
 *
 * Wraps Code Buddy's context-mentions parser so Cowork can process @file,
 * @url, @web, @git, @terminal, @image, @symbol, @search mentions in user
 * messages. Returns the cleaned text plus structured context blocks that
 * get appended to the prompt.
 *
 * @module main/input/mention-processor
 */

import { log, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';
import * as path from 'path';
import { readdirSync, statSync, existsSync } from 'fs';

export interface MentionContextBlock {
  type: string;
  content: string;
  source: string;
}

export interface MentionProcessResult {
  cleanedText: string;
  contextBlocks: MentionContextBlock[];
}

export interface MentionAutocompleteItem {
  label: string;
  value: string;
  description?: string;
  category: 'file' | 'git' | 'web' | 'terminal';
}

type CoreMentionsModule = {
  processMentions: (message: string) => Promise<{
    cleanedMessage: string;
    contextBlocks: Array<{ type: string; content: string; source: string }>;
  }>;
};

let cachedModule: CoreMentionsModule | null = null;

async function loadModule(): Promise<CoreMentionsModule | null> {
  if (cachedModule) return cachedModule;
  const mod = await loadCoreModule<CoreMentionsModule>('input/context-mentions.js');
  if (mod) {
    cachedModule = mod;
    log('[MentionProcessor] Core context-mentions loaded');
  } else {
    logWarn('[MentionProcessor] Core context-mentions unavailable');
  }
  return mod;
}

export class MentionProcessor {
  /** Serialize chdir-bound operations to avoid cross-session races */
  private chdirMutex: Promise<void> = Promise.resolve();

  /** Detect and process all @mentions in a user message */
  async process(text: string, cwd?: string): Promise<MentionProcessResult> {
    const mod = await loadModule();
    if (!mod) {
      return { cleanedText: text, contextBlocks: [] };
    }

    // Serialize chdir-bound work — core context-mentions uses process.cwd()
    // internally, so concurrent callers would otherwise race.
    const previous = this.chdirMutex;
    let release: () => void = () => undefined;
    this.chdirMutex = new Promise((resolve) => {
      release = resolve;
    });

    try {
      await previous;

      const originalCwd = process.cwd();
      let changed = false;
      if (cwd && existsSync(cwd)) {
        try {
          process.chdir(cwd);
          changed = true;
        } catch (err) {
          logWarn('[MentionProcessor] chdir failed:', err);
        }
      }

      try {
        const result = await mod.processMentions(text);
        return {
          cleanedText: result.cleanedMessage,
          contextBlocks: result.contextBlocks,
        };
      } catch (err) {
        logWarn('[MentionProcessor] Processing failed:', err);
        return { cleanedText: text, contextBlocks: [] };
      } finally {
        if (changed) {
          try {
            process.chdir(originalCwd);
          } catch {
            /* ignore */
          }
        }
      }
    } finally {
      release();
    }
  }

  /**
   * Inject context blocks into the prompt as a `<context_mentions>` section.
   * Returns a new prompt with the cleaned message followed by the context.
   */
  buildEnhancedPrompt(result: MentionProcessResult): string {
    if (result.contextBlocks.length === 0) return result.cleanedText;

    const blocks = result.contextBlocks
      .map(
        (block) =>
          `<${block.type} source="${block.source}">\n${block.content}\n</${block.type}>`
      )
      .join('\n\n');

    return `${result.cleanedText}\n\n<context_mentions>\n${blocks}\n</context_mentions>`;
  }

  /** Autocomplete for the MentionAutocomplete UI */
  async autocomplete(
    prefix: string,
    cwd?: string,
    limit = 20
  ): Promise<MentionAutocompleteItem[]> {
    const trimmed = prefix.trim().toLowerCase();

    // Built-in mention categories
    const builtins: MentionAutocompleteItem[] = [
      {
        label: '@file:',
        value: '@file:',
        description: 'Include a file',
        category: 'file',
      },
      { label: '@url:', value: '@url:', description: 'Fetch a URL', category: 'web' },
      { label: '@web', value: '@web ', description: 'Web search query', category: 'web' },
      { label: '@git log', value: '@git log', description: 'Recent git log', category: 'git' },
      { label: '@git diff', value: '@git diff', description: 'Working tree diff', category: 'git' },
      {
        label: '@git blame',
        value: '@git blame ',
        description: 'Blame annotations',
        category: 'git',
      },
      {
        label: '@terminal',
        value: '@terminal',
        description: 'Include recent terminal output',
        category: 'terminal',
      },
    ];

    // File path completions from cwd
    const fileItems: MentionAutocompleteItem[] = [];
    if (cwd && existsSync(cwd) && trimmed.startsWith('file:')) {
      const relPrefix = trimmed.slice(5);
      const parent = path.dirname(relPrefix) || '.';
      const parentAbs = path.resolve(cwd, parent);

      try {
        if (existsSync(parentAbs) && statSync(parentAbs).isDirectory()) {
          const entries = readdirSync(parentAbs);
          const basename = path.basename(relPrefix).toLowerCase();
          for (const entry of entries.slice(0, 50)) {
            if (entry.startsWith('.') && !basename.startsWith('.')) continue;
            if (basename && !entry.toLowerCase().startsWith(basename)) continue;
            const rel = parent === '.' ? entry : `${parent}/${entry}`;
            const full = path.resolve(parentAbs, entry);
            let isDir = false;
            try {
              isDir = statSync(full).isDirectory();
            } catch {
              /* ignore */
            }
            fileItems.push({
              label: `@file:${rel}${isDir ? '/' : ''}`,
              value: `@file:${rel}${isDir ? '/' : ''}`,
              description: isDir ? 'Directory' : 'File',
              category: 'file',
            });
            if (fileItems.length >= limit) break;
          }
        }
      } catch (err) {
        logWarn('[MentionProcessor] Autocomplete fs scan failed:', err);
      }
    }

    // Filter builtins by prefix
    const matchingBuiltins = trimmed
      ? builtins.filter((b) => b.label.toLowerCase().includes(trimmed))
      : builtins;

    return [...fileItems, ...matchingBuiltins].slice(0, limit);
  }
}
