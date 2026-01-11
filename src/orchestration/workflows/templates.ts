/**
 * Workflow Templates
 *
 * Pre-built workflow templates for common multi-agent tasks.
 */

import type { WorkflowDefinition, TaskDefinition, WorkflowStep } from '../types.js';

// ============================================================================
// Code Review Workflow
// ============================================================================

export const CodeReviewWorkflow: WorkflowDefinition = {
  id: 'code-review',
  name: 'Code Review',
  description: 'Multi-agent code review process',
  steps: [
    {
      id: 'analyze',
      name: 'Code Analysis',
      type: 'task',
      tasks: [
        {
          id: 'analyze-structure',
          type: 'analysis',
          name: 'Analyze Code Structure',
          description: 'Analyze the code structure and dependencies',
          input: { files: '$files' },
          requiredRole: 'researcher',
          priority: 'high',
        },
      ],
    },
    {
      id: 'review',
      name: 'Parallel Reviews',
      type: 'parallel',
      branches: [
        [
          {
            id: 'quality-review',
            name: 'Quality Review',
            type: 'task',
            tasks: [
              {
                id: 'check-quality',
                type: 'code_review',
                name: 'Check Code Quality',
                description: 'Review code for quality and best practices',
                input: { files: '$files', analysis: '$task_analyze-structure' },
                requiredRole: 'reviewer',
                priority: 'medium',
              },
            ],
          },
        ],
        [
          {
            id: 'security-review',
            name: 'Security Review',
            type: 'task',
            tasks: [
              {
                id: 'check-security',
                type: 'security_review',
                name: 'Check Security',
                description: 'Review code for security vulnerabilities',
                input: { files: '$files', analysis: '$task_analyze-structure' },
                requiredRole: 'reviewer',
                priority: 'high',
              },
            ],
          },
        ],
        [
          {
            id: 'test-review',
            name: 'Test Coverage Review',
            type: 'task',
            tasks: [
              {
                id: 'check-tests',
                type: 'coverage_analysis',
                name: 'Check Test Coverage',
                description: 'Analyze test coverage',
                input: { files: '$files' },
                requiredRole: 'tester',
                priority: 'medium',
              },
            ],
          },
        ],
      ],
    },
    {
      id: 'summarize',
      name: 'Summarize Findings',
      type: 'task',
      tasks: [
        {
          id: 'create-summary',
          type: 'documentation',
          name: 'Create Review Summary',
          description: 'Summarize all review findings',
          input: {
            quality: '$task_check-quality',
            security: '$task_check-security',
            tests: '$task_check-tests',
          },
          requiredRole: 'coordinator',
          priority: 'high',
        },
      ],
      dependsOn: ['review'],
    },
  ],
  inputSchema: {
    files: { type: 'array', items: { type: 'string' } },
  },
  outputSchema: {
    summary: { type: 'object' },
    issues: { type: 'array' },
    recommendations: { type: 'array' },
  },
};

// ============================================================================
// Feature Implementation Workflow
// ============================================================================

export const FeatureImplementationWorkflow: WorkflowDefinition = {
  id: 'feature-implementation',
  name: 'Feature Implementation',
  description: 'Multi-agent feature implementation process',
  steps: [
    {
      id: 'plan',
      name: 'Planning',
      type: 'task',
      tasks: [
        {
          id: 'create-plan',
          type: 'planning',
          name: 'Create Implementation Plan',
          description: 'Analyze requirements and create implementation plan',
          input: { feature: '$feature', codebase: '$codebase' },
          requiredRole: 'planner',
          priority: 'high',
        },
      ],
    },
    {
      id: 'implement',
      name: 'Implementation',
      type: 'task',
      tasks: [
        {
          id: 'write-code',
          type: 'coding',
          name: 'Write Feature Code',
          description: 'Implement the feature based on plan',
          input: { plan: '$task_create-plan', feature: '$feature' },
          requiredRole: 'coder',
          priority: 'high',
        },
      ],
      dependsOn: ['plan'],
    },
    {
      id: 'test',
      name: 'Testing',
      type: 'task',
      tasks: [
        {
          id: 'write-tests',
          type: 'test_creation',
          name: 'Write Tests',
          description: 'Create tests for the new feature',
          input: { code: '$task_write-code', feature: '$feature' },
          requiredRole: 'tester',
          priority: 'medium',
        },
        {
          id: 'run-tests',
          type: 'testing',
          name: 'Run Tests',
          description: 'Execute test suite',
          input: { tests: '$task_write-tests' },
          requiredRole: 'tester',
          priority: 'medium',
          dependsOn: ['write-tests'],
        },
      ],
      dependsOn: ['implement'],
    },
    {
      id: 'review',
      name: 'Code Review',
      type: 'task',
      tasks: [
        {
          id: 'review-code',
          type: 'code_review',
          name: 'Review Implementation',
          description: 'Review the implemented code',
          input: { code: '$task_write-code', tests: '$task_run-tests' },
          requiredRole: 'reviewer',
          priority: 'medium',
        },
      ],
      dependsOn: ['test'],
    },
    {
      id: 'document',
      name: 'Documentation',
      type: 'task',
      tasks: [
        {
          id: 'write-docs',
          type: 'documentation',
          name: 'Write Documentation',
          description: 'Document the new feature',
          input: { code: '$task_write-code', feature: '$feature' },
          requiredRole: 'documenter',
          priority: 'low',
        },
      ],
      dependsOn: ['review'],
    },
  ],
  inputSchema: {
    feature: { type: 'string' },
    codebase: { type: 'string' },
  },
};

// ============================================================================
// Bug Fix Workflow
// ============================================================================

