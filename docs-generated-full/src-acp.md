---
title: "src — acp"
module: "src-acp"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.347Z"
---
# src — acp

# ACP Module Documentation

## Overview

The `src/acp/protocol.ts` module implements the **Agent Communication Protocol (ACP)**, providing a robust, asynchronous, and decoupled messaging system for inter-agent communication within the application. It defines the core message format, agent structure, and a central `ACPRouter` responsible for routing messages between registered agents and handling request-response patterns.

This module is designed to facilitate communication between different logical components (referred to as "agents") without direct coupling, promoting modularity, extensibility, and testability.

## Core Concepts

### ACP Message (`ACPMessage`)

All communication within the ACP system is encapsulated in an `ACPMessage`. This interface defines the standard structure for messages:

```typescript
export type ACPMessageType = 'request' | 'response' | 'event' | 'error';

export interface ACPMessage {
  id: string;          // Unique message identifier
  type: ACPMessageType; // The message type
  from: string;        // ID of the sending agent
  to: string;          // ID of the target agent (or '*' for broadcast)
  action: string;      // Describes the message's purpose (e.g., 'user:create', 'data:fetch')
  payload: unknown;    // The actual data being transmitted
  correlationId?: string; // Used to link requests to their responses
  timestamp: number;   // When the message was created (milliseconds since epoch)
  ttl?: number;        // Time-to-live for the message (not currently enforced by router)
}
```

### ACP Agent (`ACPAgent`)

An `ACPAgent` represents any entity capable of sending or receiving ACP messages. Agents register with the `ACPRouter` to participate in the communication network.

```typescript
export interface ACPAgent {
  id: string;          // Unique identifier for the agent
  name: string;        // Human-readable name
  capabilities: string[]; // List of capabilities/roles (e.g., ['user-manager', 'data-provider'])
  status: 'ready' | 'busy' | 'offline'; // Current operational status
  handler?: (msg: ACPMessage) => Promise<ACPMessage | null>; // Optional, dedicated message handler for this agent
}
```

The `handler` property allows an agent to define its own specific logic for processing incoming messages addressed directly to it. If an agent has a `handler`, it takes precedence over global `onAction` handlers for messages explicitly `to` that agent.

## The `ACPRouter` Class

The `ACPRouter` class is the central component of the ACP module. It extends Node.js's `EventEmitter`, allowing it to emit and listen for various system events related to agent lifecycle and message flow.

### Responsibilities

-   **Agent Management**: Registering, unregistering, and querying agents.
-   **Message Routing**: Directing messages to the appropriate agent or global handler.
-   **Request-Response Handling**: Managing pending requests and correlating responses using `correlationId`.
-   **Message Logging**: Maintaining a configurable log of recent messages for debugging and auditing.
-   **Event Emission**: Notifying listeners about agent lifecycle and message flow.

### Constructor

```typescript
constructor(maxLogSize: number = 100)
```
Initializes the router, optionally setting the maximum number of messages to keep in the internal `messageLog`.

### Agent Management Methods

-   `register(agent: ACPAgent): void`
    -   Registers an `ACPAgent` with the router. Emits an `agent:registered` event.
-   `unregister(agentId: string): void`
    -   Removes an agent by its ID. Emits an `agent:unregistered` event.
-   `getAgents(): ACPAgent[]`
    -   Returns an array of all currently registered agents.
-   `getAgent(id: string): ACPAgent | undefined`
    -   Retrieves a specific agent by its ID.
-   `setAgentStatus(agentId: string, status: ACPAgent['status']): void`
    -   Updates an agent's status. Emits an `agent:status` event with `{ agentId, status }`.
-   `findByCapability(capability: string): ACPAgent[]`
    -   Returns an array of agents that declare a specific capability in their `capabilities` array.

### Message Sending Methods

The router provides two primary methods for sending messages:

