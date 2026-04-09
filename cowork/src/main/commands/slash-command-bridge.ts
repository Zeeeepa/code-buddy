/**
 * SlashCommandBridge — Claude Cowork parity Phase 2
 *
 * Exposes Code Buddy's built-in slash command catalog to the renderer so the
 * `/` palette in ChatView can discover and execute commands without rebuilding
 * the command handler in the renderer.
 *
 * The bridge is deliberately thin: it reads the catalog (via
 * `src/commands/slash/`) and a few metadata helpers, and routes execution back
 * to the engine runner or direct handlers (`handleSlashCommand` from the
 * compiled dist when available).
 *
 * @module main/commands/slash-command-bridge
 */

import { log, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';
import { getCustomCommandsService } from './custom-commands-service';

export interface SlashCommandArg {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface SlashCommandDef {
  name: string;
  description: string;
  prompt: string;
  category?: string;
  isBuiltin: boolean;
  arguments?: SlashCommandArg[];
}

export interface SlashCommandExecuteResult {
  success: boolean;
  /** Text that should be injected as the user prompt (if any) */
  prompt?: string;
  /** Free-form message shown in the chat (e.g. "Cleared", "Switched model") */
  message?: string;
  error?: string;
  /** True when the command handled everything itself (no LLM round needed) */
  handled?: boolean;
}

export interface RemoteSlashCommandResult {
  allowed: boolean;
  prompt?: string;
  message?: string;
}

type CoreSlashModule = {
  builtinCommands: SlashCommandDef[];
  getCommandsByCategory: () => Record<string, SlashCommandDef[]>;
};

let cachedSlashModule: CoreSlashModule | null = null;

async function loadSlashModule(): Promise<CoreSlashModule | null> {
  if (cachedSlashModule) return cachedSlashModule;
  const mod = await loadCoreModule<CoreSlashModule>('commands/slash/index.js');
  if (mod) {
    cachedSlashModule = mod;
    log('[SlashCommandBridge] Core slash catalog loaded');
  } else {
    logWarn('[SlashCommandBridge] Core slash catalog unavailable');
  }
  return mod;
}

export class SlashCommandBridge {
  /** List built-in + user-defined slash commands (flat). */
  async listCommands(): Promise<SlashCommandDef[]> {
    const mod = await loadSlashModule();
    const builtins: SlashCommandDef[] = [];
    if (mod) {
      try {
        const byCategory = mod.getCommandsByCategory();
        for (const [category, commands] of Object.entries(byCategory)) {
          for (const cmd of commands) {
            builtins.push({ ...cmd, category });
          }
        }
      } catch (err) {
        logWarn('[SlashCommandBridge] Failed to list commands:', err);
      }
    }

    // Phase 3 step 6: merge user-defined commands (custom category).
    const customs = (() => {
      try {
        return getCustomCommandsService().list();
      } catch {
        return [] as SlashCommandDef[];
      }
    })();

    // Custom names take precedence over built-ins with the same name.
    const customNames = new Set(customs.map((c) => c.name));
    return [...customs, ...builtins.filter((b) => !customNames.has(b.name))];
  }

  /** Autocomplete suggestions for a `/` prefix (e.g. `/mem` → memory, mem-list). */
  async autocomplete(prefix: string, limit = 20): Promise<SlashCommandDef[]> {
    const all = await this.listCommands();
    const trimmed = prefix.trim().toLowerCase();
    const query = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

    if (!query) return all.slice(0, limit);

    // Two-tier scoring: exact prefix > substring match
    const exact: SlashCommandDef[] = [];
    const substr: SlashCommandDef[] = [];
    for (const cmd of all) {
      const name = cmd.name.toLowerCase();
      if (name.startsWith(query)) exact.push(cmd);
      else if (name.includes(query) || cmd.description.toLowerCase().includes(query))
        substr.push(cmd);
    }
    return [...exact, ...substr].slice(0, limit);
  }

  /**
   * Execute a slash command. Returns a prompt that should be sent to the LLM,
   * or a `handled: true` result when the command was fully handled client-side
   * (e.g. `/clear`, `/help`, `/theme`).
   *
   * For now this implementation is prompt-rewriting only: the majority of
   * built-in commands use `__TOKEN__` prompts that the engine runner should
   * interpret, or they're natural-language prompts that we can forward as-is.
   * Commands that require stateful client handling (`__CLEAR_CHAT__`,
   * `__HELP__`, `__HISTORY__`, etc.) return `handled: true` with a message
   * so the renderer can react.
   */
  async execute(
    name: string,
    args: string[] = [],
    _sessionId?: string
  ): Promise<SlashCommandExecuteResult> {
    const all = await this.listCommands();
    const cmd = all.find((c) => c.name === name);
    if (!cmd) {
      return { success: false, error: `Unknown command: /${name}` };
    }

    const joined = args.join(' ').trim();

    // Handle special tokens the renderer can resolve directly.
    if (cmd.prompt.startsWith('__') && cmd.prompt.endsWith('__')) {
      return {
        success: true,
        handled: true,
        message: cmd.prompt, // the renderer switches on this
      };
    }

    // Natural-language prompt commands: substitute {{args}} or append.
    let resolved = cmd.prompt;
    if (resolved.includes('{{args}}')) {
      resolved = resolved.replace(/\{\{args\}\}/g, joined);
    } else if (joined) {
      resolved = `${resolved}\n\n${joined}`;
    }

    return {
      success: true,
      prompt: resolved,
      handled: false,
    };
  }

  async executeRemoteInput(
    rawInput: string,
    sessionId?: string
  ): Promise<RemoteSlashCommandResult> {
    const trimmed = rawInput.trim();
    if (!trimmed.startsWith('/')) {
      return { allowed: true, prompt: rawInput };
    }

    const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
    const [name, ...args] = parts;
    if (!name) {
      return { allowed: false, message: 'Empty slash command is not available remotely.' };
    }

    const result = await this.execute(name, args, sessionId);
    if (!result.success) {
      return {
        allowed: false,
        message: result.error ?? `/${name} is not available in remote sessions.`,
      };
    }

    if (result.handled || !result.prompt) {
      return {
        allowed: false,
        message: `/${name} is not available in remote sessions.`,
      };
    }

    return { allowed: true, prompt: result.prompt };
  }
}
