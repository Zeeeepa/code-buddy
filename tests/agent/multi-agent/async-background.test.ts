/**
 * Tests for Multi-Agent Tools
 * Tests spawn, complete, getAgent, yield functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  spawnAgent,
  completeAgent,
  resetAgentThreads,
  YIELD_SIGNAL,
  getAgent,
  listAgents,
} from '../../../src/agent/multi-agent/agent-tools.js';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock agent-memory-integration
vi.mock('../../../src/agent/multi-agent/agent-memory-integration.js', () => ({
  readAgentMemory: vi.fn().mockReturnValue(null),
  appendAgentMemory: vi.fn(),
}));

describe('Multi-Agent Tools', () => {
  beforeEach(() => {
    resetAgentThreads();
  });

  it('exports YIELD_SIGNAL constant', () => {
    expect(YIELD_SIGNAL).toBe('__SESSIONS_YIELD__');
  });

  it('spawnAgent creates a running agent', () => {
    const result = spawnAgent({ prompt: 'test task' });
    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.id).toBeDefined();
      expect(result.status).toBe('running');
    }
  });

  it('spawnAgent with yield returns __yield flag', () => {
    const result = spawnAgent({ prompt: 'test', yield: true });
    expect('error' in result).toBe(false);
    expect((result as any).__yield).toBe(true);
  });

  it('spawnAgent without yield does not return __yield flag', () => {
    const result = spawnAgent({ prompt: 'test task' });
    expect('error' in result).toBe(false);
    expect((result as any).__yield).toBeUndefined();
  });

  it('spawned agent is tracked and retrievable', () => {
    const result = spawnAgent({ prompt: 'test task' });
    if ('error' in result) throw new Error(result.error);
    const agent = getAgent(result.id);
    expect(agent).toBeDefined();
    expect(agent!.status).toBe('running');
  });

  it('completeAgent marks agent as completed', () => {
    const spawned = spawnAgent({ prompt: 'task' });
    if ('error' in spawned) throw new Error(spawned.error);

    const completed = completeAgent(spawned.id, 'task done');
    expect(completed).toBe(true);

    const agent = getAgent(spawned.id);
    expect(agent!.status).toBe('completed');
  });

  it('listAgents returns all spawned agents', () => {
    spawnAgent({ prompt: 'task 1' });
    spawnAgent({ prompt: 'task 2' });

    const agents = listAgents();
    expect(agents.length).toBe(2);
  });

  it('spawn respects depth limits', () => {
    const a1 = spawnAgent({ prompt: 'level 1' });
    if ('error' in a1) throw new Error(a1.error);

    const a2 = spawnAgent({ prompt: 'level 2', parentId: a1.id });
    if ('error' in a2) throw new Error(a2.error);

    const a3 = spawnAgent({ prompt: 'level 3', parentId: a2.id });
    if ('error' in a3) throw new Error(a3.error);

    // Level 4 should fail (max depth = 3)
    const a4 = spawnAgent({ prompt: 'level 4', parentId: a3.id });
    expect('error' in a4).toBe(true);
  });

  it('getAgent returns undefined for unknown id', () => {
    const agent = getAgent('agent-999');
    expect(agent).toBeUndefined();
  });
});
