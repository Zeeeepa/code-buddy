/**
 * Multi-Agent 5-Tool Surface — LLM-callable agent orchestration
 *
 * Five tools that let the AI spawn, communicate with, and manage
 * sub-agent threads with depth limits, fork-context, and completion
 * watching.
 *
 * Tools: spawn_agent, send_input, wait_agent, close_agent, resume_agent
 *
 * Inspired by OpenAI Codex CLI's multi_agents handler.
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type AgentRole = 'default' | 'explorer' | 'worker' | string;

export interface AgentThread {
  id: string;
  nickname: string;
  role: AgentRole;
  status: 'running' | 'waiting' | 'completed' | 'error' | 'closed';
  depth: number;
  parentId: string | null;
  createdAt: Date;
  result?: string;
}

export interface SpawnOptions {
  role?: AgentRole;
  prompt: string;
  forkContext?: boolean;
  parentId?: string;
}

// ============================================================================
// Nickname Pool
// ============================================================================

const AGENT_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank',
  'Grace', 'Hank', 'Iris', 'Jack', 'Kate', 'Leo',
  'Mia', 'Noah', 'Olivia', 'Pete', 'Quinn', 'Ruby',
  'Sam', 'Tara', 'Uma', 'Vince', 'Wendy', 'Xander',
];

let nicknameIdx = 0;
let nicknameGeneration = 0;

function allocateNickname(): string {
  const name = AGENT_NAMES[nicknameIdx % AGENT_NAMES.length];
  nicknameIdx++;
  if (nicknameIdx >= AGENT_NAMES.length) {
    nicknameGeneration++;
    nicknameIdx = 0;
  }
  return nicknameGeneration > 0 ? `${name} (${nicknameGeneration + 1})` : name;
}

// ============================================================================
// Agent Thread Manager
// ============================================================================

/** Max agent depth (prevents runaway recursion) */
const MAX_AGENT_DEPTH = 3;

/** Max concurrent agent threads */
const MAX_CONCURRENT_AGENTS = 10;

/** Event emitter for agent lifecycle events */
export const agentEvents = new EventEmitter();

/** Active agent threads */
const threads = new Map<string, AgentThread>();

/** Message queues per agent (input messages waiting to be consumed) */
const messageQueues = new Map<string, string[]>();

/** Completion callbacks waiting on agents */
const waitCallbacks = new Map<string, Array<(thread: AgentThread) => void>>();

let nextId = 1;

/**
 * Reset all state (for testing).
 */
export function resetAgentThreads(): void {
  threads.clear();
  messageQueues.clear();
  waitCallbacks.clear();
  nicknameIdx = 0;
  nicknameGeneration = 0;
  nextId = 1;
}

/**
 * Spawn a new agent thread.
 */
export function spawnAgent(options: SpawnOptions): AgentThread | { error: string } {
  // Depth check
  const parentDepth = options.parentId
    ? (threads.get(options.parentId)?.depth ?? 0)
    : 0;
  if (parentDepth >= MAX_AGENT_DEPTH) {
    return { error: `Max agent depth (${MAX_AGENT_DEPTH}) reached. Cannot spawn sub-agent.` };
  }

  // Concurrency check
  const activeCount = [...threads.values()].filter(t => t.status === 'running' || t.status === 'waiting').length;
  if (activeCount >= MAX_CONCURRENT_AGENTS) {
    return { error: `Max concurrent agents (${MAX_CONCURRENT_AGENTS}) reached. Close an agent first.` };
  }

  const id = `agent-${nextId++}`;
  const thread: AgentThread = {
    id,
    nickname: allocateNickname(),
    role: options.role ?? 'default',
    status: 'running',
    depth: parentDepth + 1,
    parentId: options.parentId ?? null,
    createdAt: new Date(),
  };

  threads.set(id, thread);
  messageQueues.set(id, [options.prompt]);

  logger.debug(`Agent spawned: ${thread.nickname} (${id}), role=${thread.role}, depth=${thread.depth}`);
  agentEvents.emit('spawn', thread);

  return thread;
}

