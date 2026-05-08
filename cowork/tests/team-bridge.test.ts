import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('electron', () => ({
  app: {
    isReady: () => true,
    getPath: () => '/tmp',
  },
}));

vi.mock('../src/main/utils/logger', () => ({
  log: () => {},
  logWarn: () => {},
  logError: () => {},
}));

class FakeTeamManager extends EventEmitter {
  private members = new Map<string, { id: string; role: string; label: string; status: string; currentTaskId: string | null; completedTasks: number; joinedAt: Date }>();
  private tasks = new Map<string, { id: string; title: string; description: string; status: string; priority: string; assignedTo: string | null; assignedRole: string | null; dependencies: string[]; createdAt: Date; updatedAt: Date }>();
  private mailbox: Array<{ id: string; from: string; to: string; content: string; timestamp: Date; read: boolean }> = [];
  private status: 'inactive' | 'active' | 'paused' | 'dissolved' = 'inactive';
  private leadId: string | null = null;
  private goal = '';

  start(goal?: string) {
    this.status = 'active';
    this.leadId = 'lead-1';
    this.goal = goal ?? '';
    this.emit('team:started', { leadId: this.leadId, goal: this.goal });
    return { success: true, leadId: this.leadId, message: 'started' };
  }

  stop() {
    this.status = 'dissolved';
    this.emit('team:stopped', { memberCount: this.members.size, completedTasks: 0, totalTasks: this.tasks.size });
    this.members.clear();
    this.tasks.clear();
    return { success: true, message: 'stopped' };
  }

  addMember(role: string, label?: string) {
    const id = `member-${this.members.size + 1}`;
    const member = {
      id,
      role,
      label: label ?? `${role}-1`,
      status: 'idle' as const,
      currentTaskId: null,
      completedTasks: 0,
      joinedAt: new Date(),
    };
    this.members.set(id, member);
    this.emit('team:member-added', member);
    return { success: true, memberId: id, message: 'added' };
  }

  removeMember(memberId: string) {
    const m = this.members.get(memberId);
    if (!m) return { success: false, message: 'not found' };
    this.members.delete(memberId);
    this.emit('team:member-removed', { memberId, role: m.role });
    return { success: true, message: 'removed' };
  }

