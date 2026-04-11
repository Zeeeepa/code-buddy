---
title: "src — agents"
module: "src-agents"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.364Z"
---
# src — agents

The `src/agents/model-failover.ts` module provides a robust mechanism for managing a chain of Large Language Model (LLM) providers, enabling automatic failover when a primary provider becomes unavailable or unhealthy. This is crucial for building resilient applications that depend on external LLM services, ensuring continuous operation even if individual providers experience outages or rate limits.

## Overview

This module defines the `ModelFailoverChain` class, which maintains an ordered list of LLM providers. When an application needs to interact with an LLM, it requests the "next available" provider from the chain. If a provider fails, it can be marked as unhealthy, and the chain will automatically attempt to use the next healthy provider. Unhealthy providers are put into a cooldown period before being re-evaluated for health.

## Core Concepts

### `FailoverEntry`

The `FailoverEntry` interface defines the structure for each individual LLM provider in the failover chain. It includes both configuration details and dynamic health status:

```typescript
export interface FailoverEntry {
  provider: string; // Unique identifier for the provider (e.g., 'grok', 'claude')
  model: string;    // The specific model to use with this provider (e.g., 'grok-3', 'gpt-4o')
  apiKey?: string;  // API key for authentication (can be a direct key or an env var name)
  baseURL?: string; // Optional custom base URL for the API endpoint

  // Internal state for failover logic
  healthy: boolean;
  lastError?: string;
  lastChecked?: number; // Timestamp of last status update (healthy or failed)
  consecutiveFailures: number;
}
```

### `FailoverConfig`

The `FailoverConfig` interface allows customization of the failover behavior:

```typescript
export interface FailoverConfig {
  maxRetries: number;           // (Currently external) Max consecutive failures before a provider is considered truly down.
  cooldownMs: number;           // Time (in milliseconds) an unhealthy provider waits before being eligible for re-evaluation.
  healthCheckIntervalMs: number; // (Currently external) Interval for proactive health checks.
}
```

It's important to note that `maxRetries` and `healthCheckIntervalMs` are currently intended for external orchestration. The `ModelFailoverChain` itself tracks `consecutiveFailures` but doesn't automatically transition a provider to `unhealthy` based on `maxRetries`. Similarly, `healthCheckIntervalMs` is a configuration hint for an external system to perform proactive health checks, rather than an internal timer within `ModelFailoverChain`. The `cooldownMs` *is* actively used by `getNextProvider` to re-enable providers.

## `ModelFailoverChain` Class

The `ModelFailoverChain` class is the central component for managing the failover logic.

### Constructor

```typescript
constructor(chain?: Partial<FailoverEntry>[], config?: Partial<FailoverConfig>)
```

Initializes a new `ModelFailoverChain` instance.
-   `chain`: An optional array of `Partial<FailoverEntry>` objects to pre-populate the chain. Each entry is initialized with `healthy: true` and `consecutiveFailures: 0`.
-   `config`: An optional `Partial<FailoverConfig>` to override default failover settings.

### Key Methods

#### `addProvider(entry: Omit<FailoverEntry, 'healthy' | 'consecutiveFailures'>): void`

Adds a new provider to the end of the failover chain. The `healthy` status is set to `true` and `consecutiveFailures` to `0` by default.

#### `getNextProvider(): FailoverEntry | null`

This is the core method for retrieving an LLM provider. It iterates through the chain to find the next available provider:
1.  It returns the first `healthy` provider it encounters.
2.  If an `unhealthy` provider's `cooldownMs` has elapsed since its `lastChecked` timestamp, it is automatically marked `healthy` again, its `consecutiveFailures` reset, and then returned.
3.  If no healthy or re-cooldown'd provider is found, it returns `null`.

#### `markFailed(provider: string, error: string): void`

Updates the status of a specified provider to `unhealthy`.
-   Increments `consecutiveFailures`.
-   Records the `error` message and the current timestamp (`lastChecked`).
-   This method should be called by the consumer of the chain when an API call to a provider fails.

#### `markHealthy(provider: string): void`

Resets the status of a specified provider to `healthy`.
-   Clears `consecutiveFailures` and `lastError`.
-   Updates `lastChecked`.
-   This can be used for manual intervention or by an external health check system.

#### `resetAll(): void`

Resets the health status of all providers in the chain to `healthy`, clearing all failure-related state.

#### `getStatus(): Array<{ provider: string; model: string; healthy: boolean; failures: number }>`

Returns a simplified array of objects representing the current health status of each provider in the chain, useful for monitoring or debugging.

### Static Factory Method: `fromEnvironment(): ModelFailoverChain`

This static method provides a convenient way to initialize a `ModelFailoverChain` based on environment variables. It checks for common API keys and automatically adds corresponding providers to the chain.

The current implementation checks for:
-   `GROK_API_KEY` (adds 'grok' provider with 'grok-3' model)
-   `ANTHROPIC_API_KEY` (adds 'claude' provider with 'claude-sonnet-4-20250514' model)
-   `OPENAI_API_KEY` (adds 'chatgpt' provider with 'gpt-4o' model)
-   `GOOGLE_API_KEY` (adds 'gemini' provider with 'gemini-2.0-flash' model)

This method simplifies setup by allowing developers to configure their LLM providers purely through environment variables.

## How it Works

