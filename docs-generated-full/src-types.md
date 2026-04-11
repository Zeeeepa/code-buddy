---
title: "src — types"
module: "src-types"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.779Z"
---
# src — types

The `src/types` module serves as the central repository for core TypeScript type definitions and interfaces used throughout the codebase. Its primary purpose is to establish clear contracts for data structures, API interactions, agent behaviors, and utility objects, ensuring consistency, type safety, and maintainability across different components.

By centralizing these definitions, `src/types` prevents type duplication, reduces the risk of inconsistencies, and provides a single source of truth for understanding the shape of critical data.

## Module Overview

This module is organized into several files, each focusing on a specific domain of types:

*   **`agent.ts`**: Defines the fundamental interface for AI agents.
*   **`api.ts`**: Contains comprehensive types for interacting with large language model (LLM) APIs, including chat messages, tool definitions, and streaming responses. It also provides utilities for parsing tool calls.
*   **`cache-types.ts`**: Offers a unified set of interfaces and types for various caching mechanisms, including cache entries, statistics, configurations, and generic cache interfaces.
*   **`errors.ts`**: A deprecated module that re-exports error types from `src/errors/index.ts`. It exists for backward compatibility.
*   **`index.ts`**: Aggregates types from other files and defines additional core types related to tools, editor commands, and agent state. It also includes general utility functions for error handling.

## Detailed Type Categories

### Agent Core Types (`src/types/agent.ts`)

This file defines the `Agent` interface, which is the cornerstone for any AI agent implementation within the system. It outlines the essential capabilities an agent must provide to interact with users, manage chat history, and handle its lifecycle.

```typescript
export interface Agent {
  processUserMessage(message: string): Promise<ChatEntry[]>;
  processUserMessageStream(message: string): AsyncGenerator<StreamingChunk, void, unknown>;
  getChatHistory(): ChatEntry[];
  clearChat(): void;
  dispose(): void;
}
```

*   **`processUserMessage`**: Handles a user message and returns a promise resolving to an array of `ChatEntry` objects, representing the agent's response.
*   **`processUserMessageStream`**: Provides a streaming interface for user messages, yielding `StreamingChunk` objects as the agent processes the input.
*   **`getChatHistory`**: Retrieves the current chat history maintained by the agent.
*   **`clearChat`**: Resets the agent's chat history.
*   **`dispose`**: Performs any necessary cleanup when the agent is no longer needed.

### API Interaction Types (`src/types/api.ts`)

This module provides a robust set of types for defining and interacting with LLM APIs, particularly focusing on chat completions and function calling. It ensures that API requests and responses conform to expected structures, facilitating integration with various LLM providers.

Key interfaces include:

*   **`ChatMessage`**: Represents a single message in a chat conversation, including roles (`system`, `user`, `assistant`, `tool`), content (text or multimodal), and optional `tool_calls`.
*   **`ToolFunction` / `ToolDefinition`**: Describes a function that the LLM can call, including its name, description, and parameters schema.
*   **`ToolCall`**: Represents a specific tool invocation made by the LLM, containing the tool's name and its arguments as a JSON string.
*   **`ParsedToolCall<T>`**: A type for a `ToolCall` where the arguments string has been successfully parsed into a structured object `T`.
*   **`ChatRequestPayload`**: The complete payload structure for sending a chat completion request to an LLM.
*   **`ChatResponse` / `StreamChunk`**: Define the structure of non-streaming and streaming API responses, respectively.

#### Utility Functions

This module also includes critical utility functions for handling tool calls:

*   **`isToolCall(value: unknown): value is ToolCall`**: A type guard to safely check if an unknown value conforms to the `ToolCall` interface.
*   **`parseToolArguments<T = Record<string, unknown>>(toolCall: ToolCall): ParsedToolCall<T>`**: Parses the `arguments` string from a `ToolCall` into a typed object. This function is crucial for executing tools, as it converts the LLM's string output into a usable data structure. It throws a `ToolArgumentParseError` if parsing fails.
*   **`ToolArgumentParseError`**: A custom error class specifically for failures during tool argument parsing, providing detailed context about the error.
*   **`hasToolCalls(choice: ResponseChoice | StreamChoice): boolean`**: Checks if an API response choice indicates that tool calls were made.

#### API Type Relationships

The following Mermaid diagram illustrates the relationships between key API types, particularly how tool definitions and calls are structured:

```mermaid
graph TD
    A[ChatRequestPayload] --> B[ChatMessage]
    B -- "messages[]" --> B
    B -- "tool_calls?[]" --> C[ToolCall]
    A -- "tools?[]" --> D[ToolDefinition]
    D -- "function" --> E[ToolFunction]
    C -- "function" --> F[ToolCallFunction]
    E -- "parameters" --> G[ToolParameter]
    C -- "parsed by" --> H[ParsedToolCall]
    F[ToolCallFunction] -- "name, arguments: string"
    H[ParsedToolCall] -- "name, arguments: T"
```

### Cache Management Types (`src/types/cache-types.ts`)

This comprehensive module provides a standardized set of types for implementing and interacting with various caching mechanisms. It promotes consistency across different cache implementations (e.g., in-memory, LRU, semantic).

Key categories of types include:

