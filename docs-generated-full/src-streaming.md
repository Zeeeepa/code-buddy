---
title: "src — streaming"
module: "src-streaming"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.733Z"
---
# src — streaming

The `src/streaming` module provides a comprehensive suite of utilities for handling asynchronous data streams, with a particular focus on real-time processing of Large Language Model (LLM) outputs, robust error handling, and user feedback mechanisms. It aims to make stream consumption efficient, resilient, and developer-friendly, abstracting away complexities like backpressure, retries, and incremental UI updates.

## Core Concepts

Before diving into the components, understanding a few core concepts is helpful:

*   **Chunk/Delta**: In the context of LLMs, a "chunk" or "delta" refers to a small, incremental piece of data received from a streaming API. These are often partial words, tokens, or fragments of tool calls.
*   **StreamEvent**: A normalized, type-safe representation of a processed chunk, indicating its type (e.g., `content`, `tool_call`, `error`, `done`).
*   **Backpressure**: A mechanism to prevent a fast producer from overwhelming a slow consumer by signaling the producer to slow down or pause.
*   **Retry Policy**: Strategies for automatically re-attempting failed operations, often with exponential backoff.
*   **Circuit Breaker**: A pattern to prevent repeated attempts to a failing service, allowing it to recover before further requests are sent.
*   **Tool Phases**: A structured way to track and report the lifecycle (start, update, success, fail) of an asynchronous tool execution, enabling real-time feedback.

## Architecture Overview

The module's architecture is designed to handle various streaming needs, from low-level LLM delta processing to high-level tool execution feedback. The `StreamHandler` and `ChunkProcessor` form the core pipeline for LLM output.

```mermaid
graph TD
    A[Raw LLM Delta Stream] --> B{StreamHandler};
    B -- Pipes to --> C{ChunkProcessor};
    C -- Processes, Batches, Applies Backpressure --> D[StreamEvent[]];
    D --> E[Consumer (e.g., UI, ChunkHandler)];
    C -- Emits Metrics, Flow Hints --> F[Monitoring/Feedback];
    B -- Can create --> G[Node.js Transform Stream];
    G --> H[Node.js Stream Consumers];
```

1.  **Raw LLM Delta Stream**: This is the initial input, typically an `AsyncIterable` of raw JSON objects (e.g., `ChatDelta` from `chunk-processor.ts`) directly from an LLM API.
2.  **`StreamHandler`**: The primary orchestrator for consuming LLM streams. It manages global timeouts, integrates with Node.js `Transform` streams, and wraps the `ChunkProcessor`.
3.  **`ChunkProcessor`**: A high-performance component responsible for:
    *   Parsing raw LLM deltas.
    *   Applying sanitization.
    *   Batching small content chunks for efficiency.
    *   Managing internal backpressure (`pendingEvents`).
    *   Tracking per-chunk timeouts.
    *   Accumulating tool call deltas.
    *   Collecting detailed streaming metrics.
    *   Emitting `StreamEvent`s.
4.  **`StreamEvent[]`**: The output of the `ChunkProcessor`, a normalized array of events that can be consumed by various parts of the application.
5.  **Consumer**: Any component that needs to react to the processed stream events, such as a UI rendering the content, or a `ChunkHandler` accumulating the full response.
6.  **Monitoring/Feedback**: `ChunkProcessor` provides `StreamingMetrics` and `FlowHint`s, allowing for real-time performance monitoring and adaptive UI adjustments.
7.  **Node.js Transform Stream**: `StreamHandler` can expose a `Transform` stream interface, enabling integration with standard Node.js stream pipelines.

## Key Components

### `StreamHandler` (`src/streaming/stream-handler.ts`)

The `StreamHandler` acts as the main entry point for consuming LLM-like asynchronous streams. It wraps a `ChunkProcessor` and provides a higher-level interface for stream management, including global timeouts and Node.js stream compatibility.

**Purpose:** To provide a robust and flexible way to consume and process streaming data, particularly from LLM APIs, with built-in error handling, timeouts, and integration capabilities.

**Key Features:**

