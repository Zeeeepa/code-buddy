/**
 * Specialized Agent Implementations
 *
 * Pre-configured agents for common tasks.
 */

import type { AgentDefinition, AgentCapabilities } from '../types.js';

// ============================================================================
// Coordinator Agent
// ============================================================================

export const CoordinatorAgent: AgentDefinition = {
  id: 'coordinator',
  name: 'Coordinator',
  role: 'coordinator',
  description: 'Coordinates other agents and manages workflows',
  capabilities: {
    tools: ['task_create', 'task_assign', 'agent_query', 'workflow_manage'],
    maxConcurrency: 10,
    taskTypes: ['coordination', 'planning', 'delegation'],
    systemPrompt: `You are a coordinator agent responsible for:
- Breaking down complex tasks into subtasks
- Assigning tasks to appropriate agents
- Monitoring progress and handling failures
- Aggregating results from multiple agents
- Making decisions about task prioritization`,
  },
  priority: 100,
};

// ============================================================================
// Researcher Agent
// ============================================================================

export const ResearcherAgent: AgentDefinition = {
  id: 'researcher',
  name: 'Researcher',
  role: 'researcher',
  description: 'Gathers information and performs analysis',
  capabilities: {
    tools: ['web_search', 'file_read', 'code_search', 'knowledge_base'],
    maxConcurrency: 5,
    taskTypes: ['research', 'analysis', 'information_gathering'],
    systemPrompt: `You are a researcher agent responsible for:
- Searching for relevant information
- Analyzing code and documentation
- Summarizing findings
- Providing context for other agents
- Answering questions with citations`,
  },
  priority: 50,
};

// ============================================================================
// Coder Agent
// ============================================================================

export const CoderAgent: AgentDefinition = {
  id: 'coder',
  name: 'Coder',
  role: 'coder',
  description: 'Writes and modifies code',
  capabilities: {
    tools: ['file_write', 'file_edit', 'code_generate', 'refactor'],
    maxConcurrency: 3,
    taskTypes: ['coding', 'implementation', 'bug_fix', 'refactoring'],
    systemPrompt: `You are a coder agent responsible for:
- Writing clean, efficient code
- Following project conventions
- Implementing features from specifications
- Fixing bugs and issues
- Refactoring for better quality`,
  },
  priority: 60,
};

// ============================================================================
// Reviewer Agent
// ============================================================================

export const ReviewerAgent: AgentDefinition = {
  id: 'reviewer',
  name: 'Reviewer',
  role: 'reviewer',
  description: 'Reviews code and provides feedback',
  capabilities: {
    tools: ['file_read', 'code_analyze', 'diff_view', 'comment'],
    maxConcurrency: 5,
    taskTypes: ['code_review', 'quality_check', 'security_review'],
    systemPrompt: `You are a reviewer agent responsible for:
- Reviewing code for quality and correctness
- Identifying potential bugs and issues
- Suggesting improvements
- Checking for security vulnerabilities
- Ensuring code follows best practices`,
  },
  priority: 40,
};

// ============================================================================
// Tester Agent
// ============================================================================

export const TesterAgent: AgentDefinition = {
  id: 'tester',
  name: 'Tester',
  role: 'tester',
  description: 'Creates and runs tests',
  capabilities: {
    tools: ['test_write', 'test_run', 'coverage_check', 'assertion'],
    maxConcurrency: 3,
    taskTypes: ['testing', 'test_creation', 'coverage_analysis'],
    systemPrompt: `You are a tester agent responsible for:
- Writing comprehensive test cases
- Running tests and analyzing results
- Checking code coverage
- Creating edge case tests
- Validating bug fixes`,
  },
  priority: 40,
};

// ============================================================================
// Documenter Agent
// ============================================================================

export const DocumenterAgent: AgentDefinition = {
  id: 'documenter',
  name: 'Documenter',
  role: 'documenter',
  description: 'Creates and maintains documentation',
  capabilities: {
    tools: ['file_write', 'markdown_format', 'docstring_generate'],
    maxConcurrency: 3,
    taskTypes: ['documentation', 'readme', 'api_docs', 'changelog'],
    systemPrompt: `You are a documenter agent responsible for:
- Writing clear documentation
- Creating README files
- Documenting APIs and interfaces
- Maintaining changelogs
- Adding inline comments where needed`,
  },
  priority: 30,
};

// ============================================================================
// Planner Agent
// ============================================================================

export const PlannerAgent: AgentDefinition = {
  id: 'planner',
  name: 'Planner',
  role: 'planner',
  description: 'Creates implementation plans',
  capabilities: {
    tools: ['code_analyze', 'dependency_check', 'architecture_view'],
    maxConcurrency: 2,
    taskTypes: ['planning', 'architecture', 'design'],
    systemPrompt: `You are a planner agent responsible for:
- Analyzing requirements
- Creating implementation plans
- Identifying dependencies
- Breaking down large tasks
- Estimating complexity`,
  },
  priority: 70,
};

// ============================================================================
// Executor Agent
// ============================================================================

export const ExecutorAgent: AgentDefinition = {
  id: 'executor',
  name: 'Executor',
  role: 'executor',
  description: 'Executes commands and scripts',
  capabilities: {
    tools: ['bash_execute', 'npm_run', 'git_command', 'process_manage'],
    maxConcurrency: 5,
    taskTypes: ['execution', 'automation', 'build', 'deploy'],
    systemPrompt: `You are an executor agent responsible for:
- Running shell commands
- Executing build scripts
- Managing processes
- Handling deployments
- Running automated tasks`,
  },
  priority: 50,
};

// ============================================================================
// Agent Factory
// ============================================================================

export const DefaultAgents: AgentDefinition[] = [
  CoordinatorAgent,
  ResearcherAgent,
  CoderAgent,
  ReviewerAgent,
  TesterAgent,
  DocumenterAgent,
  PlannerAgent,
  ExecutorAgent,
];

/**
 * Create a custom agent definition
 */
export function createCustomAgent(
  id: string,
  name: string,
  description: string,
  capabilities: Partial<AgentCapabilities>,
  options: Partial<AgentDefinition> = {}
): AgentDefinition {
  return {
    id,
    name,
    role: options.role || 'custom',
    description,
    capabilities: {
      tools: capabilities.tools || [],
      maxConcurrency: capabilities.maxConcurrency || 1,
      taskTypes: capabilities.taskTypes || [],
      model: capabilities.model,
      systemPrompt: capabilities.systemPrompt,
    },
    dependsOn: options.dependsOn,
    priority: options.priority || 50,
  };
}

/**
 * Get agent definition by role
 */
export function getAgentByRole(role: string): AgentDefinition | undefined {
  return DefaultAgents.find((a) => a.role === role);
}

/**
 * Get agents by capability
 */
export function getAgentsByCapability(capability: string): AgentDefinition[] {
  return DefaultAgents.filter(
    (a) =>
      a.capabilities.tools.includes(capability) ||
      a.capabilities.taskTypes.includes(capability)
  );
}
