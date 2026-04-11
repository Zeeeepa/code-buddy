---
title: "tests — server"
module: "tests-server"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.004Z"
---
# tests — server

This document provides an overview of the `tests/server` module, which contains comprehensive tests for the server-side components of the application. These tests ensure the robustness, correctness, and expected behavior of the API server, its middleware, authentication mechanisms, protocol implementations, and various feature-specific routes.

The tests are written using `vitest` and `jest` and employ mocking extensively to isolate units of functionality, verify contracts between layers, and simulate various scenarios without requiring a full server stack for every test.

## Module Purpose

The `tests/server` module serves several critical purposes:

1.  **Validation of API Contracts**: Ensures that API endpoints respond with the expected status codes, data formats, and error messages.
2.  **Middleware Correctness**: Verifies that core middleware (authentication, rate limiting, logging, error handling) functions as designed.
3.  **Protocol Compliance**: Confirms that internal and external communication protocols (like A2A and WebSocket) adhere to their specifications.
4.  **Concurrency Management**: Tests the serialization and parallelization logic for handling concurrent requests.
5.  **Feature Integration**: Validates the integration of various server-side features with their underlying managers and engines.

## Core Server Infrastructure Tests

This section covers tests related to the fundamental building blocks of the API server.

### API Server Configuration and Route Registration (`api-server.test.ts`)

The `api-server.test.ts` file focuses on verifying the foundational setup of the Express API server. It uses mocks for `express` and `cors` to inspect how the application configures itself and registers its routes, rather than making live HTTP requests.

**Key Aspects Tested:**

*   **Default and Custom Configuration**: Ensures the server correctly applies default configuration values (e.g., `port`, `host`, `cors`, `authEnabled`) and allows for custom overrides. It also checks environment variable parsing for configuration.
*   **Route Definitions**: Verifies that all expected API routes are defined for various domains, including:
    *   `/api/health` (e.g., `/api/health/ready`, `/api/health/metrics`)
    *   `/api/chat` (e.g., `/api/chat/completions`, `/api/chat/models`)
    *   `/api/tools` (e.g., `/api/tools/:name/execute`)
    *   `/api/sessions` (e.g., `/api/sessions/:id/messages`, `/api/sessions/:id/fork`)
    *   `/api/memory` (e.g., `/api/memory/search`, `/api/memory/clear`)
*   **Response Formatting**: Tests the expected structure and content of responses from various endpoints, such as health status, OpenAI-compatible chat completions, tool information, session details, and memory entries.

### Middleware Functionality (`middleware.test.ts`)

The `middleware.test.ts` file contains tests for the various Express middleware components that process incoming requests and outgoing responses. These tests simulate the behavior of middleware in isolation.

**Key Middleware Tested:**

*   **Rate Limiting**:
    *   Tracks requests per key (e.g., `key:test123`, `user:user456`, `ip:127.0.0.1`).
    *   Implements a sliding window mechanism.
    *   Returns `429 Too Many Requests` when limits are exceeded.
    *   Sets standard `X-RateLimit-*` and `Retry-After` headers.
*   **Authentication**:
    *   Extracts `Bearer` tokens and `X-API-Key` headers.
    *   Validates API key formats (e.g., `cb_sk_...`).
    *   Checks required scopes for operations (e.g., `chat`, `tools:execute`, `admin`).
    *   Handles basic authentication.