*   **Orchestration**: Manages the lifecycle of a streaming operation, including starting/clearing global timeouts.
*   **`ChunkProcessor` Integration**: Instantiates and configures a `ChunkProcessor` to handle the low-level delta processing.
*   **Timeout Management**: Supports both per-chunk timeouts (delegated to `ChunkProcessor`) and a global stream timeout.
*   **Node.js Stream Compatibility**: Provides `createTransformStream()` and `processReadableStream()` methods to integrate with Node.js `Readable` and `Transform` streams.
*   **Event Emission**: Emits `flowHint`, `progress`, `complete`, and `globalTimeout` events to provide real-time feedback.
*   **Accumulation**: Offers `getAccumulated()` to retrieve the final content and tool calls.

**Usage Example:**

```typescript
import { StreamHandler } from './streaming/stream-handler.js';
import { StreamChunk } from './streaming/types.js'; // Assuming types.ts defines StreamChunk

async function* mockLLMStream(): AsyncIterable<StreamChunk> {
  yield { choices: [{ delta: { content: 'Hello' } }] };
  await new Promise(resolve => setTimeout(resolve, 50));
  yield { choices: [{ delta: { content: ' world!' } }] };
  await new Promise(resolve => setTimeout(resolve, 100));
  yield { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'my_tool' } }] }] };
  await new Promise(resolve => setTimeout(resolve, 50));
  yield { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"param":"value"}' } }] }] };
  await new Promise(resolve => setTimeout(resolve, 50));
}

async function processMyStream() {
  const handler = new StreamHandler({
    globalTimeoutMs: 5000,
    processorOptions: {
      enableBatching: true,
      adaptiveThrottle: true,
    },
  });

  handler.on('flowHint', (hint) => console.log('Flow Hint:', hint.state));
  handler.on('progress', (progress) => console.log('Progress:', progress.progress));
  handler.on('complete', (data) => console.log('Stream Complete:', data.metricsSummary));
  handler.on('globalTimeout', () => console.error('Global stream timed out!'));

  try {
    for await (const event of handler.handleStream(mockLLMStream())) {
      if (event.type === 'content') {
        process.stdout.write(event.content);
      } else if (event.type === 'tool_call') {
        console.log('\nTool Call:', event.toolCall);
      } else if (event.type === 'error') {
        console.error('\nStream Error:', event.error);
      }
    }
    console.log('\nFinal Accumulated Content:', handler.getAccumulated().content);
    console.log('Final Tool Calls:', handler.getAccumulated().toolCalls);
  } catch (e) {
    console.error('Stream processing failed:', e);
  }
}

processMyStream();
```

### `ChunkProcessor` (`src/streaming/chunk-processor.ts`)

The `ChunkProcessor` is a highly optimized component for processing raw LLM deltas into a stream of `StreamEvent`s. It focuses on performance, memory efficiency, and providing detailed insights into the streaming process.

**Purpose:** To efficiently transform raw, often fragmented, LLM output into a structured, sanitized, and manageable stream of events, while providing advanced flow control and performance monitoring.

**Key Features:**

*   **Delta Processing**: Takes `ChatDelta` objects (raw LLM API responses) and extracts content and tool call information.
*   **Content Sanitization**: Applies `sanitizeLLMOutput` to clean up content.
*   **Tool Call Accumulation**: Reconstructs complete `CodeBuddyToolCall` objects from fragmented deltas. Supports extracting commentary-style tool calls if native ones are not found.
*   **Batching**: Batches small content chunks to reduce event overhead and improve rendering performance.
*   **Backpressure**: Manages an internal `pendingEvents` queue to prevent overwhelming consumers, emitting `FlowHint`s.
*   **Timeouts**: Implements per-chunk timeouts to detect stalled streams.
*   **Adaptive Render Throttling**: Adjusts the `renderThrottleMs` dynamically based on reported render durations, ensuring smooth UI updates.
*   **Metrics**: Collects extensive `StreamingMetrics` (latency, throughput, jitter, percentiles) for performance analysis.
*   **Memory Efficiency**: Uses reusable buffers (`contentBuffer`, `rawContentBuffer`, `pendingBatch`) to minimize garbage collection.

