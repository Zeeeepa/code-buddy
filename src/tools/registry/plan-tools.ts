
import { ITool } from './types.js';
import { PlanTool } from '../plan-tool.js';
import type { KnowledgeGraph } from '../../knowledge/knowledge-graph.js';

/** Singleton PlanTool instance for graph wiring */
let _planToolInstance: PlanTool | null = null;

export function createPlanTools(): ITool[] {
  _planToolInstance = new PlanTool();
  return [_planToolInstance];
}

/**
 * Wire the code graph into the PlanTool instance (lazy, called after graph is ready).
 */
export function wirePlanToolGraph(graph: KnowledgeGraph): void {
  if (_planToolInstance) {
    _planToolInstance.setGraph(graph);
  }
}
