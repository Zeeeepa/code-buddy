/**
 * Unit Tests for Session Cleanup
 *
 * Tests the /sessions cleanup functionality including age-based cleanup,
 * count-based cleanup, dry-run mode, and edge cases.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';

// Mock fs module
const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockStatSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockUnlinkSync = vi.fn();
const mockRmdirSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  rmdirSync: (...args: unknown[]) => mockRmdirSync(...args),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  default: {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    statSync: (...args: unknown[]) => mockStatSync(...args),
    readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
    unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
    rmdirSync: (...args: unknown[]) => mockRmdirSync(...args),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

// Mock os module
vi.mock('os', () => ({
  homedir: () => '/home/testuser',
  default: { homedir: () => '/home/testuser' },
}));

// Mock interaction-logger to avoid its own fs calls
vi.mock('../../src/logging/interaction-logger.js', () => ({
  InteractionLogger: {
    listSessions: vi.fn(() => ({ sessions: [], total: 0 })),
    loadSession: vi.fn(),
    deleteSession: vi.fn(),
    getLatestSession: vi.fn(),
    searchSessions: vi.fn(() => []),
    formatSession: vi.fn(() => ''),
  },
}));

// Mock codebuddy-agent
vi.mock('../../src/agent/codebuddy-agent.js', () => ({}));

import { cleanupSessions, handleSessions } from '../../src/commands/handlers/session-handlers.js';

const LOG_DIR = join('/home/testuser', '.codebuddy', 'logs');

/**
 * Helper to create a session JSON string
 */
function makeSession(shortId: string, startedAt: string, size = 1024): string {
  return JSON.stringify({
    version: '1.0.0',
    metadata: {
      id: `${shortId}-0000-0000-0000-000000000000`,
      short_id: shortId,
      started_at: startedAt,
      model: 'test-model',
      provider: 'test',
      cwd: '/test',
      total_input_tokens: 100,
      total_output_tokens: 50,
      estimated_cost: 0.01,
      turns: 3,
      tool_calls: 5,
    },
    messages: [],
  });
}

describe('Session Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return empty result when LOG_DIR does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = cleanupSessions({ days: 7 });

    expect(result.deletedCount).toBe(0);
    expect(result.freedBytes).toBe(0);
    expect(result.sessionIds).toEqual([]);
  });

  it('should delete sessions older than specified days', () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === LOG_DIR) return ['2026-03-01', '2026-03-15'];
      if (dir.includes('2026-03-01')) return ['old-session.json'];
      if (dir.includes('2026-03-15')) return ['new-session.json'];
      return [];
    });
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('2026-03-01') || path.endsWith('2026-03-15')) {
        return { isDirectory: () => true };
      }
      return { size: 2048, mtime: new Date() };
    });
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('old-session')) return makeSession('old12345', tenDaysAgo);
      if (path.includes('new-session')) return makeSession('new12345', twoDaysAgo);
      return '{}';
    });

    const result = cleanupSessions({ days: 7 });

    expect(result.deletedCount).toBe(1);
    expect(result.sessionIds).toContain('old12345');
    expect(mockUnlinkSync).toHaveBeenCalledTimes(1);
  });

  it('should keep only the N most recent sessions with --keep', () => {
    const now = new Date();
    const dates = [
      new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    ];

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === LOG_DIR) return ['2026-03-10'];
      return ['s1.json', 's2.json', 's3.json'];
    });
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('2026-03-10')) return { isDirectory: () => true };
      return { size: 1000, mtime: new Date() };
    });
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('s1')) return makeSession('sess0001', dates[0]);
      if (path.includes('s2')) return makeSession('sess0002', dates[1]);
      if (path.includes('s3')) return makeSession('sess0003', dates[2]);
      return '{}';
    });

    const result = cleanupSessions({ keep: 1 });

    expect(result.deletedCount).toBe(2);
    expect(result.sessionIds).not.toContain('sess0001'); // Most recent, kept
    expect(result.sessionIds).toContain('sess0002');
    expect(result.sessionIds).toContain('sess0003');
  });

  it('should not delete files in dry-run mode', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === LOG_DIR) return ['2026-03-01'];
      return ['old.json'];
    });
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('2026-03-01')) return { isDirectory: () => true };
      return { size: 500, mtime: new Date() };
    });
    mockReadFileSync.mockReturnValue(makeSession('dryrun01', tenDaysAgo));

    const result = cleanupSessions({ days: 7, dryRun: true });

    expect(result.deletedCount).toBe(1);
    expect(result.freedBytes).toBe(500);
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });

  it('should return empty when no sessions match age criteria', () => {
    const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === LOG_DIR) return ['2026-03-19'];
      return ['recent.json'];
    });
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('2026-03-19')) return { isDirectory: () => true };
      return { size: 1024, mtime: new Date() };
    });
    mockReadFileSync.mockReturnValue(makeSession('recent01', recentDate));

    const result = cleanupSessions({ days: 7 });

    expect(result.deletedCount).toBe(0);
    expect(result.freedBytes).toBe(0);
  });

  it('should handle invalid JSON session files gracefully', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === LOG_DIR) return ['2026-03-01'];
      return ['bad.json'];
    });
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('2026-03-01')) return { isDirectory: () => true };
      return { size: 100, mtime: tenDaysAgo };
    });
    mockReadFileSync.mockReturnValue('not valid json{{{');

    const result = cleanupSessions({ days: 7 });

    // Should still attempt cleanup using file mtime as fallback
    expect(result.deletedCount).toBe(1);
  });

  it('should handle mixed valid and invalid sessions', () => {
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === LOG_DIR) return ['2026-03-10'];
      return ['valid.json', 'invalid.json', 'recent.json'];
    });
    mockStatSync.mockImplementation((path: string) => {
      if (path.endsWith('2026-03-10')) return { isDirectory: () => true };
      if (path.includes('invalid')) return { size: 50, mtime: tenDaysAgo };
      if (path.includes('valid')) return { size: 200, mtime: tenDaysAgo };
      return { size: 300, mtime: twoDaysAgo };
    });
    mockReadFileSync.mockImplementation((path: string) => {
      if (path.includes('valid')) return makeSession('valid001', tenDaysAgo.toISOString());
      if (path.includes('recent')) return makeSession('recent01', twoDaysAgo.toISOString());
      return 'bad json';
    });

    const result = cleanupSessions({ days: 7 });

    // Both old valid and invalid sessions should be cleaned
    expect(result.deletedCount).toBe(2);
    // Recent session should be kept
    expect(result.sessionIds).not.toContain('recent01');
  });

  it('should handle /sessions cleanup command via handleSessions', () => {
    mockExistsSync.mockReturnValue(false);

    const result = handleSessions(['cleanup', '--dry-run']);

    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('No sessions to clean up');
  });

  it('should validate --days argument', () => {
    const result = handleSessions(['cleanup', '--days', 'abc']);

    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Invalid --days value');
  });
});
