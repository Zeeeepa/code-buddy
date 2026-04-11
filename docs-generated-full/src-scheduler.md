---
title: "src — scheduler"
module: "src-scheduler"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.685Z"
---
# src — scheduler

The `src/scheduler` module provides robust and flexible mechanisms for managing and executing asynchronous operations within the application. It encapsulates two distinct scheduling systems, each tailored for different use cases:

1.  **`Scheduler`**: An in-memory, priority-based task scheduler designed for managing immediate or short-term tasks with fine-grained control over concurrency, dependencies, and retries.
2.  **`CronScheduler`**: A persistent, event-driven job scheduler capable of handling long-running, recurring tasks defined by `at`, `every`, or standard cron expressions, with built-in persistence and error handling.

This module is crucial for automating background processes, managing user-defined scheduled actions, and ensuring efficient resource utilization for various asynchronous workloads.

---

## 1. Core Concepts

Before diving into the specifics of each scheduler, it's helpful to understand some common terminology:

*   **Task**: A single, often short-lived, unit of work managed by the `Scheduler`. Tasks are typically defined by a handler function and are processed based on priority and availability.
*   **Job**: A potentially long-running, recurring, or one-shot operation managed by the `CronScheduler`. Jobs are persistent, meaning their definitions and state survive application restarts.
*   **Schedule Types**:
    *   **`at`**: A one-shot schedule to execute a task/job at a specific ISO 8601 timestamp.
    *   **`every`**: A recurring schedule to execute a task/job at fixed millisecond intervals.
    *   **`cron`**: A recurring schedule based on a 5-field cron expression (minute, hour, day of month, month, day of week), often with an optional IANA timezone.

---

## 2. `Scheduler` (In-Memory Task Scheduler)

The `Scheduler` class (`src/scheduler/scheduler.ts`) provides a powerful, in-memory task management system. It's ideal for orchestrating internal application logic where tasks need to be prioritized, executed concurrently, or depend on the completion of other tasks.

### 2.1. Purpose and Use Cases

The `Scheduler` is designed for:

*   **Prioritized Workloads**: Ensuring high-priority tasks are executed before lower-priority ones.
*   **Concurrency Control**: Limiting the number of tasks running simultaneously to prevent resource exhaustion.
*   **Dependency Management**: Executing tasks only after their prerequisites are met.
*   **Scheduled Execution**: Running tasks at a specific future time or after a delay.
*   **Retry Mechanisms**: Automatically retrying failed tasks with configurable limits.
*   **Preventing Starvation**: Using priority aging to ensure long-waiting tasks eventually get processed.

Since it's an in-memory scheduler, tasks are not persisted across application restarts.

### 2.2. Key Features

*   **Priority Queue**: Tasks are processed based on their `TaskPriority` (1 = highest, 5 = lowest).
*   **Priority Aging**: The `applyPriorityAging()` mechanism periodically increases the priority of long-waiting tasks to prevent starvation.
*   **Concurrency Limits**: Configurable `maxConcurrent` tasks can run simultaneously.
*   **Scheduled Execution**: Tasks can be scheduled using `scheduledAt` (absolute time) or `scheduleAfter` (relative delay).
*   **Dependencies**: Tasks can declare dependencies on other tasks by ID, ensuring sequential execution.
*   **Retries with Backoff**: Tasks can be configured with `maxRetries` and will be re-queued on failure.
*   **Timeouts**: Tasks can have an execution `timeout` to prevent indefinite blocking.
*   **Lifecycle Events**: Emits events for task creation, start, completion, failure, retry, cancellation, etc.

### 2.3. Architecture and Execution Flow

The `Scheduler` operates on a periodic "tick" mechanism.

1.  **Initialization**: When `start()` is called, it sets up a `tickTimer` and an optional `agingTimer`.
2.  **Tick Cycle (`tick()`):**
    *   Periodically (controlled by `config.tickInterval`), the `tick()` method is invoked.
    *   It checks the `getRunningCount()` against `config.maxConcurrent` to determine available execution slots.
    *   If slots are available, it repeatedly calls `getNextTask()` to find tasks ready for execution.
    *   `getNextTask()` prioritizes tasks:
        *   First, it looks for `scheduled` tasks whose `scheduledAt` time has passed and whose `dependencies` are satisfied.
        *   Then, it looks for `pending` tasks whose `dependencies` are satisfied, sorted by `priority` and `createdAt`.
    *   Found tasks are then passed to `executeTask()`.
