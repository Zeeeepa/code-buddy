/**
 * Performance Module
 *
 * Central module for performance optimizations:
 * - Semantic caching for tool calls
 * - Lazy loading for heavy modules
 * - Request batching and deduplication
 * - Performance monitoring and metrics
 * - Memory monitoring
 * - Startup timing
 */

export * from './performance-manager.js';
export * from './lazy-loader.js';
export * from './tool-cache.js';
export * from './request-optimizer.js';
export * from './benchmark-suite.js';

// Re-export memory monitoring from utils
export {
  MemoryMonitor,
  getMemoryMonitor,
  startMemoryMonitoring,
  stopMemoryMonitoring,
  getMemoryUsage,
  getMemoryPressure,
  formatBytes,
  type MemorySnapshot,
  type MemoryMetrics,
  type MemoryMonitorConfig,
} from '../utils/memory-monitor.js';

// Re-export startup timing from utils
export {
  initStartupTiming,
  startPhase,
  endPhase,
  measurePhase,
  completeStartup,
  getStartupMetrics,
  getElapsedTime,
  StartupTimer,
  timedImport,
  timedLazy,
  PROCESS_START_TIME,
  type StartupPhase,
  type StartupMetrics,
} from '../utils/startup-timing.js';
