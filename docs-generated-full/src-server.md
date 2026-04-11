---
title: "src — server"
module: "src-server"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.707Z"
---
# src — server

The `src/server` module is the backbone of the Code Buddy application, providing the core HTTP REST API and WebSocket server. It acts as the central gateway for interacting with the AI agent, managing sessions, tools, system health, and various internal protocols. This module is designed to be robust, secure, and extensible, handling concerns like authentication, authorization, rate limiting, logging, and error management.

## Architecture Overview

The server module is built on Express.js, providing a flexible and widely understood framework for handling HTTP requests. It orchestrates a chain of middleware for cross-cutting concerns before routing requests to specific handlers. A WebSocket server runs alongside the HTTP server, enabling real-time communication.

The `src/server/index.ts` file is the main entry point, responsible for:
1.  **Configuration**: Loading server settings from environment variables and `constants.ts`.
2.  **Middleware Setup**: Applying global middleware for security, logging, rate limiting, and authentication.
3.  **Route Registration**: Mounting various API routers for different functionalities (chat, tools, sessions, health, etc.).
4.  **WebSocket Initialization**: Setting up the WebSocket server for real-time interactions.
5.  **Startup & Shutdown**: Managing the server's lifecycle.

```mermaid
graph TD
    A[src/server/index.ts] --> B(Express Application)
    B -- Configures --> C(Middleware Chain)
    C --> C1(Request ID)
    C --> C2(Security Headers)
    C --> C3(Logging)
    C --> C4(CORS)
    C --> C5(Body Parsing)
    C --> C6(Rate Limiting)
    C --> C7(Authentication)
    C --> C8(CSRF Protection)
    B -- Mounts --> D(API Routes)
    D --> D1[/api/chat]
    D --> D2[/api/tools]
    D --> D3[/api/sessions]
    D --> D4[/api/health]
    D --> D5[/api/metrics]
    D --> D6[/api/workflows]
    D --> D7[/api/a2a]
    D --> D8[/api/acp]
    D --> D9[/__codebuddy__/dashboard]
    B -- Initializes --> E(WebSocket Server)
    E --> E1(src/server/websocket/index.ts)
    D1 -- Uses --> F(src/agent/codebuddy-agent.ts)
    D7 & D8 -- Uses --> G(src/protocols/a2a/index.ts)
    C7 -- Uses --> H(src/server/auth/index.ts)
    C6 -- Uses --> I(src/server/middleware/rate-limit.ts)
    C3 -- Uses --> J(src/utils/logger.ts)
    C5 -- Uses --> K(src/server/middleware/error-handler.ts)
```

## Key Components

### 1. Main Server (`src/server/index.ts`)

This file is the orchestrator. The `startServer` function initializes the Express application via `createApp`, sets up the WebSocket server, and starts listening for incoming connections. It also handles the graceful shutdown of the server via `stopServer`.

**Key Functions:**

*   `startServer(userConfig: Partial<ServerConfig>)`: The primary function to start the HTTP and WebSocket servers. It merges default configuration with any provided `userConfig`.
*   `createApp(config: ServerConfig)`: Configures the Express application, applying all middleware and mounting the various API routers. This function is where the server's request processing pipeline is defined.
*   `stopServer(server: HttpServer)`: Gracefully shuts down the HTTP server and closes all active WebSocket connections.
*   `getServerStats(server: HttpServer)`: Provides runtime statistics about server connections.
*   `getJwtSecret()`: Generates an ephemeral JWT secret for development or retrieves it from `JWT_SECRET` environment variable in production, enforcing its presence for security.

The `createApp` function is particularly important as it defines the order of middleware and routes:
1.  `requestIdMiddleware`: Assigns a unique ID to each request.
2.  `createSecurityHeadersMiddleware`: Adds HTTP security headers (CSP, HSTS, etc.).
3.  `createLoggingMiddleware`: Logs incoming requests and outgoing responses.
4.  `cors`: Handles Cross-Origin Resource Sharing.
5.  `express.json`, `express.urlencoded`: Parses request bodies.
6.  `createRateLimitMiddleware`: Applies global and route-specific rate limits.
7.  `createAuthMiddleware`: Authenticates requests using API keys or JWTs.
8.  `CSRFProtection`: Provides CSRF token generation and validation for state-changing requests.
9.  **API Routes**: Various routers are mounted for specific functionalities.
10. `notFoundHandler`: Catches requests to undefined routes (404).
11. `errorHandler`: Centralized error handling for all API errors.

