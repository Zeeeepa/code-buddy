/**
 * Startup Timing Utility
 *
 * Tracks and reports startup performance metrics.
 * Useful for identifying slow modules and optimizing cold start times.
 */

// ============================================================================
// Types
// ============================================================================

export interface StartupPhase {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface StartupMetrics {
  totalTime: number;
  phases: StartupPhase[];
  slowPhases: StartupPhase[];
  timestamp: Date;
}

export interface StartupTimingConfig {
  /** Enable timing collection */
  enabled: boolean;
  /** Threshold for slow phase detection (ms) */
  slowThresholdMs: number;
  /** Log timing to console */
  logToConsole: boolean;
  /** Include in process title for monitoring */
  updateProcessTitle: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: StartupTimingConfig = {
  enabled: process.env.PERF_TIMING === 'true' || process.env.DEBUG === 'true',
  slowThresholdMs: 100,
  logToConsole: process.env.PERF_TIMING === 'true',
  updateProcessTitle: false,
};

// ============================================================================
// Global State
// ============================================================================

// Record absolute startup time as early as possible
const processStartTime = Date.now();

// Phases storage
const phases: StartupPhase[] = [];
const activePhases: Map<string, number> = new Map();
let config: StartupTimingConfig = { ...DEFAULT_CONFIG };
let isInitialized = false;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Initialize startup timing with optional config
 */
export function initStartupTiming(overrideConfig?: Partial<StartupTimingConfig>): void {
  if (isInitialized) return;

  config = { ...config, ...overrideConfig };
  isInitialized = true;

  // Record initialization phase
  recordPhase('init', processStartTime, Date.now());
}

/**
 * Start timing a phase
 */
export function startPhase(name: string): void {
  if (!config.enabled) return;

  activePhases.set(name, Date.now());
}

/**
 * End timing a phase
 */
export function endPhase(name: string, metadata?: Record<string, unknown>): number {
  if (!config.enabled) return 0;

  const startTime = activePhases.get(name);
  if (startTime === undefined) {
    return 0;
  }

  activePhases.delete(name);
  const endTime = Date.now();
  const duration = endTime - startTime;

  recordPhase(name, startTime, endTime, metadata);

  return duration;
}

/**
 * Measure an async operation
 */
export async function measurePhase<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  if (!config.enabled) {
    return fn();
  }

