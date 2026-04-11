---
title: "src — workflows"
module: "src-workflows"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.805Z"
---
# src — workflows

The `src/workflows` module provides a robust and flexible framework for defining, executing, managing, and optimizing multi-step processes within the Code Buddy application. It offers several distinct paradigms for workflow definition and execution, catering to a wide range of use cases from structured programmatic flows to declarative DAGs and shell-like tool chaining.

## Core Concepts

The module introduces three primary approaches to defining and executing workflows:

1.  **Structured Workflows (`WorkflowDefinition`)**: These are defined programmatically or via configuration files as a sequence of steps, each with a specific action, conditions, and potential branching logic. They are managed and executed by the `WorkflowEngine`.
2.  **Lobster Workflows (`LobsterWorkflow`)**: Advanced enterprise architecture for Lobster format, these are declarative, DAG-based workflows typically defined in YAML or JSON. They explicitly define dependencies between steps, support conditional execution, variable resolution, and integrate approval gates. The `LobsterEngine` is responsible for their parsing, validation, and execution.
3.  **Pipeline Compositor (`PipelineCompositor`)**: This system allows for chaining tools, skills, or transforms using a shell-like syntax (e.g., `search "query" | summarize`). It's designed for more ad-hoc, command-line-driven sequences of operations, including support for fallbacks and approval gates.

## Module Architecture

The `src/workflows` module is structured around several key components that work together to provide its functionality. The `WorkflowEngine` acts as the central orchestrator for structured workflows, delegating step execution to the `StepManager` and state persistence to the `WorkflowStateManager`. The `LobsterEngine` and `PipelineCompositor` offer alternative, specialized execution environments. The `AFlowOptimizer` specifically targets `LobsterWorkflow` definitions for performance tuning.

```mermaid
graph TD
    subgraph Core Workflow Engine
        WE[WorkflowEngine] --> SM[StepManager]
        WE --> WSM[WorkflowStateManager]
    end

    subgraph Specialized Workflow Systems
        LE[LobsterEngine]
        PC[PipelineCompositor]
    end

    AFO[AFlowOptimizer] --> LE

    types[types.ts] -- defines interfaces for --> WE, SM, WSM, LE, PC, AFO
```

## Key Components

### `src/workflows/types.ts` — Data Structures

This file defines the foundational TypeScript interfaces and types used across the entire workflows module. It ensures type safety and consistency for workflow definitions, execution states, step results, and context objects.

**Key Interfaces:**

*   `WorkflowDefinition`: The blueprint for a structured workflow, including its ID, name, description, and an array of `WorkflowStep`s.
*   `WorkflowStep`: Defines a single step within a `WorkflowDefinition`, specifying its action, conditions, timeouts, and branching logic.
*   `WorkflowContext`: Holds the runtime data for a workflow instance, including variables, step results, and metadata.
*   `WorkflowState`: Represents the persistent state of a workflow instance, tracking its status, current step, execution history, and timestamps.
*   `StepResult`: The outcome of a single step's execution, indicating success/failure, output, error, and duration.
*   `LobsterWorkflow`, `LobsterStep`, `StepResult` (Lobster-specific): Definitions for the Native Engine-compatible DAG workflows.
*   `PipelineStep`, `PipelineResult`, `StepResult` (Pipeline-specific): Definitions for the Pipeline Compositor's steps and outcomes.

### `src/workflows/workflow-engine.ts` — The General-Purpose Orchestrator

The `WorkflowEngine` is the primary component for managing and executing structured `WorkflowDefinition`s. It provides a high-level API for starting, resuming, pausing, and canceling workflow instances.

**Key Responsibilities:**

*   **Workflow Registration**: Allows registering and retrieving `WorkflowDefinition`s.
*   **Lifecycle Management**: Handles the full lifecycle of a workflow instance, from `pending` to `running`, `paused`, `completed`, `failed`, or `cancelled`.
*   **Execution Flow**: Iterates through workflow steps, respecting conditions and branching logic (`onSuccess`, `onFailure`).
*   **State Management**: Delegates persistence and retrieval of workflow states to the `WorkflowStateManager`.
*   **Step Execution**: Delegates the actual execution of individual step actions to the `StepManager`.
*   **Event Emitter**: Emits events for workflow lifecycle changes (e.g., `workflow:start`, `workflow:complete`, `workflow:error`).