3.  **Task Execution (`executeTask()`):**
    *   Sets the task's status to `'running'`.
    *   Executes the task's `handler()` function, wrapped with a `timeout` mechanism.
    *   On success, updates the task's status to `'completed'`, records `result`, and emits `task:completed`.
    *   On failure, if `task.retries < task.maxRetries`, it increments `retries`, sets status back to `'pending'`, and emits `task:retry`. Otherwise, it sets status to `'failed'` and emits `task:failed`.
4.  **Priority Aging (`applyPriorityAging()`):**
    *   If `config.enablePriorityAging` is true, the `agingTimer` periodically calls `applyPriorityAging()`.
    *   This function iterates through `pending` and `scheduled` tasks, calculating an `agingFactor` based on how long the task has been waiting.
    *   It then lowers the task's `priority` number (making it higher priority) to ensure it eventually gets picked up.

```mermaid
graph TD
    A[Scheduler.start()] --> B(tickTimer interval)
    B --> C{Scheduler.tick()}
    C --> D{getRunningCount() < maxConcurrent?}
    D -- Yes --> E{getNextTask()}
    E -- Task found --> F[executeTask(task)]
    F --> G{Task handler execution}
    G -- Success --> H[task:completed]
    G -- Failure --> I[task:retry / task:failed]
    H --> J[Update task status]
    I --> J
    E -- No task --> C
    D -- No --> C
    B --> K(agingTimer interval)
    K --> L[applyPriorityAging()]
```

### 2.4. API Overview

The `Scheduler` class exposes a comprehensive API for task management:

*   **`createTask(handler: () => Promise<unknown> | unknown, options?: CreateTaskOptions): ScheduledTask`**: Creates and adds a new task.
*   **`addTask(task: ScheduledTask): void`**: Adds an already constructed task.
*   **`getTask(taskId: string): ScheduledTask | undefined`**: Retrieves a task by ID.
*   **`getAllTasks(): ScheduledTask[]`**: Returns all tasks.
*   **`getTasksByStatus(status: ScheduledTaskStatus): ScheduledTask[]`**: Filters tasks by status.
*   **`getTasksByTag(tag: string): ScheduledTask[]`**: Filters tasks by associated tags.
*   **`updatePriority(taskId: string, priority: TaskPriority): boolean`**: Changes a task's priority.
*   **`start(): void`**: Starts the scheduler's processing loop.
*   **`stop(): void`**: Halts the scheduler's processing.
*   **`isRunning(): boolean`**: Checks if the scheduler is active.
*   **`cancelTask(taskId: string): boolean`**: Marks a task as cancelled.
*   **`pauseTask(taskId: string): boolean`**: Pauses a pending or scheduled task.
*   **`resumeTask(taskId: string): boolean`**: Resumes a paused task.
*   **`removeTask(taskId: string): boolean`**: Deletes a task (cannot remove running tasks).
*   **`clearFinished(): number`**: Removes all completed, failed, or cancelled tasks.
*   **`getStats(): SchedulerStats`**: Provides statistics on task counts, average wait/execution times, and throughput.
*   **`getConfig(): SchedulerConfig`**: Returns the current configuration.
*   **`updateConfig(config: Partial<SchedulerConfig>): void`**: Updates scheduler configuration (stops and restarts if running).
*   **`scheduleAt(handler, scheduledAt, options)`**: Schedules a task for a specific `Date`.
*   **`scheduleAfter(handler, delayMs, options)`**: Schedules a task after a given delay.
*   **`waitForAll(timeoutMs?: number): Promise<void>`**: Waits for all active tasks to complete.
*   **`waitForTask(taskId: string, timeoutMs?: number): Promise<TaskExecutionResult>`**: Waits for a specific task to complete.
*   **`dispose(): void`**: Stops the scheduler and clears all tasks and listeners.

### 2.5. Configuration (`SchedulerConfig`)

The `Scheduler` is configured via the `SchedulerConfig` interface, with `DEFAULT_SCHEDULER_CONFIG` providing sensible defaults:

```typescript
export interface SchedulerConfig {
  maxConcurrent: number; // Max tasks running simultaneously
  defaultPriority: TaskPriority;
  defaultTimeout: number; // Default task timeout in ms
  defaultMaxRetries: number;
  tickInterval: number; // How often the scheduler checks for new tasks in ms
  enablePriorityAging: boolean;
  agingRate: number; // How much priority increases per aging interval
  agingInterval: number; // How often priority aging is applied in ms
}
```