  startPhase(name);
  try {
    const result = await fn();
    endPhase(name, metadata);
    return result;
  } catch (error) {
    endPhase(name, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Measure a sync operation
 */
export function measurePhaseSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  if (!config.enabled) {
    return fn();
  }

  startPhase(name);
  try {
    const result = fn();
    endPhase(name, metadata);
    return result;
  } catch (error) {
    endPhase(name, { ...metadata, error: true });
    throw error;
  }
}

/**
 * Mark startup as complete and get metrics
 */
export function completeStartup(): StartupMetrics {
  const totalTime = Date.now() - processStartTime;

  // Complete any still-active phases
  Array.from(activePhases.keys()).forEach((name) => {
    endPhase(name, { incomplete: true });
  });

  const slowPhases = phases.filter((p) => p.duration >= config.slowThresholdMs);

  const metrics: StartupMetrics = {
    totalTime,
    phases: [...phases],
    slowPhases,
    timestamp: new Date(),
  };

  if (config.logToConsole) {
    logStartupMetrics(metrics);
  }

  return metrics;
}

/**
 * Get current metrics without completing startup
 */
export function getStartupMetrics(): StartupMetrics {
  const totalTime = Date.now() - processStartTime;
  const slowPhases = phases.filter((p) => p.duration >= config.slowThresholdMs);

  return {
    totalTime,
    phases: [...phases],
    slowPhases,
    timestamp: new Date(),
  };
}

/**
 * Get total startup time so far
 */
export function getElapsedTime(): number {
  return Date.now() - processStartTime;
}

/**
 * Record a phase directly (when start/end times are known)
 */
export function recordPhase(
  name: string,
  startTime: number,
  endTime: number,
  metadata?: Record<string, unknown>
): void {
  if (!config.enabled) return;

  const duration = endTime - startTime;

  phases.push({
    name,
    startTime,
    endTime,
    duration,
    metadata,
  });
}

/**
 * Clear all recorded phases
 */
export function clearPhases(): void {
  phases.length = 0;
  activePhases.clear();
}

/**
 * Format metrics for display
 */
export function formatStartupMetrics(metrics: StartupMetrics): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('=== Startup Performance ===');
  lines.push(`Total Time: ${metrics.totalTime}ms`);
  lines.push('');
  lines.push('Phase Breakdown:');

  // Sort by duration (slowest first)
  const sortedPhases = [...metrics.phases].sort((a, b) => b.duration - a.duration);

  for (const phase of sortedPhases) {
    const marker = phase.duration >= config.slowThresholdMs ? '[SLOW]' : '';
    const pct = ((phase.duration / metrics.totalTime) * 100).toFixed(1);
    lines.push(`  ${phase.name}: ${phase.duration}ms (${pct}%) ${marker}`);
  }

  if (metrics.slowPhases.length > 0) {
    lines.push('');
    lines.push(`Slow Phases (>${config.slowThresholdMs}ms): ${metrics.slowPhases.length}`);
  }

  lines.push('===========================');

  return lines.join('\n');
}

/**
 * Log startup metrics to console
 */
export function logStartupMetrics(metrics: StartupMetrics): void {
  console.log(formatStartupMetrics(metrics));
}

// ============================================================================
// Decorators for Module Loading
// ============================================================================

/**
 * Create a timed import function
 */
export function timedImport<T>(
  name: string,
  importFn: () => Promise<T>
): () => Promise<T> {
  return async () => {
    if (!config.enabled) {
      return importFn();
    }

    startPhase(`import:${name}`);
    const result = await importFn();
    endPhase(`import:${name}`);
    return result;
  };
}

/**
 * Create a lazy loader with timing
 */
export function timedLazy<T>(
  name: string,
  loader: () => Promise<T>
): () => Promise<T> {
  let cached: T | undefined;
  let loading: Promise<T> | undefined;

  return async () => {
    if (cached !== undefined) {
      return cached;
    }

    if (loading) {
      return loading;
    }

    loading = measurePhase(`lazy:${name}`, async () => {
      const result = await loader();
      cached = result;
      return result;
    });

    return loading;
  };
}

// ============================================================================
// Config Management
// ============================================================================

/**
 * Update timing configuration
 */
export function updateTimingConfig(newConfig: Partial<StartupTimingConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current configuration
 */
export function getTimingConfig(): StartupTimingConfig {
  return { ...config };
}

/**
 * Enable timing (useful for debugging)
 */
export function enableTiming(): void {
  config.enabled = true;
}

/**
 * Disable timing
 */
export function disableTiming(): void {
  config.enabled = false;
}

// ============================================================================
// Exports for Common Patterns
// ============================================================================

/**
 * Quick startup timer for simple use cases
 */
export class StartupTimer {
  private startTime: number;
  private marks: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  mark(name: string): number {
    const elapsed = Date.now() - this.startTime;
    this.marks.set(name, elapsed);
    return elapsed;
  }

  getMark(name: string): number | undefined {
    return this.marks.get(name);
  }

  getElapsed(): number {
    return Date.now() - this.startTime;
  }

  getMarks(): Record<string, number> {
    return Object.fromEntries(this.marks);
  }

  format(): string {
    const elapsed = this.getElapsed();
    const lines = [`Total: ${elapsed}ms`];

    Array.from(this.marks.entries()).forEach(([name, time]) => {
      lines.push(`  ${name}: ${time}ms`);
    });

    return lines.join('\n');
  }
}

// Export process start time for external use
export const PROCESS_START_TIME = processStartTime;
