# Multi-Agent System Documentation

> Code Buddy's Multi-Agent System enables complex software engineering tasks to be solved collaboratively by specialized AI agents.

## Overview

The Multi-Agent System is a sophisticated orchestration layer that coordinates multiple specialized agents to tackle complex tasks that require diverse expertise. Inspired by research from ComplexAgents (EMNLP 2024), Paper2Code, and AgentCoder, it implements various collaboration strategies for optimal task completion.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Request                                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Orchestrator Agent                              │
│  • Analyzes task complexity                                      │
│  • Creates execution plan                                        │
│  • Delegates to specialists                                      │
│  • Coordinates feedback loops                                    │
└─────────┬─────────────────────────┬─────────────────────────────┘
          │                         │
    ┌─────┴─────┐             ┌─────┴─────┐
    ▼           ▼             ▼           ▼
┌───────┐   ┌───────┐     ┌───────┐   ┌───────┐
│ Coder │   │Reviewer│    │Tester │   │Debugger│
└───────┘   └───────┘     └───────┘   └───────┘
    │           │             │           │
    └───────────┴─────────────┴───────────┘
                    │
                    ▼
            ┌───────────────┐
            │ Shared Context│
            │  & Artifacts  │
            └───────────────┘
```

## Agent Roles

### Orchestrator Agent

The orchestrator is the "brain" of the system. It:
- Analyzes incoming tasks and assesses complexity
- Creates execution plans with phases and dependencies
- Delegates tasks to appropriate specialists
- Monitors progress and handles failures
- Synthesizes final results

```typescript
interface OrchestratorCapabilities {
  planning: true;
  delegation: true;
  monitoring: true;
  synthesis: true;
}
```

### Coder Agent

Specialized in code generation and modification:
- Writes new code following project patterns
- Modifies existing files with surgical precision
- Implements features based on specifications
- Follows coding standards and best practices

**Allowed Tools**: `read_file`, `write_file`, `edit_file`, `glob`, `grep`, `bash`

### Reviewer Agent

Ensures code quality through review:
- Analyzes code for bugs and issues
- Checks adherence to coding standards
- Identifies security vulnerabilities
- Provides improvement suggestions
- Approves or requests revisions

**Output Types**: `approval`, `rejection`, `revision_request`, `suggestion`

### Tester Agent

Handles all testing responsibilities:
- Writes unit and integration tests
- Runs existing test suites
- Analyzes test results
- Identifies uncovered code paths
- Reports test failures with diagnostics

**Allowed Tools**: `bash`, `read_file`, `write_file`, `glob`

### Additional Roles

| Role | Description |
|------|-------------|
| `debugger` | Diagnoses and fixes bugs |
| `architect` | Designs system architecture |
| `documenter` | Writes documentation |
| `researcher` | Searches docs and codebase |

## Collaboration Strategies

### Sequential

Agents work one after another in a defined order.

```typescript
strategy: "sequential"
// Coder → Reviewer → Tester
```

**Best for**: Simple linear workflows

### Parallel

Multiple agents work simultaneously on independent tasks.

```typescript
strategy: "parallel"
parallelAgents: 3
```

**Best for**: Tasks with independent subtasks

### Hierarchical

Orchestrator delegates to specialists based on task type.

```typescript
strategy: "hierarchical"
// Orchestrator analyzes → delegates → monitors
```

**Best for**: Complex multi-faceted tasks (default)

### Peer Review

Agents review each other's work in cycles.

```typescript
strategy: "peer_review"
// Coder produces → Reviewer checks → iterate
```

**Best for**: High-quality requirements

### Iterative

Feedback loop until consensus is reached.

```typescript
strategy: "iterative"
maxIterations: 5
requireConsensus: true
```

**Best for**: Complex decisions requiring agreement

## Execution Plans

The orchestrator creates structured execution plans:

```typescript
interface ExecutionPlan {
  id: string;
  goal: string;
  summary: string;
  phases: PlanPhase[];
  estimatedComplexity: "simple" | "moderate" | "complex" | "very_complex";
  requiredAgents: AgentRole[];
  status: "draft" | "approved" | "executing" | "completed" | "failed";
}
```

### Example Plan

```json
{
  "goal": "Add user authentication to the API",
  "summary": "Implement JWT-based auth with login/register endpoints",
  "estimatedComplexity": "complex",
  "requiredAgents": ["coder", "reviewer", "tester"],
  "phases": [
    {
      "name": "Design",
      "description": "Design auth flow and data models",
      "parallelizable": false,
      "tasks": [
        { "title": "Design User model", "assignedTo": "architect" },
        { "title": "Design JWT strategy", "assignedTo": "architect" }
      ]
    },
    {
      "name": "Implementation",
      "description": "Implement auth endpoints",
      "parallelizable": true,
      "tasks": [
        { "title": "Implement User model", "assignedTo": "coder" },
        { "title": "Implement login endpoint", "assignedTo": "coder" },
        { "title": "Implement register endpoint", "assignedTo": "coder" }
      ]
    },
    {
      "name": "Testing",
      "description": "Test all auth functionality",
      "parallelizable": false,
      "tasks": [
        { "title": "Write unit tests", "assignedTo": "tester" },
        { "title": "Review implementation", "assignedTo": "reviewer" }
      ]
    }
  ]
}
```

## Shared Context

All agents share a common context:

```typescript
interface SharedContext {
  goal: string;                           // Current objective
  codebaseInfo?: CodebaseInfo;            // Project structure
  relevantFiles: string[];                // Files in scope
  conversationHistory: AgentMessage[];    // Inter-agent communication
  artifacts: Map<string, TaskArtifact>;   // Produced outputs
  decisions: Decision[];                  // Recorded decisions
  constraints: string[];                  // Project constraints
}
```

## Task Artifacts

Agents produce artifacts that can be shared:

```typescript
interface TaskArtifact {
  id: string;
  type: "code" | "document" | "test" | "diagram" | "analysis" | "diff";
  name: string;
  content: string;
  filePath?: string;
  language?: string;
}
```

## Inter-Agent Communication

Agents communicate through structured messages:

```typescript
interface AgentMessage {
  from: AgentRole;
  to: AgentRole | "all";
  type: "request" | "response" | "feedback" | "delegation" | "status_update";
  content: string;
  data?: unknown;
}
```

### Feedback System

```typescript
interface AgentFeedback {
  from: AgentRole;
  to: AgentRole;
  type: "approval" | "rejection" | "revision_request" | "suggestion";
  severity: "critical" | "major" | "minor" | "info";
  message: string;
  suggestions: string[];
  codeLocations?: CodeLocation[];
}
```

## Usage

### Basic Usage

```typescript
import { MultiAgentSystem } from 'code-buddy';