export const BugFixWorkflow: WorkflowDefinition = {
  id: 'bug-fix',
  name: 'Bug Fix',
  description: 'Multi-agent bug fixing process',
  steps: [
    {
      id: 'investigate',
      name: 'Investigation',
      type: 'task',
      tasks: [
        {
          id: 'analyze-bug',
          type: 'research',
          name: 'Analyze Bug',
          description: 'Investigate the bug and find root cause',
          input: { bug: '$bug', codebase: '$codebase' },
          requiredRole: 'researcher',
          priority: 'high',
        },
      ],
    },
    {
      id: 'fix',
      name: 'Fix',
      type: 'task',
      tasks: [
        {
          id: 'implement-fix',
          type: 'bug_fix',
          name: 'Implement Fix',
          description: 'Implement the bug fix',
          input: { analysis: '$task_analyze-bug', bug: '$bug' },
          requiredRole: 'coder',
          priority: 'high',
        },
      ],
      dependsOn: ['investigate'],
    },
    {
      id: 'verify',
      name: 'Verification',
      type: 'parallel',
      branches: [
        [
          {
            id: 'test-fix',
            name: 'Test Fix',
            type: 'task',
            tasks: [
              {
                id: 'create-regression-test',
                type: 'test_creation',
                name: 'Create Regression Test',
                description: 'Create test to prevent regression',
                input: { bug: '$bug', fix: '$task_implement-fix' },
                requiredRole: 'tester',
                priority: 'medium',
              },
            ],
          },
        ],
        [
          {
            id: 'review-fix',
            name: 'Review Fix',
            type: 'task',
            tasks: [
              {
                id: 'review-changes',
                type: 'code_review',
                name: 'Review Fix Changes',
                description: 'Review the bug fix changes',
                input: { fix: '$task_implement-fix' },
                requiredRole: 'reviewer',
                priority: 'medium',
              },
            ],
          },
        ],
      ],
      dependsOn: ['fix'],
    },
  ],
  inputSchema: {
    bug: { type: 'object' },
    codebase: { type: 'string' },
  },
};

// ============================================================================
// Refactoring Workflow
// ============================================================================

export const RefactoringWorkflow: WorkflowDefinition = {
  id: 'refactoring',
  name: 'Refactoring',
  description: 'Multi-agent code refactoring process',
  steps: [
    {
      id: 'analyze',
      name: 'Analysis',
      type: 'task',
      tasks: [
        {
          id: 'analyze-code',
          type: 'analysis',
          name: 'Analyze Code Quality',
          description: 'Analyze code for refactoring opportunities',
          input: { target: '$target', scope: '$scope' },
          requiredRole: 'researcher',
          priority: 'high',
        },
      ],
    },
    {
      id: 'plan',
      name: 'Planning',
      type: 'task',
      tasks: [
        {
          id: 'plan-refactoring',
          type: 'planning',
          name: 'Create Refactoring Plan',
          description: 'Plan the refactoring steps',
          input: { analysis: '$task_analyze-code', target: '$target' },
          requiredRole: 'planner',
          priority: 'high',
        },
      ],
      dependsOn: ['analyze'],
    },
    {
      id: 'backup',
      name: 'Backup',
      type: 'task',
      tasks: [
        {
          id: 'create-checkpoint',
          type: 'automation',
          name: 'Create Checkpoint',
          description: 'Create a checkpoint before refactoring',
          input: { target: '$target' },
          requiredRole: 'executor',
          priority: 'medium',
        },
      ],
      dependsOn: ['plan'],
    },
    {
      id: 'refactor',
      name: 'Refactoring',
      type: 'task',
      tasks: [
        {
          id: 'apply-refactoring',
          type: 'refactoring',
          name: 'Apply Refactoring',
          description: 'Apply the planned refactoring',
          input: { plan: '$task_plan-refactoring', target: '$target' },
          requiredRole: 'coder',
          priority: 'high',
        },
      ],
      dependsOn: ['backup'],
    },
    {
      id: 'validate',
      name: 'Validation',
      type: 'parallel',
      branches: [
        [
          {
            id: 'run-tests',
            name: 'Run Tests',
            type: 'task',
            tasks: [
              {
                id: 'test-refactored',
                type: 'testing',
                name: 'Test Refactored Code',
                description: 'Run tests on refactored code',
                input: { code: '$task_apply-refactoring' },
                requiredRole: 'tester',
                priority: 'high',
              },
            ],
          },
        ],
        [
          {
            id: 'review',
            name: 'Code Review',
            type: 'task',
            tasks: [
              {
                id: 'review-refactoring',
                type: 'code_review',
                name: 'Review Refactored Code',
                description: 'Review the refactoring changes',
                input: { code: '$task_apply-refactoring', plan: '$task_plan-refactoring' },
                requiredRole: 'reviewer',
                priority: 'medium',
              },
            ],
          },
        ],
      ],
      dependsOn: ['refactor'],
    },
  ],
  inputSchema: {
    target: { type: 'string' },
    scope: { type: 'string' },
  },
};

// ============================================================================
// Export All Templates
// ============================================================================

export const WorkflowTemplates: Record<string, WorkflowDefinition> = {
  'code-review': CodeReviewWorkflow,
  'feature-implementation': FeatureImplementationWorkflow,
  'bug-fix': BugFixWorkflow,
  'refactoring': RefactoringWorkflow,
};

/**
 * Get workflow template by ID
 */
export function getWorkflowTemplate(id: string): WorkflowDefinition | undefined {
  return WorkflowTemplates[id];
}

/**
 * List all workflow templates
 */
export function listWorkflowTemplates(): Array<{ id: string; name: string; description: string }> {
  return Object.values(WorkflowTemplates).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
  }));
}
