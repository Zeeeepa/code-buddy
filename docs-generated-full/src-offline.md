---
title: "src — offline"
module: "src-offline"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.601Z"
---
# src — offline

The `src/offline` module provides Code Buddy with robust offline capabilities, allowing it to function and provide value even without an active internet connection. It achieves this through a combination of intelligent response caching, local Large Language Model (LLM) fallback, embedding storage for semantic search, and a resilient request queuing system.

The core of this module is the `OfflineMode` class, which manages all aspects of offline operation.

## Core Concepts

The `offline` module is designed around several key features:

1.  **Response Caching:** Stores previous LLM responses to avoid re-querying for identical or highly similar prompts.
2.  **Local LLM Fallback:** Integrates with local LLM providers (Ollama, `llama.cpp`, `node-llama-cpp`, WebLLM) to generate responses when online models are unreachable.
3.  **Embedding Cache:** Stores vector embeddings of queries and responses, enabling semantic search for cached content.
4.  **Request Queuing:** When offline, requests that require internet connectivity (e.g., to remote LLMs or APIs) are queued and automatically processed once connectivity is restored.
5.  **Automatic Sync:** Monitors internet connectivity and triggers processing of queued requests when back online.
6.  **Offline-Capable Tools:** Provides the infrastructure for tools to leverage local LLMs and cached data.

## Architecture Overview

The `OfflineMode` class acts as a central manager, orchestrating interactions between various internal components and external dependencies. It maintains its state (caches, queue, configuration) persistently on disk and actively monitors network status.

```mermaid
graph TD
    subgraph OfflineMode Manager
        OM[OfflineMode Class] --> Cfg(OfflineConfig)
        OM --> RC(Response Cache: LRUCache<CachedResponse>)
        OM --> EC(Embedding Cache: LRUCache<CachedEmbedding>)
        OM --> RQ(Request Queue: QueuedRequest[])
        OM --> LLM(Local LLM Integration)
        OM --> Net(Internet Check)
        OM --> Stats(OfflineStats)
    end

    LLM --> LPM(LocalProviderManager)
    LLM --> Ax(Axios for Ollama/llama.cpp)
    RC --> FS(fs-extra: Disk Persistence)
    EC --> FS
    RQ --> FS
    Cfg --> FS
    Net --> Ax
    LPM --> LocalLLMProviders[Local LLM Providers (node-llama-cpp, WebLLM)]
    Ax --> ExternalAPIs[External APIs (Ollama, llama.cpp, Health Checks)]

    OM -- Emits Events --> EventBus[EventEmitter]
    MainApp[Main Application] -- Uses Singleton --> OM
```

## Key Components

### `OfflineMode` Class

The `OfflineMode` class (`src/offline/offline-mode.ts`) is the primary entry point and manager for all offline functionalities. It extends `EventEmitter` to broadcast important status changes and events.

**Constructor and Initialization:**
The constructor `new OfflineMode(config)` initializes the module with a given configuration (or `DEFAULT_CONFIG`). It sets up data directories (`~/.codebuddy/offline`), initializes `LRUCache` instances for responses and embeddings, and then calls `initialize()`.

The `initialize()` method performs critical setup:
1.  Ensures necessary directories exist (`dataDir`, `cacheDir`, `cacheDir/responses`, `cacheDir/embeddings`).
2.  Loads previously saved cache indexes (`response-index.json`, `embedding-index.json`) and the request queue (`queue.json`) from disk.
3.  Performs an initial internet connectivity check via `checkInternet()`.
4.  Starts a periodic internet connectivity check using `startInternetCheck()`.

### Configuration (`OfflineConfig`)

The `OfflineConfig` interface defines the module's behavior:
-   `enabled`: Master switch for offline mode.
-   `cacheEnabled`, `cacheMaxSize`, `cacheMaxAge`: Control response caching.
-   `localLLMEnabled`, `localLLMProvider`, `localLLMModel`: Configure local LLM usage.
-   `embeddingCacheEnabled`: Enables/disables embedding storage.
-   `queueRequestsWhenOffline`, `autoSyncOnReconnect`: Control request queuing behavior.
-   `checkInternetInterval`: Frequency of internet checks.

Configuration can be updated at runtime using `updateConfig(config: Partial<OfflineConfig>)`, which also persists the changes to `config.json`.

### Response Caching

