---
title: "src — concurrency"
module: "src-concurrency"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.415Z"
---
# src — concurrency

The `src/concurrency` module provides essential utilities for managing asynchronous operations, ensuring order, preventing race conditions, and applying backpressure in multi-session or multi-channel environments. It offers two distinct, yet complementary, concurrency control systems:

1.  **Session Lanes (`SessionLane`, `LaneManager`)**: A simpler, session-based queueing system primarily focused on ensuring strict sequential processing of operations for a given session.
2.  **Lane Queue (`LaneQueue`)**: An "Enterprise-grade" system that implements a "Default Serial, Explicit Parallel" pattern, offering more granular control over task execution within a session, including explicit parallel execution, retries, and timeouts.

This documentation will detail each system, its purpose, how it works, and how to use it effectively.

---

## 1. Session Lanes (FIFO/Priority Queues per Session)

The `SessionLane` and `LaneManager` system is designed to prevent message interleaving and ensure that operations related to a specific session are processed in a defined order (FIFO or by priority). This is crucial for maintaining state consistency when multiple requests for the same session might be in flight simultaneously.

### 1.1 Core Concepts

*   **`SessionLane<T>`**: Represents a single processing queue for a specific session. It holds `LaneItem`s and processes them one by one using a registered `processor` function.
*   **`LaneItem<T>`**: The unit of work enqueued into a `SessionLane`. It contains the `payload` (the actual message/request), a unique `id`, `enqueuedAt` timestamp, `priority`, and optional `metadata`.
*   **`LaneManager<T>`**: A central registry that manages multiple `SessionLane` instances. It acts as a factory for lanes, ensuring that each session ID maps to a unique `SessionLane`.

### 1.2 How it Works

1.  **Lane Creation**: When an operation needs to be processed for a `sessionId`, `LaneManager.getLane(sessionId)` is called. If a lane for that session doesn't exist, a new `SessionLane` is created and registered.
2.  **Processor Assignment**: A `processor` function (an `async` function that takes a `LaneItem` and returns a `Promise`) must be set for the `SessionLane`. This function defines *how* each item in the lane will be processed. The `LaneManager` can also set a `defaultProcessor` for all new lanes.
3.  **Enqueueing**: `SessionLane.enqueue(payload, options)` adds a new `LaneItem` to the lane's internal queue. Items are ordered either strictly FIFO (`config.fifo: true`) or by `priority` (lower number = higher priority).
4.  **Processing Loop**:
    *   When an item is enqueued, if `config.autoStart` is true and the lane is `idle`, `SessionLane.startProcessing()` is called.
    *   `SessionLane.processQueue()` continuously shifts items from the queue and executes the registered `processor` for each.
    *   Processing occurs sequentially: one item completes before the next begins.
    *   A `processingTimeoutMs` can be configured to prevent long-running tasks from blocking the lane indefinitely.
5.  **Status and Events**: `SessionLane` emits events (`enqueue`, `start`, `complete`, `error`, `drain`, `pause`, `resume`) to signal lifecycle changes of items and the lane itself. It also exposes its `status` (`idle`, `processing`, `paused`, `draining`) and queue length.

#### Simplified Architecture

```mermaid
graph TD
    A[LaneManager] --> B{SessionLane (sessionId)};
    B -- Manages --> C[Queue: LaneItem<T>];
    C -- Processes --> D[Processor: (item: LaneItem<T>) => Promise<unknown>];
    D -- Emits Events --> B;
```

### 1.3 Key Components & Usage

#### `SessionLane<T>` Class

*   **`constructor(config?: Partial<LaneConfig>)`**: Initializes a lane with optional configuration.
*   **`setProcessor(processor: (item: LaneItem<T>) => Promise<unknown>)`**: Defines the asynchronous function that will process each `LaneItem`. This is mandatory for the lane to function.
*   **`enqueue(payload: T, options?: { priority?: number; metadata?: Record<string, unknown> })`**: Adds a payload to the lane's queue. Returns the created `LaneItem`.
*   **`startProcessing()`**: Manually starts the processing loop if `autoStart` is false or the lane is paused.
*   **`pause()` / `resume()`**: Controls the processing flow of the lane.
*   **`drain()`**: Asynchronously waits for all currently pending items to be processed.
*   **`clear()`**: Removes all pending items from the queue.
*   **`getStatus()` / `getQueueLength()` / `getCurrentItem()` / `getStats()`**: Provide insights into the lane's current state.

