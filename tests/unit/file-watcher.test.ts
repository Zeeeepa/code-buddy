/**
 * File Watcher Trigger Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted so the variable is available inside the hoisted vi.mock factory
const { mockWatcher } = vi.hoisted(() => ({
  mockWatcher: {
    close: vi.fn(),
    on: vi.fn().mockReturnThis(),
  },
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(true),
      watch: vi.fn().mockReturnValue(mockWatcher),
    },
    existsSync: vi.fn().mockReturnValue(true),
    watch: vi.fn().mockReturnValue(mockWatcher),
  };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { FileWatcherTrigger, type FileWatcherConfig, type FileChangeEvent } from '../../src/agent/file-watcher-trigger.js';
import { watch, existsSync } from 'fs';

describe('FileWatcherTrigger', () => {
  let watcher: FileWatcherTrigger;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  afterEach(() => {
    watcher?.stop();
    vi.useRealTimers();
  });

  // =========================================================================
  // Construction & Config
  // =========================================================================

  it('should create with default config', () => {
    watcher = new FileWatcherTrigger();
    const cfg = watcher.getConfig();
    expect(cfg.patterns).toContain('**/*.ts');
    expect(cfg.debounceMs).toBe(1000);
    expect(cfg.actions).toEqual(['notify']);
  });

  it('should accept custom config', () => {
    watcher = new FileWatcherTrigger({
      patterns: ['src/**/*.py'],
      debounceMs: 500,
      actions: ['lint', 'test'],
    });
    const cfg = watcher.getConfig();
    expect(cfg.patterns).toEqual(['src/**/*.py']);
    expect(cfg.debounceMs).toBe(500);
    expect(cfg.actions).toEqual(['lint', 'test']);
  });

  it('should merge partial config with defaults', () => {
    watcher = new FileWatcherTrigger({ debounceMs: 2000 });
    const cfg = watcher.getConfig();
    expect(cfg.debounceMs).toBe(2000);
    expect(cfg.patterns.length).toBeGreaterThan(0); // defaults
  });

  // =========================================================================
  // Start / Stop / isRunning
  // =========================================================================

  it('should start and report running status', () => {
    watcher = new FileWatcherTrigger();
    expect(watcher.isRunning()).toBe(false);
    watcher.start('/tmp/project');
    expect(watcher.isRunning()).toBe(true);
    expect(watch).toHaveBeenCalled();
  });

  it('should stop and report not-running', () => {
    watcher = new FileWatcherTrigger();
    watcher.start('/tmp/project');
    expect(watcher.isRunning()).toBe(true);
    watcher.stop();
    expect(watcher.isRunning()).toBe(false);
    expect(mockWatcher.close).toHaveBeenCalled();
  });

  it('should warn when starting twice', () => {
    watcher = new FileWatcherTrigger();
    watcher.start('/tmp/project');
    watcher.start('/tmp/project');
    // second call should not add another watcher
    expect(watch).toHaveBeenCalledTimes(1);
  });

  it('should emit error if directory does not exist', () => {
    (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
    watcher = new FileWatcherTrigger();

    const errors: Error[] = [];
    watcher.on('error', (err) => errors.push(err));
    watcher.start('/nonexistent');

    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain('does not exist');
    expect(watcher.isRunning()).toBe(false);
  });

  // =========================================================================
  // Glob Filtering
  // =========================================================================

  it('should handle events for matching files', () => {
    watcher = new FileWatcherTrigger({ patterns: ['src/**/*.ts'], debounceMs: 100 });
    watcher.start('/tmp/project');

    const events: FileChangeEvent[] = [];
    watcher.on('change', (ev: FileChangeEvent) => events.push(ev));

    // Simulate fs.watch callback
    const watchCallback = (watch as ReturnType<typeof vi.fn>).mock.calls[0][2];
    watchCallback('change', 'src/index.ts');

    vi.advanceTimersByTime(150);
    expect(events.length).toBe(1);
    expect(events[0].filePath).toContain('src');
  });

  it('should ignore files not matching patterns', () => {
    watcher = new FileWatcherTrigger({ patterns: ['src/**/*.ts'], debounceMs: 100 });
    watcher.start('/tmp/project');

    const events: FileChangeEvent[] = [];
    watcher.on('change', (ev: FileChangeEvent) => events.push(ev));

    const watchCallback = (watch as ReturnType<typeof vi.fn>).mock.calls[0][2];
    watchCallback('change', 'README.md');

    vi.advanceTimersByTime(150);
    expect(events.length).toBe(0);
  });

  it('should ignore files matching ignore patterns', () => {
    watcher = new FileWatcherTrigger({ patterns: ['**/*.ts'], debounceMs: 100 });
    watcher.start('/tmp/project');

    const events: FileChangeEvent[] = [];
    watcher.on('change', (ev: FileChangeEvent) => events.push(ev));

    const watchCallback = (watch as ReturnType<typeof vi.fn>).mock.calls[0][2];
    watchCallback('change', 'node_modules/foo/index.ts');

    vi.advanceTimersByTime(150);
    expect(events.length).toBe(0);
  });

  // =========================================================================
  // Debouncing
  // =========================================================================

  it('should debounce rapid events for the same file', () => {
    watcher = new FileWatcherTrigger({ patterns: ['**/*.ts'], debounceMs: 500 });
    watcher.start('/tmp/project');

    const events: FileChangeEvent[] = [];
    watcher.on('change', (ev: FileChangeEvent) => events.push(ev));

    const watchCallback = (watch as ReturnType<typeof vi.fn>).mock.calls[0][2];

    // Fire 3 rapid events
    watchCallback('change', 'src/app.ts');
    vi.advanceTimersByTime(100);
    watchCallback('change', 'src/app.ts');
    vi.advanceTimersByTime(100);
    watchCallback('change', 'src/app.ts');
    vi.advanceTimersByTime(600);

    // Should only get 1 event after debounce
    expect(events.length).toBe(1);
  });

  it('should emit separate events for different files', () => {
    watcher = new FileWatcherTrigger({ patterns: ['**/*.ts'], debounceMs: 100 });
    watcher.start('/tmp/project');

    const events: FileChangeEvent[] = [];
    watcher.on('change', (ev: FileChangeEvent) => events.push(ev));

    const watchCallback = (watch as ReturnType<typeof vi.fn>).mock.calls[0][2];
    watchCallback('change', 'src/a.ts');
    watchCallback('change', 'src/b.ts');
    vi.advanceTimersByTime(200);

    expect(events.length).toBe(2);
  });

  // =========================================================================
  // Action Events
  // =========================================================================

  it('should emit action events for configured actions', () => {
    watcher = new FileWatcherTrigger({ patterns: ['**/*.ts'], debounceMs: 100, actions: ['lint', 'test'] });
    watcher.start('/tmp/project');

    const actions: [string, string][] = [];
    watcher.on('action', (action: string, path: string) => actions.push([action, path]));

    const watchCallback = (watch as ReturnType<typeof vi.fn>).mock.calls[0][2];
    watchCallback('change', 'src/app.ts');
    vi.advanceTimersByTime(200);

    expect(actions.length).toBe(2);
    expect(actions[0][0]).toBe('lint');
    expect(actions[1][0]).toBe('test');
  });

  it('should handle null filename gracefully', () => {
    watcher = new FileWatcherTrigger({ patterns: ['**/*.ts'], debounceMs: 100 });
    watcher.start('/tmp/project');

    const events: FileChangeEvent[] = [];
    watcher.on('change', (ev: FileChangeEvent) => events.push(ev));

    const watchCallback = (watch as ReturnType<typeof vi.fn>).mock.calls[0][2];
    watchCallback('change', null);
    vi.advanceTimersByTime(200);

    expect(events.length).toBe(0);
  });

  // =========================================================================
  // Stop clears timers
  // =========================================================================

  it('should clear debounce timers on stop', () => {
    watcher = new FileWatcherTrigger({ patterns: ['**/*.ts'], debounceMs: 5000 });
    watcher.start('/tmp/project');

    const events: FileChangeEvent[] = [];
    watcher.on('change', (ev: FileChangeEvent) => events.push(ev));

    const watchCallback = (watch as ReturnType<typeof vi.fn>).mock.calls[0][2];
    watchCallback('change', 'src/app.ts');

    // Stop before debounce fires
    watcher.stop();
    vi.advanceTimersByTime(6000);

    expect(events.length).toBe(0);
  });
});
