---
title: "tests — optimization"
module: "tests-optimization"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.939Z"
---
# tests — optimization

This documentation covers the **Prompt Cache Module**, which is primarily implemented in `src/optimization/prompt-cache.ts` and thoroughly tested by `tests/optimization/prompt-cache.test.ts`.

## Prompt Cache Module

The Prompt Cache module is designed to optimize interactions with Large Language Models (LLMs) by caching frequently used or expensive prompt components. By storing and reusing hashes of system prompts, tool definitions, and contextual information, the module aims to significantly reduce API costs and improve response times. Research suggests prompt caching can lead to substantial cost reductions, potentially up to 90%.

### Purpose

The primary goals of this module are:
*   **Cost Reduction:** Avoid re-sending identical or highly similar prompt components to LLM APIs.
*   **Performance Improvement:** Reduce latency by serving cached prompt components locally.
*   **Consistency:** Ensure consistent prompt construction for identical inputs.

### Key Components

The module exposes several types and a central class for managing the prompt cache.

#### `PromptCacheManager` Class

This is the core class responsible for managing the in-memory cache. It handles caching logic, statistics tracking, configuration, and event emission.

**Constructor:**
`new PromptCacheManager(config?: Partial<CacheConfig>)`
Initializes a new cache manager instance. If no `config` is provided, it uses `DEFAULT_CACHE_CONFIG`.

#### `CacheConfig` Type

Defines the configuration options for the prompt cache.

```typescript
type CacheConfig = {
  enabled: boolean; // Whether caching is active
  maxEntries: number; // Maximum number of entries the cache can hold
  ttlMs: number; // Time-to-live for cache entries in milliseconds
  minTokensToCache: number; // Minimum token count for content to be considered for caching
  costPerMillion: number; // Estimated cost per million tokens for cost savings calculation
};
```

**`DEFAULT_CACHE_CONFIG`**:
A constant providing sensible default values:
*   `enabled: true`
*   `maxEntries: 1000`
*   `ttlMs: 5 * 60 * 1000` (5 minutes)
*   `minTokensToCache: 1024`
*   `costPerMillion: 3.0`

#### `CacheEntry` Type

Represents a single item stored in the cache.

```typescript
type CacheEntry = {
  hash: string; // Unique hash of the cached content
  timestamp: number; // Unix timestamp of when the entry was last accessed/updated
  hitCount: number; // Number of times this entry has been hit
  tokens: number; // Estimated token count of the cached content
  type: "system" | "tools" | "context" | "full"; // Type of content cached
};
```

#### `CacheStats` Type

Provides a snapshot of the cache's performance and state.

```typescript
type CacheStats = {
  hits: number; // Total cache hits
  misses: number; // Total cache misses
  hitRate: number; // Percentage of hits (hits / (hits + misses))
  totalTokensSaved: number; // Cumulative tokens saved by using the cache
  estimatedCostSaved: number; // Estimated monetary cost saved
  entries: number; // Current number of entries in the cache
};
```

### Core Functionality & API

The `PromptCacheManager` class provides the following public methods:

#### `cacheSystemPrompt(prompt: string): string`
Caches a system prompt string. Returns a unique hash for the prompt. If the prompt is already cached, it updates its `timestamp` and `hitCount`.

#### `cacheTools(tools: Tool[]): string`
Caches an array of tool definitions. Returns a unique hash for the tools. This is crucial for scenarios where the available tools remain constant across multiple LLM calls.

#### `cacheContext(key: string, content: string): string`
Caches arbitrary contextual content, identified by a `key`. This can be used for caching file contents, database schemas, or other dynamic but reusable context. Returns a unique hash.

#### `isCached(content: string): boolean`
Checks if the given content (e.g., a system prompt string) is already present in the cache.

#### `getStats(): CacheStats`
Retrieves the current statistics of the cache, including hits, misses, hit rate, and estimated cost savings.

#### `formatStats(): string`
Returns a human-readable formatted string of the current cache statistics, suitable for logging or display.

#### `clear(): void`
Empties the entire cache, resetting all entries and statistics.

