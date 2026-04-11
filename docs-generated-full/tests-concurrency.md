---
title: "tests — concurrency"
module: "tests-concurrency"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.844Z"
---
# tests — concurrency

This document provides an overview of the concurrency primitives tested within the `tests/concurrency` module. While this module primarily contains integration and unit tests, it serves as a comprehensive guide to understanding the design, functionality, and usage of the `LaneQueue` and `SessionLane`/`LaneManager` systems.

These concurrency modules are designed to manage asynchronous tasks, ensuring ordered execution, resource isolation, and robust error handling in complex, multi-task environments.

## Concurrency Primitives Overview

The `tests/concurrency` module validates two distinct, yet conceptually related, concurrency management systems:

1.  **`LaneQueue`**: A high-level, globally-aware queue system that manages tasks across multiple named "lanes" with a global concurrency limit. It supports priority, retries, and cancellation.
2.  **`SessionLane` and `LaneManager`**: A more granular system for managing individual task queues (`SessionLane`) and orchestrating multiple such lanes (`LaneManager`), often used for session-specific or entity-specific task ordering.

While both systems utilize the concept of "lanes" for task isolation, they address different levels of concurrency management. `LaneQueue` focuses on global resource limits and cross-lane coordination, whereas `SessionLane` and `LaneManager` prioritize strict ordering and lifecycle management within specific logical units.

---

## `LaneQueue` Module Documentation

The `LaneQueue` module (`src/concurrency/lane-queue.js`) provides a robust mechanism for managing asynchronous tasks across multiple isolated "lanes" while adhering to a global concurrency limit. It's ideal for scenarios where tasks need to be grouped logically (e.g., by user session, resource ID) but also need to share a limited pool of execution resources.

### Purpose

`LaneQueue` ensures that:
*   Tasks within different lanes can run concurrently without blocking each other, up to a global `maxParallel` limit.
*   Tasks within the *same* lane are processed in a defined order (e.g., by priority).
*   Transient failures can be automatically retried for idempotent operations.
*   Tasks can be cancelled or managed through their lifecycle.

### Key Features

*   **Multi-lane Isolation**: Tasks enqueued to different lane names (`lane-A`, `lane-B`) are treated as independent streams, allowing parallel execution across lanes.
*   **Global Concurrency Limit**: The `maxParallel` option limits the total number of tasks executing concurrently across *all* lanes.
*   **Priority Ordering**: Tasks within a single lane can be assigned a `priority` (lower number = higher priority) to influence their execution order.
*   **Retry Logic**: Idempotent tasks can be configured with `retries` and `retryDelay` to automatically handle transient errors.
*   **Cancellation**: Pending tasks within a specific lane can be cancelled, rejecting their promises.
*   **Global Statistics**: Provides aggregated statistics on total, completed, and failed tasks across all managed lanes.
*   **Timeout**: Tasks can be configured with a `defaultTimeout` to prevent indefinite hangs.

### Usage Patterns

#### Initialization

A `LaneQueue` instance is created with configuration options:

```typescript
import { LaneQueue } from '../../src/concurrency/lane-queue.js';

const queue = new LaneQueue({
  maxParallel: 2,       // Max 2 tasks running concurrently across all lanes
  defaultTimeout: 5000  // Default timeout for tasks
});
```

The `resetLaneQueue()` function is available for clearing the singleton instance, primarily used in testing.

#### Enqueuing Tasks

Tasks are enqueued to a specific `laneName` and are represented by an `async` function. Options can be provided for priority, retries, and idempotency.

```typescript
// Enqueue a task to 'lane-A'
const resultA = await queue.enqueue('lane-A', async () => {
  // Simulate async work
  await new Promise(r => setTimeout(r, 50));
  return 'Task A completed';
});

// Enqueue a higher priority task to 'priority-lane'
const resultP = await queue.enqueue('priority-lane', async () => {
  return 'High priority task';
}, { priority: 10 }); // Higher number = higher priority

// Enqueue an idempotent task with retries
let attempts = 0;
const retryResult = await queue.enqueue('retry-lane', async () => {
  attempts++;
  if (attempts < 3) {
    throw new Error('Transient failure');
  }
  return 'Success after retries';
}, { idempotent: true, retries: 3, retryDelay: 100 });
```

#### Managing Lanes

Individual lanes can be paused, resumed, or have their pending tasks cancelled.

```typescript
// Pause a specific lane
queue.pause('my-lane');

// Resume a specific lane
queue.resume('my-lane');

// Cancel all pending tasks in a lane
const cancelledCount = queue.cancelPending('my-lane'); // Returns number of tasks cancelled
```

#### Monitoring and Cleanup

Global statistics and a formatted status string are available. The queue should be cleared when no longer needed.

