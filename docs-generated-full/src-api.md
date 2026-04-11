---
title: "src — api"
module: "src-api"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.370Z"
---
# src — api

The `src/api` module in Code Buddy is responsible for enabling external communication and integration. It provides two primary mechanisms: a local REST API server for programmatic interaction and a webhook manager for sending event notifications to external services.

## 1. REST API Server (`src/api/rest-server.ts`)

The `RestApiServer` provides a local HTTP/REST interface, allowing external scripts or applications to interact with Code Buddy. This enables automation of tasks such as sending prompts, executing tools, and querying internal status.

### 1.1 Purpose

*   **Programmatic Control:** Expose core Code Buddy functionalities (e.g., AI prompting, tool execution) via HTTP.
*   **Integration:** Facilitate integration with other development tools, IDEs, or CI/CD pipelines.
*   **Monitoring:** Provide endpoints for checking application health, status, and metrics.

### 1.2 Key Components

*   **`RestApiServer` Class:** The central class managing the HTTP server, routing, and request handling. It extends `EventEmitter` to emit lifecycle and request events.
*   **`ApiServerConfig` Interface:** Defines configuration options for the server, including `port`, `host`, `enableCors`, `apiKey`, and `maxRequestSize`.
*   **`ApiRequest` & `ApiResponse` Interfaces:** Standardize the structure of incoming requests and outgoing responses within the server's internal handling.
*   **`RouteHandler` Type:** A function signature for handlers that process `ApiRequest` and return a `Promise<ApiResponse>`.
*   **External Handlers:** The `RestApiServer` exposes public properties (`onPrompt`, `onToolExecute`, `onGetSessions`, `onGetMetrics`) that are intended to be set by the main Code Buddy application to delegate core logic.
*   **Singleton Access:** `getApiServer()`, `startApiServer()`, and `stopApiServer()` provide a convenient way to manage a single instance of the server throughout the application.

### 1.3 How it Works

1.  **Initialization:**
    *   A `RestApiServer` instance is created, typically via `getApiServer()`.
    *   The constructor merges provided configuration with `DEFAULT_CONFIG`.
    *   `setupDefaultRoutes()` is called to register standard endpoints like `/health`, `/api`, `/api/prompt`, `/api/tools`, `/api/sessions`, `/api/metrics`, and `/api/status`.
2.  **Starting the Server:**
    *   The `start()` method creates an `http.Server` instance and begins listening on the configured `host` and `port`.
    *   It registers `handleRequest()` as the callback for all incoming HTTP requests.
3.  **Request Handling (`handleRequest`):**
    *   Parses the incoming URL, method, and headers.
    *   Applies CORS headers if `enableCors` is true.
    *   Handles `OPTIONS` preflight requests.
    *   Enforces API key authentication if `apiKey` is configured, checking `X-API-Key` or `Authorization` headers.
    *   For `POST`, `PUT`, `PATCH` requests, it asynchronously parses the request body (expecting JSON) using `parseBody()`, respecting `maxRequestSize`.
    *   Constructs an `ApiRequest` object.
    *   Calls `findHandler()` to locate the appropriate `RouteHandler` based on method and path (supporting exact matches and simple `:param` patterns).
    *   If a handler is found, it executes the handler and sends the resulting `ApiResponse` using `sendResponse()`.
    *   If no handler is found, it returns a 404 Not Found response.
    *   Emits a `request` event with details like method, path, status, and duration.
4.  **Route Management:**
    *   `addRoute(method, path, handler)` allows dynamic registration of new routes.
    *   `getEndpoints()` provides a list of all registered API endpoints.

### 1.4 Request Handling Flow

```mermaid
graph TD
    A[HTTP Request] --> B{handleRequest};
    B --> C{Parse URL, Method, Headers};
    C --> D{Apply CORS Headers};
    D --> E{Handle OPTIONS / Check API Key};
    E -- Unauthorized --> F[Send 401 Response];
    E -- Authorized --> G{Parse Body (if POST/PUT/PATCH)};
    G --> H[Create ApiRequest Object];
    H --> I{findHandler(method, path)};
    I -- No Handler --> J[Send 404 Response];
    I -- Handler Found --> K[Execute RouteHandler];
    K --> L[Get ApiResponse];
    L --> M[sendResponse];
    M --> N[HTTP Response];
    M --> O[Emit 'request' event];
```

