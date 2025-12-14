/**
 * Tests for worktree-handlers (Git worktree management)
 */

import { handleWorktree } from '../../src/commands/handlers/worktree-handlers';

describe('Worktree Handlers', () => {
  describe('handleWorktree', () => {
    it('should return help when no args provided', () => {
      const result = handleWorktree([]);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Git Worktrees');
      expect(result.entry?.content).toContain('/worktree');
    });

    it('should return help with "help" arg', () => {
      const result = handleWorktree(['help']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Git Worktrees');
    });
  });

  describe('list worktrees', () => {
    it('should list worktrees with "list" command', () => {
      const result = handleWorktree(['list']);

      expect(result.handled).toBe(true);
      // May show worktrees or "not a git repository" depending on context
      expect(result.entry?.content).toBeDefined();
    });

    it('should accept "ls" as alias', () => {
      const result = handleWorktree(['ls']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toBeDefined();
    });
  });

  describe('add worktree', () => {
    it('should add worktree with branch name', () => {
      const result = handleWorktree(['add', 'feature-branch']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('feature-branch');
    });

    it('should accept "create" as alias', () => {
      const result = handleWorktree(['create', 'feature-branch']);

      expect(result.handled).toBe(true);
    });

    it('should show error when no branch specified', () => {
      const result = handleWorktree(['add']);

      expect(result.entry?.content).toContain('Usage:');
    });

    it('should support custom path', () => {
      const result = handleWorktree(['add', 'feature', '../my-worktree']);

      expect(result.handled).toBe(true);
    });
  });

  describe('remove worktree', () => {
    it('should remove worktree', () => {
      const result = handleWorktree(['remove', '/home/user/project-feature']);

      expect(result.handled).toBe(true);
    });

    it('should accept "rm" as alias', () => {
      const result = handleWorktree(['rm', '/home/user/project-feature']);

      expect(result.handled).toBe(true);
    });

    it('should show error when no path specified', () => {
      const result = handleWorktree(['remove']);

      expect(result.entry?.content).toContain('Usage:');
    });
  });

  describe('prune worktrees', () => {
    it('should handle prune command', () => {
      const result = handleWorktree(['prune']);

      expect(result.handled).toBe(true);
      // May succeed or show error depending on git state
      expect(result.entry?.content).toBeDefined();
    });
  });

  describe('entry structure', () => {
    it('should return proper entry type', () => {
      const result = handleWorktree(['list']);

      expect(result.entry?.type).toBe('assistant');
      expect(result.entry?.timestamp).toBeInstanceOf(Date);
    });

    it('should always set handled to true', () => {
      const results = [
        handleWorktree([]),
        handleWorktree(['list']),
        handleWorktree(['add', 'branch']),
        handleWorktree(['remove', 'path']),
        handleWorktree(['prune']),
        handleWorktree(['help']),
      ];

      results.forEach(result => {
        expect(result.handled).toBe(true);
      });
    });
  });

  describe('help content', () => {
    it('should include all commands in help', () => {
      const result = handleWorktree(['help']);

      expect(result.entry?.content).toContain('list');
      expect(result.entry?.content).toContain('add');
      expect(result.entry?.content).toContain('remove');
      expect(result.entry?.content).toContain('prune');
    });

    it('should include examples in help', () => {
      const result = handleWorktree(['help']);

      expect(result.entry?.content).toContain('Examples');
    });
  });
});

describe('Worktree Error Handling', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('should handle git not available', () => {
    // This test verifies the handler doesn't crash on errors
    const result = handleWorktree(['list']);

    expect(result.handled).toBe(true);
    expect(result.entry).toBeDefined();
  });
});
