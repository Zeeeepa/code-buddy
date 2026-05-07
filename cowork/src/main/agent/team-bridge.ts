/**
 * TeamBridge — Phase 4 layer 9 (Agent Teams) wiring for Cowork.
 *
 * Wraps the core `TeamManager` from `src/agent/multi-agent/team-manager.ts`
 * so Cowork can observe an Agent Team's lifecycle (start/stop, member
 * add/remove, task add/assign/update, mailbox messages) in real time.
 *
 * Design choices
 * - Reuses the core singleton via `loadCoreModule` (pattern shared with
 *   SubAgentBridge / OrchestratorBridge / FleetBridge).
 * - Subscribes to the 8 events TeamManager already emits — no core change
 *   needed. Translates each event to a Cowork ServerEvent.
 * - Stateless on the bridge side: TeamManager owns state, the bridge
 *   forwards. Cowork rebuilds its store slice from `getStatus()` on init.
 *
 * @module main/agent/team-bridge
 */

import { log, logError, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';
import type {
  ServerEvent,
  TeamMember,
  TeamTask,
  TeamMailboxMessage,
  TeamSnapshot,
  TeamMemberStatus,
  TeamTaskStatus,
  TeamTaskPriority,
  TeamStatusValue,
} from '../../renderer/types';

interface CoreTeamMember {
  id: string;
  role: string;
  label: string;
  status: 'idle' | 'working' | 'done' | 'error';
  currentTaskId: string | null;
  completedTasks: number;
  joinedAt: Date | string;
}

interface CoreTeamTask {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedRole: string | null;
  dependencies: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
  completedAt?: Date | string;
  result?: string;
  error?: string;
}

interface CoreMailboxMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date | string;
  read: boolean;
}

interface CoreTeamStatus {
  status: 'inactive' | 'active' | 'paused' | 'dissolved';
  goal: string;
  memberCount: number;
  members: CoreTeamMember[];
  taskSummary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
  unreadMessages: number;
  uptime: string;
}

interface CoreTeamManager {
  on(event: string, listener: (...args: unknown[]) => void): void;
  off(event: string, listener: (...args: unknown[]) => void): void;
  start(goal?: string): { success: boolean; leadId: string; message: string };
  stop(): { success: boolean; message: string };
  addMember(role: string, label?: string): { success: boolean; memberId: string; message: string };
  removeMember(memberId: string): { success: boolean; message: string };
  addTask(
    title: string,
    description: string,
    options?: { priority?: string; assignedRole?: string; dependencies?: string[] }
  ): CoreTeamTask;
  updateTask(
    taskId: string,
    updates: { status?: string; assignedTo?: string; result?: string; error?: string }
  ): { success: boolean; message: string };
  assignTask(taskId: string, memberId: string): { success: boolean; message: string };
  sendMessage(from: string, to: string, content: string): CoreMailboxMessage;
  getStatus(): CoreTeamStatus;
  getMembers(): CoreTeamMember[];
  getTasks(): CoreTeamTask[];
  getInbox(memberId: string, limit?: number): CoreMailboxMessage[];
  isActive(): boolean;
  getLeadId(): string | null;
  getTeamGoal(): string;
}

interface CoreTeamModule {
  getTeamManager: () => CoreTeamManager;
}

let cachedModule: CoreTeamModule | null = null;
let cachedManager: CoreTeamManager | null = null;

async function loadTeamModule(): Promise<CoreTeamManager | null> {
  if (cachedManager) return cachedManager;
  if (!cachedModule) {
    const mod = await loadCoreModule<CoreTeamModule>('agent/multi-agent/team-manager.js');
    if (!mod) {
      logWarn('[TeamBridge] Core team-manager module unavailable');
      return null;
    }
    cachedModule = mod;
    log('[TeamBridge] Core team-manager module loaded');
  }
  cachedManager = cachedModule.getTeamManager();
  return cachedManager;
}

