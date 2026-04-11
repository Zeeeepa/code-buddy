---
title: "tests — observability"
module: "tests-observability"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.935Z"
---
# tests — observability

This document describes the `run-store.test.ts` module, which is the test suite for the `RunStore` class located in `src/observability/run-store.ts`.

## `RunStore` Test Suite Documentation

### Introduction

The `run-store.test.ts` module provides comprehensive unit and integration tests for the `RunStore` class. `RunStore` is a critical component responsible for managing the lifecycle, events, metrics, and artifacts of individual execution runs within the system. This test suite ensures the reliability, data integrity, and correct behavior of `RunStore`'s persistence and retrieval mechanisms.

### Purpose of the Test Suite

The primary purpose of this test suite is to:
1.  **Verify Core Functionality**: Ensure that `RunStore` correctly creates, updates, and retrieves run data, including events, metrics, and artifacts.
2.  **Validate Data Integrity**: Confirm that data written to disk (e.g., `events.jsonl`, `metrics.json`, artifacts) is correctly stored and can be accurately read back.
3.  **Test Edge Cases**: Cover scenarios like unknown run IDs, concurrent operations (implicitly through rapid run creation), and data retention limits.
4.  **Ensure Resource Management**: Verify that temporary files and directories are created and cleaned up properly, and that write streams are handled correctly.
5.  **Confirm Singleton Behavior**: Validate that `RunStore` adheres to its singleton pattern.

### Core Functionality Under Test

The test suite is structured around the key public methods and behaviors of the `RunStore` class.

#### 1. Run Lifecycle Management (`startRun`, `endRun`)

*   **`startRun(objective: string, meta?: RunMetadata)`**:
    *   Verifies that `startRun` generates unique run IDs (e.g., `run_...`).
    *   Confirms that a dedicated directory for each run is created, containing `events.jsonl` and `metrics.json` files, along with an `artifacts` subdirectory.
    *   Ensures that a `run_start` event is correctly recorded in `events.jsonl` with the provided objective and metadata.
*   **`endRun(runId: string, status: RunStatus)`**:
    *   Tests that `endRun` updates the run's status (e.g., `completed`, `failed`, `cancelled`) and records the `endedAt` timestamp in the run's summary.
    *   Confirms that a `run_end` event is emitted to `events.jsonl` with the final status.

#### 2. Event Logging (`emit`, `getEvents`)

*   **`emit(runId: string, event: RunEvent)`**:
    *   Validates that arbitrary `RunEvent` objects are appended to the `events.jsonl` file for the specified run.
    *   Ensures that each emitted event automatically includes a timestamp (`ts`) and the `runId`.
    *   Tests the resilience of `emit` by confirming it silently ignores attempts to emit events for unknown `runId`s.
*   **`getEvents(runId: string)`**:
    *   Verifies that `getEvents` can correctly read and parse all events from a run's `events.jsonl` file.

#### 3. Artifact Management (`saveArtifact`, `getArtifact`)

*   **`saveArtifact(runId: string, filename: string, content: string | Buffer)`**:
    *   Tests that artifacts are correctly written to the `artifacts/` subdirectory within a run's directory.
    *   Confirms that the content written matches the input.
    *   Ensures that saved artifacts are listed in the `artifacts` array when retrieving a run record via `getRun`.
*   **`getArtifact(runId: string, filename: string)`**:
    *   Validates that `getArtifact` can retrieve the content of a previously saved artifact.
    *   Tests that `getArtifact` returns `null` for non-existent artifacts.

#### 4. Run Retrieval and Listing (`getRun`, `listRuns`)

*   **`getRun(runId: string)`**:
    *   Verifies that `getRun` returns a complete `RunRecord` for a known `runId`, including its summary, metrics, and a list of artifacts.
    *   Tests that `getRun` returns `null` for unknown `runId`s.
*   **`listRuns(limit?: number)`**:
    *   Ensures that `listRuns` returns runs sorted by `startedAt` in descending order (most recent first).
    *   Validates that the `limit` parameter correctly restricts the number of returned runs.

#### 5. Metrics Updates (`updateMetrics`)

*   While `updateMetrics` is not directly tested in its own `describe` block, its effect is verified through `getRun`. The test confirms that metrics updated via `store.updateMetrics(runId, { totalTokens: 1000, totalCost: 0.01 })` are correctly reflected in the `RunRecord` returned by `getRun`.

#### 6. Data Retention and Pruning

*   The test suite includes a specific test case to ensure that `RunStore`'s internal pruning mechanism limits the total number of stored runs (e.g., to a maximum of 30 runs), preventing unbounded disk usage.

#### 7. Singleton Pattern Enforcement

*   A dedicated test confirms that `RunStore.getInstance()` always returns the same instance of the `RunStore`, upholding the singleton design pattern.

### Test Environment and Utilities

The test suite employs several helper functions and `jest` hooks to manage the test environment effectively.

*   **`makeTmpDir()`**: Creates a unique temporary directory for each test run using `os.tmpdir()` and `fs.mkdtempSync`. This ensures isolation between tests and prevents side effects.
*   **`cleanDir(dir: string)`**: Recursively removes a given directory, used for cleaning up temporary test data. It includes error handling to ignore cleanup failures.
*   **`beforeEach()`**:
    *   Initializes a new temporary directory (`tmpDir`).
    *   Creates a new `RunStore` instance, pointing it to the `tmpDir`.
    *   Resets `activeRunIds` to track runs created within the current test.
*   **`afterEach()`**:
    *   **Crucially**, it iterates through all `activeRunIds` and calls `store.endRun()` to ensure all write streams are properly closed. This is vital before attempting to delete the temporary directory.
    *   Includes a `setTimeout` (e.g., `80ms`) to allow Node.js write streams time to flush their buffers and close the underlying file handles. Without this, `fs.rmSync` might fail due to open files.
    *   Calls `cleanDir(tmpDir)` to remove all test-generated files and directories.
    *   Resets the internal `_instance` property of the `RunStore` singleton to `null`, ensuring that `RunStore.getInstance()` returns a fresh instance for the next test block.
*   **`startRun(objective: string, meta?: Parameters<RunStore['startRun']>[1])`**: A wrapper function around `store.startRun` that also adds the newly created `runId` to the `activeRunIds` array, simplifying cleanup in `afterEach`.

### Dependencies

This test module directly depends on:
*   `fs`, `os`, `path`: Node.js built-in modules for file system operations.
*   `RunStore` (from `../../src/observability/run-store.js`): The class under test.

### How to Run Tests

Assuming `jest` or a compatible test runner is configured, these tests can typically be executed from the project root using:

```bash
npm test tests/observability/run-store.test.ts
# or
yarn test tests/observability/run-store.test.ts
```
Or, to run all tests:
```bash
npm test
```