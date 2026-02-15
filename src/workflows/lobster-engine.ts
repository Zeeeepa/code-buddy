/**
 * Lobster Typed Workflow Engine
 * DAG-based workflow definition, validation, and execution ordering.
 */

import { logger } from '../utils/logger.js';

export interface LobsterStep {
  id: string;
  name: string;
  command: string;
  inputs?: Record<string, string>;
  outputs?: string[];
  dependsOn?: string[];
  timeout?: number;
}

export interface LobsterWorkflow {
  name: string;
  version: string;
  steps: LobsterStep[];
  variables?: Record<string, string>;
}

export interface StepResult {
  stepId: string;
  status: 'success' | 'failed' | 'skipped';
  stdout: string;
  exitCode: number;
  duration: number;
}

export class LobsterEngine {
  private static instance: LobsterEngine | null = null;

  static getInstance(): LobsterEngine {
    if (!LobsterEngine.instance) {
      LobsterEngine.instance = new LobsterEngine();
    }
    return LobsterEngine.instance;
  }

  static resetInstance(): void {
    LobsterEngine.instance = null;
  }

  parseWorkflow(yaml: string): LobsterWorkflow {
    let parsed: unknown;
    try {
      parsed = JSON.parse(yaml);
    } catch {
      // Try simple YAML-like parsing for key: value format
      parsed = this.parseSimpleYaml(yaml);
    }

    const workflow = parsed as LobsterWorkflow;
    if (!workflow.name || !workflow.version || !Array.isArray(workflow.steps)) {
      throw new Error('Invalid workflow: missing name, version, or steps');
    }

    for (const step of workflow.steps) {
      if (!step.id || !step.name || !step.command) {
        throw new Error(`Invalid step: missing id, name, or command`);
      }
    }

    logger.debug(`Parsed workflow: ${workflow.name} v${workflow.version}`);
    return workflow;
  }

  validateWorkflow(workflow: LobsterWorkflow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stepIds = new Set(workflow.steps.map(s => s.id));

    if (!workflow.name) errors.push('Missing workflow name');
    if (!workflow.version) errors.push('Missing workflow version');
    if (!workflow.steps || workflow.steps.length === 0) errors.push('No steps defined');

    // Check for duplicate IDs
    if (stepIds.size !== workflow.steps.length) {
      errors.push('Duplicate step IDs found');
    }

    // Check dependencies exist
    for (const step of workflow.steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep)) {
            errors.push(`Step '${step.id}' depends on unknown step '${dep}'`);
          }
        }
      }
    }

    // Check for cycles
    if (this.hasCycle(workflow.steps)) {
      errors.push('Workflow contains a dependency cycle');
    }

    return { valid: errors.length === 0, errors };
  }

  resolveVariables(template: string, context: Record<string, string>): string {
    let result = template;

    // Replace ${var} references
    result = result.replace(/\$\{(\w+)\}/g, (_, key) => {
      return context[key] ?? '';
    });

    // Replace $step.stdout references
    result = result.replace(/\$(\w+)\.stdout/g, (_, key) => {
      return context[`${key}.stdout`] ?? '';
    });

    // Replace $step.json references
    result = result.replace(/\$(\w+)\.json/g, (_, key) => {
      return context[`${key}.json`] ?? '';
    });

    return result;
  }

  getExecutionOrder(workflow: LobsterWorkflow): string[] {
    const stepMap = new Map(workflow.steps.map(s => [s.id, s]));
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      const step = stepMap.get(id)!;
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          visit(dep);
        }
      }
      order.push(id);
    };

    for (const step of workflow.steps) {
      visit(step.id);
    }

    return order;
  }

  generateResumeToken(completedSteps: string[]): string {
    return Buffer.from(JSON.stringify(completedSteps)).toString('base64');
  }

  parseResumeToken(token: string): string[] {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      if (!Array.isArray(parsed)) throw new Error('Invalid token format');
      return parsed;
    } catch {
      throw new Error('Invalid resume token');
    }
  }

  getWorkflowStatus(results: StepResult[]): 'success' | 'failed' | 'partial' {
    if (results.length === 0) return 'success';

    const hasFailure = results.some(r => r.status === 'failed');
    const hasSuccess = results.some(r => r.status === 'success');

    if (hasFailure && hasSuccess) return 'partial';
    if (hasFailure) return 'failed';
    return 'success';
  }

  private hasCycle(steps: LobsterStep[]): boolean {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const colors = new Map<string, number>();
    steps.forEach(s => colors.set(s.id, WHITE));

    const stepMap = new Map(steps.map(s => [s.id, s]));

    const dfs = (id: string): boolean => {
      colors.set(id, GRAY);
      const step = stepMap.get(id);
      if (step?.dependsOn) {
        for (const dep of step.dependsOn) {
          const color = colors.get(dep);
          if (color === GRAY) return true;
          if (color === WHITE && dfs(dep)) return true;
        }
      }
      colors.set(id, BLACK);
      return false;
    };

    for (const step of steps) {
      if (colors.get(step.id) === WHITE) {
        if (dfs(step.id)) return true;
      }
    }
    return false;
  }

  private parseSimpleYaml(yaml: string): Record<string, unknown> {
    try {
      return JSON.parse(yaml);
    } catch {
      throw new Error('Failed to parse workflow definition');
    }
  }
}
