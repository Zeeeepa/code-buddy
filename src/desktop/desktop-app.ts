/**
 * Desktop App Scaffold
 *
 * Manages desktop application windows and integration with
 * the Code Buddy terminal experience. Supports Electron and Tauri
 * frameworks with multi-window management.
 */

import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

export interface DesktopAppConfig {
  platform: 'darwin' | 'win32' | 'linux';
  framework: 'electron';
  autoUpdate: boolean;
  multiWindow: boolean;
  cloudIntegration: boolean;
}

export interface DesktopWindow {
  id: string;
  title: string;
  sessionId?: string;
  type: 'main' | 'diff' | 'settings' | 'session-picker';
  bounds: { x: number; y: number; width: number; height: number };
  focused: boolean;
}

const DEFAULT_BOUNDS = { x: 100, y: 100, width: 1200, height: 800 };

const DEFAULT_TITLES: Record<DesktopWindow['type'], string> = {
  main: 'Code Buddy',
  diff: 'Diff Viewer',
  settings: 'Settings',
  'session-picker': 'Session Picker',
};

export class DesktopAppManager {
  private config: DesktopAppConfig;
  private windows: Map<string, DesktopWindow>;
  private windowCounter: number;

  constructor(config?: Partial<DesktopAppConfig>) {
    this.config = {
      platform: (process.platform as DesktopAppConfig['platform']) || 'linux',
      framework: 'electron' as const,
      autoUpdate: true,
      multiWindow: true,
      cloudIntegration: false,
      ...config,
    };
    this.windows = new Map();
    this.windowCounter = 0;
    logger.debug('DesktopAppManager initialized', { platform: this.config.platform, framework: this.config.framework });
  }

  createWindow(type: DesktopWindow['type'], options?: Partial<DesktopWindow>): DesktopWindow {
    if (!this.config.multiWindow && this.windows.size > 0 && type !== 'main') {
      throw new Error('Multi-window is disabled. Only one window allowed.');
    }

    this.windowCounter++;
    const id = options?.id || `window-${this.windowCounter}`;

    // Unfocus all existing windows
    for (const w of this.windows.values()) {
      w.focused = false;
    }

    const window: DesktopWindow = {
      id,
      title: options?.title || DEFAULT_TITLES[type] || 'Code Buddy',
      sessionId: options?.sessionId,
      type,
      bounds: options?.bounds || { ...DEFAULT_BOUNDS },
      focused: true,
    };

    this.windows.set(id, window);
    logger.info('Window created', { id, type });
    return { ...window };
  }

  getWindow(id: string): DesktopWindow | null {
    const w = this.windows.get(id);
    return w ? { ...w } : null;
  }

  listWindows(): DesktopWindow[] {
    return Array.from(this.windows.values()).map(w => ({ ...w }));
  }

  closeWindow(id: string): boolean {
    if (!this.windows.has(id)) {
      return false;
    }
    this.windows.delete(id);
    logger.info('Window closed', { id });
    return true;
  }

  focusWindow(id: string): boolean {
    const window = this.windows.get(id);
    if (!window) {
      return false;
    }

    for (const w of this.windows.values()) {
      w.focused = false;
    }
    window.focused = true;
    logger.debug('Window focused', { id });
    return true;
  }

  openDiffView(sessionId: string, files: string[]): DesktopWindow {
    return this.createWindow('diff', {
      title: `Diff: ${files.length} file(s)`,
      sessionId,
    });
  }

  openSessionPicker(): DesktopWindow {
    return this.createWindow('session-picker');
  }

  getInstallerConfig(): Record<string, unknown> {
    const base = {
      appId: 'com.codebuddy.desktop',
      productName: 'Code Buddy',
      framework: this.config.framework,
      autoUpdate: this.config.autoUpdate,
    };

    return {
      ...base,
      electronVersion: '35.7.5',
      build: {
        appId: base.appId,
        productName: base.productName,
        directories: { output: 'release' },
        mac: { category: 'public.app-category.developer-tools' },
        win: { target: ['nsis'] },
        linux: { target: ['AppImage'] },
      },
    };
  }

  getPlatform(): string {
    return this.config.platform;
  }

  isDesktopAvailable(): boolean {
    return this.config.framework === 'electron';
  }

  getWindowCount(): number {
    return this.windows.size;
  }
}