*   **Cache Entry Types**:
    *   `BaseCacheEntry<T>`: Basic value and timestamp.
    *   `TimedCacheEntry<T>`: Extends `BaseCacheEntry` with `expiresAt` and `ttl`.
    *   `LRUCacheEntry<T>`: Extends `BaseCacheEntry` with `createdAt`, `accessedAt`, and `accessCount`.
    *   `FullCacheEntry<T>`: Combines all fields for a comprehensive cache entry.
*   **Cache Statistics Types**:
    *   `BaseCacheStats`: Basic `size`, `hits`, `misses`, `hitRate`.
    *   `DetailedCacheStats`: Extends `BaseCacheStats` with `maxSize`, `evictions`, etc.
    *   `CategorizedCacheStats`: Extends `DetailedCacheStats` with `byCategory` / `byType` breakdowns.
*   **Cache Configuration Types**:
    *   `BaseCacheConfig`: `maxSize`, `ttlMs`, `enabled`.
    *   `LRUCacheConfig<T>`: Extends `BaseCacheConfig` with `onEvict` / `onExpire` callbacks.
    *   `SemanticCacheConfig`: For similarity-based caches, includes `similarityThreshold`.
*   **Cache Operation Types**:
    *   `CacheLookupResult<T>`: Result of a `get` operation, indicating `found`, `value`, `expired`, `age`.
    *   `CacheEvent<T>`: Describes a cache operation event (`get`, `set`, `delete`, `evict`, `expire`, `clear`).
*   **Cache Interfaces**:
    *   `ICache<T>`: A generic synchronous cache interface.
    *   `IAsyncCache<T>`: A generic asynchronous cache interface, suitable for persistence-backed caches.

#### Utility Functions

The module also provides helper functions:

*   **`isCacheEntry<T>(obj: unknown): obj is BaseCacheEntry<T>`**: Type guard for cache entries.
*   **`isExpired(entry: TimedCacheEntry | FullCacheEntry): boolean`**: Checks if a timed cache entry has expired.
*   **`calculateHitRate(hits: number, misses: number): number`**: Computes the cache hit rate.
*   **Factory Functions**: `createCacheEntry`, `createTimedCacheEntry`, `createLRUCacheEntry`, `createCacheStats` simplify the creation of these objects.

### Tooling & Execution Types (`src/types/index.ts`)

This file serves as an aggregation point for various core types and also defines types specific to tool execution and agent state management.

Key interfaces and types include:

*   **`ToolResult` / `TypedToolResult<T>` / `StringToolResult` / `DataToolResult<T>`**: A set of interfaces defining the standard output structure for tool executions, indicating success, output, and potential errors. `TypedToolResult` allows for type-safe outputs.
*   **`Tool`**: The base interface for any executable tool, specifying its `name`, `description`, and an `execute` method.
*   **`ToolArguments`**: A generic type for parsed tool arguments (a record of string keys to unknown values).
*   **`ValidatedToolCall<TArgs>`**: Represents a tool call where arguments have been parsed and validated against a specific schema, providing type safety for `TArgs`.
*   **`EditorCommand`**: A critical interface defining the structure of commands an agent can issue to interact with an editor or file system (e.g., `view`, `str_replace`, `create`, `insert`). This is fundamental for agents that modify code or files.
*   **`AgentState`**: Captures the current operational state of an agent, including its `currentDirectory`, `editHistory`, and available `tools`.
*   **`ConfirmationState`**: Manages the state of user confirmations for agent actions.

#### Utility Functions

*   **`isError(value: unknown): value is Error`**: A type guard to check if a value is an instance of `Error`.
*   **`getErrorMessage`**: Re-exported from `src/errors/index.js`, provides a canonical way to extract a message from an unknown error.
*   **`getErrorCode(error: unknown): string | undefined`**: Extracts a `code` property from an error object, useful for handling system errors (e.g., `ENOENT`).

### Error Handling Types (`src/types/errors.ts`)

This module is **deprecated**. It exists solely for backward compatibility and re-exports all error-related types and utilities from `../errors/index.js`. New code should directly import from `src/errors/index.ts`.

## Usage Patterns

The types defined in `src/types` are foundational and are used across almost every major component of the application:

*   **Agent Implementations**: Any class implementing the `Agent` interface (e.g., `src/agent/basicAgent.ts`) will adhere to the contract defined in `src/types/agent.ts`.
*   **API Clients**: Modules responsible for communicating with LLM providers (e.g., `src/llm/openai.ts`, `src/llm/google.ts`) will use `ChatMessage`, `ChatRequestPayload`, `ChatResponse`, `StreamChunk`, `ToolCall`, and related types from `src/types/api.ts` to structure their requests and parse responses.
*   **Tool Executors**: The core logic that executes tools will rely on `Tool`, `ToolResult`, `ParsedToolCall`, and `ToolArgumentParseError` from `src/types/index.ts` and `src/types/api.ts` to define, validate, and run tools.
*   **Caching Layers**: Any caching mechanism (e.g., `src/cache/inMemoryCache.ts`, `src/cache/lruCache.ts`) will implement `ICache` or `IAsyncCache` and utilize the various `CacheEntry`, `CacheStats`, and `CacheConfig` types from `src/types/cache-types.ts`.
*   **Editor Integrations**: Components that interact with an editor or file system will use `EditorCommand` from `src/types/index.ts` to define the actions an agent can perform.
*   **State Management**: The overall application state and agent-specific states will leverage `AgentState` and `ConfirmationState` from `src/types/index.ts`.

By providing a consistent and well-defined type system, `src/types` significantly enhances the clarity, robustness, and extensibility of the entire codebase.