**Key Methods:**

*   `processDelta(chunk: ChatDelta)`: The core method for processing a single raw LLM delta.
*   `startChunkTimeout()` / `clearChunkTimeout()`: Manages the per-chunk timeout.
*   `drainPendingEvents()`: Releases queued events when backpressure is relieved.
*   `getThrottledContent(content: string)`: Provides content for rendering, respecting the adaptive throttle.
*   `reportRenderDuration(durationMs: number)`: Allows consumers to provide feedback for adaptive throttling.
*   `getToolCalls()`: Retrieves all accumulated tool calls.
*   `getMetrics()` / `getMetricsSummary()`: Provides detailed performance statistics.
*   `getProgressIndicator()`: Returns a UI-friendly progress object.

### `ChunkHandler` (`src/streaming/chunk-handler.ts`)

The `ChunkHandler` provides a type-safe way to process and accumulate various types of `Chunk`s (content, tool calls, errors, etc.). It's designed to build a complete response from a stream of discrete events.

**Purpose:** To provide a structured and extensible way to consume `Chunk` objects, accumulate their content, and emit specific events for different chunk types.

**Key Features:**

*   **Type-Safe Chunks**: Defines `ChunkType` and `Chunk` interface for clear data structure.
*   **Accumulation**: Gathers `content`, `toolCalls`, `toolResults`, `tokenCount`, and `errors` into an `AccumulatedContent` object.
*   **Validation**: Can validate incoming chunk structures (`validateChunks` option).
*   **Event Emission**: Emits events for each chunk type (`content`, `toolCall`, `error`, `done`, etc.) and a general `chunk` event.
*   **Content Overflow Handling**: Prevents excessive content accumulation with `maxContentLength`.
*   **Custom Handlers**: Allows defining custom logic for specific chunk types via `typeHandlers`.
*   **Static Factories**: Provides `createContentChunk`, `createToolCallChunk`, etc., for easy chunk creation.

**Usage Example:**

```typescript
import { ChunkHandler, Chunk } from './streaming/chunk-handler.js';

const handler = new ChunkHandler({
  maxContentLength: 100,
  validateChunks: true,
  typeHandlers: {
    error: (chunk) => console.error('Custom Error Handler:', chunk.error),
  },
});

handler.on('content', ({ content, total }) => console.log(`Content: "${content}" (Total: "${total}")`));
handler.on('toolCall', ({ toolCall }) => console.log('Tool Call:', toolCall));
handler.on('done', ({ accumulated }) => console.log('Final Accumulated:', accumulated));
handler.on('validationError', ({ errors }) => console.error('Validation Errors:', errors));

handler.handle(ChunkHandler.createContentChunk('First part. '));
handler.handle(ChunkHandler.createContentChunk('Second part. '));
handler.handle(ChunkHandler.createToolCallChunk('1', 'my_tool', '{"arg":1}'));
handler.handle(ChunkHandler.createErrorChunk('Something went wrong!'));
handler.handle(ChunkHandler.createDoneChunk());

console.log('Final Content:', handler.getContent());
console.log('Has Errors:', handler.hasErrors());
```

### `BackpressureController` (`src/streaming/backpressure.ts`)

A generic backpressure mechanism for controlling the flow of data in any stream-like scenario. It buffers items and signals when a producer should pause or resume.

**Purpose:** To prevent memory exhaustion and ensure graceful handling of slow consumers by regulating the rate at which data is produced.

**Key Features:**

*   **High/Low Water Marks**: Defines thresholds for pausing (`highWaterMark`) and resuming (`lowWaterMark`) the producer.
*   **Buffer Management**: `push()` adds items, `pull()` removes them.
*   **State Management**: Tracks `flowing`, `paused`, `drained`, `overflow` states.
*   **Overflow Strategies**: Configurable behavior when `highWaterMark` is exceeded (`block`, `drop`, `error`).
*   **`waitForDrain()`**: An async method for producers to await buffer space.
*   **Event Emission**: Emits `pause`, `resume`, `drain`, `overflow`, `drop` events.
*   **Statistics**: Tracks `BackpressureStats` like `totalChunks`, `droppedChunks`, `avgDrainTime`.
*   **`process()` / `apply()`**: Convenience methods for integrating with `AsyncIterable`s.