  addTask(title: string, description: string) {
    const task = {
      id: `task-${this.tasks.size + 1}`,
      title,
      description,
      status: 'pending',
      priority: 'medium',
      assignedTo: null,
      assignedRole: null,
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(task.id, task);
    this.emit('team:task-added', task);
    return task;
  }

  assignTask(taskId: string, memberId: string) {
    const task = this.tasks.get(taskId);
    const member = this.members.get(memberId);
    if (!task || !member) return { success: false, message: 'not found' };
    task.assignedTo = memberId;
    task.status = 'in_progress';
    task.updatedAt = new Date();
    this.emit('team:task-assigned', { taskId, memberId, role: member.role });
    return { success: true, message: 'assigned' };
  }

  updateTask(taskId: string, updates: { status?: string }) {
    const task = this.tasks.get(taskId);
    if (!task) return { success: false, message: 'not found' };
    if (updates.status) task.status = updates.status;
    task.updatedAt = new Date();
    this.emit('team:task-updated', task);
    return { success: true, message: 'updated' };
  }

  sendMessage(from: string, to: string, content: string) {
    const msg = {
      id: `msg-${this.mailbox.length + 1}`,
      from,
      to,
      content,
      timestamp: new Date(),
      read: false,
    };
    this.mailbox.push(msg);
    this.emit('team:message', msg);
    return msg;
  }

  getStatus() {
    const tasks = Array.from(this.tasks.values());
    return {
      status: this.status,
      goal: this.goal,
      memberCount: this.members.size,
      members: Array.from(this.members.values()),
      taskSummary: {
        total: tasks.length,
        pending: tasks.filter((t) => t.status === 'pending').length,
        inProgress: tasks.filter((t) => t.status === 'in_progress').length,
        completed: tasks.filter((t) => t.status === 'completed').length,
        failed: tasks.filter((t) => t.status === 'failed').length,
      },
      unreadMessages: this.mailbox.filter((m) => !m.read).length,
      uptime: 'N/A',
    };
  }

  getMembers() { return Array.from(this.members.values()); }
  getTasks() { return Array.from(this.tasks.values()); }
  getInbox() { return this.mailbox; }
  isActive() { return this.status === 'active'; }
  getLeadId() { return this.leadId; }
  getTeamGoal() { return this.goal; }
}

const fakeManager = new FakeTeamManager();

vi.mock('../src/main/utils/core-loader', () => ({
  loadCoreModule: vi.fn(async () => ({
    getTeamManager: () => fakeManager,
  })),
}));

import { TeamBridge } from '../src/main/agent/team-bridge';
import type { ServerEvent } from '../src/renderer/types';

describe('TeamBridge', () => {
  let events: ServerEvent[];
  let bridge: TeamBridge;

  beforeEach(async () => {
    events = [];
    fakeManager.removeAllListeners();
    // Hard reset internal state between tests since the manager is a singleton
    // shared via the mocked loadCoreModule. Using stop() is too kind here.
    (fakeManager as unknown as { members: Map<string, unknown> }).members.clear();
    (fakeManager as unknown as { tasks: Map<string, unknown> }).tasks.clear();
    (fakeManager as unknown as { mailbox: unknown[] }).mailbox = [];
    (fakeManager as unknown as { status: string }).status = 'inactive';
    (fakeManager as unknown as { leadId: string | null }).leadId = null;
    (fakeManager as unknown as { goal: string }).goal = '';
    bridge = new TeamBridge((e) => events.push(e));
    await bridge.init();
  });

  afterEach(() => {
    fakeManager.removeAllListeners();
  });

  it('forwards team:started as team.update with snapshot', async () => {
    const result = await bridge.start('Test goal');
    expect(result.success).toBe(true);
    const updates = events.filter((e) => e.type === 'team.update');
    expect(updates).toHaveLength(1);
    const payload = updates[0].payload as { event: string; leadId?: string; goal?: string; snapshot: { status: string } };
    expect(payload.event).toBe('started');
    expect(payload.leadId).toBe('lead-1');
    expect(payload.goal).toBe('Test goal');
    expect(payload.snapshot.status).toBe('active');
  });

  it('forwards team:member-added as team.member.update', async () => {
    await bridge.start();
    events.length = 0;
    const result = await bridge.addMember('coder', 'lead-coder');
    expect(result.success).toBe(true);
    const memberUpdates = events.filter((e) => e.type === 'team.member.update');
    expect(memberUpdates).toHaveLength(1);
    const payload = memberUpdates[0].payload as { event: string; member?: { role: string; label: string } };
    expect(payload.event).toBe('added');
    expect(payload.member?.role).toBe('coder');
    expect(payload.member?.label).toBe('lead-coder');
  });

  it('forwards team:task-assigned with role context', async () => {
    await bridge.start();
    await bridge.addMember('coder');
    await bridge.addTask({ title: 'Refactor auth', description: 'Move tokens to keytar' });
    events.length = 0;

    const result = await bridge.assignTask('task-1', 'member-1');
    expect(result.success).toBe(true);
    const taskUpdates = events.filter((e) => e.type === 'team.task.update');
    const assigned = taskUpdates.find((e) => (e.payload as { event: string }).event === 'assigned');
    expect(assigned).toBeDefined();
    const payload = assigned!.payload as { taskId: string; memberId: string; role: string };
    expect(payload.taskId).toBe('task-1');
    expect(payload.memberId).toBe('member-1');
    expect(payload.role).toBe('coder');
  });

  it('forwards team:message as team.message', async () => {
    await bridge.start();
    await bridge.addMember('coder');
    events.length = 0;

    await bridge.sendMessage('lead', 'member-1', 'Please review PR #42');
    const messages = events.filter((e) => e.type === 'team.message');
    expect(messages).toHaveLength(1);
    const payload = messages[0].payload as { content: string; from: string };
    expect(payload.content).toBe('Please review PR #42');
    expect(payload.from).toBe('lead');
  });

  it('getSnapshot returns normalized team state', async () => {
    await bridge.start('snapshot test');
    await bridge.addMember('reviewer');
    const snapshot = await bridge.getSnapshot();
    expect(snapshot).not.toHaveProperty('error');
    const snap = snapshot as { status: string; memberCount: number; goal: string };
    expect(snap.status).toBe('active');
    expect(snap.memberCount).toBe(1);
    expect(snap.goal).toBe('snapshot test');
  });
});
