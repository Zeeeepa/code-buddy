/**
 * Session & Misc Enhancements
 * Per-session settings, update channels, and elevated mode management.
 */

import { logger } from './logger.js';

export class SessionPersistentSettings {
  private static instance: SessionPersistentSettings | null = null;
  private sessions: Map<string, Map<string, unknown>> = new Map();

  static getInstance(): SessionPersistentSettings {
    if (!SessionPersistentSettings.instance) {
      SessionPersistentSettings.instance = new SessionPersistentSettings();
    }
    return SessionPersistentSettings.instance;
  }

  static resetInstance(): void {
    SessionPersistentSettings.instance = null;
  }

  set(sessionId: string, key: string, value: unknown): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Map());
    }
    this.sessions.get(sessionId)!.set(key, value);
    logger.debug(`Session ${sessionId}: set ${key}`);
  }

  get(sessionId: string, key: string): unknown {
    return this.sessions.get(sessionId)?.get(key);
  }

  getAll(sessionId: string): Record<string, unknown> {
    const map = this.sessions.get(sessionId);
    if (!map) return {};
    const result: Record<string, unknown> = {};
    for (const [k, v] of map) {
      result[k] = v;
    }
    return result;
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
    logger.debug(`Session ${sessionId}: cleared`);
  }
}

export class UpdateChannelManager {
  private static instance: UpdateChannelManager | null = null;
  readonly channels = ['stable', 'beta', 'dev'] as const;
  private currentChannel: string = 'stable';

  static getInstance(): UpdateChannelManager {
    if (!UpdateChannelManager.instance) {
      UpdateChannelManager.instance = new UpdateChannelManager();
    }
    return UpdateChannelManager.instance;
  }

  static resetInstance(): void {
    UpdateChannelManager.instance = null;
  }

  getCurrentChannel(): string {
    return this.currentChannel;
  }

  setChannel(channel: string): void {
    if (!this.isValidChannel(channel)) {
      throw new Error(`Invalid channel: ${channel}. Must be one of: ${this.channels.join(', ')}`);
    }
    this.currentChannel = channel;
    logger.debug(`Update channel set to: ${channel}`);
  }

  getLatestVersion(channel: string): { version: string; channel: string; date: string } {
    if (!this.isValidChannel(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    // Stub implementation
    const versions: Record<string, string> = {
      stable: '1.0.0',
      beta: '1.1.0-beta.1',
      dev: '1.2.0-dev.1',
    };
    return {
      version: versions[channel] || '0.0.0',
      channel,
      date: new Date().toISOString(),
    };
  }

  isValidChannel(channel: string): boolean {
    return (this.channels as readonly string[]).includes(channel);
  }
}

export class ElevatedModeManager {
  private static instance: ElevatedModeManager | null = null;
  private elevated: boolean = false;

  static getInstance(): ElevatedModeManager {
    if (!ElevatedModeManager.instance) {
      ElevatedModeManager.instance = new ElevatedModeManager();
    }
    return ElevatedModeManager.instance;
  }

  static resetInstance(): void {
    ElevatedModeManager.instance = null;
  }

  isElevated(): boolean {
    return this.elevated;
  }

  enable(): void {
    this.elevated = true;
    logger.debug('Elevated mode enabled');
  }

  disable(): void {
    this.elevated = false;
    logger.debug('Elevated mode disabled');
  }

  toggle(): boolean {
    this.elevated = !this.elevated;
    logger.debug(`Elevated mode toggled to: ${this.elevated}`);
    return this.elevated;
  }

  getWarning(): string {
    return 'WARNING: Elevated mode bypasses safety confirmations. Use with caution.';
  }
}