### 2. Authentication & Authorization (`src/server/auth/`)

This sub-module provides the mechanisms for securing API access.

#### `src/server/auth/api-keys.ts`

Manages API keys, which are long-lived credentials for programmatic access.

**Key Functions:**

*   `generateApiKey()`: Creates a new random API key string and its SHA256 hash.
*   `hashApiKey(key: string)`: Hashes an API key for secure storage.
*   `createApiKey(options: { ... })`: Generates a new API key, hashes it, and stores its metadata (name, user, scopes, rate limit, expiration) in an in-memory `Map`.
    *   **Note**: In a production environment, this in-memory store (`apiKeys`) should be replaced with a persistent database.
*   `validateApiKey(key: string)`: Checks if a given API key is valid, active, and not expired. Updates `lastUsedAt`.
*   `hasScope(apiKey: ApiKey, scope: ApiScope)`: Determines if an API key has a specific scope (including `admin` for full access).
*   `hasAnyScope(apiKey: ApiKey, scopes: ApiScope[])`: Checks if an API key possesses at least one of the required scopes.
*   `revokeApiKey(keyId: string)`: Deactivates an API key by its ID.
*   `listApiKeys(userId: string)`: Retrieves all API keys associated with a specific user.
*   `deleteApiKey(keyId: string, userId: string)`: Permanently removes an API key.
*   `getApiKeyById(keyId: string)`: Fetches an API key by its internal ID.
*   `updateApiKeyScopes(keyId: string, scopes: ApiScope[])`: Modifies the scopes associated with an API key.
*   `getApiKeyStats()`: Provides statistics on total, active, and expired API keys.

#### `src/server/auth/jwt.ts`

Handles JSON Web Tokens (JWTs) for session-based or short-lived authentication.

**Key Functions:**

*   `generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, expiresIn: string)`: Creates a signed JWT with a given payload and expiration.
*   `verifyToken(token: string, secret: string)`: Validates a JWT's signature and expiration, returning its payload if valid. Uses `timingSafeEqual` for signature comparison to prevent timing attacks.
*   `decodeToken(token: string)`: Decodes a JWT's payload *without* verification (useful for debugging or checking claims before full validation).
*   `isTokenExpired(token: string)`: Checks if a token's `exp` claim indicates it has expired.
*   `getTokenTTL(token: string)`: Returns the time-to-live (in seconds) for a token.
*   `refreshToken(token: string, secret: string, expiresIn: string)`: Generates a new token with the same payload as a valid, unexpired token.
*   `createAccessToken(keyId: string, scopes: ApiScope[], secret: string, expiresIn: string)`: Creates a JWT specifically for API key access.
*   `createUserToken(userId: string, scopes: ApiScope[], secret: string, expiresIn: string)`: Creates a JWT for user authentication.

### 3. Middleware (`src/server/middleware/`)

This directory contains reusable Express middleware functions that handle common concerns across API routes.

#### `src/server/middleware/auth.ts`

Integrates API key and JWT validation into the Express request lifecycle.

**Key Functions:**

*   `createAuthMiddleware(config: ServerConfig)`: The main authentication middleware. It attempts to extract a token from `Authorization` or `X-API-Key` headers, then validates it as either an API key or a JWT. If successful, it populates `req.auth` with authentication details.
*   `requireScope(...scopes: ApiScope[])`: A middleware factory that returns a middleware to enforce specific API scopes. If `req.auth` is not present or lacks the required scopes, it returns a 403 Forbidden error.
*   `optionalAuth(config: ServerConfig)`: Similar to `createAuthMiddleware` but does not return an error if no token is provided or if it's invalid. It populates `req.auth` only if a valid token is found.
*   `extractToken(req: Request)`: Internal helper to safely extract a token from request headers.

#### `src/server/middleware/error-handler.ts`

Provides a centralized and structured approach to error handling.

**Key Components:**

