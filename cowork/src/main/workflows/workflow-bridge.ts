/**
 * WorkflowBridge — Claude Cowork parity Phase 2 step 15
 *
 * Provides workflow CRUD + execution for the visual editor. Stores
 * workflows in `<userData>/workflows.json` and lazy-loads the core
 * WorkflowEngine for execution.
 *
 * @module main/workflows/workflow-bridge
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { log, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';

export interface WorkflowNode {
  id: string;
  type: 'tool' | 'condition' | 'parallel' | 'approval' | 'start' | 'end';
  name: string;
  position: { x: number; y: number };
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: number;
  updatedAt: number;
}

interface CoreWorkflowModule {
  WorkflowEngine: new (statesDir?: string) => {
    registerWorkflow: (def: unknown) => void;
    startWorkflow: (
      id: string,
      options?: { initialContext?: Record<string, unknown> }
    ) => Promise<{
      success: boolean;
      status: string;
      duration: number;
      completedSteps: number;
      totalSteps: number;
      error?: string;
    }>;
  };
}

export class WorkflowBridge {
  private filePath: string;
  private cache: WorkflowDefinition[] | null = null;
  private engineModule: CoreWorkflowModule | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dir = path.join(userDataPath, 'workflows');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = path.join(dir, 'workflows.json');
  }

  list(): WorkflowDefinition[] {
    if (this.cache) return this.cache;
    if (!fs.existsSync(this.filePath)) {
      this.cache = [];
      return this.cache;
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      this.cache = Array.isArray(parsed) ? (parsed as WorkflowDefinition[]) : [];
      return this.cache;
    } catch (err) {
      logWarn('[WorkflowBridge] failed to load workflows:', err);
      this.cache = [];
      return this.cache;
    }
  }

  get(id: string): WorkflowDefinition | null {
    return this.list().find((w) => w.id === id) ?? null;
  }

  create(input: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): WorkflowDefinition {
    const now = Date.now();
    const definition: WorkflowDefinition = {
      ...input,
      id: `wf_${now}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    const all = this.list();
    all.push(definition);
    this.persist(all);
    return definition;
  }

  update(id: string, patch: Partial<WorkflowDefinition>): WorkflowDefinition | null {
    const all = this.list();
    const index = all.findIndex((w) => w.id === id);
    if (index === -1) return null;
    const updated = { ...all[index], ...patch, id, updatedAt: Date.now() };
    all[index] = updated;
    this.persist(all);
    return updated;
  }

  delete(id: string): boolean {
    const all = this.list();
    const next = all.filter((w) => w.id !== id);
    if (next.length === all.length) return false;
    this.persist(next);
    return true;
  }

  async run(
    id: string,
    initialContext: Record<string, unknown> = {}
  ): Promise<{
    success: boolean;
    status: string;
    duration: number;
    completedSteps: number;
    totalSteps: number;
    error?: string;
  }> {
    const definition = this.get(id);
    if (!definition) {
      return {
        success: false,
        status: 'failed',
        duration: 0,
        completedSteps: 0,
        totalSteps: 0,
        error: `Workflow not found: ${id}`,
      };
    }

    if (!this.engineModule) {
      try {
        this.engineModule = await loadCoreModule<CoreWorkflowModule>(
          'workflows/workflow-engine.js'
        );
      } catch (err) {
        logWarn('[WorkflowBridge] core engine unavailable:', err);
      }
    }
    if (!this.engineModule) {
      return {
        success: false,
        status: 'failed',
        duration: 0,
        completedSteps: 0,
        totalSteps: definition.nodes.length,
        error: 'Workflow engine unavailable',
      };
    }

    try {
      const engine = new this.engineModule.WorkflowEngine();
      // Convert visual definition to engine WorkflowDefinition
      engine.registerWorkflow({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        version: '1.0.0',
        steps: definition.nodes
          .filter((n) => n.type !== 'start' && n.type !== 'end')
          .map((node) => ({
            id: node.id,
            name: node.name,
            action: node.type === 'tool' ? 'noop' : node.type,
            ...((node.config ?? {}) as Record<string, unknown>),
          })),
      });
      const result = await engine.startWorkflow(definition.id, { initialContext });
      log('[WorkflowBridge] run completed:', definition.id, result.status);
      return {
        success: result.success,
        status: result.status,
        duration: result.duration,
        completedSteps: result.completedSteps,
        totalSteps: result.totalSteps,
        error: result.error,
      };
    } catch (err) {
      logWarn('[WorkflowBridge] run failed:', err);
      return {
        success: false,
        status: 'failed',
        duration: 0,
        completedSteps: 0,
        totalSteps: definition.nodes.length,
        error: (err as Error).message ?? 'Workflow execution failed',
      };
    }
  }

  private persist(workflows: WorkflowDefinition[]): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(workflows, null, 2), 'utf-8');
      this.cache = workflows;
    } catch (err) {
      logWarn('[WorkflowBridge] persist failed:', err);
    }
  }
}