### 1.5 Integration with Code Buddy Core

The `RestApiServer` acts as a facade. Its default routes for `/api/prompt`, `/api/tools/:tool`, `/api/sessions`, and `/api/metrics` do not contain the core logic themselves. Instead, they check if corresponding public handler functions (`onPrompt`, `onToolExecute`, `onGetSessions`, `onGetMetrics`) have been assigned. The main Code Buddy application is responsible for setting these functions, effectively injecting the business logic into the API server.

**Example:**
```typescript
import { getApiServer } from './api/rest-server';
import { handlePrompt, executeTool, getActiveSessions, getSystemMetrics } from './core-logic'; // Assume these exist

const apiServer = getApiServer();
apiServer.onPrompt = handlePrompt;
apiServer.onToolExecute = executeTool;
apiServer.onGetSessions = getActiveSessions;
apiServer.onGetMetrics = getSystemMetrics;

apiServer.start().then(() => console.log('API Server running'));
```

## 2. Webhook Manager (`src/api/webhooks.ts`)

The `WebhookManager` provides a robust system for sending event-driven notifications to external HTTP endpoints. This allows Code Buddy to integrate with other systems that react to specific events within the application.

### 2.1 Purpose

*   **Event Notifications:** Notify external services about significant events (e.g., session start/end, messages, tool execution, file changes, errors).
*   **Custom Integrations:** Enable users to configure custom webhooks for various automation and monitoring scenarios.
*   **Reliability:** Implement retry mechanisms and exponential backoff for failed deliveries.
*   **Security:** Support payload signing to verify webhook authenticity.

### 2.2 Key Components

*   **`WebhookManager` Class:** The core class responsible for managing webhook configurations, dispatching events, and handling delivery.
*   **`WebhookEvent` Type:** A union type defining the specific events Code Buddy can emit (e.g., `'session.start'`, `'message.user'`, `'tool.complete'`, `'file.modify'`).
*   **`WebhookConfig` Interface:** Defines the configuration for a single webhook, including its `url`, `events` to subscribe to, `secret` for signing, `retryCount`, `retryDelay`, and `timeout`.
*   **`WebhookPayload` Interface:** The standardized structure of the data sent in a webhook request.
*   **`WebhookDelivery` Interface:** Records the status and details of each attempt to deliver a webhook payload.
*   **Configuration Persistence:** Webhook configurations are loaded from and saved to `~/.codebuddy/webhooks.json`.
*   **Singleton Access:** `getWebhookManager()` and `emitWebhook()` provide a convenient way to access the manager and trigger events globally.

### 2.3 How it Works

1.  **Initialization & Configuration:**
    *   A `WebhookManager` instance is created, typically via `getWebhookManager()`.
    *   The constructor attempts to load existing webhook configurations from `~/.codebuddy/webhooks.json` using `loadConfig()`.
    *   Webhooks can be registered, updated, or removed using `register()`, `update()`, and `remove()`, which persist changes via `saveConfig()`.
2.  **Event Emission (`emit`):**
    *   When an event occurs in Code Buddy, `emitWebhook(event, data, sessionId)` is called.
    *   This delegates to `WebhookManager.emit()`.
    *   `emit()` identifies all active webhooks subscribed to the given `event` using `getForEvent()`.
    *   For each matching webhook, it constructs a `WebhookPayload` and initiates delivery via `deliver()`.
    *   Each delivery attempt is recorded in `deliveryHistory` via `addToHistory()`.
3.  **Delivery (`deliver`):**
    *   `deliver()` attempts to send the `WebhookPayload` to the target `webhook.url`.
    *   It implements a retry mechanism with exponential backoff based on `webhook.retryCount` and `webhook.retryDelay`.
    *   Each attempt updates the `WebhookDelivery` status.
4.  **Sending Request (`sendRequest`):**
    *   This private method handles the actual HTTP/HTTPS request.
    *   It serializes the `WebhookPayload` to JSON.
    *   If a `webhook.secret` is configured, it signs the payload using `signPayload()` (HMAC-SHA256) and adds the signature to the `X-Webhook-Signature` header.
    *   It sets standard headers like `Content-Type`, `Content-Length`, and `User-Agent`, along with any custom headers defined in `webhook.headers`.
    *   It handles HTTP/HTTPS requests, timeouts, and processes the response status code.