**Key Methods:**

*   `registerWorkflow(workflow: WorkflowDefinition)`: Adds a new workflow definition.
*   `startWorkflow(workflowId: string, options?: WorkflowExecutionOptions)`: Initiates a new workflow instance.
*   `resumeWorkflow(instanceId: string)`: Resumes a previously paused workflow instance.
*   `pauseWorkflow(instanceId: string)`: Pauses a running workflow instance.
*   `cancelWorkflow(instanceId: string)`: Terminates a running or paused workflow instance.
*   `getWorkflowState(instanceId: string)`: Retrieves the current state of a workflow instance.

**Singleton Pattern:**
The `WorkflowEngine` uses a singleton pattern, accessible via `getWorkflowEngine()` and resettable with `resetWorkflowEngine()`.

### `src/workflows/step-manager.ts` — Step Execution Handler

The `StepManager` is responsible for executing individual `WorkflowStep` actions. It acts as a registry for various actions that steps can perform.

**Key Responsibilities:**

*   **Action Registry**: Maintains a map of named action handlers (functions) that can be invoked by workflow steps.
*   **Step Execution**: Executes a given `WorkflowStep` by invoking its associated action handler, applying timeouts, and handling retries.
*   **Condition Evaluation**: Evaluates step conditions (string-based or function-based) to determine if a step should run.
*   **Event Emitter**: Emits events for step lifecycle changes (e.g., `step:start`, `step:complete`, `step:error`, `step:skipped`).

**Key Methods:**

*   `registerAction(name: string, handler: (context: WorkflowContext) => Promise<StepResult>)`: Registers a custom action.
*   `executeStep(step: WorkflowStep, context: WorkflowContext, options?: { timeout?: number })`: Executes a single workflow step.
*   `evaluateCondition(condition: string | ((context: WorkflowContext) => boolean), context: WorkflowContext)`: Evaluates a step's condition.

**Built-in Actions:**
The `StepManager` includes several built-in actions like `log`, `delay`, `setVariable`, `conditional`, and `noop` for common workflow operations.

### `src/workflows/state-manager.ts` — Workflow Persistence

The `WorkflowStateManager` handles the persistence and retrieval of `WorkflowState` objects. It ensures that workflow progress can be saved and resumed across application restarts.

**Key Responsibilities:**

*   **State Persistence**: Serializes `WorkflowState` objects to JSON files on disk (defaulting to `~/.codebuddy/workflows/`).
*   **State Retrieval**: Loads workflow states from disk upon initialization.
*   **State Management**: Provides methods for creating, updating, retrieving, and deleting workflow states.
*   **Instance ID Generation**: Generates unique IDs for workflow instances.

**Key Methods:**

*   `createState(workflowId: string, initialContext?: Record<string, unknown>)`: Creates and persists a new workflow state.
*   `getState(instanceId: string)`: Retrieves a specific workflow state.
*   `updateState(instanceId: string, updates: Partial<WorkflowState>)`: Updates and persists changes to a state.
*   `saveState(state: WorkflowState)`: Explicitly saves a state to disk.
*   `deleteState(instanceId: string)`: Deletes a state file from disk.
*   `getAllStates()`, `getStatesByWorkflow()`, `getStatesByStatus()`: Query methods for states.
*   `getStats()`: Provides aggregate statistics on workflow states.

### `src/workflows/lobster-engine.ts` — DAG-Based Workflow Execution (Native Engine Compatible)

The `LobsterEngine` is a specialized workflow engine designed to parse, validate, and execute workflows defined in the Native Engine Lobster format. This format emphasizes explicit and implicit dependencies, making it suitable for complex, data-flow-oriented tasks.

**Key Responsibilities:**

*   **Workflow Parsing & Validation**: Parses YAML/JSON workflow definitions into `LobsterWorkflow` objects and validates their structure and dependencies (including cycle detection).
*   **Native Engine Normalization**: Transforms Native Engine-specific fields (`env`, `args`, `stdin` for implicit dependencies) into a unified internal format.
*   **Dependency Resolution**: Determines the correct execution order of steps based on `dependsOn` and `stdin` references.
*   **Variable Resolution**: Resolves variables and step outputs (e.g., `$step.stdout`) within commands and conditions.
*   **Conditional Execution**: Evaluates `condition` fields to determine if a step should run.
*   **Approval Gates**: Supports `approval` steps, pausing execution and returning a `resumeToken` for external approval, then resuming.

