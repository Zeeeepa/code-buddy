---
title: "tests — tasks"
module: "tests-tasks"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.033Z"
---
# tests — tasks

This document describes the `tests/tasks/background-tasks.test.ts` module, which serves as the comprehensive test suite for the core `BackgroundTaskManager` class located in `src/tasks/background-tasks.ts`.

## Module Overview

The `background-tasks.test.ts` module is a Jest test file designed to ensure the robust functionality, reliability, and persistence of the `BackgroundTaskManager`. It covers various aspects of task management, including creation, retrieval, modification (cancellation), deletion, status tracking, and data persistence.

Its primary purpose is to validate the public API and internal mechanisms of `BackgroundTaskManager`, ensuring that background tasks are handled correctly throughout their lifecycle.

## `BackgroundTaskManager` - The Module Under Test

The `BackgroundTaskManager` is a central component responsible for managing asynchronous operations (tasks) within the application. It provides a structured way to:

*   Create new tasks with various parameters (prompt, working directory, priority, model, tags, etc.).
*   Track the status of tasks (pending, running, completed, failed, cancelled).
*   Retrieve tasks individually or in collections, with filtering and pagination options.
*   Cancel and delete tasks.
*   Provide statistics on task states.
*   Persist task data to disk, allowing tasks to survive application restarts.
*   Emit events for significant task lifecycle changes (e.g., `task-created`, `task-cancelled`).

## Test Environment Setup and Teardown

The tests employ a rigorous setup and teardown process to ensure isolation and a clean state for each test run:

### `beforeEach`

1.  **Temporary Directory Creation**: A unique temporary directory is created using `fs.mkdtempSync` in the OS's temporary location (`os.tmpdir()`). This directory serves as a isolated "home" environment for the tests.
2.  **`HOME` Environment Variable Override**: `process.env.HOME` is temporarily set to this new temporary directory. This is crucial because `BackgroundTaskManager` (and potentially other modules) relies on `HOME` to determine where to store application-specific data, including task persistence files (e.g., in `.codebuddy/tasks`).
3.  **Task Directory Creation**: The specific task persistence directory (`.codebuddy/tasks`) is explicitly created within the temporary home directory, ensuring it exists before the `BackgroundTaskManager` is initialized.
4.  **Manager Initialization**: A new instance of `BackgroundTaskManager` is created with a concurrency limit (e.g., `new BackgroundTaskManager(3)`).

### `afterEach`

1.  **`HOME` Environment Variable Restoration**: The `process.env.HOME` is restored to its original value, preventing side effects on other tests or the system.
2.  **Manager Disposal**: The `taskManager.dispose()` method is called. This is important for cleaning up any resources held by the manager (e.g., file handles, event listeners).
3.  **Temporary Directory Cleanup**: The entire temporary directory created in `beforeEach` is recursively removed using `fs.rmSync`. Error handling is included to ignore potential cleanup failures.

## Key Functionalities Tested

The test suite is organized into several `describe` blocks, each focusing on a specific aspect of the `BackgroundTaskManager`'s API and behavior.

### Task Creation

*   **`createTask(prompt: string, options: TaskOptions)`**:
    *   Verifies that a new task is successfully created with a unique ID.
    *   Confirms default values are applied when options are omitted (e.g., `status: "pending"`, `priority: "normal"`).
    *   Ensures all provided `TaskOptions` (priority, model, maxToolRounds, tags) are correctly assigned to the created task.
    *   Validates that the `task-created` event is emitted with the correct task data.
    *   Tests handling of empty, special character, and Unicode prompts.

### Task Retrieval

*   **`getTask(id: string)`**:
    *   Confirms that a task can be retrieved by its unique ID.
    *   Verifies that `undefined` is returned for non-existent task IDs.
*   **`getTasks(filter?: TaskFilterOptions)`**:
    *   Ensures all created tasks can be retrieved.
    *   Tests filtering tasks by `status` (e.g., `pending`, `running`).
    *   Validates the `limit` option correctly restricts the number of returned tasks.

### Task Cancellation

*   **`cancelTask(id: string)`**:
    *   Verifies that a pending task can be successfully cancelled, changing its status to `"cancelled"`.
    *   Confirms `false` is returned for attempts to cancel non-existent tasks.
    *   Ensures the `task-cancelled` event is emitted upon successful cancellation.

### Task Deletion

*   **`deleteTask(id: string)`**:
    *   Confirms that a task can be successfully deleted from the manager.
    *   Verifies that `false` is returned for attempts to delete non-existent tasks.

### Task Statistics

*   **`getStats()`**:
    *   Ensures the method returns an object containing `total`, `pending`, `running`, `completed`, and `failed` task counts.
    *   Validates that these counts accurately reflect the current state of tasks.

### Task Persistence

*   The tests implicitly validate the persistence mechanism:
    *   **Persistence to Disk**: A task created by one `BackgroundTaskManager` instance is expected to be saved to disk.
    *   **Loading on Initialization**: A *new* `BackgroundTaskManager` instance, when initialized in the same `HOME` directory, is expected to load previously persisted tasks, demonstrating that tasks survive manager restarts.

### Clear Completed

*   **`clearCompleted()`**:
    *   Tests the ability to remove tasks that have reached a "completed" status.
    *   Verifies that the method returns the number of tasks cleared.

### Task Formatting

*   **`formatTask(task: Task)`**:
    *   Ensures a single task can be formatted into a human-readable string.
*   **`formatTasksList(filter?: TaskFilterOptions)`**:
    *   Verifies that a list of tasks can be formatted into a comprehensive string representation, useful for display in a CLI or UI.

## Module Relationships

The `background-tasks.test.ts` module directly interacts with the `BackgroundTaskManager` class. It also leverages standard Node.js modules for file system operations (`fs`), path manipulation (`path`), and operating system utilities (`os`) to manage the test environment.

```mermaid
graph TD
    A[background-tasks.test.ts] -->|Tests & Instantiates| B[BackgroundTaskManager (src/tasks/background-tasks.ts)]
    A -->|Uses| C[fs]
    A -->|Uses| D[path]
    A -->|Uses| E[os]
    B -->|Persists data to| F[Filesystem (.codebuddy/tasks)]
    B -->|Emits| G[Task Events]
```