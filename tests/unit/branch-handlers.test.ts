/**
 * Unit Tests for Branch Handlers
 *
 * Tests cover:
 * - handleFork - Create conversation branches
 * - handleBranches - List all branches
 * - handleCheckout - Switch to a branch (with name/ID/prefix resolution)
 * - handleMerge - Merge a branch
 * - handleBranch - Unified branch management command
 * - Error handling for missing branches
 * - CommandHandlerResult structure
 */

import {
  handleFork,
  handleBranches,
  handleCheckout,
  handleMerge,
  handleBranch,
  CommandHandlerResult,
} from '../../src/commands/handlers/branch-handlers';
import {
  getBranchManager,
  resetBranchManager,
  ConversationBranch,
} from '../../src/persistence/conversation-branches';

// Mock the conversation-branches module
jest.mock('../../src/persistence/conversation-branches', () => {
  const mockBranchManager = {
    fork: jest.fn(),
    getAllBranches: jest.fn(),
    getCurrentBranch: jest.fn(),
    getCurrentBranchId: jest.fn(),
    checkout: jest.fn(),
    merge: jest.fn(),
    deleteBranch: jest.fn(),
    renameBranch: jest.fn(),
    getBranchHistory: jest.fn(),
    getBranchTree: jest.fn(),
    formatBranchTree: jest.fn(),
  };

  return {
    getBranchManager: jest.fn(function() { return mockBranchManager; }),
    resetBranchManager: jest.fn(),
  };
});

