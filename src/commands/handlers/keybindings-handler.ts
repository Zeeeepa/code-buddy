/**
 * Keybindings Handler
 *
 * Manages custom keybindings for the terminal UI with
 * load/save persistence and sensible defaults.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface KeyBinding {
  key: string;
  action: string;
  context?: string;
  chord?: string[];
}

// ============================================================================
// KeybindingsManager
// ============================================================================

let instance: KeybindingsManager | null = null;

const DEFAULT_KEYBINDINGS: KeyBinding[] = [
  { key: 'ctrl+c', action: 'cancel' },
  { key: 'ctrl+d', action: 'exit' },
  { key: 'ctrl+l', action: 'clear' },
  { key: 'ctrl+z', action: 'undo' },
  { key: 'ctrl+y', action: 'redo' },
  { key: 'ctrl+s', action: 'save' },
  { key: 'tab', action: 'autocomplete' },
  { key: 'up', action: 'history-prev' },
  { key: 'down', action: 'history-next' },
  { key: 'escape', action: 'dismiss' },
];

export class KeybindingsManager {
  private bindings: Map<string, KeyBinding> = new Map();
  private configPath: string;

  constructor(configDir?: string) {
    const dir = configDir || path.join(os.homedir(), '.codebuddy');
    this.configPath = path.join(dir, 'keybindings.json');
  }

  static getInstance(configDir?: string): KeybindingsManager {
    if (!instance) {
      instance = new KeybindingsManager(configDir);
    }
    return instance;
  }

  static resetInstance(): void {
    instance = null;
  }

  loadKeybindings(): KeyBinding[] {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        this.bindings.clear();
        if (Array.isArray(data)) {
          for (const binding of data) {
            this.bindings.set(binding.key, binding);
          }
        }
        logger.debug('Loaded keybindings', { count: this.bindings.size });
        return Array.from(this.bindings.values());
      }
    } catch (err) {
      logger.warn('Failed to load keybindings', { error: err });
    }
    // Load defaults if no file
    this.resetToDefaults();
    return Array.from(this.bindings.values());
  }

  saveKeybindings(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(Array.from(this.bindings.values()), null, 2)
      );
      logger.debug('Saved keybindings', { count: this.bindings.size });
    } catch (err) {
      logger.warn('Failed to save keybindings', { error: err });
    }
  }

  setBinding(key: string, action: string, context?: string): void {
    const binding: KeyBinding = { key, action };
    if (context) {
      binding.context = context;
    }
    this.bindings.set(key, binding);
  }

  removeBinding(key: string): boolean {
    return this.bindings.delete(key);
  }

  getBinding(key: string): KeyBinding | undefined {
    return this.bindings.get(key);
  }

  listBindings(): KeyBinding[] {
    return Array.from(this.bindings.values());
  }

  getDefaults(): KeyBinding[] {
    return [...DEFAULT_KEYBINDINGS];
  }

  resetToDefaults(): void {
    this.bindings.clear();
    for (const binding of DEFAULT_KEYBINDINGS) {
      this.bindings.set(binding.key, { ...binding });
    }
  }

  formatBindingsTable(): string {
    const bindings = this.listBindings();
    if (bindings.length === 0) {
      return 'No keybindings configured.';
    }

    const lines: string[] = [];
    lines.push('Key Bindings:');
    lines.push('─'.repeat(50));
    lines.push(`${'Key'.padEnd(20)} ${'Action'.padEnd(20)} Context`);
    lines.push('─'.repeat(50));

    for (const binding of bindings) {
      lines.push(
        `${binding.key.padEnd(20)} ${binding.action.padEnd(20)} ${binding.context || ''}`
      );
    }

    return lines.join('\n');
  }
}

export function getKeybindingsManager(configDir?: string): KeybindingsManager {
  return KeybindingsManager.getInstance(configDir);
}

export function resetKeybindingsManager(): void {
  KeybindingsManager.resetInstance();
}
