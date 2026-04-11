---
title: "tests — acp"
module: "tests-acp"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.814Z"
---
# tests — acp

This document describes the `tests/acp/protocol.test.ts` module, which serves as the comprehensive test suite for the core Agent Communication Protocol (ACP) components, primarily the `ACPRouter` class, defined in `src/acp/protocol.js`.

Its purpose is to ensure the robustness, correctness, and expected behavior of the `ACPRouter` and its interactions with `ACPAgent`s and `ACPMessage`s. Developers contributing to the ACP core should refer to these tests to understand the intended functionality and API contracts.

## ACP Core Components Under Test

The `tests/acp/protocol.test.ts` module validates the following key components from `src/acp/protocol.js`:

*   **`ACPRouter`**: The central hub responsible for managing agents, routing messages between them, handling actions, and maintaining a message log.
*   **`ACPAgent`**: Represents an entity capable of sending and receiving ACP messages. Agents are registered with the `ACPRouter` and have an ID, name, capabilities, and status.
*   **`ACPMessage`**: The standard message format used for communication within the ACP. Messages have a type (`event`, `request`, `response`), sender (`from`), recipient (`to`), action, payload, and optionally a `correlationId` for request/response matching.

## `ACPRouter` Functionality & API (as demonstrated by tests)

The tests cover the full lifecycle and core operations of the `ACPRouter`.

### 1. Agent Lifecycle Management

The `ACPRouter` acts as a registry for `ACPAgent`s.

*   **`router.register(agent: ACPAgent)`**: Adds an agent to the router's registry.
    *   *Tested behavior*: Agents can be successfully registered and retrieved by ID.
*   **`router.unregister(agentId: string)`**: Removes an agent from the registry.
    *   *Tested behavior*: Registered agents can be removed. Unregistering a non-existent agent does not throw an error.
*   **`router.getAgent(agentId: string)`**: Retrieves a registered agent by its ID.
    *   *Tested behavior*: Returns the `ACPAgent` object if found, `undefined` otherwise.
*   **`router.getAgents()`**: Returns an array of all currently registered agents.
    *   *Tested behavior*: Returns all agents that have been registered.
*   **`router.setAgentStatus(agentId: string, status: AgentStatus)`**: Updates the operational status of a registered agent.
    *   *Tested behavior*: An agent's status can be updated. Attempting to update the status of an unknown agent is gracefully ignored.
*   **`router.findByCapability(capability: string)`**: Discovers agents that possess a specific capability.
    *   *Tested behavior*: Returns an array of `ACPAgent`s whose `capabilities` array includes the specified string. Returns an empty array if no agents match.

### 2. Message Routing & Action Handling

The `ACPRouter` is responsible for directing `ACPMessage`s to their intended recipients or handlers.

*   **`router.send(message: ACPMessage)`**: Routes an `ACPMessage` through the system.
    *   *Tested behavior*:
        *   Messages are routed to the appropriate action handler based on the `action` field.
        *   Messages targeting `*` (wildcard) emit a `broadcast` event.
        *   All sent messages are added to the internal message log.
        *   Messages are automatically assigned a unique `id` and `timestamp`.
*   **`router.onAction(action: string, handler: (message: ACPMessage) => Promise<ACPMessage | null>)`**: Registers a handler function for a specific message `action`.
    *   *Tested behavior*: The registered handler is invoked when a message with the matching `action` is sent via `router.send()`. The handler receives the `ACPMessage` as an argument.

### 3. Request/Response Pattern

The `ACPRouter` facilitates a request-response mechanism using `correlationId`s.

*   **`router.request(to: string, action: string, payload: object, timeoutMs: number)`**: Sends a request message and waits for a corresponding response.
    *   *Tested behavior*:
        *   The method returns a Promise that resolves when a `response` message with a matching `correlationId` is received.
        *   The Promise rejects if a response is not received within the specified `timeoutMs`.
        *   The `correlationId` is automatically managed by the router.

### 4. Message Logging

The `ACPRouter` maintains a log of all messages processed.

*   **`router.getLog()`**: Returns the current array of logged `ACPMessage`s.
    *   *Tested behavior*: All messages sent via `router.send()` are added to this log.
*   **`router.clearLog()`**: Empties the message log.
    *   *Tested behavior*: Resets the log to an empty state.
*   **`new ACPRouter(maxLogSize?: number)`**: The constructor allows specifying a maximum size for the message log.
    *   *Tested behavior*: If `maxLogSize` is provided, the log automatically trims older messages to stay within the limit.

### 5. Resource Management

*   **`router.dispose()`**: Cleans up resources held by the router.
    *   *Tested behavior*:
        *   Clears any pending request timeouts and associated promises.
        *   Removes all event listeners registered with the router, preventing memory leaks.

## `ACPRouter` Architecture Overview

The `ACPRouter` acts as a central message broker and agent registry.

```mermaid
graph TD
    subgraph ACPRouter
        direction LR
        A[register/unregister] --> B(Agent Registry)
        C[send] --> D(Action Handlers)
        C --> E(Message Log)
        F[request] --> G(Pending Requests)
        G --> C
        D -- handles --> C
    end

    Agent1[ACPAgent 1] -- registers with --> ACPRouter
    Agent2[ACPAgent 2] -- registers with --> ACPRouter
    Agent1 -- sends ACPMessage --> ACPRouter
    ACPRouter -- routes ACPMessage --> Agent2
    ACPRouter -- emits events --> External Listeners
```

## Contributing and Extending

When modifying the `ACPRouter` class or related ACP primitives in `src/acp/protocol.js`, it is crucial to:

1.  **Consult existing tests**: Understand the current expected behavior for each method and interaction.
2.  **Add new tests**: For any new functionality or edge cases, write corresponding tests in `tests/acp/protocol.test.ts`.
3.  **Ensure all tests pass**: Before submitting changes, run the test suite to confirm no regressions have been introduced.

The tests use `jest.fn()` extensively to mock handlers and spies, allowing for precise verification of function calls and arguments. Asynchronous operations are tested using `async/await` and `setTimeout` to simulate real-world delays and ensure correct handling of promises and timeouts.