describe('Branch Handlers', () => {
  let mockBranchManager: {
    fork: jest.Mock;
    getAllBranches: jest.Mock;
    getCurrentBranch: jest.Mock;
    getCurrentBranchId: jest.Mock;
    checkout: jest.Mock;
    merge: jest.Mock;
    deleteBranch: jest.Mock;
    renameBranch: jest.Mock;
    getBranchHistory: jest.Mock;
    getBranchTree: jest.Mock;
    formatBranchTree: jest.Mock;
  };

  const sampleBranch: ConversationBranch = {
    id: 'branch_abc123',
    name: 'feature-branch',
    parentId: 'main',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ],
    createdAt: new Date('2025-01-15T10:00:00Z'),
    updatedAt: new Date('2025-01-15T11:00:00Z'),
  };

  const mainBranch: ConversationBranch = {
    id: 'main',
    name: 'Main conversation',
    messages: [
      { role: 'user', content: 'Start' },
    ],
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-15T10:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBranchManager = (getBranchManager as jest.Mock)();
    mockBranchManager.fork.mockReturnValue(sampleBranch);
    mockBranchManager.getAllBranches.mockReturnValue([mainBranch, sampleBranch]);
    mockBranchManager.getCurrentBranch.mockReturnValue(mainBranch);
    mockBranchManager.getCurrentBranchId.mockReturnValue('main');
    mockBranchManager.checkout.mockReturnValue(null);
    mockBranchManager.merge.mockReturnValue(false);
    mockBranchManager.deleteBranch.mockReturnValue(false);
    mockBranchManager.renameBranch.mockReturnValue(false);
    mockBranchManager.getBranchHistory.mockReturnValue([mainBranch]);
    mockBranchManager.getBranchTree.mockReturnValue([]);
    mockBranchManager.formatBranchTree.mockReturnValue('Branch Tree\n');
  });

  // ============================================
  // handleFork Tests
  // ============================================
  describe('handleFork', () => {
    test('should create branch with provided name', () => {
      const result = handleFork(['my-feature']);

      expect(result.handled).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.type).toBe('assistant');
      expect(result.entry?.content).toContain('Created branch: feature-branch');
      expect(result.entry?.content).toContain('ID: branch_abc123');
      expect(result.entry?.content).toContain('Messages: 2');
      expect(mockBranchManager.fork).toHaveBeenCalledWith('my-feature');
    });

    test('should create branch with multi-word name', () => {
      const result = handleFork(['my', 'awesome', 'feature']);

      expect(mockBranchManager.fork).toHaveBeenCalledWith('my awesome feature');
    });

    test('should generate timestamped name when no name provided', () => {
      const beforeTime = Date.now();
      const result = handleFork([]);
      const afterTime = Date.now();

      const callArgs = mockBranchManager.fork.mock.calls[0][0];
      expect(callArgs).toMatch(/^branch-\d+$/);

      // Extract timestamp and verify it's reasonable
      const timestamp = parseInt(callArgs.split('-')[1]);
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('should include timestamp in entry', () => {
      const result = handleFork(['test']);

      expect(result.entry?.timestamp).toBeInstanceOf(Date);
    });

    test('should show commands hint in output', () => {
      const result = handleFork(['test']);

      expect(result.entry?.content).toContain('/branches');
      expect(result.entry?.content).toContain('/checkout');
    });
  });

  // ============================================
  // handleBranches Tests
  // ============================================
  describe('handleBranches', () => {
    test('should list all branches', () => {
      const result = handleBranches();

      expect(result.handled).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.type).toBe('assistant');
      expect(result.entry?.content).toContain('Conversation Branches');
    });

    test('should show branch names and ids', () => {
      const result = handleBranches();

      expect(result.entry?.content).toContain('Main conversation');
      expect(result.entry?.content).toContain('main');
      expect(result.entry?.content).toContain('feature-branch');
      expect(result.entry?.content).toContain('branch_abc123');
    });

    test('should show message counts', () => {
      const result = handleBranches();

      expect(result.entry?.content).toContain('Messages: 1');
      expect(result.entry?.content).toContain('Messages: 2');
    });

    test('should show updated dates', () => {
      const result = handleBranches();

      expect(result.entry?.content).toContain('Updated:');
    });

    test('should indicate current branch', () => {
      mockBranchManager.getCurrentBranchId.mockReturnValue('main');

      const result = handleBranches();

      // The current branch should have an asterisk and "(current)" indicator
      expect(result.entry?.content).toContain('* Main conversation (current)');
    });

    test('should show commands help', () => {
      const result = handleBranches();

      expect(result.entry?.content).toContain('/fork <name>');
      expect(result.entry?.content).toContain('/checkout <id>');
      expect(result.entry?.content).toContain('/merge <id>');
    });

    test('should handle empty branches list', () => {
      mockBranchManager.getAllBranches.mockReturnValue([]);

      const result = handleBranches();

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('No branches found');
    });
  });

  // ============================================
  // handleCheckout Tests
  // ============================================
  describe('handleCheckout', () => {
    test('should show usage when no branch id provided', () => {
      const result = handleCheckout([]);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Usage: /checkout');
      expect(result.entry?.content).toContain('/branches');
    });

    test('should checkout existing branch by ID', () => {
      mockBranchManager.checkout.mockReturnValue(sampleBranch);

      const result = handleCheckout(['branch_abc123']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Switched to branch: feature-branch');
      expect(result.entry?.content).toContain('Messages: 2');
      expect(mockBranchManager.checkout).toHaveBeenCalledWith('branch_abc123');
    });

    test('should checkout existing branch by name', () => {
      mockBranchManager.checkout.mockReturnValue(sampleBranch);

      const result = handleCheckout(['feature-branch']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Switched to branch: feature-branch');
      expect(mockBranchManager.checkout).toHaveBeenCalledWith('branch_abc123');
    });

    test('should show error for non-existent branch', () => {
      const result = handleCheckout(['nonexistent']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Branch not found: nonexistent');
    });

    test('should checkout main branch', () => {
      mockBranchManager.checkout.mockReturnValue(mainBranch);

      const result = handleCheckout(['main']);

      expect(result.entry?.content).toContain('Switched to branch: Main conversation');
      expect(result.entry?.content).toContain('Messages: 1');
    });
  });

  // ============================================
  // handleMerge Tests
  // ============================================
  describe('handleMerge', () => {
    test('should show usage when no branch id provided', () => {
      const result = handleMerge([]);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Usage: /merge');
    });

    test('should merge branch successfully', () => {
      mockBranchManager.merge.mockReturnValue(true);

      const result = handleMerge(['branch_abc123']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Merged branch');
      expect(result.entry?.content).toContain('feature-branch');
      expect(mockBranchManager.merge).toHaveBeenCalledWith('branch_abc123');
    });

    test('should show error when merge fails', () => {
      mockBranchManager.merge.mockReturnValue(false);

      const result = handleMerge(['branch_abc123']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Merge failed');
    });

    test('should detect merging current branch into itself', () => {
      const result = handleMerge(['main']);

      expect(result.entry?.content).toContain('Cannot merge a branch into itself');
    });

    test('should show error for non-existent branch', () => {
      const result = handleMerge(['nonexistent']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Branch not found: nonexistent');
    });
  });

  // ============================================
  // handleBranch (Unified) Tests
  // ============================================
  describe('handleBranch', () => {
    test('should list branches when no action provided', () => {
      const result = handleBranch([]);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Conversation Branches');
    });

    test('should list branches with "list" action', () => {
      const result = handleBranch(['list']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Conversation Branches');
    });

    test('should create branch with "create" action', () => {
      const result = handleBranch(['create', 'new-feature']);

      expect(mockBranchManager.fork).toHaveBeenCalledWith('new-feature');
    });

    test('should switch branch with "switch" action', () => {
      mockBranchManager.checkout.mockReturnValue(sampleBranch);

      const result = handleBranch(['switch', 'branch_abc123']);

      expect(mockBranchManager.checkout).toHaveBeenCalledWith('branch_abc123');
      expect(result.entry?.content).toContain('Switched to branch');
    });

    test('should merge branch with "merge" action', () => {
      mockBranchManager.merge.mockReturnValue(true);

      const result = handleBranch(['merge', 'branch_abc123']);

      expect(mockBranchManager.merge).toHaveBeenCalledWith('branch_abc123');
      expect(result.entry?.content).toContain('Merged branch');
    });

    test('should diff branches with "diff" action', () => {
      const result = handleBranch(['diff', 'branch_abc123']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Branch Diff');
    });

    test('should delete branch with "delete" action', () => {
      mockBranchManager.deleteBranch.mockReturnValue(true);

      const result = handleBranch(['delete', 'branch_abc123']);

      expect(mockBranchManager.deleteBranch).toHaveBeenCalledWith('branch_abc123');
      expect(result.entry?.content).toContain('Deleted branch');
    });

    test('should prevent deleting main branch', () => {
      const result = handleBranch(['delete', 'main']);

      expect(result.entry?.content).toContain('Cannot delete the main branch');
    });

    test('should prevent deleting current branch', () => {
      mockBranchManager.getCurrentBranchId.mockReturnValue('branch_abc123');

      const result = handleBranch(['delete', 'branch_abc123']);

      expect(result.entry?.content).toContain('Cannot delete the current branch');
    });

    test('should rename branch with "rename" action', () => {
      mockBranchManager.renameBranch.mockReturnValue(true);

      const result = handleBranch(['rename', 'branch_abc123', 'new', 'name']);

      expect(mockBranchManager.renameBranch).toHaveBeenCalledWith('branch_abc123', 'new name');
      expect(result.entry?.content).toContain('Renamed branch');
    });

    test('should show tree with "tree" action', () => {
      const result = handleBranch(['tree']);

      expect(mockBranchManager.formatBranchTree).toHaveBeenCalled();
    });

    test('should show history with "history" action', () => {
      const result = handleBranch(['history']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Branch History');
    });

    test('should show help with "help" action', () => {
      const result = handleBranch(['help']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Branch Management');
      expect(result.entry?.content).toContain('create');
      expect(result.entry?.content).toContain('switch');
      expect(result.entry?.content).toContain('merge');
      expect(result.entry?.content).toContain('diff');
      expect(result.entry?.content).toContain('delete');
    });

    test('should show help for unknown action', () => {
      const result = handleBranch(['unknown-action']);

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Branch Management');
    });
  });

  // ============================================
  // Branch Resolution Tests
  // ============================================
  describe('Branch Resolution', () => {
    test('should resolve by exact ID', () => {
      mockBranchManager.checkout.mockReturnValue(sampleBranch);

      handleCheckout(['branch_abc123']);

      expect(mockBranchManager.checkout).toHaveBeenCalledWith('branch_abc123');
    });

    test('should resolve by name (case-insensitive)', () => {
      mockBranchManager.checkout.mockReturnValue(sampleBranch);

      handleCheckout(['Feature-Branch']);

      expect(mockBranchManager.checkout).toHaveBeenCalledWith('branch_abc123');
    });

    test('should resolve by ID prefix', () => {
      mockBranchManager.checkout.mockReturnValue(sampleBranch);

      handleCheckout(['branch_abc']);

      expect(mockBranchManager.checkout).toHaveBeenCalledWith('branch_abc123');
    });
  });

  // ============================================
  // CommandHandlerResult Interface
  // ============================================
  describe('CommandHandlerResult Interface', () => {
    test('handleFork should return correct structure', () => {
      const result = handleFork(['test']);

      expect(typeof result.handled).toBe('boolean');
      expect(result.handled).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.type).toBe('assistant');
      expect(typeof result.entry?.content).toBe('string');
      expect(result.entry?.timestamp).toBeInstanceOf(Date);
    });

    test('handleBranches should return correct structure', () => {
      const result = handleBranches();

      expect(typeof result.handled).toBe('boolean');
      expect(result.handled).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.type).toBe('assistant');
    });

    test('handleCheckout should return correct structure', () => {
      mockBranchManager.checkout.mockReturnValue(sampleBranch);

      const result = handleCheckout(['branch_abc123']);

      expect(typeof result.handled).toBe('boolean');
      expect(result.handled).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.type).toBe('assistant');
    });

    test('handleMerge should return correct structure', () => {
      mockBranchManager.merge.mockReturnValue(true);

      const result = handleMerge(['branch_abc123']);

      expect(typeof result.handled).toBe('boolean');
      expect(result.handled).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.type).toBe('assistant');
    });

    test('handleBranch should return correct structure', () => {
      const result = handleBranch(['help']);

      expect(typeof result.handled).toBe('boolean');
      expect(result.handled).toBe(true);
      expect(result.entry).toBeDefined();
      expect(result.entry?.type).toBe('assistant');
    });

    test('passToAI should be undefined for branch handlers', () => {
      const forkResult = handleFork(['test']);
      const branchesResult = handleBranches();
      mockBranchManager.checkout.mockReturnValue(sampleBranch);
      const checkoutResult = handleCheckout(['branch_abc123']);
      mockBranchManager.merge.mockReturnValue(true);
      const mergeResult = handleMerge(['branch_abc123']);
      const branchResult = handleBranch(['help']);

      expect(forkResult.passToAI).toBeUndefined();
      expect(branchesResult.passToAI).toBeUndefined();
      expect(checkoutResult.passToAI).toBeUndefined();
      expect(mergeResult.passToAI).toBeUndefined();
      expect(branchResult.passToAI).toBeUndefined();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    test('should handle branch with empty name gracefully', () => {
      const result = handleFork(['']);

      // Empty string joined becomes empty, so it uses timestamp
      expect(mockBranchManager.fork).toHaveBeenCalled();
    });

    test('should handle branch with special characters in name', () => {
      const result = handleFork(['feature/test-123']);

      expect(mockBranchManager.fork).toHaveBeenCalledWith('feature/test-123');
    });

    test('should handle branch with spaces in name', () => {
      const result = handleFork(['my', 'branch', 'with', 'spaces']);

      expect(mockBranchManager.fork).toHaveBeenCalledWith('my branch with spaces');
    });

    test('should handle many branches', () => {
      const manyBranches: ConversationBranch[] = Array.from({ length: 100 }, (_, i) => ({
        id: `branch_${i}`,
        name: `Branch ${i}`,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      mockBranchManager.getAllBranches.mockReturnValue(manyBranches);

      const result = handleBranches();

      expect(result.handled).toBe(true);
      expect(result.entry?.content).toContain('Branch 0');
      expect(result.entry?.content).toContain('Branch 99');
    });

    test('should handle branch with no messages', () => {
      const emptyBranch: ConversationBranch = {
        id: 'empty',
        name: 'Empty Branch',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockBranchManager.fork.mockReturnValue(emptyBranch);

      const result = handleFork(['empty']);

      expect(result.entry?.content).toContain('Messages: 0');
    });

    test('should show diff usage when no branch specified', () => {
      const result = handleBranch(['diff']);

      expect(result.entry?.content).toContain('Usage: /branch diff');
    });

    test('should show delete usage when no branch specified', () => {
      const result = handleBranch(['delete']);

      expect(result.entry?.content).toContain('Usage: /branch delete');
    });

    test('should show rename usage when args missing', () => {
      const result = handleBranch(['rename']);

      expect(result.entry?.content).toContain('Usage: /branch rename');
    });
  });

  // ============================================
  // Integration with getBranchManager
  // ============================================
  describe('Integration with getBranchManager', () => {
    test('handleFork should call getBranchManager', () => {
      handleFork(['test']);

      expect(getBranchManager).toHaveBeenCalled();
    });

    test('handleBranches should call getBranchManager', () => {
      handleBranches();

      expect(getBranchManager).toHaveBeenCalled();
    });

    test('handleCheckout should call getBranchManager', () => {
      handleCheckout(['branch_abc123']);

      expect(getBranchManager).toHaveBeenCalled();
    });

    test('handleMerge should call getBranchManager', () => {
      handleMerge(['branch_abc123']);

      expect(getBranchManager).toHaveBeenCalled();
    });

    test('handleBranch should call getBranchManager', () => {
      handleBranch(['list']);

      expect(getBranchManager).toHaveBeenCalled();
    });
  });
});