*   `ApiServerError`: A custom error class for API-specific errors, allowing consistent error responses with `code`, `status`, and `details`. Includes static factory methods like `badRequest`, `unauthorized`, `forbidden`, `notFound`, `rateLimited`, `internal`, `serviceUnavailable`.
*   `errorHandler: ErrorRequestHandler`: The global Express error handling middleware. It logs errors, formats them into a consistent `ApiError` structure, and sends appropriate HTTP status codes. It also handles common errors like `SyntaxError` (for invalid JSON) and `ValidationError`.
*   `notFoundHandler(req: Request, res: Response)`: A middleware specifically for handling 404 Not Found errors for unhandled routes.
*   `asyncHandler<T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>)`: A utility wrapper for asynchronous route handlers. It catches any promise rejections and passes them to the `errorHandler`, preventing unhandled promise rejections from crashing the server.
*   `requestIdMiddleware(req: Request, res: Response, next: NextFunction)`: Assigns a unique `X-Request-ID` to each incoming request, useful for tracing and logging.
*   `validateRequired<T extends object>(body: T, fields: (keyof T | string)[])`: Throws an `ApiServerError.badRequest` if any specified fields are missing from the request body.
*   `validateTypes(body: Record<string, unknown>, schema: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>)`: Throws an `ApiServerError.badRequest` if fields in the request body do not match the expected types in the schema.

#### `src/server/middleware/logging.ts`

Provides request and response logging, along with basic request statistics.

**Key Functions:**

*   `createLoggingMiddleware(config: ServerConfig)`: Logs request details (method, path, status, response time, user ID) to the console. It also collects runtime statistics.
*   `createJsonLoggingMiddleware(config: ServerConfig)`: An alternative logging middleware that outputs logs in JSON format, suitable for structured logging systems.
*   `getRequestStats()`: Returns aggregated statistics about requests, including total, errors, average latency, and counts by endpoint and status code.
*   `resetRequestStats()`: Resets the collected request statistics.

#### `src/server/middleware/rate-limit.ts`

Implements a sliding window rate limiting mechanism to protect the API from abuse.

**Key Functions:**

*   `createRateLimitMiddleware(config: ServerConfig)`: The main rate limiting middleware. It applies global rate limits and can be configured with `routeRateLimits` to apply different limits based on URL prefixes.
*   `endpointRateLimit(maxRequests: number, windowMs: number)`: Creates a rate limiter specifically for a single endpoint.
*   `createRouteRateLimiter(options: RateLimitOptions)`: A factory function to create a rate limiter for a group of routes (e.g., all routes under `/auth`).
*   `getRateLimitStats(keyId: string)`: Retrieves current rate limit usage for a specific key.
*   `resetRateLimit(keyId: string)`: Resets the rate limit counter for a given key (admin function).
*   `getAllRateLimits()`: Returns all active rate limit entries (admin function).
*   `rateLimiters`: Predefined rate limiters for common use cases (e.g., `auth`, `api`, `readonly`, `sensitive`).

#### `src/server/middleware/security-headers.ts`

Adds essential HTTP security headers to enhance the application's security posture.

**Key Functions:**

*   `createSecurityHeadersMiddleware(serverConfig: ServerConfig, securityConfig: SecurityHeadersConfig)`: The main middleware to apply security headers. It supports Content-Security-Policy (CSP), X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Strict-Transport-Security (HSTS), Referrer-Policy, and Permissions-Policy.
*   `getRecommendedConfig()`: Returns a preset security configuration based on `NODE_ENV` (strict for production, more relaxed for development).
*   `STRICT_API_CONFIG`, `STATIC_ASSETS_CONFIG`, `DEVELOPMENT_CONFIG`: Predefined configurations for different deployment scenarios.

### 4. API Routes (`src/server/routes/`)

This directory contains the route definitions for various API functionalities. Each file typically exports an Express `Router` instance.

#### `src/server/routes/a2a-protocol.ts`

Implements endpoints for the Google Agent-to-Agent (A2A) protocol, enabling discovery and interaction with other agents.

**Key Function:**