*   **Error Handler**:
    *   Formats API error responses with `code`, `message`, `status`, and `requestId`.
    *   Generates specific error types: `400 BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `429 RATE_LIMITED`.
    *   Hides stack traces in production environments.
*   **Logging**:
    *   Creates structured log entries with `timestamp`, `requestId`, `method`, `path`, `ip`, `userAgent`, `statusCode`, and `responseTime`.
    *   Tracks request statistics (total, errors, latency, by endpoint, by status).
    *   Applies color coding to status codes for readability.
    *   Formats logs as JSON.
*   **Request ID**:
    *   Generates unique request IDs.
    *   Uses provided request IDs if available.
    *   Sets the `X-Request-ID` response header.
*   **Validation Helpers**: Includes tests for generic validation logic, such as checking for required fields and validating field types.

### Authentication Mechanisms (`auth.test.ts`)

The `auth.test.ts` file provides detailed tests for the API key and JWT (JSON Web Token) authentication systems, leveraging Node.js's `crypto` module for cryptographic operations.

**Key Areas Tested:**

*   **API Key Management**:
    *   **Generation**: Ensures keys have the correct prefix (`cb_sk_`), are unique, and can be hashed securely using `createHmac`.
    *   **Validation**: Checks key format, expiration, and verifies the key hash.
    *   **Scope Checking**: Verifies that keys possess the necessary scopes for operations, including support for wildcard scopes (e.g., `tools:*`) and the `admin` super-scope.
    *   **Revocation**: Tests the mechanism for marking keys as revoked and rejecting them.
    *   **Listing**: Ensures sensitive information like `keyHash` is not exposed in public listings, and `keyPreview` is generated correctly.
*   **JWT Authentication**:
    *   **Token Generation**: Tests the creation of JWT headers, payloads (with claims like `sub`, `userId`, `scopes`, `iat`, `exp`), and signatures using HMAC-SHA256.
    *   **Token Verification**: Validates parsing of token parts, rejection of malformed tokens, decoding of payloads, and signature verification.
    *   **Token Expiration**: Checks for token expiry and supports various expiration formats (e.g., `24h`, `30m`).
    *   **Token Refresh**: Ensures new tokens are issued with extended expiration while preserving user claims, and that revoked tokens cannot be refreshed.
    *   **Claims**: Verifies the presence of required claims and support for custom claims.
*   **Authentication Flow**: Tests the logic for preferring API keys over JWTs and extracting authentication information from multiple request headers.

### Concurrency and Request Serialization (`lane-queue-server.test.ts`)

The `lane-queue-server.test.ts` file focuses on the server-side integration of the `LaneQueue` concurrency mechanism. It ensures that requests are properly serialized within a "lane" (e.g., for a specific session or connection) while allowing parallel processing across different lanes.

**Key Functions and Concepts Tested:**

*   **`LaneQueue`**: The core concurrency primitive that manages queues for different "lanes" or keys.
*   **`enqueueMessage(sessionKey, handler)`**: The primary function used to submit tasks to a specific lane.
*   **`getChannelLaneQueue()` / `resetChannelLaneQueue()`**: Functions to interact with the global `LaneQueue` instance.
*   **Session Serialization**:
    *   **HTTP Chat Routes**: Verifies that multiple chat requests for the *same* `sessionId` are processed sequentially.
    *   **WebSocket Connections**: Ensures messages within a *single* WebSocket connection (`ws:connectionId`) are serialized.
    *   **Webhooks**: Confirms that webhook messages for the *same* chat ID (`webhook:source:chatId`) are processed in order.
*   **Parallel Processing**: Demonstrates that requests for *different* session keys (different HTTP sessions, different WebSocket connections, different webhook chats) can execute concurrently.
*   **Lane Queue Statistics**: Tracks `completedTasks`, `failedTasks`, `totalTasks` for individual lanes and globally.
*   **Error Handling**: Ensures that a failing task within a lane does not block subsequent tasks in the same lane.

The following Mermaid diagram illustrates the core concept of the `LaneQueue`:

```mermaid
graph TD
    A[Incoming Request] --> B{Determine Session Key};
    B -- "api:chat:sessionId" --> C1[LaneQueue: HTTP Chat];
    B -- "ws:connectionId" --> C2[LaneQueue: WebSocket];
    B -- "webhook:source:chatId" --> C3[LaneQueue: Webhook];
    C1 -- "Enqueue Task" --> D1[Task 1 (Session A)];
    C1 -- "Enqueue Task" --> D2[Task 2 (Session A)];
    C2 -- "Enqueue Task" --> E1[Task 1 (Connection X)];
    C2 -- "Enqueue Task" --> E2[Task 2 (Connection X)];
    D1 --> F{Execute Task};
    D2 -- "Waits for D1" --> F;
    E1 --> G{Execute Task};
    E2 -- "Waits for E1" --> G;
    C1 -- "Different Session" --> H[LaneQueue: HTTP Chat (Session B)];
    H -- "Enqueue Task" --> I[Task 1 (Session B)];
    I --> J{Execute Task};
    F & J --> K[Parallel Execution];
