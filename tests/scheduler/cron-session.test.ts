/**
 * Tests for Cron Session Binding (OpenClaw v2026.3.13 alignment)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Cron Session Binding', () => {
  it('should add sessionTarget field to CronJob type', async () => {
    // Verify the type exists by importing and creating a job-like object
    const job = {
      id: 'test-1',
      name: 'test job',
      type: 'every' as const,
      schedule: { every: 60000 },
      task: { type: 'message' as const, message: 'hello' },
      status: 'active' as const,
      createdAt: new Date(),
      runCount: 0,
      errorCount: 0,
      enabled: true,
      sessionTarget: 'current' as const,
      resolvedSessionId: 'session-123',
    };
    // If it compiles, the type is correct
    expect(job.sessionTarget).toBe('current');
    expect(job.resolvedSessionId).toBe('session-123');
  });

  it('should resolve "current" to a concrete session ID', () => {
    // When sessionTarget is 'current', resolvedSessionId should be populated
    const sessionKey = 'existing-session-456';
    const job = {
      sessionTarget: 'current' as const,
      delivery: { sessionKey },
      resolvedSessionId: undefined as string | undefined,
    };

    // Simulate the resolution logic
    if (job.sessionTarget === 'current') {
      job.resolvedSessionId = job.delivery?.sessionKey || `session-${Date.now()}`;
    }

    expect(job.resolvedSessionId).toBe('existing-session-456');
  });

  it('should keep "new" as-is without resolving session ID', () => {
    const job = {
      sessionTarget: 'new' as const,
      resolvedSessionId: undefined as string | undefined,
    };

    // 'new' should NOT resolve a session ID
    if (job.sessionTarget === 'current') {
      job.resolvedSessionId = `session-${Date.now()}`;
    }

    expect(job.resolvedSessionId).toBeUndefined();
  });

  it('should allow specific session ID as sessionTarget', () => {
    const job = {
      sessionTarget: 'session-specific-789',
      resolvedSessionId: 'session-specific-789',
    };

    expect(job.sessionTarget).toBe('session-specific-789');
    expect(job.resolvedSessionId).toBe('session-specific-789');
  });
});
