---
title: "tests — gateway"
module: "tests-gateway"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.903Z"
---
# tests — gateway

This document provides an overview of the `tests/gateway` module, which is responsible for verifying the functionality and integrity of the core gateway services. These tests are crucial for ensuring the reliability of message handling, session management, WebSocket transport, and agent registration within the system.

Understanding these tests is key for any developer contributing to the gateway's backend logic, as they define the expected behavior of its various components.

## Module Purpose

The `tests/gateway` module contains unit and integration tests for the `src/gateway` directory. It covers:

*   **Core Gateway Logic:** Message creation, error handling, and the fundamental `GatewayServer` operations.
*   **Session Management:** How user and agent sessions are created, managed, and cleaned up.
*   **WebSocket Transport:** The `WebSocketGateway`'s ability to handle client connections, broadcast messages, and manage the WebSocket server lifecycle.
*   **Agent Registry:** The system for registering, tracking, and querying connected agents and their capabilities.
*   **Security Features:** Configuration and logic related to TLS and local pairing skip.
*   **Singleton Patterns:** Ensuring correct instance management for core gateway services.

## Core Gateway Components

The `gateway.test.ts` file focuses on the foundational elements of the gateway.

### Message Utilities

The gateway relies on standardized message formats for communication.

*   **`createMessage(type, payload, sessionId?)`**: Tests verify that this function correctly constructs a `GatewayMessage` with a unique `id`, `timestamp`, specified `type`, `payload`, and an optional `sessionId`. This ensures all internal and external messages adhere to the expected structure.
*   **`createErrorMessage(code, message, details?)`**: This utility is tested to ensure it produces a `GatewayMessage` of `type: 'error'`, encapsulating an error `code`, human-readable `message`, and optional `details` for debugging.

### Session Management (`SessionManager`)

The `SessionManager` is responsible for tracking active sessions and the clients connected to them.

*   **Session Lifecycle**: Tests cover `createSession()`, `hasSession()`, `getSession()`, `getAllSessions()`, and `clear()`, ensuring sessions can be created, retrieved, and managed.
*   **Client Association**: `addClient()`, `removeClient()`, and `getClients()` are tested to confirm clients can be correctly associated with and disassociated from sessions.
*   **Cleanup**: The `cleanup()` method is verified to correctly identify and remove sessions that no longer have any connected clients, preventing resource leaks.

### Gateway Server Core (`GatewayServer`)

The `GatewayServer` is the central orchestrator for the gateway's operations.

*   **Lifecycle**: Tests confirm `start()` and `stop()` methods correctly manage the server's running state, verifiable via `isRunning()`.
*   **Handler Registration**: `registerHandler()` and `unregisterHandler()` are tested to ensure message handlers can be dynamically added and removed for specific message types. While the actual message processing is complex and involves transport layers, these tests ensure the registration mechanism works.
*   **Statistics**: `getStats()` is tested to provide accurate runtime information, including the server's running status, client count, session count, and authenticated client count.

### Gateway Server Singleton

The `GatewayServer` is designed as a singleton to ensure a single, consistent instance throughout the application.

*   **`getGatewayServer()`**: Tests confirm that calling this function repeatedly returns the exact same instance of `GatewayServer`.
*   **`resetGatewayServer()`**: This utility is tested to ensure it properly disposes of the current singleton instance and allows a new one to be created on the next call to `getGatewayServer()`. This is particularly useful for isolating tests.

## WebSocket Transport Layer

The `ws-transport.test.ts` file focuses on the WebSocket-specific implementation of the gateway.

### WebSocket Gateway (`WebSocketGateway`)

The `WebSocketGateway` extends `GatewayServer` to provide WebSocket-based communication.

*   **Configuration**: Tests verify that the `WebSocketGateway` can be initialized with default or custom `WebSocketTransportConfig` values, including `port`, `path`, `perMessageDeflate`, `heartbeatInterval`, and `binaryMode`. The `DEFAULT_WS_CONFIG` is also explicitly tested.
*   **Lifecycle**: Similar to `GatewayServer`, `start()` and `stop()` are tested for correct operation and state management.
*   **Statistics**: `getWebSocketStats()` is verified to provide WebSocket-specific metrics, such as the running status, client count, session count, and configured port/path.
*   **Client Management**: Methods like `getClientInfo()`, `getConnectedClientIds()`, and `kickClient()` are tested to ensure accurate client tracking and the ability to disconnect specific clients.
*   **Broadcasting**: `broadcast()` and `broadcastToSession()` are tested to ensure messages can be sent to all connected clients or only those within a specific session, even when no clients are present (i.e., they should not throw errors).

### Agent Registry (`AgentRegistry`)

The `AgentRegistry` is a critical component for managing connected agents and their capabilities.