**Usage Example:**

```typescript
import { BackpressureController } from './streaming/backpressure.js';

async function producer(controller: BackpressureController<number>) {
  for (let i = 0; i < 200; i++) {
    console.log(`Producer: Pushing ${i}`);
    const accepted = await controller.push(i);
    if (!accepted) {
      console.log(`Producer: Chunk ${i} was dropped or blocked.`);
      if (controller.getState() === 'paused') {
        console.log('Producer: Waiting for drain...');
        await controller.waitForDrain();
        console.log('Producer: Resumed after drain.');
        // Re-attempt push if blocked, or handle dropped
        await controller.push(i); // Re-push if blocked
      }
    }
    await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
  }
}

async function consumer(controller: BackpressureController<number>) {
  while (true) {
    const chunk = controller.pull();
    if (chunk !== undefined) {
      console.log(`Consumer: Pulled ${chunk}. Buffer size: ${controller.getBufferSize()}`);
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate slow work
    } else if (controller.isEmpty() && controller.getState() === 'drained') {
      console.log('Consumer: Buffer drained, stopping.');
      break;
    } else {
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait for more data
    }
  }
}

const controller = new BackpressureController<number>({
  highWaterMark: 10,
  lowWaterMark: 5,
  overflowStrategy: 'block',
});

controller.on('pause', ({ bufferSize }) => console.warn(`Controller PAUSED. Buffer: ${bufferSize}`));
controller.on('resume', ({ bufferSize }) => console.info(`Controller RESUMED. Buffer: ${bufferSize}`));
controller.on('drain', () => console.log('Controller DRAINED.'));

Promise.all([producer(controller), consumer(controller)]);
```

### `StreamProcessor` (`src/streaming/stream-processor.ts`)

A generic stream processor for any `AsyncIterable`, providing fundamental stream management capabilities like buffering, pause/resume, abort, and basic retry logic. This is a more general-purpose utility compared to `ChunkProcessor` which is specialized for LLM deltas.

**Purpose:** To provide a foundational layer for processing generic asynchronous data streams with common control flow mechanisms.

**Key Features:**

*   **Generic `AsyncIterable` Processing**: Works with any `AsyncIterable<T>`.
*   **Buffering & Backpressure**: Uses `maxBufferSize` to manage an internal buffer and `waitForBufferDrain()` to apply backpressure.
*   **Pause/Resume**: Allows explicit pausing and resuming of stream consumption.
*   **Abort**: Supports aborting the stream processing via an `AbortController`.
*   **Retry Logic**: `processWithRetry()` provides automatic retry with exponential backoff for transient errors.
*   **Transformation**: Supports an optional `transform` function for each chunk.
*   **Statistics**: Tracks `chunksProcessed`, `bytesProcessed`, `errors`, `retries`.
*   **Event Emission**: Emits `start`, `chunk`, `pause`, `resume`, `abort`, `complete`, `error`, `backpressure`, `retry`, `transformError` events.
*   **Collection/Reduction**: `collect()` and `reduce()` convenience methods for common stream operations.

### `StreamTransformer` (`src/streaming/stream-transformer.ts`)

A static utility class offering a rich set of composable functions for transforming, filtering, and combining `AsyncIterable`s.

**Purpose:** To provide a functional and declarative API for common stream manipulation patterns, making complex stream pipelines easier to build and reason about.

**Key Features (Static Methods):**

*   **Mapping & Filtering**: `map`, `filter`.
*   **Limiting**: `take`, `skip`, `takeWhile`, `skipWhile`.
*   **Structure**: `flatten`, `batch`.
*   **Flow Control**: `debounce`, `throttle`, `delay`.
*   **Buffering**: `buffer` (with custom flush condition).
*   **Combining Streams**: `merge`, `concat`, `zip`.
*   **Duplication**: `tee` (creates multiple independent iterables from one source).
*   **Pipelining**: `pipe` (chains multiple transformations).
*   **Aggregation**: `reduce`, `collect`.

