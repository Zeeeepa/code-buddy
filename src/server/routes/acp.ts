/**
 * ACP HTTP Transport Routes
 *
 * Agent Communication Protocol over HTTP — provides a transport layer
 * for agent-to-agent communication with named persistent sessions.
 *
 * Routes:
 * - POST /api/acp/send           — Send a message to an agent
 * - GET  /api/acp/agents         — List available agents
 * - POST /api/acp/request        — Submit a task
 * - GET  /api/acp/tasks/:id      — Get task status
 * - POST /api/acp/tasks/:id/yield  — Yield a task
 * - POST /api/acp/tasks/:id/resume — Resume a yielded task
 * - POST /api/acp/sessions       — Create a named session
 * - GET  /api/acp/sessions       — List sessions
 * - GET  /api/acp/sessions/:name — Get session with tasks
 * - DELETE /api/acp/sessions/:name — Delete session
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/index.js';
import {
  A2AAgentServer,
  A2AAgentClient,
  getTaskResult,
  type Task,
  type A2AMessage,
} from '../../protocols/a2a/index.js';

/* ── Session Store ── */

interface QueuedPrompt {
  message: A2AMessage;
  metadata?: Record<string, string>;
  fireAndForget?: boolean;
  resolve: (task: Task) => void;
}

interface ACPSession {
  id: string;
  name: string;
  repoScope?: string;
  tasks: Task[];
  createdAt: number;
  lastActive: number;
  /** Prompt queue — messages waiting for the active task to complete */
  queue: QueuedPrompt[];
  /** Whether the session is soft-closed (no new sends accepted) */
  closed: boolean;
  /** Currently active task ID */
  activeTaskId: string | null;
}