*   `createA2AProtocolRoutes()`: Returns an Express router with A2A endpoints:
    *   `GET /.well-known/agent.json`: Agent card discovery.
    *   `GET /agents`: Lists registered agents.
    *   `POST /tasks/send`: Submits a task to an agent.
    *   `GET /tasks/:id`: Retrieves task status.
    *   `POST /tasks/:id/cancel`: Cancels a task.
    *   `GET /agents/by-skill/:skillId`: Finds agents capable of a specific skill.

#### `src/server/routes/acp.ts`

Provides an HTTP transport layer for the Agent Communication Protocol (ACP), including named persistent sessions and task queuing.

**Key Function:**

*   `createACPRoutes()`: Returns an Express router with ACP endpoints:
    *   `POST /send`: Sends a message to an agent, supporting session context, fire-and-forget, and prompt queuing.
    *   `GET /agents`: Lists available agents with their cards.
    *   `POST /request`: Submits a task to an agent.
    *   `GET /tasks/:id`: Gets task status.
    *   `POST /tasks/:id/yield`: Pauses a task, allowing an orchestrator to intervene.
    *   `POST /tasks/:id/resume`: Resumes a yielded task.
    *   `POST /sessions`: Creates a new named session.
    *   `GET /sessions`: Lists all named sessions.
    *   `GET /sessions/:name`: Retrieves a specific session and its tasks.
    *   `DELETE /sessions/:name`: Deletes a session.
    *   `POST /sessions/:name/cancel`: Cancels the active task and clears the queue for a session.
    *   `POST /sessions/:name/close`: Soft-closes a session, preventing new sends.

#### `src/server/routes/canvas.ts`

Manages an agent-driven visual workspace, serving HTML/CSS/JS content and A2UI host pages.

**Key Function:**

*   `createCanvasRoutes(config?: Partial<CanvasRouteConfig>)`: Returns an array of route handlers for:
    *   `GET /__codebuddy__/canvas/`: Serves the current canvas HTML.
    *   `GET /__codebuddy__/canvas/:id`: Serves a specific canvas snapshot.
    *   `POST /__codebuddy__/canvas/push`: Pushes new canvas content (HTML, CSS, JS).
    *   `POST /__codebuddy__/canvas/reset`: Resets the canvas.
    *   `GET /__codebuddy__/a2ui/`: Serves the A2UI host page.
    *   `POST /__codebuddy__/a2ui/eval`: Evaluates A2UI expressions.
    *   `GET /__codebuddy__/a2ui/snapshot`: Gets A2UI snapshot status.
*   `CanvasStore`: An in-memory store for canvas snapshots.

#### `src/server/routes/chat.ts`

Provides endpoints for interacting with the Code Buddy AI agent for chat completions.

**Key Routes:**

*   `POST /api/chat`: Sends a chat message and receives a response from the agent. Validates input messages and optional parameters like `model`, `temperature`, `maxTokens`.
*   `POST /v1/chat/completions`: An OpenAI-compatible endpoint for chat completions, supporting streaming responses.

**Dependencies:**

*   `CodeBuddyAgent` (lazy-loaded from `src/agent/codebuddy-agent.ts`): The core AI agent that processes user messages.
*   `enqueueMessage` (lazy-loaded from `src/channels/index.ts`): Used for non-streaming chat responses.

### 5. Dashboard (`src/server/dashboard.ts`)

This module provides a singleton `Dashboard` class for managing and exposing status and metrics for a web-based control UI.

**Key Class:**

*   `Dashboard`: A singleton class that holds dashboard configuration and runtime status.
    *   `getInstance(config?: DashboardConfig)`: Returns the singleton instance of the Dashboard.
    *   `start(port?: number)`: Initializes and starts the dashboard.
    *   `stop()`: Stops the dashboard.
    *   `getStatus()`: Returns current operational status (running, port, uptime, connected clients).
    *   `getMetrics()`: Provides mock or actual metrics about the agent, sessions, channels, tools, and system health.
    *   `generateDashboardHtml()`: Generates a basic HTML page for the dashboard.

## Integration Points

The `src/server` module integrates with many other parts of the Code Buddy codebase:

