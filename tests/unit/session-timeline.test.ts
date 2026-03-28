/**
 * Unit tests for conversation branching
 *
 * Tests handleBranches, handleFork, handleCheckout, BranchManager
 * message management, and fork-from-message functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs-extra
vi.mock('fs-extra', () => {
  const impl = {
    ensureDirSync: vi.fn(),
    readdirSync: vi.fn().mockReturnValue([]),
    readJsonSync: vi.fn(),
    writeJsonSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false),
    unlinkSync: vi.fn(),
  };
  return { ...impl, default: impl };
});

// Mock os
vi.mock('os', () => {
  const impl = {
    homedir: () => '/tmp/test-home',
  };
  return { ...impl, default: impl };
});

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { handleBranches, handleFork, handleCheckout } from '../../src/commands/handlers/branch-handlers.js';
import { getBranchManager, resetBranchManager } from '../../src/persistence/conversation-branches.js';

describe('Session Branching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBranchManager();
  });

  it('should show branches list', () => {
    const result = handleBranches();
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toBeDefined();
  });

  it('should add messages to the current branch', () => {
    const mgr = getBranchManager();
    mgr.addMessage({ role: 'user', content: 'Hello, world!' });
    mgr.addMessage({ role: 'assistant', content: 'Hi there!' });

    const branch = mgr.getCurrentBranch();
    expect(branch.messages.length).toBe(2);
    expect(branch.messages[0].content).toBe('Hello, world!');
    expect(branch.messages[1].content).toBe('Hi there!');
  });

  it('should fork a new branch', () => {
    const mgr = getBranchManager();
    mgr.addMessage({ role: 'user', content: 'Hello' });
    mgr.addMessage({ role: 'assistant', content: 'Hi' });

    const result = handleFork(['my-fork']);
    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('my-fork');

    const currentBranch = mgr.getCurrentBranch();
    expect(currentBranch.name).toBe('my-fork');
  });

  it('should fork from a specific message index', () => {
    const mgr = getBranchManager();
    mgr.addMessage({ role: 'user', content: 'First message' });
    mgr.addMessage({ role: 'assistant', content: 'Second message' });
    mgr.addMessage({ role: 'user', content: 'Third message' });

    const branch = mgr.forkFromMessage('experiment', 1);
    expect(branch.name).toBe('experiment');
    // The new branch should have messages up to the fork point
    expect(branch.messages.length).toBe(1);
  });

  it('should switch branches with checkout', () => {
    const mgr = getBranchManager();
    mgr.addMessage({ role: 'user', content: 'Hello' });

    // Fork to create a second branch
    handleFork(['test-branch']);
    const forkedBranch = mgr.getCurrentBranch();
    expect(forkedBranch.name).toBe('test-branch');

    // Checkout back to main
    const result = handleCheckout(['Main conversation']);
    expect(result.handled).toBe(true);

    const current = mgr.getCurrentBranch();
    expect(current.name).toBe('Main conversation');
  });

  it('should list all branches', () => {
    const mgr = getBranchManager();
    mgr.addMessage({ role: 'user', content: 'Hello' });
    handleFork(['branch-a']);
    mgr.checkout('main');
    handleFork(['branch-b']);

    const result = handleBranches();
    expect(result.entry?.content).toContain('branch-a');
    expect(result.entry?.content).toContain('branch-b');
  });

  it('should mark current branch in listing', () => {
    const mgr = getBranchManager();
    mgr.addMessage({ role: 'user', content: 'Hello' });

    const result = handleBranches();
    expect(result.entry?.content).toContain('(current)');
  });

  it('should show branch commands in help text', () => {
    const mgr = getBranchManager();
    mgr.addMessage({ role: 'user', content: 'Hello' });

    const result = handleBranches();
    expect(result.entry?.content).toContain('/fork');
    expect(result.entry?.content).toContain('/checkout');
  });
});