#### `LaneManager<T>` Class

*   **`constructor(config?: Partial<LaneConfig>)`**: Initializes the manager with default lane configuration.
*   **`setDefaultProcessor(processor: (item: LaneItem<T>) => Promise<unknown>)`**: Sets a processor that will be automatically assigned to any new `SessionLane` created by this manager.
*   **`getLane(sessionId: string)`**: Retrieves or creates a `SessionLane` for the given `sessionId`.
*   **`enqueue(sessionId: string, payload: T, options?: ...)`**: A convenience method to enqueue a payload directly to a session's lane via the manager.
*   **`removeLane(sessionId: string)`**: Removes a lane and clears its pending items.
*   **`pauseAll()` / `resumeAll()` / `drainAll()` / `clearAll()`**: Global operations across all managed lanes.
*   **`getStats()`**: Provides aggregated statistics across all lanes.

#### Singleton Access

*   **`getLaneManager<T>(config?: Partial<LaneConfig>)`**: Provides access to a global singleton `LaneManager` instance. This is the recommended way to interact with the manager across your application.
*   **`resetLaneManager()`**: Clears all lanes from the singleton manager and resets the instance. Useful for testing or application shutdown.

#### Convenience Functions

*   **`withLane<T, R>(sessionId: string, payload: T, processor: (payload: T) => Promise<R>, config?: Partial<LaneConfig>)`**: A high-level function to execute a single `processor` function for a `payload` within a specific `sessionId`'s lane. It handles setting up the processor and enqueueing the item, returning a `Promise` that resolves with the processor's result.
*   **`createLanedFunction<T, R>(getSessionId: (payload: T) => string, processor: (payload: T) => Promise<R>, config?: Partial<LaneConfig>)`**: Creates a reusable async function that automatically enqueues its calls into the appropriate session lane. The `getSessionId` function determines which lane to use based on the input `payload`. This is ideal for wrapping existing functions that need lane-ordered execution.

### 1.4 Example Usage

```typescript
import { getLaneManager, createLanedFunction } from './concurrency/lanes.js';

interface UserAction {
  userId: string;
  action: string;
  data: any;
}

// 1. Using LaneManager directly
const manager = getLaneManager<UserAction>();
manager.setDefaultProcessor(async (item) => {
  console.log(`[${item.id}] Processing action for user ${item.payload.userId}: ${item.payload.action}`);
  await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async work
  return `Processed: ${item.payload.action}`;
});

manager.enqueue('user-123', { userId: 'user-123', action: 'updateProfile', data: { name: 'Alice' } });
manager.enqueue('user-456', { userId: 'user-456', action: 'fetchData', data: {} });
manager.enqueue('user-123', { userId: 'user-123', action: 'sendNotification', data: { message: 'Welcome!' } });
// Operations for user-123 will be processed in order.

// 2. Using createLanedFunction for a reusable API
const processUserAction = createLanedFunction<UserAction, string>(
  (payload) => payload.userId, // How to get the session ID from the payload
  async (payload) => {
    console.log(`[LanedFn] Processing action for user ${payload.userId}: ${payload.action}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    return `Completed: ${payload.action}`;
  }
);

async function runLanedFunctionExample() {
  const p1 = processUserAction({ userId: 'user-789', action: 'login', data: {} });
  const p2 = processUserAction({ userId: 'user-101', action: 'viewPage', data: { page: '/home' } });
  const p3 = processUserAction({ userId: 'user-789', action: 'logout', data: {} });

  await Promise.all([p1, p2, p3]);
  console.log('All laned functions completed.');
}

