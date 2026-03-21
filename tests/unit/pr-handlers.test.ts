/**
 * Unit Tests for PR Handlers
 *
 * Tests cover:
 * - /pr command basic flow
 * - Base branch detection
 * - Draft flag parsing
 * - CLI detection (gh/glab)
 * - Error handling
 * - Title generation from branch name
 */

import { handlePR } from '../../src/commands/handlers/pr-handlers';
import { execSync, spawnSync } from 'child_process';

// Mock child_process
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  spawnSync: jest.fn(),
}));

const mockExecSync = execSync as jest.Mock;
const mockSpawnSync = spawnSync as jest.Mock;

describe('PR Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handlePR', () => {
    it('should return error when not in a git repo', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) {
          throw new Error('not a git repo');
        }
        return '';
      });

      const result = await handlePR([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Not inside a git repository');
    });

    it('should return error when on base branch', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'main\n';
        return '';
      });

      mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
        // detectPRCli: not found
        if (args?.[0] === 'gh' || args?.[0] === 'glab') {
          return { status: 1, stdout: '', stderr: '' };
        }
        // detectBaseBranch: main exists
        if (args?.includes('--verify') && args?.includes('main')) {
          return { status: 0, stdout: 'abc123\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: '' };
      });

      const result = await handlePR([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Cannot create PR');
      expect(result.entry?.content).toContain('base branch');
    });

    it('should show manual instructions when no CLI is available', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature/my-feature\n';
        if (cmd.includes('diff') && cmd.includes('--stat')) return '2 files changed\n';
        if (cmd.includes('log')) return '';
        return '';
      });

      mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
        // detectPRCli: neither gh nor glab found
        if (args?.[0] === 'gh' || args?.[0] === 'glab') {
          return { status: 1, stdout: '', stderr: '' };
        }
        // detectBaseBranch: main exists
        if (args?.includes('--verify') && args?.includes('main')) {
          return { status: 0, stdout: 'abc123\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: '' };
      });

      const result = await handlePR([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Neither `gh`');
      expect(result.entry?.content).toContain('gh pr create');
      expect(result.entry?.content).toContain('glab mr create');
    });

    it('should create PR with gh when available', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature/add-login\n';
        if (cmd.includes('diff') && cmd.includes('--stat')) return '3 files changed\n';
        if (cmd.includes('log') && cmd.includes('--oneline')) return 'abc1234 feat: add login page\n';
        if (cmd.includes('gh pr create')) return 'https://github.com/owner/repo/pull/42\n';
        return '';
      });

      mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
        // detectPRCli: gh found
        if (args?.[0] === 'gh') {
          return { status: 0, stdout: '/usr/bin/gh\n', stderr: '' };
        }
        // detectBaseBranch: main exists
        if (args?.includes('--verify') && args?.includes('main')) {
          return { status: 0, stdout: 'abc123\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: '' };
      });

      const result = await handlePR([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Pull request created');
      expect(result.entry?.content).toContain('https://github.com/owner/repo/pull/42');
    });

    it('should support --draft flag', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'fix/bug-123\n';
        if (cmd.includes('diff') && cmd.includes('--stat')) return '1 file changed\n';
        if (cmd.includes('log') && cmd.includes('--oneline')) return 'def5678 fix: resolve null pointer\n';
        if (cmd.includes('gh pr create')) {
          // Verify --draft is in the command
          expect(cmd).toContain('--draft');
          return 'https://github.com/owner/repo/pull/43\n';
        }
        return '';
      });

      mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
        if (args?.[0] === 'gh') return { status: 0, stdout: '/usr/bin/gh\n', stderr: '' };
        if (args?.includes('--verify') && args?.includes('main')) {
          return { status: 0, stdout: 'abc123\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: '' };
      });

      const result = await handlePR(['--draft']);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('(draft)');
    });

    it('should use custom title when provided', async () => {
      let capturedCmd = '';
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature/stuff\n';
        if (cmd.includes('diff') && cmd.includes('--stat')) return '1 file changed\n';
        if (cmd.includes('log') && cmd.includes('--oneline')) return '';
        if (cmd.includes('gh pr create')) {
          capturedCmd = cmd;
          return 'https://github.com/owner/repo/pull/44\n';
        }
        return '';
      });

      mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
        if (args?.[0] === 'gh') return { status: 0, stdout: '/usr/bin/gh\n', stderr: '' };
        if (args?.includes('--verify') && args?.includes('main')) {
          return { status: 0, stdout: 'abc123\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: '' };
      });

      const result = await handlePR(['My', 'Custom', 'Title']);
      expect(result.handled).toBe(true);
      expect(capturedCmd).toContain('My Custom Title');
    });

    it('should handle PR creation failure gracefully', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature/x\n';
        if (cmd.includes('diff') && cmd.includes('--stat')) return '';
        if (cmd.includes('log') && cmd.includes('--oneline')) return '';
        if (cmd.includes('gh pr create')) {
          const err = new Error('Not authenticated') as Error & { stdout: string; stderr: string };
          err.stdout = '';
          err.stderr = 'gh: Not logged in';
          throw err;
        }
        return '';
      });

      mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
        if (args?.[0] === 'gh') return { status: 0, stdout: '/usr/bin/gh\n', stderr: '' };
        if (args?.includes('--verify') && args?.includes('main')) {
          return { status: 0, stdout: 'abc123\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: '' };
      });

      const result = await handlePR([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('PR creation failed');
      expect(result.entry?.content).toContain('gh auth login');
    });

    it('should detect develop as base branch when main/master missing', async () => {
      mockExecSync.mockImplementation((cmd: string) => {
        if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true';
        if (cmd.includes('rev-parse --abbrev-ref HEAD')) return 'feature/y\n';
        if (cmd.includes('diff') && cmd.includes('--stat')) return '';
        if (cmd.includes('log') && cmd.includes('--oneline')) return '';
        if (cmd.includes('gh pr create')) {
          expect(cmd).toContain('develop');
          return 'https://github.com/owner/repo/pull/45\n';
        }
        return '';
      });

      mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
        if (args?.[0] === 'gh') return { status: 0, stdout: '/usr/bin/gh\n', stderr: '' };
        // main and master don't exist, develop does
        if (args?.includes('--verify') && args?.includes('main')) {
          return { status: 1, stdout: '', stderr: '' };
        }
        if (args?.includes('--verify') && args?.includes('master')) {
          return { status: 1, stdout: '', stderr: '' };
        }
        if (args?.includes('--verify') && args?.includes('develop')) {
          return { status: 0, stdout: 'abc123\n', stderr: '' };
        }
        return { status: 1, stdout: '', stderr: '' };
      });

      const result = await handlePR([]);
      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Pull request created');
    });
  });
});