The `ModelFailoverChain` operates as a stateful manager for a list of LLM providers.

1.  **Initialization**: A chain is created, either empty or pre-populated with `FailoverEntry` objects.
2.  **Provider Request**: When an LLM call is needed, the application calls `getNextProvider()`.
3.  **Health Check**: `getNextProvider()` iterates through the configured providers:
    *   If a provider is `healthy`, it's immediately returned.
    *   If an `unhealthy` provider has passed its `cooldownMs` period, it's given another chance by being marked `healthy` and then returned.
    *   If no provider is available, `null` is returned, indicating all providers are currently unavailable or in cooldown.
4.  **Failure Reporting**: If an API call to the returned provider fails, the application *must* call `markFailed(providerName, errorMessage)` to update the provider's status in the chain. This marks the provider as `unhealthy`, increments its `consecutiveFailures`, and starts its cooldown timer.
5.  **Recovery**: After its `cooldownMs` period, an `unhealthy` provider becomes eligible for re-evaluation by `getNextProvider()`. If it's successfully used again, its health status is reset.

### Failover Flow

```mermaid
graph TD
    A[Application Needs LLM] --> B{Call getNextProvider()};
    B --> C{Is current provider healthy?};
    C -- Yes --> D[Return Provider];
    C -- No --> E{Has cooldownMs passed for current provider?};
    E -- Yes --> F[Mark Provider Healthy, Reset Failures];
    F --> D;
    E -- No --> G{Move to next provider in chain};
    G --> C;
    G -- No more providers --> H[Return null];

    D --> I[Attempt LLM Call];
    I -- Success --> J[Continue Application];
    I -- Failure --> K[Call markFailed(provider, error)];
    K --> L[Provider marked Unhealthy, Cooldown starts];
    L --> A;
```

## Integration and Usage

This module is designed to be integrated into an LLM orchestration layer or agent system.

1.  **Setup the Chain**:
    ```typescript
    import { ModelFailoverChain } from './src/agents/model-failover';

    // Option 1: From environment variables
    const failoverChain = ModelFailoverChain.fromEnvironment();

    // Option 2: Manually
    const customChain = new ModelFailoverChain([
      { provider: 'my-primary', model: 'model-a', apiKey: process.env.PRIMARY_API_KEY },
      { provider: 'my-fallback', model: 'model-b', apiKey: process.env.FALLBACK_API_KEY },
    ], { cooldownMs: 30000 }); // 30 seconds cooldown
    ```

2.  **Get a Provider and Make a Call**:
    ```typescript
    async function makeLLMCall(prompt: string): Promise<string | null> {
      let providerEntry = failoverChain.getNextProvider();

      if (!providerEntry) {
        console.error('No healthy LLM providers available.');
        return null;
      }

      try {
        // Example: Use providerEntry.provider, providerEntry.model, providerEntry.apiKey
        // to initialize an LLM client and make a call.
        console.log(`Attempting call with ${providerEntry.provider} (${providerEntry.model})...`);
        // const llmClient = new LLMClient(providerEntry); // Hypothetical client
        // const response = await llmClient.generate(prompt);
        const response = await simulateLLMCall(providerEntry, prompt); // Placeholder

        failoverChain.markHealthy(providerEntry.provider); // Mark healthy on success
        return response;

      } catch (error: any) {
        console.error(`Call to ${providerEntry.provider} failed: ${error.message}`);
        failoverChain.markFailed(providerEntry.provider, error.message); // Mark failed on error
        // Optionally, retry with the next provider immediately or let the next call handle it
        return makeLLMCall(prompt); // Recursive retry for demonstration
      }
    }

    // Placeholder for actual LLM interaction
    async function simulateLLMCall(entry: FailoverEntry, prompt: string): Promise<string> {
      // Simulate success or failure based on some condition
      if (entry.provider === 'grok' && Math.random() < 0.3) { // Grok fails 30% of the time
        throw new Error('Simulated Grok API error');
      }
      if (entry.provider === 'claude' && Math.random() < 0.1) { // Claude fails 10% of the time
        throw new Error('Simulated Claude API error');
      }
      return `Response from ${entry.provider} using model ${entry.model} for prompt: "${prompt}"`;
    }

    // Example usage
    (async () => {
      console.log('Initial status:', failoverChain.getStatus());
      for (let i = 0; i < 10; i++) {
        const result = await makeLLMCall('Tell me a short story.');
        console.log(`Attempt ${i + 1}:`, result);
        console.log('Current status:', failoverChain.getStatus());
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait a bit
      }
    })();
    ```

## Connections to the Codebase

While the provided call graph primarily shows usage from test files (`model-failover.test.ts`, `fallback-chain.test.ts`), this module is designed as a foundational utility for any part of the application that needs to interact with external LLM providers.

-   **Agent Orchestration**: Higher-level agent modules would instantiate `ModelFailoverChain` (likely via `fromEnvironment()`) and use its `getNextProvider()`, `markFailed()`, and `markHealthy()` methods to manage their LLM interactions.
-   **Configuration**: The `fromEnvironment()` static method provides a clear integration point for application startup, allowing environment variables to dictate the available LLM providers without code changes.
-   **Provider Abstraction**: This module helps abstract away the specifics of individual LLM providers, allowing the rest of the codebase to simply request "an LLM" and let the failover chain handle which specific provider is used.