**Usage Example:**

```typescript
import { StreamTransformer } from './streaming/stream-transformer.js';

async function* numberSource(count: number) {
  for (let i = 0; i < count; i++) {
    await new Promise(resolve => setTimeout(resolve, 10));
    yield i;
  }
}

async function demonstrateTransforms() {
  console.log('--- Map and Filter ---');
  const mappedAndFiltered = StreamTransformer.pipe(
    numberSource(10),
    (s) => StreamTransformer.map(s as AsyncIterable<number>, n => n * 2),
    (s) => StreamTransformer.filter(s as AsyncIterable<number>, n => n % 4 === 0)
  );
  console.log(await StreamTransformer.collect(mappedAndFiltered)); // [0, 4, 8, 12, 16]

  console.log('--- Batch ---');
  const batched = StreamTransformer.batch(numberSource(10), 3);
  for await (const b of batched) {
    console.log(b); // [0,1,2], [3,4,5], [6,7,8], [9]
  }

  console.log('--- Merge ---');
  async function* sourceA() { yield 'A1'; await new Promise(r => setTimeout(r, 50)); yield 'A2'; }
  async function* sourceB() { await new Promise(r => setTimeout(r, 20)); yield 'B1'; await new Promise(r => setTimeout(r, 50)); yield 'B2'; }
  console.log(await StreamTransformer.collect(StreamTransformer.merge(sourceA(), sourceB()))); // [ 'B1', 'A1', 'A2', 'B2' ] (order depends on timing)
}

demonstrateTransforms();
```

### `RetryManager` & `CircuitBreaker` (`src/streaming/retry-policy.ts`)

This module provides robust error handling strategies: automatic retries with exponential backoff and the circuit breaker pattern. `RetryManager` orchestrates both.

**Purpose:** To enhance the resilience of asynchronous operations by automatically handling transient failures and preventing cascading failures to unstable services.

**Key Components:**

*   **`RetryConfig`**: Defines parameters for retry attempts (max attempts, delays, jitter, retryable/non-retryable errors).
*   **`retry<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>)`**: A standalone function to execute an operation with retry logic. `retryOrThrow` is a convenience wrapper.
*   **`CircuitBreakerConfig`**: Defines parameters for the circuit breaker (failure thresholds, reset timeouts, success thresholds).
*   **`CircuitBreaker`**: An `EventEmitter` that manages the state (`closed`, `open`, `half-open`) of a service. It prevents requests to a failing service when `open` and allows controlled probes when `half-open`.
*   **`RetryManager`**: A singleton (`getRetryManager()`) that manages multiple `CircuitBreaker` instances (one per `serviceId`) and combines retry logic with circuit breaking. It provides `execute()` and `executeOrThrow()` methods.
*   **Decorators**: `withRetry`, `withCircuitBreaker`, `withRetryAndCircuitBreaker` provide a declarative way to apply these policies to functions.

**Usage Example:**

```typescript
import { getRetryManager, CircuitOpenError } from './streaming/retry-policy.js';

let failureCount = 0;
async function unreliableOperation(shouldFail: boolean): Promise<string> {
  if (shouldFail && failureCount < 3) { // Fail first 3 times
    failureCount++;
    console.log(`Operation failed (attempt ${failureCount})`);
    throw new Error('Transient network error');
  }
  console.log('Operation succeeded!');
  return 'Data from service';
}

async function demonstrateRetry() {
  const manager = getRetryManager();
  const serviceId = 'my-api-service';

  manager.on('circuit-state-change', (id, from, to) =>
    console.warn(`Circuit for ${id} changed from ${from} to ${to}`)
  );
  manager.on('circuit-failure', (id, error) =>
    console.error(`Circuit for ${id} recorded failure: ${error.message}`)
  );

  try {
    console.log('\n--- Demonstrating Retry ---');
    failureCount = 0;
    const result = await manager.executeOrThrow(
      serviceId,
      () => unreliableOperation(true),
      { maxAttempts: 5, initialDelayMs: 100 }
    );
    console.log('Retry Result:', result);

    console.log('\n--- Demonstrating Circuit Breaker ---');
    // Reset failure count for circuit breaker demo
    failureCount = 0;
    for (let i = 0; i < 10; i++) {
      try {
        console.log(`Request ${i + 1}. Circuit state: ${manager.getCircuitState(serviceId)}`);
        await manager.executeOrThrow(serviceId, () => unreliableOperation(true), { maxAttempts: 1 });
      } catch (e) {
        if (e instanceof CircuitOpenError) {
          console.error(`Request ${i + 1} rejected by circuit breaker.`);
        } else {
          console.error(`Request ${i + 1} failed: ${e.message}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit
    }
    console.log('Final Circuit Stats:', manager.getCircuitStats(serviceId));
  } catch (e) {
    console.error('Overall operation failed:', e.message);
  } finally {
    manager.resetAllCircuits();
  }
}