*   **Agent Lifecycle**: Tests cover `register()`, `unregister()`, and `updateStatus()` to ensure agents can be added, removed, and have their status updated (e.g., 'online', 'offline', 'busy').
*   **Agent Retrieval**: `getAgent()`, `getAllAgents()`, `getOnlineAgents()`, `findByCapability()` (e.g., 'chat', 'bash', 'streaming'), and `findByType()` are tested to ensure agents can be efficiently queried based on various criteria.
*   **Statistics**: `getStats()` provides a summary of registered agents, including total counts, counts by status, and counts by type.
*   **Event Emission**: The `AgentRegistry` is tested to emit specific events (`agent:registered`, `agent:unregistered`, `agent:status-changed`) when agent states change, allowing other parts of the system to react.

### Control Messages (`createControlMessage`)

Control messages are used for internal communication between gateway components and agents for operational purposes.

*   **Structure**: Tests ensure `createControlMessage(type, source, payload, target?)` correctly constructs a control message with a `type`, `source` identifier, `payload`, and an optional `target` identifier.

### Agent Capabilities (`AgentCapabilities`)

The `AgentCapabilities` type defines the features an agent supports.

*   **Type Definition**: Tests confirm that the `AgentCapabilities` interface correctly allows for defining capabilities such as `chat`, `tools` (list of strings), `streaming`, `modes` (list of strings), and custom properties.

### WebSocket Gateway Singleton

Similar to `GatewayServer`, `WebSocketGateway` also implements a singleton pattern.

*   **`getWebSocketGateway()`**: Ensures a single instance is returned across multiple calls.
*   **`resetWebSocketGateway()`**: Verifies the ability to reset the singleton instance for testing or reinitialization.

## TLS and Security

The `tls-pairing.test.ts` file focuses on the gateway's TLS configuration and security logic.

### Gateway Configuration (`GatewayConfig`)

*   **TLS Fields**: Tests confirm that `GatewayConfig` includes `tlsEnabled`, `tlsCert`, and `tlsKey` fields, and that `tlsEnabled` is `false` by default.
*   **Environment Variables**: It verifies that TLS configuration can be influenced by `GATEWAY_TLS_CERT` and `GATEWAY_TLS_KEY` environment variables.

### Local Pairing Skip Logic (`shouldSkipPairing`)

This logic is crucial for development and local deployments where TLS certificate warnings might be undesirable for local connections.

*   **Conditional Skipping**: The `shouldSkipPairing` function (tested directly) is verified to return `true` *only if* all of the following conditions are met:
    *   `tlsEnabled` is `true`.
    *   `skipLocalPairing` is `true`.
    *   The `clientIp` is `127.0.0.1` (IPv4 localhost) or `::1` (IPv6 localhost).
*   **Negative Cases**: Tests explicitly confirm that pairing is *not* skipped for remote IPs, when TLS is disabled, or when `skipLocalPairing` is explicitly `false`.

## Architectural Overview

The following diagram illustrates the relationships between the core gateway components tested in this module:

```mermaid
graph TD
    A[GatewayServer] --> B[SessionManager]
    A --> C[Message Handlers]
    D[WebSocketGateway] -- extends --> A
    D --> E[AgentRegistry]
    D --> F[WebSocketServer (mocked)]
    E --> G[RegisteredAgent]
```

*   The `WebSocketGateway` extends the base `GatewayServer`, inheriting its core message handling and session management capabilities.
*   It composes an `AgentRegistry` to manage connected agents and interacts with a `WebSocketServer` (mocked in tests) for network communication.
*   The `SessionManager` is a dependency of the `GatewayServer`, handling the lifecycle of user and agent sessions.

## Testing Strategy and Mocks

The `ws-transport.test.ts` file employs mocking extensively to isolate the `WebSocketGateway` and `AgentRegistry` from actual network dependencies.

*   **`ws` Mock**: The `ws` library (both `WebSocketServer` and `WebSocket` classes) is mocked to simulate WebSocket connections without requiring a real network stack. This allows tests to control connection events, message sending, and closing behavior.
    *   **Incoming Calls**: The mock `WebSocket` includes `ping()` and `close()` methods that are called by the `WebSocketGateway` (e.g., for heartbeats or client disconnections), verifying the gateway's interaction with the underlying WebSocket.
*   **`http` Mock**: The `http.createServer` function is mocked to prevent the `WebSocketGateway` from attempting to bind to a real network port during tests. This ensures tests run quickly and without port conflicts.

This mocking strategy allows for focused testing of the gateway's logic, independent of external network conditions.

## Contributing and Extending

When contributing to the gateway module:

*   **New Features**: If adding new functionality to `GatewayServer`, `SessionManager`, `WebSocketGateway`, or `AgentRegistry`, ensure corresponding tests are added to the relevant test file (`gateway.test.ts` or `ws-transport.test.ts`).
*   **Bug Fixes**: For bug fixes, first, write a failing test that reproduces the bug, then implement the fix, and finally, ensure the test passes.
*   **Understanding Behavior**: Refer to these tests to understand the expected behavior of any gateway component. The `describe` and `it` blocks clearly outline the requirements and assertions.
*   **Mocks**: If extending the WebSocket transport, be mindful of the existing `ws` and `http` mocks. You might need to extend them or add new mock behaviors to cover your specific use cases.