const system = new MultiAgentSystem(apiKey, baseURL);

// Run a multi-agent workflow
const result = await system.run("Add a user settings page", {
  strategy: "hierarchical",
  maxIterations: 5,
  verbose: true
});

console.log(result.summary);
```

### With Event Handling

```typescript
const system = new MultiAgentSystem(apiKey, baseURL);

// Listen to events
system.on("task:start", ({ task }) => {
  console.log(`Starting: ${task.title}`);
});

system.on("agent:message", ({ message }) => {
  console.log(`[${message.from}]: ${message.content}`);
});

system.on("task:complete", ({ task, result }) => {
  console.log(`Completed: ${task.title}`);
});

const result = await system.run("Refactor the auth module");
```

### Workflow Options

```typescript
const options: WorkflowOptions = {
  strategy: "peer_review",      // Collaboration strategy
  maxIterations: 5,             // Max feedback loops
  requireConsensus: true,       // Require all agents to agree
  parallelAgents: 3,            // Max concurrent agents
  timeout: 600000,              // 10 minute timeout
  verbose: true,                // Detailed logging
  dryRun: false,                // Actually execute changes
  autoApprove: false,           // Require user confirmation
  onProgress: (event) => {},    // Progress callback
  onAgentMessage: (msg) => {}   // Message callback
};
```

## Event System

### Available Events

| Event | Description |
|-------|-------------|
| `workflow:start` | Workflow begins |
| `workflow:complete` | Workflow finishes |
| `workflow:error` | Workflow fails |
| `phase:start` | Phase begins |
| `phase:complete` | Phase finishes |
| `task:start` | Task begins |
| `task:complete` | Task finishes |
| `task:failed` | Task fails |
| `agent:message` | Agent sends message |
| `agent:feedback` | Agent provides feedback |

## Workflow Result

```typescript
interface WorkflowResult {
  success: boolean;
  plan: ExecutionPlan;
  results: Map<string, AgentExecutionResult>;
  artifacts: TaskArtifact[];
  timeline: WorkflowEvent[];
  totalDuration: number;
  summary: string;
  errors: string[];
}
```

## Best Practices

### 1. Task Description

Provide clear, detailed task descriptions:

```typescript
// Good
await system.run("Add pagination to the /api/users endpoint with limit and offset parameters, returning total count in headers");