demonstrateRetry();
```

### `MarkdownChunker` (`src/streaming/markdown-chunker.ts`)

A specialized utility for intelligently chunking streaming markdown content, ensuring that code blocks are not split mid-way unless absolutely necessary.

**Purpose:** To enable incremental display or processing of markdown content from a stream while preserving the structural integrity of code blocks, improving readability and usability.

**Key Features:**

*   **Block-Aware Splitting**: Tracks `BlockState` (e.g., `inCodeBlock`, `fence`, `language`) to make informed splitting decisions.
*   **Code Block Preservation**: Prioritizes splitting *outside* code blocks. If a hard maximum is reached *inside* a code block, it will force-split by closing the current fence and reopening it in the next chunk.
*   **Configurable Thresholds**: `softMaxChars` (preferred split point) and `hardMaxChars` (absolute maximum before force-splitting).
*   **Preferred Breaks**: Uses `preferredBreaks` (e.g., `\n\n`, `\n`, `.`) to find natural split points.
*   **`write()` / `flush()`**: Methods for incremental input and final buffer flushing.
*   **`ChunkResult`**: Provides information about the chunk, including whether it was force-split and if a fence needs to be reopened.
*   **Convenience Functions**: `chunkMarkdown`, `hasUnclosedCodeBlock`, `countCodeBlocks`, `fixUnclosedCodeBlocks`, `createStreamingChunker`.

**Usage Example:**

```typescript
import { MarkdownChunker, createStreamingChunker } from './streaming/markdown-chunker.js';

const longMarkdown = `
# Introduction

This is some introductory text. It's quite long and might need to be chunked.

\`\`\`typescript
function helloWorld() {
  console.log("Hello, world!");
  // This is a very long line that might cause a split if not handled carefully.
  // Another long line to ensure the chunker has enough content to work with.
  // Yet another line.
}
\`\`\`

More text after the code block.
`;

console.log('--- Streaming Chunker ---');
const streamingChunker = createStreamingChunker(
  (chunk) => {
    console.log(`Chunk (forceSplit: ${chunk.forceSplit}, reopen: ${chunk.reopenFence}):\n---\n${chunk.content}\n---`);
  },
  { softMaxChars: 100, hardMaxChars: 200, preserveCodeBlocks: true }
);

streamingChunker.write(longMarkdown.slice(0, 150));
streamingChunker.write(longMarkdown.slice(150, 300));
streamingChunker.write(longMarkdown.slice(300));
streamingChunker.flush();

