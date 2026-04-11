---
title: "src — copilot"
module: "src-copilot"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.425Z"
---
# src — copilot

The `src/copilot/copilot-proxy.ts` module provides a robust, configurable HTTP proxy server designed to emulate the GitHub Copilot API. Its primary purpose is to intercept and process AI completion requests, delegating the actual generation of completions to a custom, pluggable handler. This allows other modules to integrate their own AI models or logic while benefiting from the proxy's built-in features like authentication, rate limiting, and standardized API responses.

## Overview

The `CopilotProxy` class creates a local HTTP server that listens for incoming requests, primarily targeting the `/v1/completions` endpoint. It acts as a middleware layer, handling common concerns such as:

*   **API Emulation**: Mimics key Copilot API endpoints (`/v1/completions`, `/v1/models`, `/health`).
*   **Authentication**: Supports bearer token authentication.
*   **Rate Limiting**: Implements IP-based request rate limiting.
*   **Request Parsing & Validation**: Parses incoming JSON bodies and validates essential fields like `prompt`.
*   **Completion Delegation**: Forwards validated completion requests to a user-defined `onCompletion` callback.
*   **Error Handling**: Provides standardized JSON error responses for various issues (auth, rate limit, bad request, internal errors).

This module is crucial for integrating custom AI completion services into environments that expect a Copilot-compatible API.

## Core Components

### `CopilotProxy` Class

The central component of this module. `CopilotProxy` is an `EventEmitter`, allowing consumers to subscribe to lifecycle events like `listening` (when the server starts) and `error` (for unhandled server errors).

**Key Methods:**

*   `constructor(config: CopilotProxyConfig)`: Initializes the proxy with the provided configuration. Sets up default values and a timer for rate limit cleanup.
*   `start(): Promise<void>`: Asynchronously starts the HTTP server, binding it to the configured host and port. Emits a `listening` event on success.
*   `stop(): Promise<void>`: Asynchronously stops the HTTP server and clears the rate limit cleanup timer.
*   `handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>`: The core request handler. This private method orchestrates authentication, rate limiting, endpoint routing, and completion processing.
*   `authenticate(req: IncomingMessage): boolean`: Checks the `Authorization` header against the configured `authToken`.
*   `checkRateLimit(clientIp: string): boolean`: Implements a token-bucket-like rate limiting mechanism per client IP.
*   `parseBody(req: IncomingMessage): Promise<string>`: Reads and buffers the incoming request body, enforcing a `MAX_BODY_SIZE` limit (10MB).
*   `getRequestCount(): number`: Returns the total number of requests processed since the server started.
*   `isRunning(): boolean`: Checks if the server is currently listening for requests.

### `CopilotProxyConfig` Interface

This interface defines the configuration options for the `CopilotProxy`.

```typescript
export interface CopilotProxyConfig {
  port: number;
  host: string;
  authToken?: string;
  requireAuth?: boolean;
  maxTokens: number;
  maxTokensLimit?: number;
  rateLimitPerMinute?: number;
  onCompletion: (req: CopilotCompletionRequest) => Promise<CopilotCompletionResponse>;
}
```

**Key Configuration Properties:**

*   `port`, `host`: Standard network configuration for the HTTP server.
*   `authToken?`: An optional bearer token string. If provided, requests must include `Authorization: Bearer <authToken>`.
*   `requireAuth?`: If `true`, authentication is enforced even if `authToken` is not set (useful for testing unauthorized access). Defaults to `false`.
*   `maxTokens`: The default `max_tokens` value to use if a client request does not specify it.
*   `maxTokensLimit?`: An absolute upper bound for `max_tokens` requested by clients. This prevents clients from requesting excessively long completions, defaulting to `8192` if not specified.
*   `rateLimitPerMinute?`: The maximum number of requests allowed per minute per unique client IP address. Defaults to `60`.
*   `onCompletion`: **This is the most critical property.** It's a callback function that the proxy invokes when a valid completion request is received. This function is responsible for interacting with the actual AI model and returning a `CopilotCompletionResponse`.

### `CopilotCompletionRequest` & `CopilotCompletionResponse` Interfaces

These interfaces define the standardized structure for completion requests and responses, mirroring the expected format of the Copilot API.

*   `CopilotCompletionRequest`: Contains fields like `prompt`, `suffix`, `max_tokens`, `temperature`, `top_p`, `n`, `stop`, `language`, and `file_path`.
*   `CopilotCompletionResponse`: Contains `id`, an array of `choices` (each with `text`, `index`, `finish_reason`), and optional `usage` statistics.

## How It Works

The `CopilotProxy` operates by creating a standard Node.js HTTP server and routing incoming requests through a series of checks and handlers.

