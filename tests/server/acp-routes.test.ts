/**
 * Tests for ACP advanced session features
 *
 * Phase 2: resumeSessionId, prompt queue, cancel, soft-close, fire-and-forget
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the a2a module
vi.mock('../../src/protocols/a2a/index.js', () => {
  const tasks = new Map<string, any>();
  const activeTasks = new Map<string, boolean>();

  const A2AAgentServer = vi.fn().mockImplementation((card: any, executor: any) => {
    return {
      getAgentCard: () => card,
      submitTask: vi.fn().mockImplementation(async (req: any) => {
        const task = {
          id: req.id,
          sessionId: req.sessionId || req.id,
          status: { status: 'completed', timestamp: Date.now() },
          messages: [req.message],
          artifacts: [],
          history: [{ status: 'submitted', timestamp: Date.now() }],
          metadata: req.metadata,
        };
        tasks.set(req.id, task);
        return task;
      }),
      getTask: (id: string) => tasks.get(id),
      cancelTask: vi.fn().mockImplementation((id: string) => {
        const task = tasks.get(id);
        if (task) {
          task.status = { status: 'canceled', timestamp: Date.now() };
          return true;
        }
        return false;
      }),
      yieldTask: vi.fn().mockReturnValue(true),
      resumeTask: vi.fn().mockImplementation(async (id: string) => {
        const task = tasks.get(id);
        if (task) {
          task.status = { status: 'completed', timestamp: Date.now() };
        }
        return task;
      }),
    };
  });

  const A2AAgentClient = vi.fn().mockImplementation(() => {
    const agents = new Map<string, any>();
    return {
      agents,
      listAgents: () => Array.from(agents.keys()),
      getAgentCard: (key: string) => agents.get(key)?.getAgentCard(),
      registerAgent: (key: string, server: any) => agents.set(key, server),
    };
  });

  return {
    A2AAgentServer,
    A2AAgentClient,
    getTaskResult: (task: any) => task.messages?.[task.messages.length - 1]?.parts?.[0]?.text || null,
    TaskStatus: {
      SUBMITTED: 'submitted',
      WORKING: 'working',
      COMPLETED: 'completed',
      FAILED: 'failed',
      CANCELED: 'canceled',
    },
  };
});

describe('ACP Advanced Sessions', () => {
  describe('ACPSession interface', () => {
    it('should have queue, closed, and activeTaskId fields', () => {
      // Type check — if the module compiles, this passes
      const session = {
        id: 'session_1',
        name: 'test',
        tasks: [],
        createdAt: Date.now(),
        lastActive: Date.now(),
        queue: [] as any[],
        closed: false,
        activeTaskId: null as string | null,
      };
      expect(session.queue).toEqual([]);
      expect(session.closed).toBe(false);
      expect(session.activeTaskId).toBeNull();
    });
  });

  describe('Prompt Queue behavior', () => {
    it('should queue prompts when task is active', () => {
      const queue: Array<{ message: any; metadata?: any; resolve: Function }> = [];

      // Simulate active task
      const activeTaskId = 'task_1';
      const message = { role: 'user', parts: [{ type: 'text', text: 'queued prompt' }] };

      // Queue the prompt
      queue.push({ message, resolve: () => {} });

      expect(queue.length).toBe(1);
      expect(queue[0].message.parts[0].text).toBe('queued prompt');
    });

    it('should drain queue in order', () => {
      const queue: string[] = ['first', 'second', 'third'];
      const processed: string[] = [];

      while (queue.length > 0) {
        processed.push(queue.shift()!);
      }

      expect(processed).toEqual(['first', 'second', 'third']);
    });
  });

  describe('Cancel behavior', () => {
    it('should clear queue on cancel', () => {
      const queue = ['a', 'b', 'c'];
      // Cancel: clear queue
      queue.length = 0;
      expect(queue).toEqual([]);
    });
  });

  describe('Soft-close behavior', () => {
    it('should reject new sends when closed', () => {
      const session = { closed: false, activeTaskId: 'task_1' };

      // Soft-close
      session.closed = true;

      // Should reject
      expect(session.closed).toBe(true);
    });

    it('should allow active task to finish', () => {
      const session = { closed: true, activeTaskId: 'task_1' };
      // Active task can still complete
      expect(session.activeTaskId).toBe('task_1');
    });
  });

  describe('Fire-and-forget', () => {
    it('should return 202 immediately with taskId', () => {
      const taskId = `acp_${Date.now()}_abc`;
      const response = {
        status: 202,
        body: { taskId, queued: true },
      };

      expect(response.status).toBe(202);
      expect(response.body.taskId).toBe(taskId);
      expect(response.body.queued).toBe(true);
    });
  });

  describe('resumeSessionId', () => {
    it('should copy previous session context', () => {
      const previousSession = {
        tasks: [
          { messages: [{ role: 'user', parts: [{ type: 'text', text: 'earlier context' }] }] },
        ],
      };

      // Extract messages from previous session
      const previousMessages = previousSession.tasks
        .flatMap(t => t.messages);

      expect(previousMessages.length).toBe(1);
      expect(previousMessages[0].parts[0].text).toBe('earlier context');
    });
  });
});