console.log('\n--- Single-shot Chunker ---');
const chunks = MarkdownChunker.chunkMarkdown(longMarkdown, {
  softMaxChars: 100,
  hardMaxChars: 200,
  preserveCodeBlocks: true,
});
chunks.forEach((chunk, i) => {
  console.log(`Chunk ${i + 1} (forceSplit: ${chunk.forceSplit}, reopen: ${chunk.reopenFence}):\n---\n${chunk.content}\n---`);
});
```

### `ProgressTracker` (`src/streaming/progress-tracker.ts`)

A utility for tracking and reporting progress across multiple, weighted stages of a long-running operation.

**Purpose:** To provide a structured way to monitor and communicate the progress of complex, multi-step processes, offering real-time updates and estimated time remaining.

**Key Features:**

*   **Multi-Stage Tracking**: Defines `ProgressStage`s with `name` and `weight`.
*   **Weighted Progress**: Calculates `totalProgress` based on the progress and weight of each stage.
*   **Time Estimation**: Can estimate `estimatedTimeRemaining` based on historical progress.
*   **Event Emission**: Emits `progress` events with `ProgressUpdate` objects.
*   **Control Methods**: `start()`, `updateProgress()`, `completeStage()`, `failStage()`.
*   **Throttling**: `updateIntervalMs` to control how frequently progress events are emitted.
*   **Convenience Functions**: `createSimpleTracker`, `calculateIterationProgress`.

**Usage Example:**

```typescript
import { ProgressTracker } from './streaming/progress-tracker.js';