**Key Methods:**

*   `parseWorkflow(yaml: string)`: Parses a Lobster workflow definition.
*   `validateWorkflow(workflow: LobsterWorkflow)`: Checks for structural and dependency errors.
*   `getExecutionOrder(workflow: LobsterWorkflow)`: Returns a topological sort of step IDs.
*   `executeWithApproval(...)`: Executes a workflow, handling approval gates by pausing and returning a resume token.
*   `resumeWorkflow(...)`: Resumes a paused workflow after an approval decision.
*   `generateResumeToken(...)`, `parseResumeToken(...)`: Utility for managing workflow resume points.

**Singleton Pattern:**
The `LobsterEngine` also uses a singleton pattern, accessible via `LobsterEngine.getInstance()` and resettable with `LobsterEngine.resetInstance()`.

### `src/workflows/aflow-optimizer.ts` — Lobster Workflow Optimizer

The `AFlowOptimizer` is a specialized component designed to optimize the execution parameters of `LobsterWorkflow` definitions. It employs a Monte Carlo Tree Search (MCTS) algorithm to explore various configurations and find the most efficient ones.

**Key Responsibilities:**

*   **Parameter Optimization**: Optimizes step parallelism, timeout values, AI model selection (for AI-driven steps), and step ordering within dependency constraints.
*   **MCTS Implementation**: Implements the core MCTS phases:
    *   **Selection**: Uses UCB1 (Upper Confidence Bound 1) with MCTSr Q-value to select the most promising node in the search tree.
    *   **Expansion**: Generates new variant configurations (children nodes) by adjusting parameters like timeouts, parallelism, and AI models.
    *   **Simulation**: Estimates the reward (duration, cost, success rate) of a configuration by simulating its execution, potentially using historical data.
    *   **Backpropagation**: Updates the statistics (visits, total reward, min reward) of nodes along the path from the simulated node back to the root.
*   **Analysis Tools**: Provides utility functions to analyze parallelism opportunities and suggest timeout adjustments based on historical data.

**Key Methods:**

*   `optimize(workflow: LobsterWorkflow, historicalResults?: StepResult[])`: Runs the MCTS optimization process.
*   `analyzeParallelism(workflow: LobsterWorkflow)`: Identifies steps that can run concurrently.
*   `suggestTimeouts(workflow: LobsterWorkflow, historicalResults: StepResult[])`: Recommends timeout values based on historical performance.
*   `createRootNode(...)`, `select(...)`, `expand(...)`, `generateVariants(...)`, `simulate(...)`, `evaluate(...)`, `backpropagate(...)`: Internal MCTS methods.

**Optimization Goals:**
The optimizer's default evaluation function balances speed, cost, and reliability, but a custom `evaluator` can be provided in the `OptimizationConfig`.

**Singleton Pattern:**
The `AFlowOptimizer` uses a singleton pattern, accessible via `AFlowOptimizer.getInstance()` and `getAFlowOptimizer()`, and resettable with `AFlowOptimizer.resetInstance()`.

### `src/workflows/pipeline.ts` — The Pipeline Compositor (Tool Chaining)

The `PipelineCompositor` provides a lightweight, shell-like syntax for chaining tools, skills, or transforms. It's designed for sequential execution with support for conditional logic, fallbacks, and approval gates.

**Key Responsibilities:**

*   **Pipeline Parsing**: Parses a pipeline string (e.g., `tool1 args | tool2 args`) into a sequence of `PipelineToken`s.
*   **Step Execution**: Executes each `PipelineStep` sequentially, passing the output of one step as input to the next.
*   **Operators**: Supports `|` (pipe), `||` (fallback on failure), `&&` (sequential, requires previous success), and `&` (intended for parallel execution, though currently processed sequentially).
*   **Built-in Transforms**: Provides a set of common text transformations (e.g., `uppercase`, `trim`, `grep`).
*   **Tool Execution**: Delegates actual tool/skill execution to a configurable `ToolExecutor` callback.
*   **Approval Gates**: Supports `approval` steps, which can be auto-approved by a condition, handled by a callback, or require manual resolution via an event.
*   **Event Emitter**: Emits events for pipeline and step lifecycle changes (e.g., `pipeline:complete`, `step:start`, `approval:required`).
*   **File Loading & Validation**: Can load pipeline definitions from JSON/YAML files and validate their structure.