5.  **Security:**
    *   `signPayload(payload, secret)` generates an HMAC-SHA256 signature for the payload.
    *   `static verifySignature(payload, signature, secret)` allows external services to verify the authenticity of incoming webhooks.
6.  **Delivery History & Retries:**
    *   `getHistory()` and `getFailedDeliveries()` provide access to past delivery attempts.
    *   `retry(deliveryId)` allows manual re-attempting of failed deliveries.
    *   `clearHistory()` clears the stored delivery records.
7.  **Testing:**
    *   `test(id)` provides a utility to send a test webhook payload to a specific registered webhook, useful for debugging configurations.

### 2.4 Webhook Delivery Flow

```mermaid
graph TD
    A[Code Buddy Event Occurs] --> B[emitWebhook(event, data)];
    B --> C[getWebhookManager().emit(event, data)];
    C --> D{Get Webhooks for Event};
    D -- For Each Webhook --> E[deliver(webhook, payload)];
    E --> F{Attempt Delivery (sendRequest)};
    F -- Success --> G[Record Success, Break Retry Loop];
    F -- Failure --> H{Retry?};
    H -- Yes (Exponential Backoff) --> F;
    H -- No (Max Retries) --> I[Record Failure];
    G --> J[Add to Delivery History];
    I --> J;
```

## 3. Interconnections and External Dependencies

The `src/api` module serves as a crucial interface layer, connecting Code Buddy's internal logic to the outside world.

### 3.1 Internal Dependencies

*   **`RestApiServer`:**
    *   Relies on Node.js `http` and `url` for server functionality.
    *   Uses `EventEmitter` for eventing.
    *   Its core functionality depends on external handlers (`onPrompt`, `onToolExecute`, etc.) being provided by the main application.
*   **`WebhookManager`:**
    *   Relies on Node.js `http`, `https`, `crypto` for network requests and payload signing.
    *   Uses `fs-extra` and Node.js `path`, `os` for persistent configuration storage.
    *   Uses `EventEmitter` (implicitly, as `RestApiServer` does, but `WebhookManager` itself doesn't extend it directly, rather it's called by other parts of the app that might emit events).

### 3.2 External Interactions

*   **`RestApiServer`:**
    *   **Incoming:** Receives HTTP requests from any client (e.g., `curl`, browser, scripts).
    *   **Outgoing:** Delegates core operations to functions provided by the main Code Buddy application (e.g., `handlePrompt` from a core AI module, `executeTool` from a tool registry).
*   **`WebhookManager`:**
    *   **Incoming:** `emitWebhook()` is called by various parts of Code Buddy (e.g., session manager, tool executor, file watcher) when relevant events occur.
    *   **Outgoing:** Makes HTTP/HTTPS `POST` requests to external webhook URLs.

### 3.3 Observed Call Graph Anomalies

The provided call graph data shows a few unusual connections that are likely artifacts of static analysis or test-time interactions rather than core runtime dependencies:

*   **`findHandler (src/api/rest-server.ts) → test (src/api/webhooks.ts)`:** The `findHandler` method's purpose is to match incoming HTTP requests to registered route handlers. It is highly improbable that it would directly call `WebhookManager.test()` during normal operation. This connection is almost certainly a result of unit tests for `RestApiServer` that involve testing webhook functionality.
*   **`sendRequest (src/api/webhooks.ts) → destroy (src/sandbox/e2b-sandbox.ts)`:** The `sendRequest` method is an HTTP client responsible for making network requests. It is not designed to directly interact with or destroy a sandbox environment. This connection is very likely a transitive dependency or a test-specific scenario where a webhook delivery (perhaps to a sandbox-related endpoint) might indirectly lead to a sandbox being destroyed in a test cleanup phase, or the call graph tool has misinterpreted a dependency. It does not represent a direct functional call from the HTTP client itself.

Developers should be aware of these potential misinterpretations when analyzing the call graph and focus on the intended functional roles of each component. The primary interaction of `sendRequest` is to make an HTTP request, not to manage sandboxes.