```typescript
// Get global statistics
const stats = queue.getGlobalStats();
console.log(`Total tasks: ${stats.totalTasks}, Completed: ${stats.completedTasks}`);

// Get a human-readable status string
const statusString = queue.formatStatus();
console.log(statusString);

// Clear all tasks and lanes
queue.clear();
```

### API Reference (from tests)

*   `new LaneQueue(options: { maxParallel?: number; defaultTimeout?: number })`: Creates a new `LaneQueue` instance.
*   `enqueue<T>(laneName: string, task: () => Promise<T>, options?: { priority?: number; idempotent?: boolean; retries?: number; retryDelay?: number }): Promise<T>`: Adds a task to the specified lane.
*   `pause(laneName: string)`: Pauses processing for a specific lane.
*   `resume(laneName: string)`: Resumes processing for a specific lane.
*   `cancelPending(laneName: string): number`: Cancels all pending tasks in a lane, returning the count of cancelled tasks.
*   `getGlobalStats(): { totalTasks: number; completedTasks: number; failedTasks: number; activeTasks: number; pendingTasks: number; cancelledTasks: number }`: Returns aggregated statistics across all lanes.
*   `formatStatus(): string`: Returns a formatted string representing the current status of all lanes.
*   `clear()`: Clears all tasks and lanes managed by this `LaneQueue` instance.
*   `resetLaneQueue()`: (Utility) Resets the internal singleton instance of `LaneQueue`.

---

## `SessionLane` and `LaneManager` Module Documentation

The `SessionLane` and `LaneManager` modules (`src/concurrency/lanes.js`) provide a more granular approach to managing task queues, particularly useful for scenarios where strict ordering and lifecycle management are required for individual "sessions" or entities.

### `SessionLane`

A `SessionLane` represents a single, independent queue of tasks. It processes items sequentially (FIFO by default, or by priority) and provides detailed control over its lifecycle and events.

#### Purpose

`SessionLane` ensures that:
*   Tasks for a specific session are processed one after another, maintaining order.
*   The state and progress of an individual session's tasks can be monitored.
*   Custom processing logic can be applied to each task.

#### Key Features

*   **FIFO or Priority Queue**: By default, tasks are processed in First-In, First-Out order. Can be configured for priority-based processing.
*   **Event Emitter**: Emits events (`enqueue`, `start`, `complete`, `drain`, `error`) for lifecycle monitoring.
*   **Custom Processor**: A `setProcessor` function defines how each enqueued item is handled.
*   **Lifecycle Control**: Can be explicitly `startProcessing()`, `pause()`, `resume()`, and `clear()` tasks.
*   **Queue Limits**: Can enforce a `maxQueueSize` to prevent unbounded growth.
*   **Current Item Tracking**: Provides access to the currently processing item.

#### Usage Patterns

#### Initialization and Processor Setup

A `SessionLane` is created, and its processing logic is defined using `setProcessor`.

```typescript
import { SessionLane } from '../../src/concurrency/lanes.js';

const lane = new SessionLane({ autoStart: false, maxQueueSize: 10 });
const results: string[] = [];

lane.setProcessor(async (item) => {
  // Simulate async work
  await new Promise(r => setTimeout(r, 10));
  results.push(item.payload as string);
});

// Listen for events
lane.on('complete', () => console.log('Task completed in lane'));
lane.on('error', (err) => console.error('Lane error:', err.message));
```

#### Enqueuing and Processing Tasks

Tasks are enqueued with a payload. If `autoStart` is false, `startProcessing()` must be called.

```typescript
lane.enqueue('task-1');
lane.enqueue('task-2', { priority: 5 }); // For priority-based lanes
lane.enqueue('task-3');

lane.startProcessing(); // Start processing if autoStart was false

await lane.drain(); // Wait for all tasks in this lane to complete
expect(results).toEqual(['task-1', 'task-2', 'task-3']); // If FIFO
```

#### Lifecycle Management

```typescript
lane.pause();
console.log(lane.getStatus()); // 'paused'

lane.resume();
console.log(lane.getStatus()); // 'active'

const clearedItems = lane.clear(); // Clears all pending items
```

### `LaneManager`

The `LaneManager` acts as a central registry and orchestrator for multiple `SessionLane` instances. It provides a singleton pattern and convenience methods for managing tasks across different lanes.

#### Purpose

`LaneManager` simplifies the management of multiple `SessionLane`s by:
*   Providing a single point of access for creating and retrieving lanes by name.
*   Allowing global operations (e.g., `pauseAll`, `drainAll`).
*   Offering a default processor for newly created lanes.
*   Ensuring a singleton instance across the application.

#### Key Features