*   **`src/utils/logger.ts`**: Centralized logging for all server operations.
*   **`src/config/`**: Retrieves server configuration, model defaults, timeouts, and limits.
*   **`src/types.ts`**: Defines shared data structures and interfaces used across the server and other modules.
*   **`src/websocket/index.ts`**: The HTTP server is passed to `setupWebSocket` to enable WebSocket connections.
*   **`src/metrics/index.ts`**: Initializes the metrics collector for server-wide telemetry.
*   **`src/security/csrf-protection.ts`**: Provides CSRF protection for web-based interactions.
*   **`src/channels/peer-routing.ts`**: Exposes endpoints for peer routing statistics and resolution.
*   **`src/daemon/`**: Provides API endpoints to query the status and health of background daemon services and the heartbeat engine.
*   **`src/scheduler/cron-scheduler.ts`**: Offers endpoints to list and trigger cron jobs.
*   **`src/agent/proactive/index.ts`**: Manages notification preferences.
*   **`src/webhooks/webhook-manager.ts`**: Provides API for managing and triggering webhooks.
*   **`src/skills/hub.ts`**: Exposes endpoints for searching, installing, and uninstalling skills from the Skills Hub.
*   **`src/identity/identity-manager.ts`**: Manages agent identity and prompt injection.
*   **`src/channels/group-security.ts`**: Provides endpoints for managing group security settings (e.g., blocklists).
*   **`src/auth/profile-manager.ts`**: Manages authentication profiles.
*   **`src/protocols/a2a/index.ts`**: Core A2A protocol client and server components used by `a2a-protocol.ts` and `acp.ts`.
*   **`src/agent/codebuddy-agent.ts`**: The primary AI agent logic, consumed by the chat routes.

## Configuration

The server's behavior is highly configurable through environment variables and the `ServerConfig` interface.

**Key Configuration Options (from `DEFAULT_CONFIG` in `src/server/index.ts`):**

*   `port`: The port the server listens on (default: `3000`).
*   `host`: The host address the server binds to (default: `0.0.0.0`).
*   `cors`: Enable/disable CORS.
*   `corsOrigins`: Allowed CORS origins (default: `*`).
*   `rateLimit`: Enable/disable global rate limiting.
*   `rateLimitMax`: Max requests in `rateLimitWindow`.
*   `rateLimitWindow`: Time window for rate limiting in milliseconds.
*   `authEnabled`: Enable/disable authentication (always `true` in production).
*   `jwtSecret`: Secret for signing JWTs (required in production).
*   `jwtExpiration`: Default JWT expiration time.
*   `websocketEnabled`: Enable/disable WebSocket server.
*   `logging`: Enable/disable request logging.
*   `maxRequestSize`: Maximum size for request bodies.
*   `securityHeaders`: Configuration for HTTP security headers (CSP, HSTS, etc.).

These settings can be overridden by environment variables (e.g., `PORT`, `JWT_SECRET`, `AUTH_ENABLED`) or by passing a `Partial<ServerConfig>` object to `startServer`.

## Development & Contribution Notes

*   **In-Memory Stores**: Be aware that `api-keys.ts` and `acp.ts` currently use in-memory `Map`s for storing API keys and ACP sessions/tasks. This means data will not persist across server restarts. For production deployments, these should be backed by a persistent database.
*   **Lazy Imports**: Several modules are lazy-imported in `src/server/index.ts` and `src/server/routes/chat.ts` (e.g., `CodeBuddyAgent`, `getPeerRouter`). This helps reduce initial startup time and avoids circular dependency issues.
*   **Error Handling**: Use `ApiServerError` and `asyncHandler` consistently in new routes to ensure errors are caught, logged, and returned in a standardized format.
*   **Authentication**: All new API routes should use `requireScope` to enforce appropriate authorization. Consider `optionalAuth` for endpoints that can function with or without authentication.
*   **Rate Limiting**: Apply `endpointRateLimit` or `createRouteRateLimiter` for specific endpoints or groups of routes that require stricter rate limits than the global default.
*   **Security Headers**: When adding new static assets or UI components, review the `cspDirectives` in `src/server/middleware/security-headers.ts` to ensure they are not inadvertently blocked by the Content Security Policy.
*   **Testing**: The server module is critical. Ensure any changes are thoroughly tested, especially regarding authentication, authorization, and error handling. The `tests/server/` directory contains relevant test suites.