### 2.6. Events (`EventEmitter`)

The `Scheduler` extends `EventEmitter` and emits various events throughout the task lifecycle, allowing external components to react to task state changes:

*   `task:created`, `task:added`, `task:priority-changed`, `task:priority-aged`
*   `task:started`, `task:completed`, `task:retry`, `task:failed`
*   `task:cancelled`, `task:paused`, `task:resumed`, `task:removed`
*   `scheduler:started`, `scheduler:stopped`, `config:updated`, `error`

---

## 3. `CronScheduler` (Persistent Job Scheduler)

The `CronScheduler` class (`src/scheduler/cron-scheduler.ts`) provides a robust, persistent, and event-driven system for managing scheduled jobs. It's Advanced enterprise architecture for scheduling system and is designed for long-running, recurring operations that need to survive application restarts.

### 3.1. Purpose and Use Cases

The `CronScheduler` is designed for:

*   **Persistent Scheduled Automation**: Jobs are saved to disk and reloaded on startup, ensuring continuity.
*   **Recurring Tasks**: Executing tasks at fixed intervals (`every`) or complex cron schedules (`cron`).
*   **One-Shot Future Tasks**: Running a task once at a specific future time (`at`).
*   **Background Operations**: Ideal for tasks like data synchronization, report generation, system maintenance, or triggering AI agents/tools at specific times.
*   **Error Resilience**: Includes exponential backoff for failed jobs to prevent overwhelming external services.

### 3.2. Key Features

*   **Persistence**: Job definitions are saved to a JSON file (`jobs.json`) and reloaded automatically.
*   **Flexible Scheduling**: Supports `at` (ISO 8601), `every` (milliseconds), and 5-field `cron` expressions with timezone support.
*   **Run History**: Stores a history of job runs in JSONL files, with configurable limits per job.
*   **Exponential Backoff**: On job execution errors, the scheduler applies an exponential backoff strategy before retrying, preventing rapid-fire failures.
*   **Staggering**: Optional `staggerMs` can be added to scheduled times to spread load for concurrent jobs.
*   **Task Execution Delegation**: The actual work of a job is delegated to an external `taskExecutor` function, allowing the scheduler to remain decoupled from business logic.
*   **Session Targeting**: Jobs can be configured to run within the 'current' session, a 'new' session, or a specific session ID.

### 3.3. Architecture and Execution Flow

The `CronScheduler` manages jobs through a combination of file persistence, internal timers, and a periodic tick.

1.  **Initialization (`constructor`, `start()`):**
    *   The `CronScheduler` is initialized with a `CronSchedulerConfig` (or uses `DEFAULT_CRON_SCHEDULER_CONFIG`).
    *   `start()` ensures persistence and history directories exist.
    *   It calls `loadJobs()` to retrieve previously saved jobs from `jobs.json`.
    *   For all `enabled` and `active` jobs, it calls `scheduleJob()`.
    *   A `tickTimer` is started to periodically call `tick()`.
2.  **Job Management (`addJob`, `updateJob`, `removeJob`):**
    *   When a job is added or updated, its `nextRunAt` is calculated using `calculateNextRun()`.
    *   The job's state is immediately persisted to disk via `persistJobs()`.
    *   If the scheduler is running, `scheduleJob()` is called to set up its next execution.
3.  **Scheduling (`scheduleJob`, `calculateNextRun`):**
    *   `scheduleJob(job)` cancels any existing timer for the job.
    *   It determines the `nextRunAt` using `calculateNextRun()`.
    *   For `at` and `every` type jobs, it sets a `setTimeout` to trigger `executeJob()` directly.
    *   For `cron` type jobs, it relies on the main `tick()` loop to detect when they are due.
    *   An optional `staggerMs` adds random jitter to the delay.
    *   `calculateNextRun(job)` uses the job's `type` and `schedule` properties:
        *   `at`: Parses `schedule.at` (ISO 8601).
        *   `every`: Calculates `lastRunAt + schedule.every`.
        *   `cron`: Uses `parseCronExpression()` and `getNextCronTime()` to find the next matching date.
