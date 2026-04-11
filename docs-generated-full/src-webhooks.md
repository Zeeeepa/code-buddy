---
title: "src — webhooks"
module: "src-webhooks"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.798Z"
---
# src — webhooks

The `src/webhooks` module provides a robust system for managing and processing incoming webhooks. Its core component, the `WebhookManager` class, handles everything from configuration persistence to payload validation and event dispatching.

## Module Purpose

The primary purpose of the `src/webhooks` module is to:

1.  **Manage Webhook Configurations:** Allow for the registration, retrieval, modification, and removal of webhook definitions, including their unique IDs, names, optional secrets, and associated agent messages.
2.  **Process Incoming Payloads:** Validate and process data received from external webhook sources, including optional signature verification for security.
3.  **Resolve Agent Messages:** Dynamically generate agent messages by injecting data from the incoming webhook payload into predefined templates.
4.  **Dispatch Events:** Notify internal application components when a webhook payload has been successfully processed, enabling reactive logic.
5.  **Persist Configuration:** Store webhook configurations to disk, ensuring they are maintained across application restarts.

## Key Components

### `WebhookConfig` Interface

Defines the structure for a single webhook's configuration:

```typescript
export interface WebhookConfig {
  id: string;          // Unique identifier for the webhook
  name: string;        // User-friendly name
  secret?: string;     // Optional secret for signature verification
  agentMessage: string; // Template string for the agent's response
  enabled: boolean;    // Whether the webhook is active
  createdAt: number;   // Timestamp of creation
}
```

### `WebhookPayloadCallback` Type

Defines the signature for functions that listen to processed webhook payloads:

```typescript
export type WebhookPayloadCallback = (webhookId: string, body: Record<string, unknown>) => void;
```

### `WebhookManager` Class

The central class responsible for all webhook operations.

#### Constructor

`constructor(configDir?: string)`

Initializes the `WebhookManager`. It sets the path for `webhooks.json` (defaulting to `.codebuddy/webhooks.json`) and immediately attempts to load any existing webhook configurations from this file.

#### Configuration Management

*   `register(name: string, agentMessage: string, secret?: string): WebhookConfig`
    *   Creates a new webhook with a unique ID, saves it to disk, and returns its configuration.
*   `remove(id: string): boolean`
    *   Deletes a webhook by its ID. Returns `true` if deleted, `false` otherwise. Triggers a save.
*   `setEnabled(id: string, enabled: boolean): boolean`
    *   Toggles the `enabled` status of a webhook. Returns `true` if updated, `false` if not found. Triggers a save.
*   `get(id: string): WebhookConfig | undefined`
    *   Retrieves a single webhook configuration by its ID.
*   `list(): WebhookConfig[]`
    *   Returns an array of all registered webhook configurations.

#### Payload Processing

`processPayload(id: string, body: Record<string, unknown>, signature?: string): { message: string } | { error: string }`

This is the primary entry point for handling incoming webhook data.

1.  **Lookup & Status Check:** Retrieves the `WebhookConfig` by `id`. Returns an error if not found or disabled.
2.  **Signature Verification:** If the webhook has a `secret` configured, it expects a `signature` in the request. It uses `private verifySignature` to cryptographically validate the payload against the secret. An invalid or missing signature results in an error.
3.  **Message Resolution:** Calls `private resolveTemplate` to generate the final agent message by replacing placeholders in `agentMessage` with values from the `body`.
4.  **Event Dispatch:** Notifies all registered `WebhookPayloadCallback` listeners (both specific to the webhook `id` and global `*` listeners) with the webhook ID and the processed `body`. Listener errors are silently ignored.
5.  **Response:** Returns either the resolved `message` or an `error` object.

##### `private verifySignature(payload: string, signature: string, secret: string): boolean`

A utility method that uses Node.js's `crypto` module (`createHmac`, `timingSafeEqual`) to securely verify an HMAC SHA256 signature. It's crucial for ensuring the integrity and authenticity of incoming webhook payloads when a secret is configured.

##### `private resolveTemplate(template: string, body: Record<string, unknown>): string`

Parses the `agentMessage` template string, replacing `{{body.path.to.value}}` placeholders with corresponding values from the `body` object. It includes basic protection against prototype pollution paths (`__proto__`, `constructor`, `prototype`). If a path is not found or invalid, the placeholder is left as is.

#### Event Subscription

`onPayload(webhookId: string, callback: WebhookPayloadCallback): () => void`

Allows other parts of the application to subscribe to webhook payload events.

*   `webhookId`: The ID of the specific webhook to listen to, or `'*'` to listen to all webhooks.
*   `callback`: The function to be invoked when a payload is processed.
*   Returns an unsubscribe function, which can be called to remove the listener.

#### Persistence

*   `private load(): void`
    *   Reads `webhooks.json` from the configured `configPath`. If the file exists and contains valid JSON, it populates the `webhooks` map. Errors during loading are caught, resulting in an empty webhook state.
*   `private save(): void`
    *   Writes the current state of all webhooks to `webhooks.json`. It ensures the directory exists before writing. Errors during saving are silently ignored.

## Execution Flow: Processing a Webhook Payload

The following diagram illustrates the typical flow when an external webhook request is received and processed by the `WebhookManager`:

```mermaid
graph TD
    A[External Webhook Request] --> B{WebhookManager.processPayload(id, body, signature?)};
    B --> C{Get WebhookConfig by ID};
    C -- Not Found/Disabled --> D[Return { error: ... }];
    C -- Found & Enabled --> E{WebhookConfig has 'secret'?};
    E -- Yes --> F{Call verifySignature(payload, signature, secret)};
    F -- Invalid Signature --> D;
    F -- Valid Signature --> G{Call resolveTemplate(agentMessage, body)};
    E -- No Secret --> G;
    G --> H{Notify onPayload Listeners (specific & global)};
    H --> I[Return { message: resolvedAgentMessage }];
```

## Integration with the Codebase

### Incoming Calls

*   **`src/server/index.ts` (via `createApp`)**: This is the primary integration point. The HTTP server routes incoming webhook requests to the `WebhookManager.processPayload` method, making it the public API for external webhook providers.
*   **`tests/webhooks/webhook-manager.test.ts`**: The unit tests extensively interact with all public methods of `WebhookManager` to ensure correct functionality.

### Outgoing Calls

*   **`crypto` module**: Used by `verifySignature` for secure hashing and comparison.
*   **`fs` module**: Used by `load` and `save` for reading and writing webhook configurations to disk.
*   **`path` module**: Used by the constructor and `save` for resolving and creating the configuration file path.
*   **Internal Callbacks**: `processPayload` invokes `WebhookPayloadCallback` functions registered via `onPayload`. This allows other internal modules (e.g., `tests/features/tailscale-dashboard-nodes.test.ts` in a test scenario) to react to processed webhook events.