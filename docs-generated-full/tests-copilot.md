---
title: "tests — copilot"
module: "tests-copilot"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.872Z"
---
# tests — copilot

This document provides an overview of the `tests/copilot/copilot-proxy.test.ts` module, which contains the unit tests for the `CopilotProxy` class.

## Module Overview

The `copilot-proxy.test.ts` module is a critical part of the test suite, ensuring the robust and correct operation of the `CopilotProxy` server. It focuses on verifying the core functionalities of the proxy, including authentication, rate limiting, and its lifecycle management.

## Purpose

The primary purpose of this test module is to validate the behavior of the `CopilotProxy` class, located in `src/copilot/copilot-proxy.ts`. It aims to confirm that the proxy:

*   **Handles Authentication Correctly**: Ensures that requests are properly authenticated using a bearer token when `requireAuth` is enabled, and that unauthenticated requests are rejected. It also verifies behavior when authentication is optional.
*   **Enforces Rate Limiting**: Tests that the proxy correctly applies and enforces the configured `rateLimitPerMinute`, rejecting requests once the limit is exceeded.
*   **Manages its Lifecycle**: Verifies that the proxy can be started and stopped reliably, and that its running state is accurately reported via `isRunning()`.
*   **Tracks Request Metrics**: Confirms that the proxy accurately tracks the number of requests processed using `getRequestCount()`.
*   **Initializes with Various Configurations**: Ensures that the `CopilotProxy` can be instantiated and behave as expected with different configuration overrides.

## Test Structure and Helpers

The test suite is organized using `describe` blocks for the `CopilotProxy` class, with individual `it` blocks for specific test cases. Several helper functions are defined within the test file to facilitate consistent test setup and interaction.

### `createProxy(overrides?: Record<string, unknown>): CopilotProxy`

This helper function is responsible for instantiating a `CopilotProxy` instance for each test. It provides a default configuration that includes:

*   A unique `port` for each test to prevent conflicts.
*   A `host` of `127.0.0.1`.
*   A `test-token` for `authToken` and `requireAuth: true`.
*   Default `maxTokens`, `maxTokensLimit`, and `rateLimitPerMinute`.
*   A mock `onCompletion` handler that returns a simple "hello" response.

Tests can override any of these default options by passing an `overrides` object, allowing for flexible testing of different proxy configurations (e.g., `rateLimitPerMinute: 3`, `authToken: undefined`).

### `makeRequest(port: number, options: http.RequestOptions, body?: string): Promise<{ status: number; body: string }>`

This asynchronous helper function simulates an HTTP client making a request to the `CopilotProxy`. It constructs an `http.request` call to the specified `port` and `hostname` (`127.0.0.1`), allowing tests to send requests with custom paths, methods, headers (like `Authorization`), and bodies. It returns a promise that resolves with the HTTP status code and response body, enabling assertions on the proxy's responses.

### `afterEach` Hook

An `afterEach` hook is used to ensure proper cleanup after every test. If a `proxy` instance was created and is currently running (`proxy?.isRunning()`), it calls `await proxy.stop()` to gracefully shut down the server, freeing up the port and preventing resource leaks or conflicts between tests.

## Key Test Scenarios

The module includes several distinct test cases:

*   **Authentication Enforcement**:
    *   `should reject requests without auth token`: Verifies that a 401 status is returned when `requireAuth` is true and no `Authorization` header is provided.
    *   `should accept requests with valid auth token`: Confirms that requests with a matching `Bearer` token are accepted.
    *   `should reject when requireAuth is true and no token configured`: Tests the edge case where authentication is required but no `authToken` is set on the proxy.
    *   `should allow when no auth token and requireAuth is false`: Ensures that requests are allowed when authentication is explicitly disabled.
*   **Rate Limiting**:
    *   `should enforce rate limiting`: Tests that after a configured number of requests (`rateLimitPerMinute`), subsequent requests receive a 429 (Too Many Requests) status.
*   **Proxy State and Metrics**:
    *   `should track request count`: Verifies that `proxy.getRequestCount()` accurately reflects the number of successful requests.
    *   `should report running state`: Confirms that `proxy.isRunning()` correctly reports the proxy's state before `start()`, after `start()`, and after `stop()`.

## Integration with `CopilotProxy`

This test module directly interacts with the `CopilotProxy` class. It instantiates `CopilotProxy` objects, calls its public methods like `start()`, `stop()`, `isRunning()`, and `getRequestCount()`, and sends HTTP requests to the server it creates. The `onCompletion` callback provided during proxy creation is a mock implementation, allowing the tests to control the AI model's response without needing an actual external AI service.

```mermaid
graph TD
    subgraph Test Suite (copilot-proxy.test.ts)
        A[describe('CopilotProxy')] --> B(createProxy)
        A --> C(makeRequest)
        A --> D(afterEach)
        A --> E{it(...) assertions}
    end

    subgraph CopilotProxy (src/copilot/copilot-proxy.ts)
        F[CopilotProxy Constructor]
        G[start()]
        H[stop()]
        I[isRunning()]
        J[getRequestCount()]
    end

    B --> F
    C -- HTTP Request --> G
    D --> H
    E --> I
    E --> J
```

This diagram illustrates how the test suite's components interact with the `CopilotProxy` class. `createProxy` constructs `CopilotProxy` instances, `makeRequest` simulates client interactions over HTTP, and the test assertions directly call `CopilotProxy` methods to verify its internal state and behavior.