---
title: "tests — workflows"
module: "tests-workflows"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.067Z"
---
# tests — workflows

This documentation describes the **workflow testing module**, located at `tests/workflows`. This module is crucial for validating the core workflow orchestration capabilities of the system, primarily focusing on the `PipelineCompositor` class from `src/workflows/pipeline.ts`. It ensures that pipelines can be defined, parsed, executed, and managed correctly, including complex features like approval gates and custom transforms.

## Module Purpose

The `tests/workflows` module serves as the primary test suite for the `PipelineCompositor` and related workflow components. Its main goals are to:

*   **Verify Pipeline Execution**: Ensure that sequences of steps (tools, transforms, approvals) execute correctly, passing outputs between them.
*   **Validate Parsing Logic**: Confirm that pipeline definitions, expressed in a pipe-delimited syntax, are correctly parsed into executable `PipelineStep` objects.
*   **Test Approval Gates**: Rigorously check the behavior of approval steps, including auto-approval conditions, manual approval/rejection, timeouts, and custom approval handlers.
*   **Integrate Tool Execution**: Ensure the `PipelineCompositor` correctly delegates tool execution to a provided `ToolExecutor`.
*   **Manage Transforms**: Verify the functionality of built-in and custom text transformation steps.
*   **Handle Errors and Edge Cases**: Confirm that pipelines gracefully handle failures, invalid definitions, and resource limits.
*   **Track State and Events**: Validate that the compositor correctly records approval history and emits relevant events during execution.

## Core Component: `PipelineCompositor`

The `PipelineCompositor` is the central class under test. It is responsible for:

*   **Parsing**: Converting a string-based pipeline definition (e.g., `"step1 | step2"`) into a structured array of `PipelineStep` objects.
*   **Execution**: Iterating through `PipelineStep`s, managing input/output flow, and orchestrating their execution.
*   **Tool Integration**: Providing an interface (`setToolExecutor`) to plug in an external `ToolExecutor` for executing `tool` type steps.
*   **Transform Management**: Registering and applying `transform` type steps.
*   **Approval Workflow**: Implementing logic for `approval` type steps, including auto-approval, manual intervention, and timeout mechanisms.
*   **State Management**: Maintaining an `ApprovalHistory` and emitting events (`step:start`, `step:complete`, `approval:required`, `approval:auto`, `pipeline:complete`).
*   **Validation**: Checking the structural integrity and validity of pipeline definitions.

### `PipelineCompositor` Interactions

The following diagram illustrates the primary interactions of the `PipelineCompositor` with other components and concepts:

```mermaid
graph TD
    A[PipelineCompositor] -->|orchestrates| B(PipelineStep);
    B -- type: tool --> C[ToolExecutor];
    B -- type: transform --> D[Registered Transforms];
    B -- type: approval --> E[Approval Handler / approveStep()];
    A -- emits events --> F[Events];
    A -- manages --> G[Approval History];
```

## Key Functionalities Tested

The tests cover various aspects of the `PipelineCompositor`'s behavior.

### 1. Pipeline Execution Flow

The `agent-pipeline.test.ts` and `pipeline-integration.test.ts` files extensively test the sequential execution of pipeline steps.

*   **Chaining Steps**: Verifies that the output of one step correctly becomes the input for the next.
    *   *Example*: `step1 | step2 | step3` ensures `step2` receives `step1`'s output, and `step3` receives `step2`'s output.
*   **Mixed Step Types**: Confirms that `tool` and `transform` steps can be interleaved seamlessly.
    *   *Example*: `web_search "query" | trim | uppercase`
*   **Error Handling**: Tests that the pipeline stops execution immediately upon a step failure and propagates the error.
*   **Step Duration**: Ensures that `durationMs` is accurately tracked for each step and the overall pipeline.
*   **Max Steps Limit**: Validates that a configured `maxSteps` limit prevents excessively long pipelines.
*   **Events**: Checks that `step:start`, `step:complete`, and `pipeline:complete` events are emitted at appropriate times.

### 2. Pipeline Definition and Parsing

The `PipelineCompositor.parse()` method is critical for converting human-readable pipeline strings into executable structures.