4.  **Tick Cycle (`tick()`):**
    *   Periodically (controlled by `config.tickIntervalMs`), `tick()` is invoked.
    *   It iterates through all `cron` type jobs.
    *   If a `cron` job is `enabled`, `active`, and its `nextRunAt` is in the past or present, `executeJob()` is called.
5.  **Job Execution (`executeJob()`):**
    *   A `JobRun` record is created and `job:run:start` is emitted.
    *   The core logic is delegated to the `this.taskExecutor(job)` function, which must be set externally.
    *   **On Success**:
        *   `JobRun` status is set to `'success'`.
        *   `job.runCount` is incremented, `job.lastRunAt` is updated.
        *   `job.backoffLevel` is reset.
        *   If `job.maxRuns` is reached, `job.status` becomes `'completed'` and `enabled` is set to `false`.
        *   `job.nextRunAt` is recalculated.
        *   `job:run:complete` is emitted.
    *   **On Error**:
        *   `JobRun` status is set to `'error'`, `job.errorCount` is incremented, `job.lastError` is updated.
        *   `job.backoffLevel` is incremented (capped by `BACKOFF_DELAYS_MS` length).
        *   `job.nextRetryAt` and `job.nextRunAt` are set based on the exponential backoff delay.
        *   `job:run:error` is emitted.
    *   Finally, `saveRunHistory()` is called, and `persistJobs()` updates the job's state on disk.
6.  **Persistence (`loadJobs`, `persistJobs`, `saveRunHistory`, `pruneRunHistory`):**
    *   `loadJobs()` reads `jobs.json` on startup, parsing dates correctly.
    *   `persistJobs()` writes the current state of all jobs to `jobs.json`.
    *   `saveRunHistory()` appends `JobRun` records to a job-specific JSONL file (`<jobId>.jsonl`) in the `historyPath`.
    *   `pruneRunHistory()` ensures that history files do not exceed `maxHistoryPerJob` entries.

```mermaid
graph TD
    A[CronScheduler.start()] --> B(Load Jobs from Disk)
    B --> C(Schedule all active jobs)
    C --> D(tickTimer interval)
    D --> E{CronScheduler.tick()}
    E --> F{For each job in jobs:}
    F --> G{Is job due? (nextRunAt <= now)}
    G -- Yes --> H[executeJob(job)]
    H --> I(Update job state, persist, save history)
    I --> J{Calculate nextRunAt}
    J --> F
    G -- No --> F
    H -- Error --> K[Apply backoff, update nextRetryAt]
    K --> I
```

### 3.4. API Overview

The `CronScheduler` class provides methods for managing jobs and their lifecycle:

*   **`setTaskExecutor(executor: (job: CronJob) => Promise<unknown>): void`**: **Crucial** for defining the actual work a job performs. This function is called by `executeJob()`.
*   **`start(taskExecutor?: (job: CronJob) => Promise<unknown>): Promise<void>`**: Starts the scheduler, loads jobs, and begins processing.
*   **`stop(): Promise<void>`**: Halts the scheduler and persists current job states.
*   **`addJob(params: { ... }): Promise<CronJob>`**: Creates and adds a new job.
*   **`updateJob(jobId: string, updates: Partial<CronJob>): Promise<CronJob | null>`**: Modifies an existing job.
*   **`removeJob(jobId: string): Promise<boolean>`**: Deletes a job and its associated timer.
*   **`getJob(jobId: string): CronJob | undefined`**: Retrieves a job by ID.
*   **`listJobs(params?: { status?, type?, enabled? }): CronJob[]`**: Lists jobs, optionally filtered by status, type, or enabled state.
*   **`pauseJob(jobId: string): Promise<boolean>`**: Pauses a job, disabling its execution.
*   **`resumeJob(jobId: string): Promise<boolean>`**: Resumes a paused job.
*   **`runJobNow(jobId: string): Promise<JobRun | null>`**: Executes a job immediately, bypassing its schedule.
*   **`getRunHistory(jobId: string, limit?: number): Promise<JobRun[]>`**: Retrieves the execution history for a specific job.
*   **`getStats(): { totalJobs, activeJobs, pausedJobs, completedJobs, byType }`**: Provides statistics on job counts.

### 3.5. Configuration (`CronSchedulerConfig`)

The `CronScheduler` is configured via the `CronSchedulerConfig` interface, with `DEFAULT_CRON_SCHEDULER_CONFIG` providing sensible defaults:

