import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  spawnAgent,
  completeAgent,
  resetAgentThreads,
  agentEvents,
  waitForSingleAgent,
  YIELD_SIGNAL,
} from '../../../src/agent/multi-agent/agent-tools.js';

describe('sessions_yield', () => {
  beforeEach(() => {
    resetAgentThreads();
  });

  it('exports YIELD_SIGNAL constant', () => {
    expect(YIELD_SIGNAL).toBe('__SESSIONS_YIELD__');
  });

  it('spawnAgent with yield=true returns __yield flag', () => {
    const result = spawnAgent({ prompt: 'test task', yield: true });
    expect('error' in result).toBe(false);
    expect((result as any).__yield).toBe(true);
    expect((result as any).id).toBeDefined();
    expect((result as any).nickname).toBeDefined();
  });

  it('spawnAgent without yield does not return __yield flag', () => {
    const result = spawnAgent({ prompt: 'test task' });
    expect('error' in result).toBe(false);
    expect((result as any).__yield).toBeUndefined();
  });

  it('spawnAgent with yield=false does not return __yield flag', () => {
    const result = spawnAgent({ prompt: 'test task', yield: false });
    expect('error' in result).toBe(false);
    expect((result as any).__yield).toBeUndefined();
  });

  it('waitForSingleAgent resolves on agent completion', async () => {
    const agent = spawnAgent({ prompt: 'test' });
    if ('error' in agent) throw new Error(agent.error);

    const agentId = agent.id;

    // Complete the agent after a short delay
    setTimeout(() => {
      completeAgent(agentId, 'done!');
    }, 50);

    const result = await waitForSingleAgent(agentId, 5000);
    expect(result.status).toBe('completed');
    expect(result.result).toBe('done!');
  });

  it('waitForSingleAgent resolves immediately for already-completed agent', async () => {
    const agent = spawnAgent({ prompt: 'test' });
    if ('error' in agent) throw new Error(agent.error);

    completeAgent(agent.id, 'already done');

    const result = await waitForSingleAgent(agent.id, 5000);
    expect(result.status).toBe('completed');
  });

  it('waitForSingleAgent rejects for unknown agent', async () => {
    await expect(waitForSingleAgent('agent-999', 1000)).rejects.toThrow('not found');
  });

  it('waitForSingleAgent rejects on timeout', async () => {
    const agent = spawnAgent({ prompt: 'slow task' });
    if ('error' in agent) throw new Error(agent.error);

    await expect(waitForSingleAgent(agent.id, 100)).rejects.toThrow('timeout');
  });
});