runLanedFunctionExample();
```

---

## 2. Lane Queue (Default Serial, Explicit Parallel)

The `LaneQueue` system provides a more sophisticated concurrency model, Advanced enterprise architecture for "Default Serial, Explicit Parallel" pattern. This means that tasks within a session's lane execute serially by default, but can be explicitly marked as `parallel` if they are safe to run concurrently with other parallel tasks in the same lane. This is ideal for scenarios where some operations (e.g., writes, state modifications) must be strictly ordered, while others (e.g., reads, idempotent operations) can benefit from parallel execution.

### 2.1 Core Concepts

*   **`LaneQueue`**: The central manager for all session lanes. It orchestrates task distribution and execution.
*   **`Lane`**: Represents a session's execution context. Each `Lane` maintains separate `pending` and `running` task queues.
*   **`Task<T>`**: The unit of work. Each task encapsulates an `async` function (`fn`), `TaskOptions` (e.g., `parallel`, `priority`, `timeout`, `retries`), and its current `status`.
*   **"Default Serial, Explicit Parallel"**:
    *   **Serial Tasks**: If `options.parallel` is `false` (default), a task will only start if *no other tasks* (serial or parallel) are currently running in its lane. This ensures strict ordering for state-modifying operations.
    *   **Parallel Tasks**: If `options.parallel` is `true`, a task can run concurrently with other parallel tasks, up to a `maxParallel` limit defined in the `LaneQueueConfig`. However, a serial task will still block all parallel tasks from starting if it's currently running.

### 2.2 How it Works

1.  **Enqueueing**: `LaneQueue.enqueue(laneId, fn, options)` creates a `Task` object and adds it to the `pending` queue of the specified `laneId`. Tasks are sorted by `priority` (higher value = higher priority).
2.  **Lane Processing (`processLane`)**:
    *   Each `Lane` has an asynchronous `processLane` loop that runs when tasks are enqueued or completed.
    *   It checks if the lane is `paused` or already `processing`.
    *   It calls `getNextTasks` to determine which tasks from the `pending` queue can be moved to `running`.
3.  **Task Selection (`getNextTasks`)**: This is the core logic for "Default Serial, Explicit Parallel":
    *   If there are any tasks currently `running` in the lane, no new *serial* tasks can start.
    *   If there are no `running` tasks, the highest priority *serial* task can start. If a serial task starts, no other tasks (serial or parallel) can start until it completes.
    *   *Parallel* tasks can start if the `maxParallel` limit for the lane has not been reached, and no *serial* task is currently running.
4.  **Task Execution (`executeTask`)**:
    *   A task is moved from `pending` to `running`.
    *   It's executed using `executeWithTimeout` to enforce the configured `timeout`.
    *   If the task fails and `options.idempotent` is true and `retries` are available, it will be retried after a `retryDelay`.
    *   Upon completion (success or final failure), the task is removed from `running`, and `processLane` is called again to continue processing.
5.  **Events and Stats**: `LaneQueue` emits events (`task:enqueued`, `task:started`, `task:completed`, `task:failed`, `task:cancelled`, `lane:created`, `lane:paused`, `lane:resumed`, `lane:drained`) for detailed monitoring. It also maintains `LaneStats` for each lane and global statistics.

#### Simplified Architecture

```mermaid
graph TD
    A[LaneQueue] --> B{Lane (laneId)};
    B -- Enqueues --> C[Pending Tasks (sorted by priority)];
    B -- Runs --> D[Running Tasks];
    C -- getNextTasks --> D;
    D -- executeTask --> E[Task fn() with timeout/retries];
    E -- Emits Events --> A;
```

### 2.3 Key Components & Usage

#### `LaneQueue` Class

*   **`constructor(config?: Partial<LaneQueueConfig>)`**: Initializes the queue with optional configuration, including `maxParallel`, `defaultTimeout`, `defaultRetries`, etc.
*   **`enqueue<T>(laneId: string, fn: () => Promise<T>, options?: TaskOptions)`**: The primary method to add a task. `fn` is the asynchronous function to execute. `options` allow specifying `parallel`, `priority`, `timeout`, `idempotent`, `retries`, etc. Returns a `Promise` that resolves with the task's result.
*   **`pause(laneId: string)` / `resume(laneId: string)`**: Controls the processing flow for a specific lane.
*   **`cancelPending(laneId: string)`**: Rejects and removes all tasks currently in the `pending` queue for a lane.
*   **`getLane(laneId: string)` / `listLanes()`**: Retrieve lane information.
*   **`getStats(laneId: string)` / `getGlobalStats()`**: Access performance and status statistics.
*   **`removeLane(laneId: string)`**: Removes a lane and cancels its pending tasks.
*   **`clear()`**: Clears all lanes and their pending tasks.
*   **`formatStatus()`**: Returns a human-readable string of the current queue status.

#### Singleton Access

*   **`getLaneQueue(config?: Partial<LaneQueueConfig>)`**: Provides access to a global singleton `LaneQueue` instance.
*   **`resetLaneQueue()`**: Clears all lanes from the singleton queue and resets the instance.

### 2.4 Example Usage

```typescript
import { getLaneQueue } from './concurrency/lane-queue.js';