#### `warmCache(prompts: { system?: string; tools?: Tool[]; context?: Record<string, string> }): void`
Pre-populates the cache with initial prompt components. This is useful for ensuring common components are available immediately upon application startup. It can cache a `system` prompt, `tools` array, and a map of `context` items.

#### `structureForCaching(messages: Message[]): Message[]`
Reorders a list of LLM messages to optimize for caching. Specifically, it moves system messages to the beginning of the array, as they are often static and good candidates for caching. This helps ensure consistent hashing for the same logical prompt structure.

#### `updateConfig(config: Partial<CacheConfig>): void`
Updates the cache's configuration at runtime. Only the provided properties in `config` will be updated, others will retain their current values.

#### Events

The `PromptCacheManager` extends `EventEmitter` and emits the following events:

*   **`cache:hit`**: Emitted when content is successfully retrieved from the cache.
    *   Payload: `{ hash: string; tokens: number; type: string }`
*   **`cache:miss`**: Emitted when content is not found in the cache and is being added.
    *   Payload: `{ hash: string; tokens: number; type: string }`
*   **`cache:warmed`**: Emitted after the `warmCache` operation completes.
    *   Payload: `void`

### Singleton Access

For convenience and to ensure a single, global cache instance across the application, the module provides singleton access functions.

#### `getPromptCacheManager(): PromptCacheManager`
Returns the singleton instance of `PromptCacheManager`. If the manager has not been initialized yet, it will create one with `DEFAULT_CACHE_CONFIG`.

#### `initializePromptCache(config?: Partial<CacheConfig>): PromptCacheManager`
Initializes or re-initializes the singleton `PromptCacheManager` with the provided configuration. This should typically be called once at application startup to configure the cache.

#### Singleton Architecture

```mermaid
graph TD
    A[Application Code] --> B{getPromptCacheManager()};
    A --> C{initializePromptCache(config)};
    B --> D[PromptCacheManager Instance];
    C --> D;
    D -- Manages --> E[In-memory Cache];
    D -- Emits --> F[Cache Events];
```

### Usage Example

```typescript
import {
  initializePromptCache,
  getPromptCacheManager,
} from "./src/optimization/prompt-cache.js";

// 1. Initialize the cache once at application startup
initializePromptCache({
  maxEntries: 500,
  ttlMs: 10 * 60 * 1000, // 10 minutes
  minTokensToCache: 500,
});

// 2. Get the manager instance anywhere in your code
const cacheManager = getPromptCacheManager();

// 3. Warm the cache with common components
cacheManager.warmCache({
  system: "You are a helpful AI assistant.",
  context: {
    "file:utils.ts": "export function add(a, b) { return a + b; }",
  },
});

// 4. Cache system prompts
const systemPrompt = "You are a senior software engineer.";
const systemHash = cacheManager.cacheSystemPrompt(systemPrompt);

// 5. Cache tool definitions
const tools = [
  {
    type: "function" as const,
    function: { name: "search", description: "Search the web", parameters: {} },
  },
];
const toolsHash = cacheManager.cacheTools(tools);

// 6. Check if content is cached
if (cacheManager.isCached(systemPrompt)) {
  console.log("System prompt is cached!");
}

// 7. Listen for cache events
cacheManager.on("cache:hit", (data) => {
  console.log(`Cache HIT for ${data.type} with hash ${data.hash}`);
});

// Trigger a hit
cacheManager.cacheSystemPrompt(systemPrompt);

// 8. Get and format statistics
const stats = cacheManager.getStats();
console.log(cacheManager.formatStats());

// 9. Update configuration dynamically
cacheManager.updateConfig({ enabled: false }); // Disable caching temporarily
```

### Integration with LLM Calls

When constructing prompts for LLM APIs, you would typically:
1.  Use `cacheManager.cacheSystemPrompt()` for the system message.
2.  Use `cacheManager.cacheTools()` for the tool definitions.
3.  Use `cacheManager.cacheContext()` for any other static contextual information.
4.  Combine the hashes (or the original content if not cached) into your final prompt structure. The actual mechanism for *using* the hashes to reduce API calls would depend on the LLM provider's API (e.g., if they support sending hashes instead of full content, or if you're managing the full prompt construction locally and only sending the diff). The `structureForCaching` method helps prepare messages for consistent hashing.