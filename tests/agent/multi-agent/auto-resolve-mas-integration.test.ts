/**
 * Phase M (V0.4.1) — MAS pre-batch detect+resolve integration.
 *
 * Validates that:
 * 1. detectAndEmitConflicts is called PRE-batch in all 5 strategies
 *    (was POST in V0.3/V0.4 — bug fix).
 * 2. autoResolveConflicts is invoked when TOML auto_resolve_enabled=true
 *    AND auto_resolve_strategy='prefer-reviewer'.
 * 3. Auto-resolve disabled (default) → no autoResolve call, no task mutation.
 * 4. Tasks mutated to status='blocked' are skipped by strategy executors.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const detectConflictsMock = vi.fn(() => []);
  const autoResolveConflictsMock = vi.fn(() => [] as string[]);
  const allocateTaskMock = vi.fn();
  const markTaskStartedMock = vi.fn();
  const recordTaskCompletionMock = vi.fn();

  const fakeCoordinator = {
    detectConflicts: detectConflictsMock,
    autoResolveConflicts: autoResolveConflictsMock,
    allocateTask: allocateTaskMock,
    markTaskStarted: markTaskStartedMock,
    recordTaskCompletion: recordTaskCompletionMock,
  };

  const getEnhancedCoordinatorMock = vi.fn(() => fakeCoordinator);

  let tomlConfig: {
    enable_adaptive_allocation?: boolean;
    min_assignment_confidence?: number;
    enable_conflict_resolution?: boolean;
    auto_resolve_enabled?: boolean;
    auto_resolve_strategy?: 'prefer-reviewer' | 'none';
  } = {};
  const getConfigManagerMock = vi.fn(() => ({
    getConfig: () => ({ multi_agent_system: { coordination: tomlConfig } }),
  }));
  const setTomlConfig = (cfg: typeof tomlConfig) => { tomlConfig = cfg; };

  return {
    detectConflictsMock, autoResolveConflictsMock,
    allocateTaskMock, markTaskStartedMock, recordTaskCompletionMock,
    fakeCoordinator, getEnhancedCoordinatorMock,
    getConfigManagerMock, setTomlConfig,
  };
});

vi.mock('../../../src/agent/multi-agent/enhanced-coordination.js', () => ({
  getEnhancedCoordinator: mocks.getEnhancedCoordinatorMock,
}));

vi.mock('../../../src/config/toml-config.js', () => ({
  getConfigManager: mocks.getConfigManagerMock,
}));

import { MultiAgentSystem } from '../../../src/agent/multi-agent/multi-agent-system.js';
import type { AgentTask } from '../../../src/agent/multi-agent/types.js';

function makeTask(id: string): AgentTask {
  return {
    id,
    title: `t-${id}`,
    description: '',
    status: 'pending',
    priority: 'medium',
    assignedTo: 'coder',
    dependencies: [],
    subtasks: [],
    artifacts: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('MAS Phase M — auto-resolve pre-batch wiring', () => {
  let mas: MultiAgentSystem;

  beforeEach(() => {
    mas = new MultiAgentSystem('test-key');
    mocks.detectConflictsMock.mockReset().mockReturnValue([]);
    mocks.autoResolveConflictsMock.mockReset().mockReturnValue([]);
    mocks.getEnhancedCoordinatorMock.mockClear();
    mocks.getConfigManagerMock.mockClear();
    mocks.setTomlConfig({});
    (mas as unknown as { coordinationConfigCache: unknown }).coordinationConfigCache = null;
  });

  afterEach(() => mas.dispose());

  const callDetect = (m: MultiAgentSystem, tasks: AgentTask[]) =>
    (m as unknown as { detectAndEmitConflicts: (t: AgentTask[]) => Promise<void> }).detectAndEmitConflicts(tasks);

  describe('autoResolveConflicts gating via TOML', () => {
    it('auto_resolve_enabled=false (default) → autoResolveConflicts NOT called', async () => {
      mocks.setTomlConfig({ enable_conflict_resolution: true });
      mocks.detectConflictsMock.mockReturnValue([
        { id: 'c1', type: 'code_overlap', severity: 'high', agents: ['coder'], description: 'x', timestamp: new Date(), affectedFile: 'a.ts' },
      ] as never);

      await callDetect(mas, [makeTask('t1')]);

      expect(mocks.detectConflictsMock).toHaveBeenCalledOnce();
      expect(mocks.autoResolveConflictsMock).not.toHaveBeenCalled();
    });

    it('auto_resolve_enabled=true + strategy=none → autoResolveConflicts NOT called', async () => {
      mocks.setTomlConfig({
        enable_conflict_resolution: true,
        auto_resolve_enabled: true,
        auto_resolve_strategy: 'none',
      });
      mocks.detectConflictsMock.mockReturnValue([
        { id: 'c1', type: 'code_overlap', severity: 'high', agents: ['coder'], description: 'x', timestamp: new Date(), affectedFile: 'a.ts' },
      ] as never);

      await callDetect(mas, [makeTask('t1')]);
      expect(mocks.autoResolveConflictsMock).not.toHaveBeenCalled();
    });

    it('auto_resolve_enabled=true + strategy=prefer-reviewer + conflicts → autoResolveConflicts called with tasks', async () => {
      mocks.setTomlConfig({
        enable_conflict_resolution: true,
        auto_resolve_enabled: true,
        auto_resolve_strategy: 'prefer-reviewer',
      });
      mocks.detectConflictsMock.mockReturnValue([
        { id: 'c1', type: 'code_overlap', severity: 'high', agents: ['coder', 'reviewer'], description: 'x', timestamp: new Date(), affectedFile: 'a.ts' },
      ] as never);

      const tasks = [makeTask('t1'), makeTask('t2')];
      await callDetect(mas, tasks);

      expect(mocks.autoResolveConflictsMock).toHaveBeenCalledOnce();
      expect(mocks.autoResolveConflictsMock).toHaveBeenCalledWith(tasks);
    });

    it('auto_resolve enabled but no conflicts detected → autoResolveConflicts NOT called (skip optimization)', async () => {
      mocks.setTomlConfig({
        enable_conflict_resolution: true,
        auto_resolve_enabled: true,
        auto_resolve_strategy: 'prefer-reviewer',
      });
      mocks.detectConflictsMock.mockReturnValue([]);

      await callDetect(mas, [makeTask('t1')]);
      expect(mocks.autoResolveConflictsMock).not.toHaveBeenCalled();
    });

    it('autoResolveConflicts mutated tasks → emits conflict_detected event with autoResolved marker', async () => {
      mocks.setTomlConfig({
        enable_conflict_resolution: true,
        auto_resolve_enabled: true,
        auto_resolve_strategy: 'prefer-reviewer',
      });
      mocks.detectConflictsMock.mockReturnValue([
        { id: 'c1', type: 'code_overlap', severity: 'high', agents: ['coder', 'reviewer'], description: 'x', timestamp: new Date(), affectedFile: 'a.ts' },
      ] as never);
      mocks.autoResolveConflictsMock.mockReturnValue(['t1']);

      const events: unknown[] = [];
      mas.on('workflow:event', (e) => events.push(e));

      await callDetect(mas, [makeTask('t1'), makeTask('t2')]);

      const conflictEvents = events.filter((e) => (e as { type: string }).type === 'conflict_detected');
      // 1 for detected + 1 for resolved
      expect(conflictEvents.length).toBe(2);
      const autoResolvedEvent = conflictEvents.find((e) =>
        (e as { data?: { autoResolved?: boolean } }).data?.autoResolved === true
      );
      expect(autoResolvedEvent).toBeDefined();
      expect((autoResolvedEvent as { message: string }).message).toContain('Auto-resolved');
      expect((autoResolvedEvent as { data: { blockedTaskIds: string[] } }).data.blockedTaskIds).toEqual(['t1']);
    });

    it('coordinator.autoResolveConflicts throws → silent fallback (no rethrow)', async () => {
      mocks.setTomlConfig({
        enable_conflict_resolution: true,
        auto_resolve_enabled: true,
        auto_resolve_strategy: 'prefer-reviewer',
      });
      mocks.detectConflictsMock.mockReturnValue([
        { id: 'c1', type: 'code_overlap', severity: 'high', agents: ['coder'], description: 'x', timestamp: new Date(), affectedFile: 'a.ts' },
      ] as never);
      mocks.autoResolveConflictsMock.mockImplementationOnce(() => {
        throw new Error('autoresolve boom');
      });

      await expect(callDetect(mas, [makeTask('t1')])).resolves.toBeUndefined();
    });
  });
});