*   **Lane Creation/Retrieval**: `getLane(name)` creates a new `SessionLane` if one doesn't exist for the given name, or returns the existing one.
*   **Singleton Instance**: `getLaneManager()` ensures only one `LaneManager` instance exists globally. `resetLaneManager()` is for testing.
*   **Default Processor**: `setDefaultProcessor()` sets a common processing function for all new lanes.
*   **Global Operations**: `pauseAll()`, `resumeAll()`, `drainAll()`, `clearAll()` affect all managed lanes.
*   **Statistics**: `getStats()` provides an overview of all lanes and their pending tasks.

#### Usage Patterns

#### Accessing the Singleton and Managing Lanes

```typescript
import { getLaneManager, resetLaneManager } from '../../src/concurrency/lanes.js';

resetLaneManager(); // For clean state in tests
const manager = getLaneManager();

// Set a default processor for all new lanes
manager.setDefaultProcessor(async (item) => {
  console.log(`Processing item for lane ${item.laneName}: ${item.payload}`);
});

// Get or create lanes
const lane1 = manager.getLane('session-1');
const lane2 = manager.getLane('session-2');

manager.enqueue('session-1', 'message-A');
manager.enqueue('session-2', 'message-B');

await manager.drainAll(); // Wait for all tasks in all lanes to complete
```

#### Global Control

```typescript
manager.pauseAll();
console.log(manager.getLane('session-1').getStatus()); // 'paused'

manager.resumeAll();
manager.clearAll(); // Clears all tasks from all lanes and removes lanes
```

#### Monitoring

```typescript
const stats = manager.getStats();
console.log(`Total lanes: ${stats.totalLanes}, Total pending: ${stats.totalPending}`);
console.log(stats.lanes['session-1']); // Lane-specific stats
```

### Higher-Order Utilities

The `lanes` module also provides convenience functions for integrating lane-based concurrency directly into your application logic.

#### `withLane`

Executes a given function within the context of a specific lane, ensuring its execution is ordered relative to other tasks in that lane.

```typescript
import { withLane } from '../../src/concurrency/lanes.js';

async function processData(sessionId: string, data: any) {
  return await withLane(sessionId, data, async (payload) => {
    // This function will be enqueued and processed by the session's lane
    console.log(`Processing data for ${sessionId}: ${payload}`);
    await new Promise(r => setTimeout(r, 100));
    return `Processed: ${payload}`;
  });
}

// Calls to processData for the same sessionId will be ordered
const p1 = processData('user-123', 'request-1');
const p2 = processData('user-123', 'request-2');
const p3 = processData('user-456', 'request-A'); // This will run in parallel with user-123 tasks

await Promise.all([p1, p2, p3]);
```

#### `createLanedFunction`

Creates a new function that automatically enqueues its calls into a specific lane based on a provided `getLaneName` resolver. This is useful for creating "laned" versions of existing functions.

```typescript
import { createLanedFunction } from '../../src/concurrency/lanes.js';

interface MyPayload { session: string; value: string; }

const myLanedProcessor = createLanedFunction<MyPayload, string>(
  (payload) => payload.session, // Resolver to get the lane name from the payload
  async (payload) => {
    // This is the actual processing logic
    await new Promise(r => setTimeout(r, 50));
    return `Processed ${payload.value} for ${payload.session}`;
  }
);

// Calls to myLanedProcessor will be automatically routed to the correct lane
const r1 = myLanedProcessor({ session: 'user-X', value: 'data-1' });
const r2 = myLanedProcessor({ session: 'user-X', value: 'data-2' });
const r3 = myLanedProcessor({ session: 'user-Y', value: 'data-A' });

await Promise.all([r1, r2, r3]);
// r1 and r2 for 'user-X' will be processed sequentially
// r3 for 'user-Y' will be processed in parallel
```

### API Reference (from tests)

#### `SessionLane`
*   `new SessionLane(options?: { autoStart?: boolean; maxQueueSize?: number; fifo?: boolean })`: Creates a new lane.
*   `setProcessor<T>(processor: (item: LaneItem<T>) => Promise<void>)`: Sets the function to process enqueued items.
*   `enqueue<T>(payload: T, options?: { priority?: number }): LaneItem<T>`: Adds an item to the lane's queue.
*   `drain(): Promise<void>`: Waits for all items in the queue to be processed.
*   `on(event: 'enqueue' | 'start' | 'complete' | 'drain' | 'error', listener: Function)`: Registers event listeners.
*   `getStatus(): 'idle' | 'active' | 'paused'`: Returns the current status of the lane.
*   `getQueueLength(): number`: Returns the number of pending items in the queue.
*   `getCurrentItem<T>(): LaneItem<T> | undefined`: Returns the item currently being processed.
*   `startProcessing()`: Explicitly starts processing the queue.
*   `pause()`: Pauses the lane's processing.
*   `resume()`: Resumes the lane's processing.
*   `clear(): LaneItem<any>[]`: Clears all pending items from the queue, returning the cleared items.