const queue = getLaneQueue({ maxParallel: 2 }); // Allow up to 2 parallel tasks per lane

async function runLaneQueueExample() {
  console.log('--- LaneQueue Example ---');

  // Serial task (default) - will block other tasks in 'session-A'
  const serialTask = queue.enqueue('session-A', async () => {
    console.log('[session-A] Serial task START');
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('[session-A] Serial task END');
    return 'Serial Done';
  });

  // Parallel tasks - will run concurrently if no serial task is active
  const parallelTask1 = queue.enqueue('session-A', async () => {
    console.log('[session-A] Parallel 1 START');
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('[session-A] Parallel 1 END');
    return 'Parallel 1 Done';
  }, { parallel: true });

  const parallelTask2 = queue.enqueue('session-A', async () => {
    console.log('[session-A] Parallel 2 START');
    await new Promise(resolve => setTimeout(resolve, 150));
    console.log('[session-A] Parallel 2 END');
    return 'Parallel 2 Done';
  }, { parallel: true });

  const parallelTask3 = queue.enqueue('session-A', async () => {
    console.log('[session-A] Parallel 3 START (will wait for one of the first two to finish)');
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log('[session-A] Parallel 3 END');
    return 'Parallel 3 Done';
  }, { parallel: true });

  // Task for another session - runs independently
  const otherSessionTask = queue.enqueue('session-B', async () => {
    console.log('[session-B] Independent task START');
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('[session-B] Independent task END');
    return 'Session B Done';
  });

  try {
    const results = await Promise.all([
      serialTask,
      parallelTask1,
      parallelTask2,
      parallelTask3,
      otherSessionTask
    ]);
    console.log('All tasks completed:', results);
  } catch (error) {
    console.error('A task failed:', error);
  }

  console.log('\n' + queue.formatStatus());
}

runLaneQueueExample();
```

---

## 3. Choosing the Right Concurrency System

*   **Use `SessionLane` / `LaneManager` when:**
    *   You need a simple, strict FIFO or priority-based queue for operations related to a specific session.
    *   All operations within a session are inherently serial and modifying shared state.
    *   You primarily need to prevent message interleaving.
    *   The `withLane` or `createLanedFunction` convenience wrappers fit your use case well.

*   **Use `LaneQueue` when:**
    *   You need more fine-grained control over concurrency within a session.
    *   Some operations can safely run in parallel (e.g., read-only API calls) while others must be strictly serial (e.g., database writes).
    *   You require features like task timeouts, automatic retries for idempotent operations, or explicit priority management.
    *   You want to manage backpressure by limiting `maxParallel` tasks or `maxPending` tasks per lane.

## 4. Integration with the Codebase

Both concurrency systems are designed as foundational utilities.

*   **`LaneQueue` Integration**: The `LaneQueue` is actively used by the `src/channels/core.ts` module. Specifically, `enqueueMessage` utilizes `LaneQueue.enqueue` to manage message processing for channels, ensuring that messages within a channel are handled according to the "Default Serial, Explicit Parallel" model. This prevents race conditions and ensures message order where necessary.
    *   `src/channels/core.ts` → `getChannelLaneQueue()` → `LaneQueue`
    *   `src/channels/core.ts` → `enqueueMessage()` → `LaneQueue.enqueue()`
    *   `src/channels/core.ts` → `resetChannelLaneQueue()` → `LaneQueue.clear()`

*   **`SessionLane` / `LaneManager` Integration**: While `LaneQueue` is used for core channel messaging, the `SessionLane` system provides a more general-purpose session-based queueing mechanism. Its convenience functions (`withLane`, `createLanedFunction`) are particularly useful for wrapping business logic that needs to guarantee sequential execution for specific entities (e.g., user sessions, document IDs) without needing the explicit parallel/serial distinction of `LaneQueue`.
    *   The `onError` event of `SessionLane` is observed by various error boundary components (e.g., `components/error-boundaries/tool-error-boundary.tsx`, `ui/components/ErrorBoundary.tsx`, `components/error-boundaries/file-error-boundary.tsx`), suggesting that lane processing errors are captured and handled at the UI level.

This module serves as a robust foundation for managing complex asynchronous workflows, providing developers with the tools to build reliable and performant concurrent systems.