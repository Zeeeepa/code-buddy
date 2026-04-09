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
  action?: {
    type: 'open_schedule' | 'create_schedule';
    draft?: SlashScheduleDraft;
    createInput?: SlashScheduleCreateInput;
  };
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

export interface SlashScheduleDraft {
  prompt: string;
  cwd?: string;
  scheduleMode: 'once' | 'daily' | 'weekly';
  runAt?: string;
  selectedTimes?: string[];
  selectedWeekdays?: SlashScheduleWeekday[];
  enabled?: boolean;
}

export type SlashScheduleWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface SlashScheduleCreateInput {
  prompt: string;
  cwd?: string;
  runAt: number;
  nextRunAt: number;
  scheduleConfig:
    | {
        kind: 'daily';
        times: string[];
      }
      | {
        kind: 'weekly';
        weekdays: SlashScheduleWeekday[];
        times: string[];
      }
    | null;
  enabled: boolean;
}

const SYNTHETIC_COMMANDS: SlashCommandDef[] = [
  {
    name: 'schedule',
    description: 'Open the schedule form to create a recurring or one-shot task',
    prompt: '__OPEN_SCHEDULE__',
    category: 'workflow',
    isBuiltin: true,
    arguments: [
      {
        name: 'rule',
        description: 'Optional: daily 09:00 | weekly mon 09:00 | once 2026-04-10T09:00',
        required: false,
      },
      {
        name: 'task',
        description: 'Prompt to run on the schedule',
        required: false,
      },
    ],
  },
];

function isTimeToken(value: string | undefined): value is string {
  return typeof value === 'string' && /^\d{2}:\d{2}$/.test(value);
}

function weekdayTokenToIndex(value: string | undefined): SlashScheduleWeekday | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const map: Record<string, SlashScheduleWeekday> = {
    mon: 1,
    monday: 1,
    tue: 2,
    tues: 2,
    tuesday: 2,
    wed: 3,
    weds: 3,
    wednesday: 3,
    thu: 4,
    thur: 4,
    thurs: 4,
    thursday: 4,
    fri: 5,
    friday: 5,
    sat: 6,
    saturday: 6,
    sun: 0,
    sunday: 0,
  };
  return normalized in map ? map[normalized] : null;
}

function normalizeDateTimeLocal(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function parseScheduleSlashArgs(args: string[]): SlashScheduleDraft {
  const [first, second, third, ...rest] = args;

  if (first?.toLowerCase() === 'daily' && isTimeToken(second)) {
    return {
      prompt: args.slice(2).join(' ').trim(),
      scheduleMode: 'daily',
      selectedTimes: [second],
      enabled: true,
    };
  }

  const weekday = weekdayTokenToIndex(second);
  if (first?.toLowerCase() === 'weekly' && weekday !== null && isTimeToken(third)) {
    return {
      prompt: args.slice(3).join(' ').trim(),
      scheduleMode: 'weekly',
      selectedWeekdays: [weekday],
      selectedTimes: [third],
      enabled: true,
    };
  }

  const onceDateToken =
    first?.toLowerCase() === 'once'
      ? normalizeDateTimeLocal(second)
      : normalizeDateTimeLocal(first);
  if (onceDateToken) {
    return {
      prompt: (first?.toLowerCase() === 'once' ? [third, ...rest] : [second, third, ...rest])
        .filter(Boolean)
        .join(' ')
        .trim(),
      scheduleMode: 'once',
      runAt: onceDateToken,
      enabled: true,
    };
  }

  return {
    prompt: args.join(' ').trim(),
    scheduleMode: 'once',
    enabled: true,
  };
}

function buildNextRunAtForDaily(time: string, now = Date.now()): number {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

function buildNextRunAtForWeekly(weekday: number, time: string, now = Date.now()): number {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hours, minutes, 0, 0);

  const currentWeekday = next.getDay();
  let delta = weekday - currentWeekday;
  if (delta < 0) {
    delta += 7;
  }
  if (delta === 0 && next.getTime() <= now) {
    delta = 7;
  }
  next.setDate(next.getDate() + delta);
  return next.getTime();
}

export function buildScheduleCreateInputFromArgs(
  args: string[],
  now = Date.now()
): SlashScheduleCreateInput | null {
  const draft = parseScheduleSlashArgs(args);
  const trimmedPrompt = draft.prompt.trim();
  if (!trimmedPrompt) {
    return null;
  }

  if (draft.scheduleMode === 'once') {
    const nextRunAt = draft.runAt ? new Date(draft.runAt).getTime() : NaN;
    if (!Number.isFinite(nextRunAt) || nextRunAt <= now) {
      return null;
    }
    return {
      prompt: trimmedPrompt,
      cwd: draft.cwd,
      runAt: nextRunAt,
      nextRunAt,
      scheduleConfig: null,
      enabled: draft.enabled ?? true,
    };
  }

  if (draft.scheduleMode === 'daily') {
    const time = draft.selectedTimes?.[0];
    if (!isTimeToken(time)) {
      return null;
    }
    const nextRunAt = buildNextRunAtForDaily(time, now);
    return {
      prompt: trimmedPrompt,
      cwd: draft.cwd,
      runAt: nextRunAt,
      nextRunAt,
      scheduleConfig: {
        kind: 'daily',
        times: [time],
      },
      enabled: draft.enabled ?? true,
    };
  }

  const weekday = draft.selectedWeekdays?.[0];
  const time = draft.selectedTimes?.[0];
  if (typeof weekday !== 'number' || !isTimeToken(time)) {
    return null;
  }
  const nextRunAt = buildNextRunAtForWeekly(weekday, time, now);
  return {
    prompt: trimmedPrompt,
    cwd: draft.cwd,
    runAt: nextRunAt,
    nextRunAt,
    scheduleConfig: {
      kind: 'weekly',
      weekdays: [weekday],
      times: [time],
    },
    enabled: draft.enabled ?? true,
  };
}

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
    const synthetic = SYNTHETIC_COMMANDS.filter(
      (item) => !customNames.has(item.name) && !builtins.some((builtin) => builtin.name === item.name)
    );
    return [...customs, ...synthetic, ...builtins.filter((b) => !customNames.has(b.name))];
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

    if (cmd.name === 'schedule') {
      const createInput = buildScheduleCreateInputFromArgs(args);
      return {
        success: true,
        handled: true,
        message: createInput ? '__CREATE_SCHEDULE__' : '__OPEN_SCHEDULE__',
        action: createInput
          ? {
              type: 'create_schedule',
              createInput,
            }
          : {
              type: 'open_schedule',
              draft: parseScheduleSlashArgs(args),
            },
      };
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
