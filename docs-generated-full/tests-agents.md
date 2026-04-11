---
title: "tests — agents"
module: "tests-agents"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.819Z"
---
# tests — agents

This document describes the `ModelFailoverChain` module, located at `src/agents/model-failover.ts`. While the provided source code is a test file (`tests/agents/model-failover.test.ts`), this documentation focuses on the core `ModelFailoverChain` class and its associated components, which are thoroughly tested by the provided suite.

## Model Failover Chain Module (`src/agents/model-failover.ts`)

This module provides a robust mechanism for managing and failing over between multiple Large Language Model (LLM) providers. It tracks the health and failure status of each configured provider, allowing applications to gracefully switch to an alternative when a primary provider experiences issues (e.g., rate limits, service outages).

### Purpose

The `ModelFailoverChain` class is designed to:

*   Maintain a list of available LLM providers and their current operational status.
*   Automatically select the next healthy provider in a round-robin fashion.
*   Mark providers as unhealthy upon failure and re-evaluate their health after a configurable cooldown period.
*   Provide a clear API for updating provider status and retrieving the current chain state.
*   Support convenient initialization from environment variables for common LLM providers.

### Key Components

#### `FailoverEntry` (Type)

Represents the status of a single LLM provider within the failover chain. This type is used internally by `ModelFailoverChain` to track the state of each provider.

```typescript
interface FailoverEntry {
  provider: string;      // The identifier for the LLM provider (e.g., 'grok', 'claude', 'chatgpt', 'gemini')
  model: string;         // The specific model being used (e.g., 'grok-3', 'claude-sonnet-4-20250514')
  healthy: boolean;      // True if the provider is currently considered healthy
  failures: number;      // Consecutive failures recorded for this provider
  lastChecked?: number;  // Timestamp (ms) of the last time this provider was checked or failed
}
```

#### `ModelFailoverChain` (Class)

The central class managing the failover logic. It maintains an ordered list of `FailoverEntry` objects and provides methods to interact with their status.

```mermaid
classDiagram
    class ModelFailoverChain {
        -chain: FailoverEntry[]
        -options: { cooldownMs: number }
        +constructor(initialProviders?: FailoverEntry[], options?: object)
        +addProvider(providerConfig: { provider: string, model: string }): void
        +getStatus(): FailoverEntry[]
        +getNextProvider(): FailoverEntry | null
        +markFailed(providerName: string, reason: string): void
        +markHealthy(providerName: string): void
        +resetAll(): void
        +static fromEnvironment(): ModelFailoverChain
    }
    class FailoverEntry {
        +provider: string
        +model: string
        +healthy: boolean
        +failures: number
        +lastChecked?: number
    }
    ModelFailoverChain "1" *-- "0..*" FailoverEntry : manages
```

### Core Functionality

1.  **`constructor(initialProviders?: FailoverEntry[], options?: { cooldownMs?: number })`**
    *   Initializes a new `ModelFailoverChain` instance.
    *   Can be optionally provided with an array of `FailoverEntry` objects to pre-populate the chain.
    *   `options.cooldownMs`: Configures the duration (in milliseconds) a failed provider remains unhealthy before `getNextProvider` attempts to re-check it. Defaults to `5 * 60 * 1000` (5 minutes).

2.  **`addProvider(providerConfig: { provider: string, model: string }): void`**
    *   Adds a new LLM provider to the failover chain.
    *   The provider is initially marked as `healthy: true` with `failures: 0`.

3.  **`getStatus(): FailoverEntry[]`**
    *   Returns a copy of the current state of all providers in the chain.
    *   Each element in the array is a `FailoverEntry` object, reflecting its current health, failure count, and other metadata.

4.  **`getNextProvider(): FailoverEntry | null`**
    *   This is the primary method for obtaining an LLM provider to use.
    *   It iterates through the configured providers to find the next *healthy* one in a round-robin fashion.
    *   **Cooldown Logic**: If a provider is currently `healthy: false`, `getNextProvider` checks if its `lastChecked` timestamp plus the configured `cooldownMs` has passed. If the cooldown has expired, the provider is temporarily marked `healthy: true` and returned, giving it another chance. If the subsequent call fails, it will be marked `healthy: false` again.
    *   Returns `null` if all providers are currently unhealthy and within their cooldown period.

5.  **`markFailed(providerName: string, reason: string): void`**
    *   Updates the status of a specific provider, indicating a failure.
    *   Locates the provider by `providerName`.
    *   Increments its `failures` count.
    *   Sets `healthy: false`.
    *   Updates `lastChecked` to the current timestamp, initiating the cooldown period.
    *   The `reason` parameter is for logging or debugging purposes and is not stored in the `FailoverEntry`.

6.  **`markHealthy(providerName: string): void`**
    *   Resets the status of a specific provider, marking it as fully operational.
    *   Locates the provider by `providerName`.
    *   Resets its `failures` count to `0`.
    *   Sets `healthy: true`.

7.  **`resetAll(): void`**
    *   Resets the status of *all* providers in the chain.
    *   Marks every provider as `healthy: true` and sets their `failures` count to `0`.
    *   Useful for recovering from a widespread outage or for resetting the state during testing.

8.  **`static fromEnvironment(): ModelFailoverChain`**
    *   A static factory method that constructs a `ModelFailoverChain` instance by checking common environment variables for API keys.
    *   It automatically adds providers like 'grok', 'claude', 'chatgpt', and 'gemini' if their respective API keys (`GROK_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`) are present in `process.env`.
    *   This provides a convenient way to configure the failover chain without explicit code, especially for common LLM integrations.

### How it Works (Execution Flow)

When an application needs to make an LLM call:

1.  The application calls `chain.getNextProvider()` to get a suitable provider.
2.  The `ModelFailoverChain` iterates through its internal list of `FailoverEntry` objects, applying its health and cooldown logic.
3.  If a provider is returned, the application attempts to make an LLM call using that provider.
4.  **If the LLM call succeeds**: No further action is needed regarding the failover chain for that specific call.
5.  **If the LLM call fails**: The application should call `chain.markFailed(providerName, reason)` for the provider that failed. This updates the provider's status, making it less likely to be chosen immediately again and starting its cooldown period.
6.  **If a previously failed provider starts working again**: The application can call `chain.markHealthy(providerName)` to restore its full health status, making it immediately available for selection by `getNextProvider()`.

This module provides the foundational logic for building resilient LLM agent systems that can gracefully handle transient or persistent issues with individual model providers, improving the overall reliability of LLM-powered applications.