// Less good
await system.run("Add pagination");
```

### 2. Choose the Right Strategy

- **Simple tasks**: Use `sequential`
- **Complex tasks**: Use `hierarchical` (default)
- **Critical code**: Use `peer_review`
- **Large refactors**: Use `parallel`

### 3. Monitor Progress

Use event handlers for visibility:

```typescript
system.on("task:complete", ({ task, result }) => {
  if (!result.success) {
    console.warn(`Task failed: ${task.title}`);
  }
});
```

### 4. Handle Errors

Check result status and errors:

```typescript
const result = await system.run(task);

if (!result.success) {
  console.error("Errors:", result.errors);
  // Review timeline for debugging
  console.log("Timeline:", result.timeline);
}
```

## Limitations

1. **Token Usage**: Multi-agent workflows use more tokens than single-agent
2. **Latency**: Coordination adds overhead
3. **Complexity**: Not all tasks benefit from multi-agent approach
4. **Determinism**: Results may vary between runs

## When to Use Multi-Agent

**Good candidates**:
- Complex feature implementations
- Large refactoring projects
- Code requiring multiple reviews
- Tasks spanning multiple files/systems

**Not ideal for**:
- Simple one-file edits
- Quick bug fixes
- Documentation updates
- Single-purpose tasks

## Advanced Configuration

### Custom Agents

```typescript
const customAgent = new BaseAgent({
  role: "custom",
  name: "Custom Agent",
  systemPrompt: "You are a specialized agent...",
  capabilities: ["code_generation", "testing"]
});

system.addAgent(customAgent);
```

### Tool Restrictions

```typescript
const coderAgent = createCoderAgent(apiKey, baseURL, {
  allowedTools: ["read_file", "edit_file"],  // Restrict tools
  maxRounds: 10,  // Limit iterations
  timeout: 60000  // 1 minute timeout
});
```

## Metrics & Observability

The system tracks:
- Task completion rates
- Agent utilization
- Iteration counts
- Token usage per agent
- Duration per phase

Access metrics:

```typescript
const result = await system.run(task);

console.log("Total duration:", result.totalDuration);
console.log("Tasks completed:", result.results.size);
console.log("Artifacts produced:", result.artifacts.length);
```

## Troubleshooting

### Workflow Timeout

Increase timeout or reduce task scope:

```typescript
await system.run(task, { timeout: 1200000 });  // 20 minutes
```

### Consensus Not Reached

Check `maxIterations` and feedback messages:

```typescript
await system.run(task, {
  maxIterations: 10,
  requireConsensus: false  // Continue despite disagreement
});
```

### Agent Errors

Review the timeline for details:

```typescript
result.timeline.filter(e => e.type === "task_failed").forEach(e => {
  console.log(e.message, e.data);
});
```