1.  **`send(partial: Omit<ACPMessage, 'id' | 'timestamp'>): Promise<ACPMessage | null>`**
    -   Sends a message into the router for processing.
    -   Automatically assigns a unique `id` and `timestamp` to the message.
    -   This method is suitable for fire-and-forget messages (`type: 'event'`) or for initiating a request where the response might be handled asynchronously elsewhere.
    -   The returned promise resolves with the response if the message was a `request` and a handler processed it, otherwise `null`.
    -   Internally calls `private route(msg: ACPMessage)`.

2.  **`request(to: string, action: string, payload: unknown, timeoutMs: number = 30000): Promise<ACPMessage>`**
    -   Implements a robust request-response pattern.
    -   Generates a `correlationId` to link the request to its eventual response.
    -   Returns a `Promise<ACPMessage>` that resolves when a matching `response` message (with the same `correlationId`) is received.
    -   The promise rejects if `timeoutMs` is exceeded before a response is received.
    -   Internally calls `send` to dispatch the request message.

### Message Handling and Routing (`private route`)

The `private async route(msg: ACPMessage): Promise<ACPMessage | null>` method is the core of the router's logic. It determines how an incoming message is processed and dispatched.

**Routing Logic Flow:**

1.  **Emit `message` event**: All messages processed by `route` trigger this event.
2.  **Handle Incoming Responses**: If `msg.type === 'response'` and `msg.correlationId` is present, it attempts to resolve a pending request using `resolveRequest`. If successful, routing stops here.
3.  **Broadcast Messages**: If `msg.to === '*'`, the router emits a `broadcast` event. It then checks for a global `onAction` handler for the message's `action`. If found, the handler is invoked.
4.  **Target Agent Handler**: If `msg.to` matches a registered agent's `id` and that agent has a `handler` function, the message is dispatched to `targetAgent.handler`.
    -   **Automatic Response for Requests**: If the original message was a `request` and the agent's handler returns a non-null response, the router automatically constructs and `send`s a `response` message back to the original sender, using the `correlationId`.
5.  **Global Action Handler**: If no specific agent handler processes the message (or if `msg.to` was not a specific agent), the router checks for a global handler registered via `onAction(action, handler)`.
    -   **Automatic Response for Requests**: Similar to agent handlers, if this global handler processes a `request` and returns a response, the router automatically `send`s a `response` message.

### Global Action Handlers

-   `onAction(action: string, handler: (msg: ACPMessage) => Promise<ACPMessage | null>): void`
    -   Registers a handler function that will be invoked for any message with a matching `action` that isn't handled by a specific agent's `handler`. These act as fallback or general-purpose handlers.

### Request Resolution

-   `resolveRequest(correlationId: string, response: ACPMessage): void`
    -   An internal method called by `route` to fulfill promises created by `request` calls when a matching `response` message arrives. It clears the associated timeout to prevent memory leaks.

### Message Logging

-   `getLog(): ACPMessage[]`
    -   Returns a copy of the internal `messageLog`, which stores recent messages up to `maxLogSize`.
-   `clearLog(): void`
    -   Clears the internal message log.

### Lifecycle

-   `dispose(): void`
    -   Cleans up any pending request timers and removes all event listeners registered with the router. This method is crucial for preventing memory leaks when an `ACPRouter` instance is no longer needed.

## Execution Flow: Request-Response Cycle

The following diagram illustrates the typical flow for a `request` initiated by an external component and handled by a registered `ACPAgent` with a dedicated handler.

```mermaid
graph TD
    A[External Component] -->|1. router.request(to, action, payload)| B(ACPRouter)
    B -->|2. Creates Promise, sets timeout| B
    B -->|3. Calls router.send() with type='request', correlationId| B
    B -->|4. Calls private route(requestMsg)| B
    B -->|5. Emits 'message' event| B
    B -->|6. Dispatches to targetAgent.handler(requestMsg)| C(ACPAgent Handler)
    C -->|7. Processes request, returns responsePayload| B
    B -->|8. router.send() with type='response', correlationId, from=targetAgent.id, to=requestMsg.from| B
    B -->|9. Calls private route(responseMsg)| B
    B -->|10. Emits 'message' event| B
    B -->|11. Detects type='response' & correlationId| B
    B -->|12. Calls resolveRequest(correlationId, responseMsg)| B
    B -->|13. Clears timeout, resolves Promise with responseMsg| A
```