```typescript
export interface CronSchedulerConfig {
  persistPath: string; // Path to jobs.json
  historyPath: string; // Directory for job run history files
  maxHistoryPerJob: number; // Max entries in a job's history file
  tickIntervalMs: number; // How often the scheduler checks for due cron jobs
  defaultTimezone: string; // Default IANA timezone for cron expressions
}
```

### 3.6. Events (`EventEmitter`)

The `CronScheduler` extends `EventEmitter` and emits events related to job lifecycle and execution:

*   `job:created`, `job:updated`, `job:deleted`
*   `job:run:start`, `job:run:complete`, `job:run:error`
*   `error` (for internal scheduler errors, e.g., persistence issues)

### 3.7. Cron Parser

The `cron-scheduler.ts` file includes internal functions (`parseCronExpression`, `parseField`, `getNextCronTime`) to handle 5-field cron expressions. These functions parse the cron string into a structured `CronFields` object and then calculate the next matching date and time.

---

## 4. Singleton Access

Both `Scheduler` and `CronScheduler` provide singleton access patterns to ensure a single, globally managed instance of each scheduler type. This is crucial for maintaining consistent state across the application.

*   **`getScheduler(): Scheduler`**: Returns the singleton `Scheduler` instance, creating it with default configuration if it doesn't already exist.
*   **`createScheduler(config?: Partial<SchedulerConfig>): Scheduler`**: Creates and returns a new `Scheduler` instance, replacing any existing singleton. Use this if you need to initialize with specific configuration.
*   **`resetScheduler(): void`**: Stops and disposes of the current `Scheduler` singleton, setting the internal reference to `null`. This is useful for testing or application shutdown.
*   **`getCronScheduler(config?: Partial<CronSchedulerConfig>): CronScheduler`**: Returns the singleton `CronScheduler` instance, creating it with default or provided configuration if it doesn't exist.
*   **`resetCronScheduler(): Promise<void>`**: Stops the current `CronScheduler` singleton, persists its state, and sets the internal reference to `null`.

---

## 5. Types (`src/scheduler/types.ts`)

The `src/scheduler/types.ts` file defines common interfaces and types used by the `Scheduler` class, ensuring type safety and clarity:

*   **`ScheduledTaskStatus`**: Union type for task states (`'pending'`, `'scheduled'`, `'running'`, `'completed'`, `'failed'`, `'cancelled'`, `'paused'`).
*   **`TaskPriority`**: Numeric priority levels (1 = highest, 5 = lowest).
*   **`ScheduledTask`**: Interface defining the structure of a task managed by `Scheduler`.
*   **`CreateTaskOptions`**: Options for creating a new task.
*   **`SchedulerConfig`**: Configuration interface for the `Scheduler`.
*   **`SchedulerStats`**: Interface for scheduler statistics.
*   **`TaskExecutionResult`**: Result object returned after task execution.
*   **`DEFAULT_SCHEDULER_CONFIG`**: Default configuration values for `Scheduler`.

The `src/scheduler/cron-scheduler.ts` file defines its own specific types for `CronJob`, `JobRun`, `CronSchedulerConfig`, and `CronSchedulerEvents`.

---

## 6. Connections to the Rest of the Codebase

### `CronScheduler` Integrations:

*   **`src/server/index.ts` (`createApp`)**: The main application server likely initializes the `CronScheduler` using `getCronScheduler()`. It then exposes API endpoints for managing jobs (e.g., `listJobs`, `runJobNow`, `getStats`) to external clients.
*   **`commands/cli/daemon-commands.ts` (`registerDaemonCommands`)**: This is a critical integration point. The CLI daemon sets the `taskExecutor` for the `CronScheduler`. This executor function defines *how* a scheduled `CronJob` interacts with the core application logic, such as invoking agents, running tools, or sending messages. This decouples the scheduling mechanism from the actual business logic execution.
*   **Node.js Built-ins**: Leverages `fs/promises` for persistence, `path` for file system operations, `os` for `homedir`, and `crypto` for generating unique IDs.

### `Scheduler` Integrations:

*   While the provided call graph primarily shows `scheduler.test.ts` interacting with the `Scheduler`, its general-purpose nature suggests it's intended for broader internal use. Other modules would use `createTask()`, `scheduleAt()`, or `scheduleAfter()` to manage their internal asynchronous operations, benefiting from its priority, concurrency, and dependency features. It acts as a foundational utility for managing complex internal workflows.