The module uses an `LRUCache<CachedResponse>` (`responseCache`) to store LLM responses.
-   **`cacheResponse(query: string, response: string, model: string, tokensUsed: number)`:** Stores a response. It generates a SHA256 hash of the query (`hash()`) as the cache key and saves the full `CachedResponse` object to a file in `cacheDir/responses/` before adding it to the in-memory LRU cache. It then calls `saveCacheIndexes()` and `cleanupCacheIfNeeded()`.
-   **`getCachedResponse(query: string)`:** Retrieves a response. It checks the LRU cache using the query hash. If found, it updates `accessedAt` and `accessCount` for LRU management and increments `stats.cacheHits`. It also checks `cacheMaxAge` and removes expired entries.
-   **`removeCachedResponse(queryHash: string)`:** Deletes a cached response from both the in-memory cache and disk.
-   **`cleanupCacheIfNeeded()`:** Periodically called to ensure the cache size (`stats.cacheSize`) does not exceed `config.cacheMaxSize`. It removes the least recently accessed items until the cache is within limits.
-   **`clearCache()`:** Empties both response and embedding caches from memory and disk.

### Embedding Caching & Semantic Search

An `LRUCache<CachedEmbedding>` (`embeddingCache`) stores text embeddings.
-   **`cacheEmbedding(text: string, embedding: number[], model: string)`:** Stores a text's embedding, similar to `cacheResponse`.
-   **`getEmbedding(text: string)`:** Retrieves a cached embedding.
-   **`findSimilarResponses(query: string, threshold: number = 0.85)`:** This is a key feature for semantic search.
    1.  It first gets or computes the embedding for the input `query`.
    2.  Then, it iterates through all cached responses. For each cached response, it retrieves its associated query embedding from `embeddingCache`.
    3.  It calculates the `cosineSimilarity()` between the input query's embedding and the cached query's embedding.
    4.  Responses exceeding the `threshold` are returned, sorted by similarity.

### Request Queuing

When offline, requests that cannot be fulfilled locally are added to a queue.
-   **`queueRequest(type: QueuedRequest['type'], payload: unknown, priority: number = 0)`:** Adds a request to `requestQueue`. Requests are sorted by `priority`. The queue is persisted to `queue.json` via `saveQueue()`.
-   **`processQueue()`:** Called when the system comes back online (if `autoSyncOnReconnect` is true) or manually. It iterates through the `requestQueue`, attempting to process each request via `processRequest()`. Failed requests are retried up to 3 times before being discarded.
-   **`processRequest(request: QueuedRequest)`:** A placeholder method that would integrate with the main application's request handling logic. It emits a `request:execute` event.
-   **`clearQueue()`:** Empties the request queue.

### Local LLM Integration

The module supports various local LLM providers.
-   **`callLocalLLM(prompt: string, options: {})`:** The main method for interacting with local LLMs. It dispatches to specific provider implementations based on `config.localLLMProvider`.
    -   For `local-llama` (node-llama-cpp) and `webllm`, it uses the `LocalProviderManager` from `../providers/local-llm-provider.js`.
    -   For `ollama` and `llamacpp`, it makes direct `axios` calls to their respective local HTTP endpoints (`callOllama`, `callLlamaCpp`).
-   **`streamLocalLLM(prompt: string, options: {})`:** Provides an `AsyncIterable<string>` for streaming responses from providers that support it (currently `LocalProviderManager` based ones).
-   **`isLocalLLMAvailable()`:** Checks if the configured local LLM provider is running and accessible.
-   **`getAvailableProviders()`:** Dynamically checks for the presence of various local LLM providers (Ollama, `llama.cpp` server, `node-llama-cpp` bindings, WebGPU for WebLLM) and returns a list of available options.
-   **`getLocalModels()`:** Specifically for Ollama, retrieves a list of installed models.

### Internet Connectivity Management

-   **`checkInternet()`:** Attempts to ping `https://api.x.ai/health` or `https://www.google.com/generate_204` to determine online status.
-   **`startInternetCheck()`:** Sets up a `setInterval` to periodically call `checkInternet()`. It emits `online` and `offline` events when the status changes and triggers `processQueue()` on reconnection if `autoSyncOnReconnect` is enabled.

### Data Persistence

All critical data (configuration, cache indexes, request queue) is persisted to disk within the user's home directory (`~/.codebuddy/offline`).
-   `fs-extra` is used for robust file system operations (e.g., `ensureDir`, `readJSON`, `writeJSON`, `remove`, `emptyDir`).
-   `saveCacheIndexes()`: Writes `response-index.json` and `embedding-index.json`.
-   `saveQueue()`: Writes `queue.json`.
-   `saveConfig()`: Writes `config.json`.

