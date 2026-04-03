import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process before importing agent-tools
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

// Mock agent-memory-integration
vi.mock('../../../src/agent/multi-agent/agent-memory-integration.js', () => ({
  readAgentMemory: vi.fn().mockReturnValue(null),
  appendAgentMemory: vi.fn(),
}));

// Mock context-engine
vi.mock('../../../src/context/context-engine.js', () => ({}));

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { execSync } from 'child_process';
import path from 'path';
import {
  spawnAgent,
  closeAgent,
  resetAgentThreads,
  getAgent,
} from '../../../src/agent/multi-agent/agent-tools.js';
import { logger } from '../../../src/utils/logger.js';

const mockExecSync = vi.mocked(execSync);

describe('worktree isolation', () => {
  beforeEach(() => {
    resetAgentThreads();
    vi.clearAllMocks();
  });

  describe('spawnAgent with isolation: worktree', () => {
    it('calls git worktree add with correct branch name', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });

      expect('error' in result).toBe(false);
      const thread = result as ReturnType<typeof getAgent>;
      expect(thread).toBeDefined();

      const worktreeCall = mockExecSync.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('worktree add'),
      );
      expect(worktreeCall).toBeDefined();
      expect(worktreeCall![0]).toMatch(/git worktree add/);
      expect(worktreeCall![0]).toMatch(/codebuddy\/agent\/agent-/);
    });

    it('sets worktreePath on the thread', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);

      const thread = result as { id: string; worktreePath?: string; worktreeBranch?: string };
      expect(thread.worktreePath).toBeDefined();
      expect(thread.worktreePath).toContain('worktrees');
      expect(thread.worktreePath).toContain(thread.id);
    });

    it('sets worktreeBranch on the thread', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);

      const thread = result as { id: string; worktreeBranch?: string };
      expect(thread.worktreeBranch).toBe(`codebuddy/agent/${thread.id}`);
    });

    it('places worktree inside .codebuddy/worktrees/<agentId>', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);

      const thread = result as { id: string; worktreePath?: string };
      const expected = path.join(process.cwd(), '.codebuddy', 'worktrees', thread.id);
      expect(thread.worktreePath).toBe(expected);
    });

    it('logs info when worktree is created successfully', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      spawnAgent({ prompt: 'test', isolation: 'worktree' });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('isolated worktree at'),
      );
    });

    it('falls back gracefully when git worktree add fails', () => {
      mockExecSync.mockImplementation((cmd: unknown) => {
        if (typeof cmd === 'string' && cmd.includes('worktree add')) {
          throw new Error('not a git repository');
        }
        return '' as unknown as Buffer;
      });

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);

      const thread = result as { worktreePath?: string };
      // worktreePath should NOT be set on fallback
      expect(thread.worktreePath).toBeUndefined();
    });

    it('logs a warning on worktree creation failure', () => {
      mockExecSync.mockImplementation((cmd: unknown) => {
        if (typeof cmd === 'string' && cmd.includes('worktree add')) {
          throw new Error('fatal: not a git repository');
        }
        return '' as unknown as Buffer;
      });

      spawnAgent({ prompt: 'test', isolation: 'worktree' });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('worktree creation failed'),
        expect.any(Object),
      );
    });

    it('does not call git worktree add when isolation is not set', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      spawnAgent({ prompt: 'test' });

      const worktreeCall = mockExecSync.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('worktree add'),
      );
      expect(worktreeCall).toBeUndefined();
    });

    it('thread has no worktreePath when isolation is not set', () => {
      const result = spawnAgent({ prompt: 'test' });
      expect('error' in result).toBe(false);

      const thread = result as { worktreePath?: string };
      expect(thread.worktreePath).toBeUndefined();
    });

    it('works correctly alongside yield=true', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree', yield: true });
      expect('error' in result).toBe(false);
      expect((result as { __yield?: boolean }).__yield).toBe(true);

      const thread = result as { worktreePath?: string };
      expect(thread.worktreePath).toBeDefined();
    });
  });

  describe('closeAgent with worktree', () => {
    it('runs git status --porcelain in the worktree directory', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);
      const thread = result as { id: string };

      vi.clearAllMocks();
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      closeAgent(thread.id);

      const statusCall = mockExecSync.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('git status --porcelain'),
      );
      expect(statusCall).toBeDefined();
    });

    it('removes the worktree with --force on close', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);
      const thread = result as { id: string; worktreePath?: string };

      vi.clearAllMocks();
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      closeAgent(thread.id);

      const removeCall = mockExecSync.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('worktree remove') && c[0].includes('--force'),
      );
      expect(removeCall).toBeDefined();
    });

    it('deletes the branch on close', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);
      const thread = result as { id: string; worktreeBranch?: string };

      vi.clearAllMocks();
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      closeAgent(thread.id);

      const branchDeleteCall = mockExecSync.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('branch -D'),
      );
      expect(branchDeleteCall).toBeDefined();
      expect(branchDeleteCall![0]).toContain(thread.worktreeBranch);
    });

    it('auto-commits when worktree has uncommitted changes', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);
      const thread = result as { id: string };

      vi.clearAllMocks();
      // status returns non-empty = dirty worktree
      mockExecSync.mockImplementation((cmd: unknown) => {
        if (typeof cmd === 'string' && cmd.includes('git status --porcelain')) {
          return ' M src/foo.ts\n' as unknown as Buffer;
        }
        return '' as unknown as Buffer;
      });

      closeAgent(thread.id);

      const commitCall = mockExecSync.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('git commit'),
      );
      expect(commitCall).toBeDefined();
    });

    it('skips commit when worktree is clean', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);
      const thread = result as { id: string };

      vi.clearAllMocks();
      mockExecSync.mockReturnValue('' as unknown as Buffer); // empty status

      closeAgent(thread.id);

      const commitCall = mockExecSync.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('git commit'),
      );
      expect(commitCall).toBeUndefined();
    });

    it('handles cleanup failure gracefully without throwing', () => {
      mockExecSync.mockReturnValue('' as unknown as Buffer);

      const result = spawnAgent({ prompt: 'test', isolation: 'worktree' });
      expect('error' in result).toBe(false);
      const thread = result as { id: string };

      vi.clearAllMocks();
      mockExecSync.mockImplementation(() => {
        throw new Error('git error');
      });

      expect(() => closeAgent(thread.id)).not.toThrow();
    });

    it('does not call git cleanup for agents without worktree', () => {
      const result = spawnAgent({ prompt: 'test' });
      expect('error' in result).toBe(false);
      const thread = result as { id: string };

      vi.clearAllMocks();
      closeAgent(thread.id);

      const worktreeCall = mockExecSync.mock.calls.find(c =>
        typeof c[0] === 'string' && c[0].includes('worktree'),
      );
      expect(worktreeCall).toBeUndefined();
    });
  });
});