*   **Pipe Syntax**: Supports standard pipe (`|`) for sequential execution, as well as fallback (`||`) and sequential (`&&`) operators (though the tests primarily focus on `|`).
*   **Argument Handling**: Parses both positional arguments (e.g., `"search "query"`) and key-value arguments (e.g., `"search query="hello world"`).
*   **Step Type Identification**: Correctly identifies `tool`, `transform`, and `approval` steps based on their names.
*   **`validateDefinition()`**: Ensures that pipeline definitions are structurally sound, checking for empty pipelines, missing names, and invalid step types. It also provides warnings for unknown transforms or duplicate step names.

### 3. Tool Execution Integration

The `PipelineCompositor` relies on an external `ToolExecutor` to perform actions defined as `tool` steps.

*   **`setToolExecutor(executor: ToolExecutor)`**: This method allows injecting a custom executor. Tests use `vi.fn()` or `jest.fn()` mocks to simulate tool behavior.
*   **Delegation**: Verifies that `tool` steps correctly invoke the `ToolExecutor` with the appropriate `toolName`, `args`, and `_input`.
*   **Failure Handling**: Ensures that tool execution failures are caught and stop the pipeline.
*   **No Executor Configured**: Tests the behavior when no `ToolExecutor` has been set, expecting a clear error.

### 4. Transform Management

Transforms are built-in text manipulation functions that can be applied as pipeline steps.

*   **Built-in Transforms**: Tests cover standard transforms like `uppercase`, `trim`, `count`, `head`, `tail`, `lowercase`, and `wrap` (with `prefix`/`suffix` arguments).
*   **Custom Transforms**: The `registerTransform(name: string, fn: TransformFunction)` method allows developers to add their own transforms. Tests confirm that custom transforms can be registered and used.
*   **`listTransforms()`**: Verifies that all available transforms, including custom ones, can be listed.

### 5. Approval Gates

The `pipeline-approval.test.ts` module provides comprehensive testing for `approval` type steps, which introduce human or automated decision points into a pipeline.

*   **`ApprovalGateConfig`**: Defines the configuration for an approval step, including `timeoutMs`, `message`, `autoApproveCondition`, and `requireExplicit`.
*   **Auto-Approval**:
    *   Tests that `autoApproveCondition` (a function returning `boolean`) can automatically approve a step.
    *   Ensures that `requireExplicit: true` bypasses auto-approval, forcing manual intervention or handler execution.
    *   Handles cases where `autoApproveCondition` throws an error, falling back to the approval handler.
    *   Emits an `approval:auto` event upon auto-approval.
*   **Timeout Handling**:
    *   Verifies that an approval step will fail with a "timed out" error if no approval is received within `timeoutMs`.
    *   Confirms that the timeout is recorded in the `ApprovalHistory`.
*   **Manual Approval Flow**:
    *   **`approveStep(stepIndex: number, result: ApprovalResult)`**: This method allows external systems (e.g., a UI or API endpoint) to manually approve or reject a pending approval step.
    *   Tests that `approveStep` correctly unblocks the pipeline and records the result.
    *   Ensures that calling `approveStep` with `approved: false` rejects the pipeline.
    *   Validates error handling for invalid `stepIndex` calls.
    *   Emits an `approval:required` event when a manual approval is needed, providing the `ApprovalGateConfig` and `stepIndex`.
*   **Approval Handler Callback**:
    *   The `PipelineCompositor` can be configured with an `approvalHandler` function. This handler is invoked when an approval step is encountered and no auto-approval occurs.
    *   Tests confirm that the handler is called with the correct `gate`, `stepIndex`, and `context`.
    *   Verifies that the pipeline proceeds or fails based on the `ApprovalResult` returned by the handler.
*   **Approval History**:
    *   **`getApprovalHistory()`**: Returns a record of all approval decisions made during a pipeline run.
    *   Tests ensure history is accumulated across multiple approval steps, is a copy (not a reference), and is cleared on `dispose()`.
*   **Input Passing**: Crucially, approval gates are tested to ensure they pass the pipeline's current input through unchanged, allowing subsequent steps to operate on the data.

## Testing Strategy

The tests utilize `vitest` for its testing framework, including `describe`, `it`, `expect`, `beforeEach`, and `afterEach` hooks. `vi.fn()` and `jest.fn()` are used extensively to create mock `ToolExecutor` implementations and `approvalHandler` callbacks, allowing for isolated testing of the `PipelineCompositor`'s logic without external dependencies.

The `resetPipelineCompositor()` function is used in `beforeEach` to ensure a clean state for each test, preventing side effects from previous tests (e.g., registered custom transforms or approval history). The `compositor.dispose()` method is called in `afterEach` to clean up resources and clear internal state.