async function longRunningTask() {
  const tracker = new ProgressTracker({
    stages: [
      { name: 'Initialization', weight: 10 },
      { name: 'Processing Data', weight: 70 },
      { name: 'Finalization', weight: 20 },
    ],
    estimateTime: true,
    updateIntervalMs: 50,
  });

  tracker.on('progress', (update) => {
    console.log(
      `Total: ${update.totalProgress}% | Stage: ${update.currentStage} (${update.stageProgress}%) | Message: ${update.message} | ETA: ${update.estimatedTimeRemaining?.toFixed(0) || 'N/A'}ms`
    );
  });

  tracker.start();

  // Stage 1: Initialization
  for (let i = 0; i <= 100; i += 20) {
    tracker.updateProgress(i, 'Initialization', `Initializing step ${i / 20}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  tracker.completeStage('Initialization');

  // Stage 2: Processing Data
  for (let i = 0; i <= 100; i += 10) {
    tracker.updateProgress(i, 'Processing Data', `Processing batch ${i / 10}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  tracker.completeStage('Processing Data');

  // Stage 3: Finalization
  for (let i = 0; i <= 100; i += 25) {
    tracker.updateProgress(i, 'Finalization', `Finalizing step ${i / 25}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  tracker.completeStage('Finalization');

  console.log('Task Completed!');
}

longRunningTask();
```

### Tool Streaming Convenience Functions (`src/streaming/index.ts`)

The `index.ts` file exports all components and provides high-level convenience functions for integrating tool execution with streaming progress and results. These functions leverage `ToolPhaseManager` and `ToolPhaseThrottler` (not detailed in the provided source, but part of the module).

**Purpose:** To simplify the process of reporting real-time progress and outcomes for asynchronous tool calls, making it easier to build interactive agents or UIs.

**Key Functions:**

*   **`createToolStream(toolCallId, toolName, onPhase?)`**: Creates an object with an `emitter` and helper methods (`start`, `update`, `success`, `fail`, `cleanup`) to manage the lifecycle of a tool call's streaming progress.
*   **`streamedOperation<T>(toolCallId, toolName, operation, onPhase?)`**: Wraps an `async` function, automatically emitting `start`, `update` (via a provided callback), `success`, or `fail` events.
*   **`streamedIteration<T, R>(toolCallId, toolName, items, processor, onPhase?)`**: Iterates over an array of items, calling a `processor` for each, and automatically updates progress.

**Usage Example:**

```typescript
import { streamedOperation, streamedIteration } from './streaming/index.js';

async function myToolFunction(
  updateProgress: (progress: number, message?: string) => void
): Promise<string> {
  updateProgress(10, 'Starting complex calculation...');
  await new Promise(resolve => setTimeout(resolve, 200));
  updateProgress(50, 'Halfway through...');
  await new Promise(resolve => setTimeout(resolve, 300));
  updateProgress(90, 'Almost done...');
  await new Promise(resolve => setTimeout(resolve, 100));
  return 'Calculation complete!';
}

async function processItems(item: string, index: number): Promise<string> {
  console.log(`Processing item ${item} (index ${index})...`);
  await new Promise(resolve => setTimeout(resolve, 150));
  return `Processed: ${item}`;
}

async function demonstrateToolStreaming() {
  console.log('--- Streamed Operation ---');
  try {
    const result = await streamedOperation(
      'tool-call-123',
      'ComplexTool',
      myToolFunction,
      (event) => console.log(`[ToolPhase] ${event.phase}: ${event.message || ''} (${event.progress || 0}%)`)
    );
    console.log('Streamed Operation Result:', result);
  } catch (error) {
    console.error('Streamed Operation Failed:', error.message);
  }

  console.log('\n--- Streamed Iteration ---');
  try {
    const items = ['itemA', 'itemB', 'itemC'];
    const results = await streamedIteration(
      'tool-call-456',
      'BatchProcessor',
      items,
      processItems,
      (event) => console.log(`[ToolPhase] ${event.phase}: ${event.message || ''} (${event.progress || 0}%)`)
    );
    console.log('Streamed Iteration Results:', results);
  } catch (error) {
    console.error('Streamed Iteration Failed:', error.message);
  }
}

demonstrateToolStreaming();
```

## Integration Points

The `src/streaming` module is designed to integrate broadly across the codebase:

*   **LLM Providers (`src/providers/*-provider.ts`)**: The `retry` utility from `retry-policy.ts` is used by `gemini-provider.ts` and `local-llm-provider.ts` to make API calls more resilient. `StreamHandler` and `ChunkProcessor` are likely used to consume the actual streaming responses from these providers.
*   **CodeBuddy Client (`src/codebuddy/client.ts`)**: `geminiChat` uses `retry` for its operations. The `ChunkProcessor`'s ability to extract `CodeBuddyToolCall`s is crucial here.
*   **Agent Logic (`src/agent/codebuddy-agent.ts`)**: Agents would use the `createToolStream`, `streamedOperation`, and `streamedIteration` functions to report progress and results of their internal tool executions. They might also consume `StreamEvent`s from `StreamHandler` to process LLM responses.
*   **UI/Frontend**: The `StreamHandler` and `ChunkProcessor` are designed to provide real-time feedback (`progress`, `flowHint`, `getThrottledContent`, `reportRenderDuration`) for building responsive user interfaces that display streaming LLM output.
*   **Utilities (`src/utils/sanitize.ts`, `src/utils/retry.ts`)**: `ChunkProcessor` uses `sanitizeLLMOutput`. The `retry` functions are also re-exported or used by `src/utils/retry.ts`.
*   **Memory Management (`src/memory/memory-flush.ts`)**: The `buffer` transformer from `stream-transformer.ts` might be used for memory flushing strategies.
*   **Sandbox/Runtime (`src/sandbox/e2b-sandbox.ts`, `src/scripting/runtime.ts`)**: The `destroy` method of a `Transform` stream (created by `StreamHandler`) might be called by sandbox environments. Functions wrapped with `withRetry` or `withCircuitBreaker` could be runtime functions.

## Contributing to the Module

When contributing to the `src/streaming` module, consider the following:

*   **Performance**: Many components, especially `ChunkProcessor`, are optimized for high performance and low memory allocation. Be mindful of creating new objects in hot paths. Reuse arrays (`.length = 0`) where possible.
*   **Genericity**: Components like `StreamProcessor`, `StreamTransformer`, and `BackpressureController` are designed to be generic. Avoid coupling them to LLM-specific types unless absolutely necessary.
*   **Testability**: Each component should be independently testable. The existing unit tests (`tests/unit/streaming.test.ts`) provide good examples.
*   **Event-Driven**: Many components extend `EventEmitter`. Ensure events are clearly defined, documented, and emitted consistently.
*   **Error Handling**: Robust error handling is critical. Ensure that errors are caught, propagated, and reported appropriately, especially in streaming contexts.
*   **Asynchronous Nature**: All components deal with `Promise`s and `AsyncIterable`s. Understand asynchronous patterns and potential pitfalls (e.g., race conditions, unhandled promises).
*   **Mermaid Diagrams**: If adding new complex interactions, consider a small, focused Mermaid diagram to illustrate the flow.