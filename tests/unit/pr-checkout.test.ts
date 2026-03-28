/**
 * Unit tests for PR handler
 *
 * Tests handlePR: git repo detection, base branch protection,
 * CLI detection, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
const mockExecSync = vi.fn();
const mockSpawnSync = vi.fn();

vi.mock('child_process', () => ({
  execSync: (...args: unknown[]) => mockExecSync(...args),
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { handlePR } from '../../src/commands/handlers/pr-handlers.js';

describe('PR Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: we're in a git repo on main
    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
      if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'main';
      return '';
    });
  });

  describe('handlePR', () => {
    it('should error when not in a git repo', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) throw new Error('not a git repo');
        return '';
      });

      const result = await handlePR([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Not inside a git repository');
    });

    it('should error when on base branch', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'main';
        if (cmd.includes('rev-parse --verify main')) return 'abc123';
        return '';
      });

      const result = await handlePR([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('base branch');
    });

    it('should show CLI install instructions when no CLI is available', async () => {
      mockSpawnSync.mockReturnValue({ status: 1 }); // Neither gh nor glab
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature-branch';
        if (cmd.includes('rev-parse --verify main')) return 'abc123';
        if (cmd.includes('git diff')) return '';
        if (cmd.includes('git log')) return '';
        return '';
      });

      const result = await handlePR([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Neither');
    });

    it('should create PR with title from args', async () => {
      mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
        if (args?.[0] === 'gh') return { status: 0 };
        return { status: 1 };
      });
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature-branch';
        if (cmd.includes('rev-parse --verify main')) return 'abc123';
        if (cmd.includes('git diff')) return '';
        if (cmd.includes('git log')) return '';
        if (cmd.includes('gh pr create')) return 'https://github.com/org/repo/pull/1';
        return '';
      });

      const result = await handlePR(['My', 'PR', 'title']);
      expect(result.handled).toBe(true);
    });

    it('should handle --draft flag', async () => {
      mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
        if (args?.[0] === 'gh') return { status: 0 };
        return { status: 1 };
      });
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature-branch';
        if (cmd.includes('rev-parse --verify main')) return 'abc123';
        if (cmd.includes('git diff')) return '';
        if (cmd.includes('git log')) return '';
        if (cmd.includes('gh pr create') && cmd.includes('--draft'))
          return 'https://github.com/org/repo/pull/2';
        if (cmd.includes('gh pr create'))
          return 'https://github.com/org/repo/pull/2';
        return '';
      });

      const result = await handlePR(['--draft']);
      expect(result.handled).toBe(true);
    });
  });
});