**Key Methods:**

*   `parse(pipelineString: string)`: Parses a pipeline string.
*   `run(pipelineString: string)`: Parses and executes a pipeline string.
*   `execute(steps: PipelineStep[])`: Executes a pipeline from a programmatic array of steps.
*   `setToolExecutor(executor: ToolExecutor)`: Configures the function responsible for executing tools/skills.
*   `registerTransform(name: string, fn: Function)`: Adds a custom transform function.
*   `approveStep(stepIndex: number, result: ApprovalResult)`: Manually resolves a pending approval gate.
*   `loadFromFile(filePath: string)`: Loads a pipeline definition from a file.
*   `validateDefinition(steps: PipelineStep[])`: Validates a programmatic pipeline definition.

**Singleton Pattern:**
The `PipelineCompositor` uses a singleton pattern, accessible via `getPipelineCompositor()` and resettable with `resetPipelineCompositor()`.

## Integration Points

The `src/workflows` module is a central piece of the Code Buddy architecture, integrating with various other components:

### Incoming Calls

*   **`src/commands/pipeline.ts`**: The CLI command for pipelines heavily relies on `getPipelineCompositor()` to parse and execute pipelines from the command line. It also uses `getWorkflowEngine()` to list available structured workflows.
*   **`server/routes/workflow-builder.ts`**: The backend API for workflow management and building interacts with `AFlowOptimizer` for optimization suggestions and `LobsterEngine` for parsing and validating Lobster workflows.
*   **Tests (`tests/workflows/*.test.ts`, `tests/unit/workflows.test.ts`)**: All components within this module are extensively tested, demonstrating their usage and ensuring correctness.
*   **Scripts (`scripts/tests/*.ts`)**: Example scripts use `LobsterEngine` for testing real-world workflow conditions.

### Outgoing Calls

*   **`src/utils/logger.js`**: All workflow components utilize the shared `logger` for debugging, informational messages, and error reporting.
*   **Node.js Built-ins (`fs`, `path`, `os`)**: `WorkflowStateManager` and `PipelineCompositor` use these modules for file system operations (persisting state, loading pipeline definitions).
*   **`js-yaml`**: `PipelineCompositor` uses `js-yaml` for loading pipeline definitions from YAML files.

## Contribution Guidelines

When contributing to the `src/workflows` module, consider the following:

*   **Understand the Paradigms**: Be aware of the distinct philosophies behind `WorkflowEngine`, `LobsterEngine`, and `PipelineCompositor`. Choose the appropriate system for new features or extensions.
*   **Type Safety**: Leverage the types defined in `src/workflows/types.ts` to maintain strong type safety throughout the module.
*   **Extensibility**:
    *   **New `WorkflowEngine` Actions**: Register new actions with `StepManager.registerAction()` to extend the capabilities of structured workflows.
    *   **New `PipelineCompositor` Transforms**: Add new text processing functions using `PipelineCompositor.registerTransform()`.
    *   **New `LobsterEngine` Features**: Extend `LobsterEngine` for new Native Engine-compatible features, ensuring proper parsing, validation, and execution logic.
    *   **Optimizer Enhancements**: Improve `AFlowOptimizer` by adding new variant generation strategies or refining the `evaluate` function.
*   **State Management**: If adding new stateful components, consider how their state will be managed and persisted, potentially integrating with `WorkflowStateManager` or implementing a similar mechanism.
*   **Event-Driven Architecture**: Utilize the `EventEmitter` capabilities of `WorkflowEngine`, `StepManager`, and `PipelineCompositor` to allow for external monitoring and integration.
*   **Testing**: Write comprehensive unit and integration tests for any new features or changes, ensuring all workflow paths, error conditions, and edge cases are covered.
*   **Singleton Awareness**: Be mindful of the singleton patterns used by the main engines. Use `getInstance()` for access and `resetInstance()` in tests to ensure clean state.