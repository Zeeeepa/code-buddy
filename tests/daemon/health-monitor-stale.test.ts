/**
 * Tests for Health Monitor stale event detection and restart limits
 * (OpenClaw v2026.3.11 alignment)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthMonitor } from '../../src/daemon/health-monitor.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe('HealthMonitor — Stale Event Detection', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor({
      intervalMs: 60000, // don't auto-run during tests
      staleEventThresholdMs: 100, // 100ms for fast tests
      maxTotalRestarts: 3,
    });
  });

  afterEach(() => {
    monitor.stop();
  });

  it('should emit stale event when no events received within threshold', async () => {
    const staleHandler = vi.fn();
    monitor.on('stale', staleHandler);

    // Force lastEventTime to be old
    (monitor as any).lastEventTime = Date.now() - 200;

    monitor.check();

    expect(staleHandler).toHaveBeenCalledTimes(1);
    expect(staleHandler.mock.calls[0][0]).toHaveProperty('lastEventTime');
    expect(staleHandler.mock.calls[0][0]).toHaveProperty('elapsed');
  });

  it('should not emit stale event after recordEvent()', () => {
    const staleHandler = vi.fn();
    monitor.on('stale', staleHandler);

    monitor.recordEvent(); // Fresh event
    monitor.check();

    expect(staleHandler).not.toHaveBeenCalled();
  });

  it('should stop after exceeding maxTotalRestarts', () => {
    const maxRestartsHandler = vi.fn();
    monitor.on('max-restarts-exceeded', maxRestartsHandler);

    // Set memory to critical to force unhealthy
    monitor.registerServiceCheck('test', () => false);

    // Trigger enough unhealthy checks to exceed maxTotalRestarts
    // maxUnhealthyChecks defaults to 3, maxTotalRestarts is 3
    for (let i = 0; i < 4 * 3; i++) {
      monitor.check();
    }

    // After 4 cycles of 3 unhealthy checks = 4 restarts, should exceed max of 3
    expect(maxRestartsHandler).toHaveBeenCalled();
    expect(monitor.isRunning()).toBe(false);
  });

  it('should track total restarts', () => {
    monitor.registerServiceCheck('test', () => false);

    // 3 unhealthy checks trigger 1 restart
    for (let i = 0; i < 3; i++) {
      monitor.check();
    }

    expect(monitor.getTotalRestarts()).toBe(1);
  });
});