```
This diagram shows how requests are categorized by a `Session Key` and routed to dedicated `LaneQueue` instances. Tasks within the same lane are executed sequentially, ensuring order, while tasks in different lanes can proceed in parallel, maximizing throughput.

## Protocol & Feature-Specific Tests

This section details tests for specific communication protocols and advanced server features.

### Agent-to-Agent (A2A) Protocol (`a2a-protocol.test.ts`)

The `a2a-protocol.test.ts` file tests the core logic of the Agent-to-Agent (A2A) communication protocol, which enables agents to discover and interact with each other. These are unit tests for the protocol implementation itself, not directly for Express routes.

**Key Components Tested:**

*   **`A2AAgentServer`**: Represents an agent that can receive and execute tasks.
*   **`A2AAgentClient`**: Represents a client that can discover agents and submit tasks.
*   **`createAgentCard()`**: A utility function for creating agent metadata.
*   **`Task` / `TaskStatus`**: The data structure for tasks and their lifecycle statuses.

**Key Scenarios Tested:**

*   **Agent Card Structure**: Ensures `createAgentCard` produces cards with required fields (e.g., `name`, `version`, `skills`).
*   **Registration and Discovery**: Verifies that clients can register agents with the server and then list or find agents based on their skills.
*   **Task Submission**: Tests the end-to-end flow of submitting a task via the client to a registered server, including task execution and artifact generation.
*   **Task Cancellation**: Simulates task cancellation via the server and verifies its effect on ongoing tasks.

### Advanced Chat Protocol (ACP) Sessions (`acp-routes.test.ts`)

The `acp-routes.test.ts` file tests advanced session management features, likely intended for use within chat-related API routes. It mocks the `a2a` module to focus on the session logic itself.

**Key Concepts Tested:**

*   **`ACPSession` Interface**: Verifies the presence and behavior of session fields like `queue`, `closed`, and `activeTaskId`.
*   **Prompt Queue Behavior**:
    *   Ensures prompts are queued when a task is active.
    *   Verifies that the queue drains prompts in the correct order.
*   **Cancel Behavior**: Tests that canceling a session clears its prompt queue.
*   **Soft-Close Behavior**:
    *   Ensures new sends are rejected when a session is soft-closed.
    *   Confirms that an active task can still complete even after soft-closing.
*   **Fire-and-Forget**: Tests the immediate `202 Accepted` response for fire-and-forget operations, including the return of a `taskId`.
*   **`resumeSessionId`**: Verifies the ability to copy context (e.g., previous messages) from an existing session to a new one.

### Native Engine API Routes (`Native Engine-routes.test.ts`)

The `Native Engine-routes.test.ts` file is a critical integration test suite for various "Native Engine" API routes. It replicates the exact handler logic from `src/server/index.ts` but injects mock manager objects (e.g., `mockHeartbeatEngine`, `mockSkillsHub`) to verify the contract between the HTTP layer and the underlying business logic modules without a full server startup.

**Key Route Groups and Managers Tested:**

*   **Heartbeat Routes (`/api/heartbeat/*`)**:
    *   **`mockHeartbeatEngine`**: Tests `getStatus()`, `start()`, `stop()`, and `tick()` methods.
    *   Verifies status reporting, engine control, and error handling for these operations.
*   **Skills Hub Routes (`/api/hub/*`)**:
    *   **`mockSkillsHub`**: Tests `search()`, `list()`, `install()`, and `uninstall()` methods.
    *   Validates skill discovery, listing installed skills, and managing skill installations.
*   **Identity Routes (`/api/identity/*`)**:
    *   **`mockIdentityManager`**: Tests `load()`, `getAll()`, `getPromptInjection()`, and `set()` methods.
    *   Verifies loading identity data, retrieving all identities, getting prompt injection strings, and setting identity content.
*   **Group Security Routes (`/api/groups/*`)**:
    *   **`mockGroupSecurity`**: Tests `getStats()`, `listGroups()`, `addToBlocklist()`, and `removeFromBlocklist()` methods.
    *   Validates group statistics, listing groups, and managing user blocklists.
*   **Auth Profiles Routes (`/api/auth-profiles/*`)**:
    *   **`mockAuthProfileManager`**: Tests `getStatus()`, `addProfile()`, `removeProfile()`.
    *   **`mockResetAuthProfileManager()`**: Tests the reset functionality.
    *   Verifies managing authentication profiles, including adding, removing, and resetting them.

### WebSocket Handler (`websocket.test.ts`)

The `websocket.test.ts` file tests the functionality of the WebSocket server, covering connection lifecycle, message parsing, authentication, and various message types for real-time interaction.

**Key Areas Tested:**

*   **Connection Management**:
    *   Generates unique connection IDs.
    *   Initializes and tracks connection state (e.g., `authenticated`, `scopes`, `lastActivity`, `streaming`).
    *   Detects stale connections based on activity timeouts.
*   **Message Processing**:
    *   Parses JSON messages and rejects invalid JSON.
    *   Requires a `type` field for messages and handles unknown types gracefully.
*   **Authentication**:
    *   Authenticates connections using API keys (`cb_sk_...`) or JWT tokens.
    *   Rejects invalid credentials.
    *   Checks required scopes for specific operations.
*   **Chat Handling**:
    *   Requires authentication and a message payload.
    *   Supports streaming by default.
    *   Formats various stream messages: `stream_start`, `stream_chunk`, `stream_end`, `chat_response` (for non-streaming).
*   **Stream Control**: Stops streaming on request and formats `stream_stopped` messages.
*   **Tool Execution**: Requires `tools:execute` scope and a tool name, and formats `tool_result` messages.
*   **Ping/Pong**: Ensures the server responds to `ping` messages with `pong`.
*   **Status**: Returns detailed connection status, including authentication, user ID, scopes, and streaming state.
*   **Error Handling**: Formats error messages with `type`, `id`, `code`, and `message`.
*   **Connection Stats**: Tracks total, authenticated, and streaming connections.
*   **Broadcast**: Tests broadcasting messages to authenticated connections, with optional filtering by scope.

### Workflow Builder & API (`workflow-builder.test.ts`)

The `workflow-builder.test.ts` file tests the server-side components related to the workflow builder, including its API routes and underlying data stores. It spins up a minimal Express server to make actual HTTP requests, providing a more integrated test environment for these routes.

**Key Components and APIs Tested:**

*   **`createWorkflowBuilderRoutes()`**: Generates routes for the workflow builder UI and its internal API.
*   **`createWorkflowApiRouter()`**: Creates the Express router for the workflow REST API.
*   **`WorkflowStore`**: Manages the persistence of workflow definitions.
*   **`WorkflowRunTracker`**: Tracks the status and history of workflow executions.
*   **`LobsterWorkflow`**: The type definition for workflows.
*   **`LobsterEngine` (mocked)**: Simulates workflow execution.
*   **`AFlowOptimizer` (mocked)**: Simulates workflow optimization.

**Key Scenarios Tested:**

*   **Workflow Builder UI**: Serves the HTML page for the workflow builder.
*   **Workflow Validation (`POST /api/workflows/validate`)**:
    *   Validates correct workflow structures.
    *   Detects missing fields, dependency cycles, and unknown dependencies.
    *   Calculates execution order and parallel groups for valid workflows.
*   **Workflow Ordering (`POST /__codebuddy__/workflows/api/order`)**: Returns the topological execution order of workflow steps.
*   **Workflow CRUD Operations (`/api/workflows`, `/api/workflows/:id`)**:
    *   **Create (`POST`)**: Creates new workflows, validates input, and returns `201 Created`.
    *   **List (`GET`)**: Retrieves a list of all stored workflows.
    *   **Get (`GET /:id`)**: Retrieves a specific workflow by ID, returning `404 Not Found` for unknown IDs.
    *   **Update (`PUT /:id`)**: Modifies existing workflows, including validation.
    *   **Delete (`DELETE /:id`)**: Removes a workflow by ID.
*   **Workflow Execution (`POST /api/workflows/:id/run`)**:
    *   Executes a workflow using the mocked `LobsterEngine`.
    *   Records run status and details via `WorkflowRunTracker`.
*   **Workflow Status (`GET /api/workflows/:id/status`)**: Retrieves the status and history of runs for a given workflow.
*   **Workflow Optimization (`GET /api/workflows/:id/optimize`)**: Triggers the mocked `AFlowOptimizer` and returns optimization results.

This comprehensive test suite ensures that the server-side components are well-tested, maintainable, and behave as expected across various functionalities and integration points.