```mermaid
sequenceDiagram
    participant Client
    participant CopilotProxy
    participant CustomCompletionHandler

    Client->>CopilotProxy: HTTP Request (e.g., POST /v1/completions)
    CopilotProxy->>CopilotProxy: handleRequest(req, res)
    CopilotProxy->>CopilotProxy: checkRateLimit(clientIp)
    alt Rate Limit Exceeded
        CopilotProxy-->>Client: 429 Rate Limit Exceeded
    else
        CopilotProxy->>CopilotProxy: authenticate(req)
        alt Unauthorized
            CopilotProxy-->>Client: 401 Unauthorized
        else
            alt GET /health
                CopilotProxy-->>Client: 200 OK
            alt GET /v1/models
                CopilotProxy-->>Client: 200 OK (model list)
            alt POST /v1/completions
                CopilotProxy->>CopilotProxy: parseBody(req)
                CopilotProxy->>CopilotProxy: Validate & Clamp max_tokens
                CopilotProxy->>CustomCompletionHandler: config.onCompletion(request)
                CustomCompletionHandler-->>CopilotProxy: CopilotCompletionResponse
                CopilotProxy-->>Client: 200 OK (Completion Response)
            else Other Path
                CopilotProxy-->>Client: 404 Not Found
            end
        end
    end
```

1.  **Server Start**: When `start()` is called, an `http.Server` instance is created and begins listening on the configured `port` and `host`. All incoming requests are directed to the `handleRequest` method.
2.  **Request Handling (`handleRequest`)**:
    *   **Rate Limiting**: The `checkRateLimit` method is called first. If the client's IP has exceeded the `rateLimitPerMinute`, a `429 Too Many Requests` response is sent. A background timer (`rateLimitCleanupTimer`) periodically cleans up stale IP entries from the `rateLimitMap`.
    *   **Authentication**: The `authenticate` method verifies the `Authorization` header. If authentication fails or is required but no token is present, a `401 Unauthorized` response is sent.
    *   **Endpoint Routing**:
        *   `GET /health`: Returns a simple `200 OK` status.
        *   `GET /v1/models`: Returns a hardcoded JSON response listing a dummy model (`id: 'codebuddy'`). This is primarily for client compatibility.
        *   `POST /v1/completions` (or `/v1/engines/codex/completions`): This is the main completion endpoint.
            *   The request body is parsed by `parseBody`.
            *   The parsed JSON is validated to ensure a `prompt` is present.
            *   The `max_tokens` value is set to `config.maxTokens` if not provided by the client, and then clamped to `config.maxTokensLimit` to prevent abuse.
            *   The `config.onCompletion` callback is invoked with the `CopilotCompletionRequest`.
            *   The response from `onCompletion` is then sent back to the client with a `200 OK` status.
        *   Any other path or method receives a `404 Not Found` response.
3.  **Error Handling**:
    *   Errors during body parsing (e.g., invalid JSON, payload too large) result in `400 Bad Request`.
    *   Errors originating from the `onCompletion` callback or other internal server issues are caught, and a `500 Internal Server Error` is returned. The proxy ensures that internal error details are not leaked to the client.

## Integration and Extensibility

The `CopilotProxy` is designed to be easily integrated into any Node.js application that needs to expose a Copilot-compatible API for custom AI models.

The primary point of integration and extensibility is the `onCompletion` callback in `CopilotProxyConfig`. This function is where you connect your custom AI logic.

**Example Usage:**

```typescript
import { CopilotProxy, CopilotCompletionRequest, CopilotCompletionResponse } from './copilot-proxy';

async function myCustomCompletionHandler(
  request: CopilotCompletionRequest
): Promise<CopilotCompletionResponse> {
  console.log('Received completion request:', request.prompt);

  // Simulate an AI model's response
  const generatedText = `// This is a simulated completion for: ${request.prompt}`;

  return {
    id: 'simulated-completion-123',
    choices: [{
      text: generatedText,
      index: 0,
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: request.prompt.length, // Simplified token count
      completion_tokens: generatedText.length,
      total_tokens: request.prompt.length + generatedText.length,
    },
  };
}

async function main() {
  const proxy = new CopilotProxy({
    port: 3000,
    host: '127.0.0.1',
    authToken: 'my-secret-token', // Optional: set for authentication
    maxTokens: 100,
    maxTokensLimit: 500,
    rateLimitPerMinute: 10,
    onCompletion: myCustomCompletionHandler, // Plug in your custom logic here
  });

  proxy.on('listening', () => {
    console.log(`Copilot Proxy listening on http://${proxy.config.host}:${proxy.config.port}`);
    console.log('Try: curl -H "Authorization: Bearer my-secret-token" -X POST -H "Content-Type: application/json" -d \'{"prompt": "function helloWorld() {"}\' http://127.0.0.1:3000/v1/completions');
  });

  proxy.on('error', (err) => {
    console.error('Copilot Proxy error:', err);
  });

  await proxy.start();

  // To stop the proxy later:
  // await proxy.stop();
}

main().catch(console.error);
```

This module provides a flexible and robust foundation for building custom AI completion services that are compatible with existing Copilot-aware clients.