## Usage Example

```typescript
import { ACPRouter, ACPAgent, ACPMessage } from './protocol';

// 1. Create an ACPRouter instance
const router = new ACPRouter();

// 2. Define an Agent
const myAgent: ACPAgent = {
  id: 'agent-alpha',
  name: 'Alpha Agent',
  capabilities: ['data-processor'],
  status: 'ready',
  handler: async (msg: ACPMessage): Promise<ACPMessage | null> => {
    console.log(`[${myAgent.id}] Received message: ${msg.action}`);
    if (msg.type === 'request' && msg.action === 'process:data') {
      const data = msg.payload as { value: number };
      const processedData = { result: data.value * 2, processedBy: myAgent.id };
      // The router will automatically wrap this in an ACPMessage of type 'response'
      // and send it back to msg.from with the correct correlationId.
      return { payload: processedData } as ACPMessage; // Minimal response object
    }
    return null; // Message not handled by this agent
  },
};

// 3. Register the Agent
router.register(myAgent);

// 4. Register a global action handler (fallback or for broadcast)
router.onAction('log:event', async (msg: ACPMessage) => {
  console.log(`[Global Handler] Received event: ${JSON.stringify(msg.payload)}`);
  return null; // No response needed for an event
});

// 5. Send a request to an agent
async function makeRequest() {
  try {
    console.log('\n--- Sending request to agent-alpha ---');
    const response = await router.request(
      'agent-alpha',
      'process:data',
      { value: 10 }
    );
    console.log('Request response:', response.payload); // Output: { result: 20, processedBy: 'agent-alpha' }
  } catch (error: any) {
    console.error('Request failed:', error.message);
  }
}

// 6. Send a fire-and-forget event (broadcast)
async function sendEvent() {
  console.log('\n--- Sending log event (broadcast) ---');
  await router.send({
    type: 'event',
    from: 'system',
    to: '*', // Broadcast to all relevant handlers
    action: 'log:event',
    payload: { message: 'System started', level: 'info' },
  });
}

// 7. Listen for router events
router.on('agent:registered', (agent) => console.log(`\nRouter event: Agent registered: ${agent.name}`));
router.on('message', (msg) => console.log(`Router event: Saw message: ${msg.action} from ${msg.from} to ${msg.to}`));

// Execute the examples
makeRequest();
sendEvent();

// Example of finding agents by capability
const dataProcessors = router.findByCapability('data-processor');
console.log('\nAgents with "data-processor" capability:', dataProcessors.map(a => a.id));

// Clean up resources when the router is no longer needed
// setTimeout(() => router.dispose(), 1000);
```

## Integration with the Codebase

The `src/acp/protocol.ts` module provides a self-contained communication layer. Any part of the application that needs to communicate with other logical "agents" can instantiate and utilize an `ACPRouter`.

-   **Decoupling**: By using the `ACPRouter`, modules do not need direct references to each other. They only need to know the `id` and `action` of the target agent/operation. This significantly reduces inter-module dependencies.
-   **Extensibility**: New agents can be added and registered with the router without modifying existing communication logic. This makes it easy to introduce new features or services.
-   **Testability**: Individual agents and their handlers can be tested in isolation by mocking the `ACPRouter` or by setting up a minimal router instance with specific agents.
-   **Observability**: The `messageLog` and `EventEmitter` capabilities provide hooks for monitoring and debugging communication flows.

While the provided call graph shows no outgoing calls from this module to other application-specific code, it is designed to be integrated *into* other modules that will define and register their own `ACPAgent` instances and interact with the router. This makes `ACPRouter` a foundational utility for building distributed or highly modular applications within a single process.