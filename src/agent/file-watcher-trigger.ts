/**
 * File Watcher Trigger
 *
 * Watches source files for changes and triggers agent actions (lint, test,
 * typecheck, notify, custom). Uses fs.watch with debouncing and glob-based
 * filtering via the shared glob-utils.
 */

import { watch, type FSWatcher } from 'fs';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger.js';
import { matchGlobPatterns } from '../utils/glob-utils.js';

// ============================================================================
// Types
// ============================================================================

export interface FileWatcherConfig {
  /** Glob patterns to watch: ['src/**\/*.ts', '*.py'] */
  patterns: string[];
  /** Glob patterns to ignore: ['node_modules/**', 'dist/**'] */
  ignorePatterns: string[];
  /** Debounce interval in ms (default 1000) */
  debounceMs: number;
  /** Actions to trigger on detected change */
  actions: WatchAction[];
}

export type WatchAction = 'lint' | 'test' | 'typecheck' | 'notify' | 'custom';

export interface FileChangeEvent {
  filePath: string;
  changeType: 'create' | 'modify' | 'delete';
  timestamp: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  'dist/**',
  '.git/**',
  '__pycache__/**',
  '.codebuddy/**',
  '*.log',
  '.DS_Store',
  'coverage/**',
  '.next/**',
  '.nuxt/**',
  'build/**',
  'out/**',
];

const DEFAULT_CONFIG: FileWatcherConfig = {
  patterns: ['**/*.ts', '**/*.js', '**/*.py', '**/*.go', '**/*.rs'],
  ignorePatterns: DEFAULT_IGNORE_PATTERNS,
  debounceMs: 1000,
  actions: ['notify'],
};

// ============================================================================
// FileWatcherTrigger
// ============================================================================

/**
 * Watches the filesystem for changes matching configured glob patterns and
 * emits events + triggers actions when files are created, modified, or deleted.
 *
 * Events:
 *  - 'change' (FileChangeEvent) — raw file change detected
 *  - 'action' (WatchAction, filePath) — action triggered for a change
 *  - 'error' (Error) — watcher error
 */
export class FileWatcherTrigger extends EventEmitter {
  private watchers: FSWatcher[] = [];
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private config: FileWatcherConfig;
  private running = false;
  private rootDir = '';

  constructor(config: Partial<FileWatcherConfig> = {}) {
    super();
    this.config = {
      patterns: config.patterns ?? DEFAULT_CONFIG.patterns,
      ignorePatterns: config.ignorePatterns ?? DEFAULT_CONFIG.ignorePatterns,
      debounceMs: config.debounceMs ?? DEFAULT_CONFIG.debounceMs,
      actions: config.actions ?? DEFAULT_CONFIG.actions,
    };
  }

  /**
   * Start watching files under rootDir.
   */
  start(rootDir: string): void {
    if (this.running) {
      logger.warn('FileWatcherTrigger: already running');
      return;
    }

    this.rootDir = path.resolve(rootDir);

    if (!fs.existsSync(this.rootDir)) {
      const err = new Error(`Watch directory does not exist: ${this.rootDir}`);
      this.emit('error', err);
      return;
    }

    try {
      // Use recursive watch where supported (Windows + macOS).
      // On Linux, recursive watch may not be supported on older Node versions,
      // but Node 19+ supports it for most filesystems.
      const watcher = watch(
        this.rootDir,
        { recursive: true },
        (eventType, filename) => {
          if (!filename) return;
          this.handleRawEvent(eventType, filename);
        },
      );

      watcher.on('error', (err) => {
        logger.error('FileWatcherTrigger: watcher error', err);
        this.emit('error', err);
      });

      this.watchers.push(watcher);
      this.running = true;
      logger.info(`FileWatcherTrigger: started watching ${this.rootDir}`);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('FileWatcherTrigger: failed to start', error);
      this.emit('error', error);
    }
  }

  /**
   * Stop all watchers and clear pending debounce timers.
   */
  stop(): void {
    for (const watcher of this.watchers) {
      try {
        watcher.close();
      } catch {
        // Ignore close errors
      }
    }
    this.watchers = [];

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    this.running = false;
    logger.info('FileWatcherTrigger: stopped');
  }

  /**
   * Whether the watcher is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get current configuration (read-only copy).
   */
  getConfig(): Readonly<FileWatcherConfig> {
    return { ...this.config };
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  /**
   * Handle a raw fs.watch event with debouncing and glob filtering.
   */
  private handleRawEvent(eventType: string, filename: string): void {
    // Normalize to forward slashes for glob matching
    const normalized = filename.replace(/\\/g, '/');

    // Check ignore patterns first (fast rejection)
    if (matchGlobPatterns(normalized, this.config.ignorePatterns)) {
      return;
    }

    // Check if file matches any watch pattern
    if (!matchGlobPatterns(normalized, this.config.patterns)) {
      return;
    }

    // Debounce: skip if a timer is already pending for this file
    if (this.debounceTimers.has(normalized)) {
      clearTimeout(this.debounceTimers.get(normalized)!);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(normalized);
      this.processChange(eventType, normalized);
    }, this.config.debounceMs);

    this.debounceTimers.set(normalized, timer);
  }

  /**
   * After debounce, determine the change type and emit events.
   */
  private processChange(eventType: string, relativePath: string): void {
    const absolutePath = path.join(this.rootDir, relativePath);
    let changeType: FileChangeEvent['changeType'];

    try {
      if (fs.existsSync(absolutePath)) {
        // rename events on new files → create; change events → modify
        changeType = eventType === 'rename' ? 'create' : 'modify';
      } else {
        changeType = 'delete';
      }
    } catch {
      changeType = 'modify';
    }

    const event: FileChangeEvent = {
      filePath: absolutePath,
      changeType,
      timestamp: Date.now(),
    };

    this.emit('change', event);

    // Trigger configured actions
    for (const action of this.config.actions) {
      this.emit('action', action, absolutePath);
    }
  }
}