export function createACPRoutes(): Router {
  const router = Router();
  const client = new A2AAgentClient();
  const sessions = new Map<string, ACPSession>();

  // Task index: taskId → agentKey (for cross-agent task lookups)
  const taskIndex = new Map<string, string>();

  /**
   * Helper: find a task across all registered agents
   */
  function findTask(taskId: string): { task: Task; agentKey: string } | undefined {
    // Check index first
    const indexed = taskIndex.get(taskId);
    if (indexed) {
      const server = (client as unknown as { agents: Map<string, A2AAgentServer> }).agents?.get(indexed);
      if (server) {
        const task = server.getTask(taskId);
        if (task) return { task, agentKey: indexed };
      }
    }

    // Fallback: search all agents
    for (const agentKey of client.listAgents()) {
      const server = (client as unknown as { agents: Map<string, A2AAgentServer> }).agents?.get(agentKey);
      if (server) {
        const task = server.getTask(taskId);
        if (task) {
          taskIndex.set(taskId, agentKey);
          return { task, agentKey };
        }
      }
    }
    return undefined;
  }

  /**
   * Helper: get A2AAgentServer by key
   */
  function getServer(agentKey: string): A2AAgentServer | undefined {
    return (client as unknown as { agents: Map<string, A2AAgentServer> }).agents?.get(agentKey);
  }

  /**
   * Helper: update session lastActive timestamp
   */
  function touchSession(sessionId: string): void {
    for (const session of Array.from(sessions.values())) {
      if (session.id === sessionId) {
        session.lastActive = Date.now();
        return;
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Agent & Task Endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/acp/send — Send a message to an agent
   *
   * Extended (OpenClaw v2026.3.12 alignment):
   * - `resumeSessionId` — copy context from a previous session
   * - `fireAndForget` — return 202 immediately
   * - Prompt queue — if a task is active, queue the prompt (returns 202 with queuePosition)
   */
  router.post('/send', asyncHandler(async (req, res) => {
    const { agentId, message, sessionId, metadata, resumeSessionId, fireAndForget } = req.body;

    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId (string) is required' });
      return;
    }
    if (!message || !message.role || !Array.isArray(message.parts)) {
      res.status(400).json({ error: 'message with role and parts[] is required' });
      return;
    }

    const server = getServer(agentId);
    if (!server) {
      res.status(404).json({ error: `Agent not found: ${agentId}` });
      return;
    }

    // Check if session is soft-closed
    if (sessionId) {
      const session = findSessionById(sessionId);
      if (session?.closed) {
        res.status(409).json({ error: 'Session is closed — no new sends accepted' });
        return;
      }
    }

    const taskId = `acp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const a2aMessage: A2AMessage = {
      role: message.role,
      parts: message.parts,
      metadata: message.metadata,
    };

    // Resume from previous session: inject its message history
    let resumeMessages: A2AMessage[] = [];
    if (resumeSessionId && typeof resumeSessionId === 'string') {
      const prevSession = findSessionById(resumeSessionId);
      if (prevSession) {
        resumeMessages = prevSession.tasks.flatMap(t => t.messages || []);
      }
    }

    // Check if session has an active task — queue if so
    if (sessionId) {
      const session = findSessionById(sessionId);
      if (session?.activeTaskId) {
        // Queue the prompt
        const queuePosition = session.queue.length + 1;

        if (fireAndForget) {
          session.queue.push({ message: a2aMessage, metadata, fireAndForget: true, resolve: () => {} });
          res.status(202).json({ taskId, queued: true, queuePosition, fireAndForget: true });
          return;
        }

        // Return 202 with queue position (prompt will be processed when active task completes)
        const queuePromise = new Promise<Task>((resolve) => {
          session.queue.push({ message: a2aMessage, metadata, resolve });
        });

        res.status(202).json({ taskId, queued: true, queuePosition });
        // Process will drain queue automatically
        return;
      }
    }

    // Fire-and-forget: submit task and return immediately
    if (fireAndForget) {
      server.submitTask({
        id: taskId,
        sessionId: sessionId || taskId,
        message: a2aMessage,
        metadata: { ...(metadata || {}), resumeMessages: resumeMessages.length > 0 ? 'true' : undefined },
      }).then(task => {
        taskIndex.set(taskId, agentId);
        if (sessionId) associateTaskWithSession(sessionId, task);
      });

      res.status(202).json({ taskId, queued: false, fireAndForget: true });
      return;
    }

    const task = await server.submitTask({
      id: taskId,
      sessionId: sessionId || taskId,
      message: a2aMessage,
      metadata,
    });

    taskIndex.set(taskId, agentId);

    // Associate with session if provided
    if (sessionId) {
      associateTaskWithSession(sessionId, task);
    }

    res.json({
      id: task.id,
      sessionId: task.sessionId,
      status: task.status,
      result: getTaskResult(task),
      artifacts: task.artifacts,
      history: task.history,
    });
  }));

  /**
   * GET /api/acp/agents — List available agents with their cards
   */
  router.get('/agents', (_req, res) => {
    const agents = client.listAgents();
    const cards = agents.map((key) => ({
      id: key,
      card: client.getAgentCard(key),
    }));
    res.json({ agents: cards });
  });

  /**
   * POST /api/acp/request — Submit a task to an agent
   */
  router.post('/request', asyncHandler(async (req, res) => {
    const { agentId, taskId, message, metadata } = req.body;

    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId (string) is required' });
      return;
    }
    if (!taskId || typeof taskId !== 'string') {
      res.status(400).json({ error: 'taskId (string) is required' });
      return;
    }
    if (!message || !message.role || !Array.isArray(message.parts)) {
      res.status(400).json({ error: 'message with role and parts[] is required' });
      return;
    }

    const server = getServer(agentId);
    if (!server) {
      res.status(404).json({ error: `Agent not found: ${agentId}` });
      return;
    }

    const a2aMessage: A2AMessage = {
      role: message.role,
      parts: message.parts,
      metadata: message.metadata,
    };

    const task = await server.submitTask({
      id: taskId,
      message: a2aMessage,
      metadata,
    });

    taskIndex.set(taskId, agentId);

    res.json({
      id: task.id,
      sessionId: task.sessionId,
      status: task.status,
      result: getTaskResult(task),
      artifacts: task.artifacts,
      history: task.history,
    });
  }));

  /**
   * GET /api/acp/tasks/:id — Get task status
   */
  router.get('/tasks/:id', (req, res) => {
    const found = findTask(req.params.id as string);
    if (!found) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const { task } = found;
    res.json({
      id: task.id,
      sessionId: task.sessionId,
      status: task.status,
      result: getTaskResult(task),
      artifacts: task.artifacts,
      history: task.history,
      messages: task.messages,
      metadata: task.metadata,
      yieldPayload: task.yieldPayload,
    });
  });

  /**
   * POST /api/acp/tasks/:id/yield — Yield a task (pause for orchestrator)
   */
  router.post('/tasks/:id/yield', (req, res) => {
    const { reason, state, resumeHint } = req.body;

    if (!reason || typeof reason !== 'string') {
      res.status(400).json({ error: 'reason (string) is required' });
      return;
    }

    const taskId = req.params.id as string;
    const found = findTask(taskId);
    if (!found) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const server = getServer(found.agentKey);
    if (!server) {
      res.status(500).json({ error: 'Agent server unavailable' });
      return;
    }

    const yielded = server.yieldTask(taskId, {
      reason,
      state,
      resumeHint,
    });

    if (!yielded) {
      res.status(409).json({ error: 'Task cannot be yielded (not in working state)' });
      return;
    }

    const task = server.getTask(taskId);
    res.json({
      id: taskId,
      status: task?.status,
      yieldPayload: task?.yieldPayload,
    });
  });

  /**
   * POST /api/acp/tasks/:id/resume — Resume a yielded task
   */
  router.post('/tasks/:id/resume', asyncHandler(async (req, res) => {
    const { message, state } = req.body;

    const taskId = req.params.id as string;
    const found = findTask(taskId);
    if (!found) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const server = getServer(found.agentKey);
    if (!server) {
      res.status(500).json({ error: 'Agent server unavailable' });
      return;
    }

    const resumeMessage: A2AMessage | undefined = message
      ? { role: message.role, parts: message.parts, metadata: message.metadata }
      : undefined;

    const task = await server.resumeTask(taskId, resumeMessage, state);

    res.json({
      id: task.id,
      sessionId: task.sessionId,
      status: task.status,
      result: getTaskResult(task),
      artifacts: task.artifacts,
      history: task.history,
    });
  }));

  // ──────────────────────────────────────────────────────────────────────────
  // Named Persistent Sessions
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/acp/sessions — Create a named session
   */
  router.post('/sessions', (req, res) => {
    const { name, repoScope } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name (string) is required' });
      return;
    }

    if (name.length > 128) {
      res.status(400).json({ error: 'name must be 128 characters or fewer' });
      return;
    }

    if (sessions.has(name)) {
      res.status(409).json({ error: `Session already exists: ${name}` });
      return;
    }

    const session: ACPSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      repoScope: repoScope || undefined,
      tasks: [],
      createdAt: Date.now(),
      lastActive: Date.now(),
      queue: [],
      closed: false,
      activeTaskId: null,
    };

    sessions.set(name, session);

    res.status(201).json({
      id: session.id,
      name: session.name,
      repoScope: session.repoScope,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActive: new Date(session.lastActive).toISOString(),
      taskCount: 0,
    });
  });

  /**
   * GET /api/acp/sessions — List all sessions
   */
  router.get('/sessions', (_req, res) => {
    const list = Array.from(sessions.values()).map((s) => ({
      id: s.id,
      name: s.name,
      repoScope: s.repoScope,
      taskCount: s.tasks.length,
      createdAt: new Date(s.createdAt).toISOString(),
      lastActive: new Date(s.lastActive).toISOString(),
    }));

    res.json({ sessions: list });
  });

  /**
   * GET /api/acp/sessions/:name — Get a session with its tasks
   */
  router.get('/sessions/:name', (req, res) => {
    const session = sessions.get(req.params.name);
    if (!session) {
      res.status(404).json({ error: `Session not found: ${req.params.name}` });
      return;
    }

    res.json({
      id: session.id,
      name: session.name,
      repoScope: session.repoScope,
      createdAt: new Date(session.createdAt).toISOString(),
      lastActive: new Date(session.lastActive).toISOString(),
      tasks: session.tasks.map((t) => ({
        id: t.id,
        status: t.status,
        result: getTaskResult(t),
        artifacts: t.artifacts,
        metadata: t.metadata,
      })),
    });
  });

  /**
   * DELETE /api/acp/sessions/:name — Delete a session
   */
  router.delete('/sessions/:name', (req, res) => {
    if (!sessions.has(req.params.name)) {
      res.status(404).json({ error: `Session not found: ${req.params.name}` });
      return;
    }

    sessions.delete(req.params.name);
    res.json({ deleted: true, name: req.params.name });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Advanced Session Operations (OpenClaw v2026.3.12)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * POST /api/acp/sessions/:name/cancel — Cancel active task and clear queue
   */
  router.post('/sessions/:name/cancel', (req, res) => {
    const session = sessions.get(req.params.name);
    if (!session) {
      res.status(404).json({ error: `Session not found: ${req.params.name}` });
      return;
    }

    // Cancel active task
    let canceledTaskId: string | null = null;
    if (session.activeTaskId) {
      // Find and cancel the task across all agents
      const found = findTask(session.activeTaskId);
      if (found) {
        const server = getServer(found.agentKey);
        server?.cancelTask(session.activeTaskId);
      }
      canceledTaskId = session.activeTaskId;
      session.activeTaskId = null;
    }

    // Clear queue
    const droppedCount = session.queue.length;
    session.queue = [];

    session.lastActive = Date.now();

    res.json({
      canceled: true,
      canceledTaskId,
      droppedFromQueue: droppedCount,
    });
  });

  /**
   * POST /api/acp/sessions/:name/close — Soft-close session
   * Active task finishes, but no new sends accepted
   */
  router.post('/sessions/:name/close', (req, res) => {
    const session = sessions.get(req.params.name);
    if (!session) {
      res.status(404).json({ error: `Session not found: ${req.params.name}` });
      return;
    }

    session.closed = true;
    session.lastActive = Date.now();

    res.json({
      closed: true,
      name: session.name,
      activeTaskId: session.activeTaskId,
      queuedPrompts: session.queue.length,
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────────────

  function findSessionById(sessionId: string): ACPSession | undefined {
    for (const session of sessions.values()) {
      if (session.id === sessionId) return session;
    }
    return undefined;
  }

  function associateTaskWithSession(sessionId: string, task: Task): void {
    touchSession(sessionId);
    for (const session of sessions.values()) {
      if (session.id === sessionId) {
        session.tasks.push(task);
        session.activeTaskId = task.id;
        break;
      }
    }
  }

  // Expose internals for testing/external registration
  (router as unknown as Record<string, unknown>).acpClient = client;
  (router as unknown as Record<string, unknown>).acpSessions = sessions;

  return router;
}