/**
 * Send input to an existing agent.
 */
export function sendInput(agentId: string, message: string, interrupt?: boolean): boolean {
  const thread = threads.get(agentId);
  if (!thread) return false;
  if (thread.status === 'closed' || thread.status === 'error') return false;

  const queue = messageQueues.get(agentId) ?? [];
  if (interrupt) {
    // Clear queue and prepend
    queue.length = 0;
  }
  queue.push(message);
  messageQueues.set(agentId, queue);

  agentEvents.emit('input', { agentId, message, interrupt });
  return true;
}

/**
 * Consume the next message for an agent (called by the agent's execution loop).
 */
export function consumeInput(agentId: string): string | null {
  const queue = messageQueues.get(agentId);
  if (!queue || queue.length === 0) return null;
  return queue.shift() ?? null;
}

/**
 * Wait for one or more agents to reach a final status.
 * Returns a promise that resolves when at least one agent finishes.
 */
export function waitForAgents(
  agentIds: string[],
  timeoutMs: number = 300_000,
): Promise<AgentThread[]> {
  return new Promise((resolve) => {
    const results: AgentThread[] = [];

    // Check already-completed agents
    for (const id of agentIds) {
      const thread = threads.get(id);
      if (thread && (thread.status === 'completed' || thread.status === 'error' || thread.status === 'closed')) {
        results.push(thread);
      }
    }

    if (results.length > 0) {
      resolve(results);
      return;
    }

    // Register callbacks
    const timer = setTimeout(() => {
      // Timeout — return whatever we have
      for (const id of agentIds) {
        const thread = threads.get(id);
        if (thread) results.push(thread);
      }
      cleanup();
      resolve(results);
    }, timeoutMs);

    const onComplete = (thread: AgentThread) => {
      if (agentIds.includes(thread.id)) {
        results.push(thread);
        cleanup();
        resolve(results);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      agentEvents.removeListener('complete', onComplete);
    };

    // Use addListener (not once) because cleanup removes it explicitly.
    // Set maxListeners higher to prevent Node warning for many concurrent waits.
    agentEvents.setMaxListeners(Math.max(agentEvents.getMaxListeners(), 50));
    agentEvents.on('complete', onComplete);
  });
}

/**
 * Mark an agent as completed.
 */
export function completeAgent(agentId: string, result?: string): boolean {
  const thread = threads.get(agentId);
  if (!thread) return false;

  thread.status = 'completed';
  thread.result = result;

  agentEvents.emit('complete', thread);
  logger.debug(`Agent completed: ${thread.nickname} (${agentId})`);

  // Notify parent if exists
  if (thread.parentId) {
    sendInput(thread.parentId, `[Agent ${thread.nickname} completed]: ${result ?? 'done'}`);
  }

  return true;
}

/**
 * Close an agent and release its slot.
 */
export function closeAgent(agentId: string): boolean {
  const thread = threads.get(agentId);
  if (!thread) return false;

  thread.status = 'closed';
  messageQueues.delete(agentId);

  agentEvents.emit('close', thread);
  logger.debug(`Agent closed: ${thread.nickname} (${agentId})`);
  return true;
}

/**
 * Resume a previously closed agent.
 */
export function resumeAgent(agentId: string, prompt?: string): boolean {
  const thread = threads.get(agentId);
  if (!thread) return false;
  if (thread.status !== 'closed' && thread.status !== 'completed') return false;

  thread.status = 'running';
  const queue: string[] = [];
  if (prompt) queue.push(prompt);
  messageQueues.set(agentId, queue);

  agentEvents.emit('resume', thread);
  logger.debug(`Agent resumed: ${thread.nickname} (${agentId})`);
  return true;
}

/**
 * Get all active agent threads.
 */
export function listAgents(): AgentThread[] {
  return [...threads.values()];
}

/**
 * Get a specific agent thread.
 */
export function getAgent(agentId: string): AgentThread | undefined {
  return threads.get(agentId);
}