function toIsoDate(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeMember(member: CoreTeamMember): TeamMember {
  return {
    id: member.id,
    role: member.role,
    label: member.label,
    status: member.status as TeamMemberStatus,
    currentTaskId: member.currentTaskId,
    completedTasks: member.completedTasks,
    joinedAt: toIsoDate(member.joinedAt) ?? new Date().toISOString(),
  };
}

function normalizeTask(task: CoreTeamTask): TeamTask {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as TeamTaskStatus,
    priority: task.priority as TeamTaskPriority,
    assignedTo: task.assignedTo,
    assignedRole: task.assignedRole,
    dependencies: task.dependencies,
    createdAt: toIsoDate(task.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoDate(task.updatedAt) ?? new Date().toISOString(),
    completedAt: toIsoDate(task.completedAt),
    result: task.result,
    error: task.error,
  };
}

function normalizeMessage(msg: CoreMailboxMessage): TeamMailboxMessage {
  return {
    id: msg.id,
    from: msg.from,
    to: msg.to,
    content: msg.content,
    timestamp: toIsoDate(msg.timestamp) ?? new Date().toISOString(),
    read: msg.read,
  };
}

function normalizeSnapshot(status: CoreTeamStatus): TeamSnapshot {
  return {
    status: status.status as TeamStatusValue,
    goal: status.goal,
    memberCount: status.memberCount,
    members: status.members.map(normalizeMember),
    taskSummary: status.taskSummary,
    unreadMessages: status.unreadMessages,
    uptime: status.uptime,
  };
}

export class TeamBridge {
  private readonly sendToRenderer: (event: ServerEvent) => void;
  private eventListenersAttached = false;

  constructor(sendToRenderer: (event: ServerEvent) => void) {
    this.sendToRenderer = sendToRenderer;
  }

  /** Attach EventEmitter listeners to the core TeamManager. Idempotent. */
  async init(): Promise<void> {
    const mgr = await loadTeamModule();
    if (!mgr) return;
    if (this.eventListenersAttached) return;
    this.eventListenersAttached = true;

    try {
      mgr.on('team:started', (...args: unknown[]) => {
        const payload = args[0] as { leadId: string; goal: string };
        const status = mgr.getStatus();
        this.sendToRenderer({
          type: 'team.update',
          payload: {
            event: 'started',
            leadId: payload.leadId,
            goal: payload.goal,
            snapshot: normalizeSnapshot(status),
          },
        });
      });

      mgr.on('team:stopped', (...args: unknown[]) => {
        const payload = args[0] as {
          memberCount: number;
          completedTasks: number;
          totalTasks: number;
        };
        const status = mgr.getStatus();
        this.sendToRenderer({
          type: 'team.update',
          payload: {
            event: 'stopped',
            stats: payload,
            snapshot: normalizeSnapshot(status),
          },
        });
      });

      mgr.on('team:member-added', (...args: unknown[]) => {
        const member = args[0] as CoreTeamMember;
        this.sendToRenderer({
          type: 'team.member.update',
          payload: { event: 'added', member: normalizeMember(member) },
        });
      });

      mgr.on('team:member-removed', (...args: unknown[]) => {
        const payload = args[0] as { memberId: string; role: string };
        this.sendToRenderer({
          type: 'team.member.update',
          payload: { event: 'removed', memberId: payload.memberId, role: payload.role },
        });
      });

      mgr.on('team:task-added', (...args: unknown[]) => {
        const task = args[0] as CoreTeamTask;
        this.sendToRenderer({
          type: 'team.task.update',
          payload: { event: 'added', task: normalizeTask(task) },
        });
      });

      mgr.on('team:task-updated', (...args: unknown[]) => {
        const task = args[0] as CoreTeamTask;
        this.sendToRenderer({
          type: 'team.task.update',
          payload: { event: 'updated', task: normalizeTask(task) },
        });
      });

      mgr.on('team:task-assigned', (...args: unknown[]) => {
        const payload = args[0] as { taskId: string; memberId: string; role: string };
        this.sendToRenderer({
          type: 'team.task.update',
          payload: { event: 'assigned', taskId: payload.taskId, memberId: payload.memberId, role: payload.role },
        });
      });

      mgr.on('team:message', (...args: unknown[]) => {
        const msg = args[0] as CoreMailboxMessage;
        this.sendToRenderer({
          type: 'team.message',
          payload: normalizeMessage(msg),
        });
      });

      log('[TeamBridge] Event listeners attached (8 channels)');
    } catch (err) {
      logError('[TeamBridge] Failed to attach event listeners:', err);
    }
  }

  // ==========================================================================
  // Imperative API (called from IPC handlers)
  // ==========================================================================

  async getSnapshot(): Promise<ReturnType<typeof normalizeSnapshot> | { error: string }> {
    const mgr = await loadTeamModule();
    if (!mgr) return { error: 'Team manager unavailable' };
    return normalizeSnapshot(mgr.getStatus());
  }

  async start(goal?: string): Promise<{ success: boolean; leadId?: string; message: string }> {
    const mgr = await loadTeamModule();
    if (!mgr) return { success: false, message: 'Team manager unavailable' };
    return mgr.start(goal);
  }

  async stop(): Promise<{ success: boolean; message: string }> {
    const mgr = await loadTeamModule();
    if (!mgr) return { success: false, message: 'Team manager unavailable' };
    return mgr.stop();
  }

  async addMember(
    role: string,
    label?: string
  ): Promise<{ success: boolean; memberId?: string; message: string }> {
    const mgr = await loadTeamModule();
    if (!mgr) return { success: false, message: 'Team manager unavailable' };
    return mgr.addMember(role, label);
  }

  async removeMember(memberId: string): Promise<{ success: boolean; message: string }> {
    const mgr = await loadTeamModule();
    if (!mgr) return { success: false, message: 'Team manager unavailable' };
    return mgr.removeMember(memberId);
  }

  async addTask(input: {
    title: string;
    description: string;
    priority?: string;
    assignedRole?: string;
    dependencies?: string[];
  }): Promise<ReturnType<typeof normalizeTask> | { error: string }> {
    const mgr = await loadTeamModule();
    if (!mgr) return { error: 'Team manager unavailable' };
    const task = mgr.addTask(input.title, input.description, {
      priority: input.priority,
      assignedRole: input.assignedRole,
      dependencies: input.dependencies,
    });
    return normalizeTask(task);
  }

  async updateTask(
    taskId: string,
    updates: { status?: string; assignedTo?: string; result?: string; error?: string }
  ): Promise<{ success: boolean; message: string }> {
    const mgr = await loadTeamModule();
    if (!mgr) return { success: false, message: 'Team manager unavailable' };
    return mgr.updateTask(taskId, updates);
  }

  async assignTask(
    taskId: string,
    memberId: string
  ): Promise<{ success: boolean; message: string }> {
    const mgr = await loadTeamModule();
    if (!mgr) return { success: false, message: 'Team manager unavailable' };
    return mgr.assignTask(taskId, memberId);
  }

  async sendMessage(
    from: string,
    to: string,
    content: string
  ): Promise<ReturnType<typeof normalizeMessage> | { error: string }> {
    const mgr = await loadTeamModule();
    if (!mgr) return { error: 'Team manager unavailable' };
    const msg = mgr.sendMessage(from, to, content);
    return normalizeMessage(msg);
  }

  async getInbox(
    memberId: string,
    limit?: number
  ): Promise<Array<ReturnType<typeof normalizeMessage>>> {
    const mgr = await loadTeamModule();
    if (!mgr) return [];
    return mgr.getInbox(memberId, limit).map(normalizeMessage);
  }
}

let singleton: TeamBridge | null = null;

export function getTeamBridge(sendToRenderer?: (event: ServerEvent) => void): TeamBridge {
  if (!singleton) {
    if (!sendToRenderer) {
      throw new Error('TeamBridge requires sendToRenderer on first init');
    }
    singleton = new TeamBridge(sendToRenderer);
  }
  return singleton;
}
