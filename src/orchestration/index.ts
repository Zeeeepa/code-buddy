/**
 * Multi-Agent Orchestration Module
 *
 * Exports for coordinating multiple agents on complex tasks.
 */

// Types
export * from './types.js';

// Orchestrator
export { Orchestrator } from './orchestrator.js';

// Agents
export {
  CoordinatorAgent,
  ResearcherAgent,
  CoderAgent,
  ReviewerAgent,
  TesterAgent,
  DocumenterAgent,
  PlannerAgent,
  ExecutorAgent,
  DefaultAgents,
  createCustomAgent,
  getAgentByRole,
  getAgentsByCapability,
} from './agents/index.js';

// Workflows
export {
  CodeReviewWorkflow,
  FeatureImplementationWorkflow,
  BugFixWorkflow,
  RefactoringWorkflow,
  WorkflowTemplates,
  getWorkflowTemplate,
  listWorkflowTemplates,
} from './workflows/templates.js';

// Quick factory function
import { Orchestrator } from './orchestrator.js';
import { DefaultAgents } from './agents/index.js';
import type { OrchestratorConfig } from './types.js';

/**
 * Create an orchestrator with default agents
 */
export function createOrchestrator(config?: Partial<OrchestratorConfig>): Orchestrator {
  const orchestrator = new Orchestrator(config);

  // Register default agents
  for (const agent of DefaultAgents) {
    orchestrator.registerAgent(agent);
  }

  return orchestrator;
}

/**
 * Create a minimal orchestrator with specific agents
 */
export function createMinimalOrchestrator(
  agentRoles: string[],
  config?: Partial<OrchestratorConfig>
): Orchestrator {
  const orchestrator = new Orchestrator(config);

  // Register only specified agents
  for (const agent of DefaultAgents) {
    if (agentRoles.includes(agent.role)) {
      orchestrator.registerAgent(agent);
    }
  }

  return orchestrator;
}