#### `LaneManager`
*   `new LaneManager(options?: { autoStart?: boolean; maxQueueSize?: number; fifo?: boolean })`: Creates a new manager.
*   `getLane(name: string): SessionLane`: Retrieves or creates a `SessionLane` by name.
*   `hasLane(name: string): boolean`: Checks if a lane with the given name exists.
*   `removeLane(name: string)`: Removes a lane from the manager.
*   `setDefaultProcessor<T>(processor: (item: LaneItem<T>) => Promise<void>)`: Sets the default processor for new lanes.
*   `enqueue<T>(laneName: string, payload: T, options?: { priority?: number }): LaneItem<T>`: Enqueues an item to a specific lane.
*   `getTotalPending(): number`: Returns the total number of pending items across all lanes.
*   `pauseAll()`: Pauses all managed lanes.
*   `resumeAll()`: Resumes all managed lanes.
*   `drainAll(): Promise<void>`: Waits for all tasks in all managed lanes to complete.
*   `getStats(): { totalLanes: number; totalPending: number; lanes: { [key: string]: { pending: number; status: string } } }`: Returns statistics for all lanes.
*   `clearAll()`: Clears all tasks from all lanes and removes the lanes.
*   `getActiveSessions(): string[]`: Returns an array of names of active lanes.

#### Utilities
*   `getLaneManager(): LaneManager`: Returns the singleton `LaneManager` instance.
*   `resetLaneManager()`: Resets the singleton `LaneManager` instance (primarily for testing).
*   `withLane<T, R>(laneName: string, payload: T, fn: (payload: T) => Promise<R>, options?: { priority?: number }): Promise<R>`: Executes a function within a specific lane.
*   `createLanedFunction<P, R>(getLaneName: (payload: P) => string, fn: (payload: P) => Promise<R>, options?: { priority?: number }): (payload: P) => Promise<R>`: Creates a function that automatically enqueues its calls to a lane.

---

## Architectural Relationship

The `SessionLane` and `LaneManager` components form a cohesive system for managing ordered task execution within logical "sessions." The `LaneManager` acts as the central hub, providing access to and control over individual `SessionLane` instances. Higher-order utilities like `withLane` and `createLanedFunction` abstract away the direct interaction with `LaneManager`, making it easier to integrate lane-based concurrency into application logic.

The `LaneQueue` module, while sharing the "lane" concept, operates as a separate, parallel concurrency system. It focuses on global resource management and cross-lane concurrency limits, rather than the strict in-lane ordering and eventing provided by `SessionLane`.

```mermaid
graph TD
    subgraph Lane Management System
        A[LaneManager Singleton] --> B{getLane(name)}
        B --> C[SessionLane Instance 1]
        B --> D[SessionLane Instance 2]
        B --> E[...]

        F[withLane()] --> A
        G[createLanedFunction()] --> A
    end

    subgraph Global Concurrency System
        H[LaneQueue Instance]
    end

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style H fill:#ccf,stroke:#333,stroke-width:2px
```

**Explanation:**
*   The `LaneManager` is a singleton that orchestrates multiple `SessionLane` instances.
*   `withLane` and `createLanedFunction` are convenience wrappers that interact with the `LaneManager` to enqueue tasks into appropriate `SessionLane`s.
*   `LaneQueue` is a distinct concurrency primitive, managing its own set of lanes and global concurrency limits, independent of `LaneManager` and `SessionLane`.

## Contributing and Extending

When contributing to or extending these concurrency modules:

*   **`LaneQueue`**: Consider its global impact. Changes to `maxParallel` or retry logic affect the entire application's task throughput. New features should align with global resource management and cross-lane isolation.
*   **`SessionLane`**: Focus on the behavior of a single queue. Enhancements might include new event types, more sophisticated queueing algorithms (if `fifo: false` is expanded), or advanced error handling within a single lane's context.
*   **`LaneManager`**: This is the orchestration layer for `SessionLane`s. Extensions here might involve new ways to group or prioritize lanes, or more comprehensive global statistics. Ensure changes maintain the singleton pattern and its reset mechanism.
*   **Utilities (`withLane`, `createLanedFunction`)**: These are designed for developer convenience. New utilities should simplify common concurrency patterns using `LaneManager` without exposing its internal complexities.

Always ensure that changes are thoroughly tested, especially considering the asynchronous and concurrent nature of these modules. The existing test suite provides a strong foundation for verifying correct behavior under various conditions.