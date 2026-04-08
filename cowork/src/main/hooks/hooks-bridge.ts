/**
 * HooksBridge — Claude Cowork parity Phase 3 step 13
 *
 * Reads and writes `.codebuddy/hooks.json` so the Cowork settings UI can
 * visually manage user-configurable hooks (PreToolUse, PostToolUse,
 * SessionStart, FileChanged, …). Each event maps to an ordered list of
 * handlers with type `command | http | prompt | agent`. Also exposes a
 * `test()` dry-run that executes a single command handler in the project
 * directory so authors can validate their script before saving.
 *
 * The core `UserHooksManager` still owns execution at runtime — this
 * bridge only touches the JSON config file, preserving full parity with
 * Code Buddy's format.
 *
 * @module main/hooks/hooks-bridge
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

export type UserHookEvent =
  | 'SessionStart'
  | 'SessionEnd'
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'PermissionRequest'
  | 'PermissionDenied'
  | 'Stop'
  | 'StopFailure'
  | 'FileChanged'
  | 'PreCompact'
  | 'PostCompact'
  | 'SubagentStart'
  | 'SubagentStop'
  | 'TaskCreated'
  | 'TaskCompleted';

export const HOOK_EVENTS: UserHookEvent[] = [
  'SessionStart',
  'SessionEnd',
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
  'PermissionRequest',
  'PermissionDenied',
  'Stop',
  'StopFailure',
  'FileChanged',
  'PreCompact',
  'PostCompact',
  'SubagentStart',
  'SubagentStop',
  'TaskCreated',
  'TaskCompleted',
];

export type UserHookHandlerType = 'command' | 'http' | 'prompt' | 'agent';

export interface UserHookHandler {
  type: UserHookHandlerType;
  command?: string;
  url?: string;
  headers?: Record<string, string>;
  prompt?: string;
  agent?: { role?: string; prompt: string };
  if?: string;
  timeout?: number;
}

export interface HooksConfigFile {
  hooks: Partial<Record<UserHookEvent, UserHookHandler[]>>;
}

export interface HookEntry {
  id: string;
  event: UserHookEvent;
  index: number;
  handler: UserHookHandler;
}

export interface HooksTestResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  error?: string;
}

export class HooksBridge {
  private workspaceDir: string | null = null;

  setWorkspace(dir: string | null): void {
    this.workspaceDir = dir;
  }

  private configPath(): string | null {
    if (!this.workspaceDir) return null;
    return path.join(this.workspaceDir, '.codebuddy', 'hooks.json');
  }

  async readConfig(): Promise<HooksConfigFile> {
    const p = this.configPath();
    if (!p) return { hooks: {} };
    try {
      const raw = await fs.readFile(p, 'utf-8');
      const parsed = JSON.parse(raw) as HooksConfigFile;
      return {
        hooks: parsed.hooks ?? {},
      };
    } catch {
      return { hooks: {} };
    }
  }

  async writeConfig(config: HooksConfigFile): Promise<void> {
    const p = this.configPath();
    if (!p) throw new Error('No workspace directory');
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(config, null, 2), 'utf-8');
  }

  async list(): Promise<HookEntry[]> {
    const config = await this.readConfig();
    const entries: HookEntry[] = [];
    for (const ev of HOOK_EVENTS) {
      const handlers = config.hooks[ev] ?? [];
      handlers.forEach((handler, idx) => {
        entries.push({
          id: `${ev}:${idx}`,
          event: ev,
          index: idx,
          handler,
        });
      });
    }
    return entries;
  }

  async upsert(
    event: UserHookEvent,
    handler: UserHookHandler,
    index?: number
  ): Promise<{ success: boolean; entry?: HookEntry; error?: string }> {
    try {
      const config = await this.readConfig();
      const list = config.hooks[event] ?? [];
      if (typeof index === 'number' && index >= 0 && index < list.length) {
        list[index] = handler;
      } else {
        list.push(handler);
      }
      config.hooks[event] = list;
      await this.writeConfig(config);
      const newIndex = typeof index === 'number' ? index : list.length - 1;
      return {
        success: true,
        entry: {
          id: `${event}:${newIndex}`,
          event,
          index: newIndex,
          handler,
        },
      };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async remove(event: UserHookEvent, index: number): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.readConfig();
      const list = config.hooks[event];
      if (!list || index < 0 || index >= list.length) {
        return { success: false, error: 'Hook not found' };
      }
      list.splice(index, 1);
      if (list.length === 0) {
        delete config.hooks[event];
      } else {
        config.hooks[event] = list;
      }
      await this.writeConfig(config);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Dry-run a command handler. HTTP/prompt/agent handlers are not
   * executed — they return a no-op success so authors can still save
   * them without triggering side effects from the editor.
   */
  async test(handler: UserHookHandler): Promise<HooksTestResult> {
    if (handler.type !== 'command' || !handler.command) {
      return {
        success: true,
        exitCode: 0,
        stdout: '',
        stderr: '',
        durationMs: 0,
      };
    }
    if (!this.workspaceDir) {
      return {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        error: 'No workspace directory',
      };
    }
    const start = Date.now();
    const timeout = handler.timeout ?? 10_000;
    const isWindows = process.platform === 'win32';
    const shell = isWindows ? 'cmd' : 'sh';
    const shellFlag = isWindows ? '/c' : '-c';

    return new Promise<HooksTestResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let finished = false;
      const child = spawn(shell, [shellFlag, handler.command as string], {
        cwd: this.workspaceDir as string,
        env: { ...process.env, CODEBUDDY_HOOK_DRY_RUN: '1' },
      });
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        try {
          child.kill('SIGTERM');
        } catch {
          /* ignore */
        }
        resolve({
          success: false,
          exitCode: null,
          stdout,
          stderr,
          durationMs: Date.now() - start,
          error: `Timed out after ${timeout}ms`,
        });
      }, timeout);

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on('error', (err) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({
          success: false,
          exitCode: null,
          stdout,
          stderr,
          durationMs: Date.now() - start,
          error: err.message,
        });
      });
      child.on('close', (code) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve({
          success: code === 0,
          exitCode: code,
          stdout,
          stderr,
          durationMs: Date.now() - start,
        });
      });
    });
  }
}

let singleton: HooksBridge | null = null;

export function getHooksBridge(): HooksBridge {
  if (!singleton) {
    singleton = new HooksBridge();
  }
  return singleton;
}