### Statistics & Monitoring

The `OfflineStats` interface tracks various metrics:
-   `cacheHits`, `cacheMisses`
-   `localLLMCalls`
-   `queuedRequests`
-   `cacheSize`
-   `isOnline`, `lastOnline`

The `getStats()` method returns the current statistics. `formatStatus()` provides a human-readable summary, useful for debugging or user interfaces.

## Usage

The `OfflineMode` instance is typically accessed as a singleton:

```typescript
import { getOfflineMode, OfflineConfig } from './offline-mode.js';

// Get the singleton instance, optionally with initial config
const offlineManager = getOfflineMode({
  localLLMProvider: 'ollama',
  localLLMModel: 'llama3',
  cacheMaxSize: 1024, // 1GB
});

// Check internet status
console.log('Is online:', offlineManager.getStats().isOnline);

// Try to get a cached response
const cached = await offlineManager.getCachedResponse('What is Code Buddy?');
if (cached) {
  console.log('Cached response:', cached.response);
} else {
  // If offline, queue a request or use local LLM
  if (!offlineManager.getStats().isOnline && offlineManager.getConfig().localLLMEnabled) {
    const localResponse = await offlineManager.callLocalLLM('Explain offline mode.');
    console.log('Local LLM response:', localResponse);
  } else if (!offlineManager.getStats().isOnline && offlineManager.getConfig().queueRequestsWhenOffline) {
    const requestId = offlineManager.queueRequest('chat', { prompt: 'What is Code Buddy?' });
    console.log('Request queued:', requestId);
  }
}

// Listen for events
offlineManager.on('online', () => console.log('Back online! Processing queue...'));
offlineManager.on('request:processed', ({ request }) => console.log(`Processed queued request: ${request.id}`));

// Clean up on application exit
// offlineManager.dispose();
```

## Integration Points

-   **`../utils/lru-cache.js`**: Provides the underlying LRU cache implementation for `responseCache` and `embeddingCache`.
-   **`../providers/local-llm-provider.js`**: This is a crucial dependency for modern local LLM integration. The `OfflineMode` class uses `LocalProviderManager` and `autoConfigureLocalProvider` to abstract away the complexities of interacting with `node-llama-cpp` and WebLLM.
-   **`axios`**: Used for external HTTP requests, including internet checks and direct API calls to Ollama and `llama.cpp` servers.
-   **`fs-extra`**: Handles all file system interactions for persistence.
-   **Main Application Logic**: The main Code Buddy application is expected to:
    -   Call `getOfflineMode()` to obtain the manager instance.
    -   Use `getCachedResponse()` before making online LLM calls.
    -   Call `cacheResponse()` after successful online LLM calls.
    -   Call `queueRequest()` when an online request fails due to lack of connectivity.
    -   Listen to `online` and `offline` events to adjust UI or behavior.
    -   Call `dispose()` on application shutdown to ensure state is saved and resources are released.

## Events

The `OfflineMode` class extends `EventEmitter` and emits the following events:

-   `online`: When internet connectivity is restored.
-   `offline`: When internet connectivity is lost.
-   `cache:evict`: When an item is evicted from an LRU cache.
-   `cache:cleaned`: After a cache cleanup operation.
-   `cache:cleared`: After the cache has been completely cleared.
-   `request:queued`: When a request is added to the queue.
-   `queue:processing`: When the queue starts processing.
-   `request:processed`: When a queued request is successfully processed.
-   `request:failed`: When a queued request fails after retries.
-   `queue:processed`: When the queue finishes processing.
-   `localLLM:error`: When an error occurs during a local LLM call.
-   `localLLM:progress`: Emitted by `LocalProviderManager` during model loading or generation.

## Lifecycle

-   **Initialization:** The `getOfflineMode()` function ensures a singleton instance is created and initialized. This involves setting up directories, loading persisted data, and starting background tasks like internet checks.
-   **Disposal:** The `dispose()` method is critical for proper shutdown. It clears the internet check timer, attempts to kill any child processes started for local LLMs, disposes of the `LocalProviderManager`, and saves any pending cache indexes and queue state to disk. It also removes all event listeners to prevent memory leaks. The `resetOfflineMode()` function can be used in testing or specific scenarios to force a re-initialization.