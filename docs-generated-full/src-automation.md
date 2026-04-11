---
title: "src — automation"
module: "src-automation"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.378Z"
---
# src — automation

The `src/automation` module provides foundational capabilities for an intelligent agent to interact with its environment through scheduled tasks, event-driven triggers, and continuous monitoring. It encapsulates three core automation patterns:
1.  **Authentication Monitoring (`AuthMonitor`):** Ensures the agent's access to external services remains valid and alerts to impending expirations or issues.
2.  **Gmail Trigger (`GmailTrigger`):** Enables the agent to react in real-time to new emails, acting as an event source for agent workflows.
3.  **Polling (`PollManager`):** Allows the agent to periodically fetch and detect changes in data from various external sources (URLs, files, commands).

This module is critical for maintaining the agent's operational readiness, responsiveness, and awareness of external state changes.

---

## 1. Authentication Monitoring (`AuthMonitor`)

The `AuthMonitor` class is responsible for tracking the authentication status of various external services and channels the agent interacts with. It helps prevent operational disruptions by proactively identifying expired or invalid credentials.

### Purpose
To provide a centralized, continuous monitoring system for authentication tokens and API keys, emitting events when their status changes (e.g., expiring, expired, invalid).

### Key Concepts

*   **`AuthTarget`**: An interface defining a single item to be monitored. It includes:
    *   `id`: Unique identifier.
    *   `name`: Human-readable name.
    *   `type`: Categorization (`'provider'`, `'channel'`, `'service'`).
    *   `envVar?`: Optional environment variable name to check for credential presence.
    *   `expiresAt?`: Optional `Date` indicating when the credential expires.
    *   `state`: Current `AuthState` (`'valid'`, `'expiring'`, `'expired'`, `'invalid'`, `'unknown'`).
*   **`AuthState`**: A union type representing the possible states of an authentication target.
*   **`AuthMonitorConfig`**: Configuration for the monitor, including `checkIntervalMs` (how often to check) and `expiryWarningMs` (how far in advance to warn about expiration).
*   **`AuthEvent`**: An event object emitted when an `AuthTarget`'s state changes, detailing the `previousState`, `newState`, and a `message`.

### How it Works

The `AuthMonitor` operates as a singleton, ensuring a single point of truth for authentication status.

1.  **Initialization**:
    *   `AuthMonitor.getInstance(config?)`: Retrieves or creates the singleton instance.
    *   The constructor sets up default configuration values for `checkIntervalMs` (5 minutes) and `expiryWarningMs` (24 hours).
2.  **Target Management**:
    *   `addTarget(target: AuthTarget)`: Registers a new credential for monitoring.
    *   `removeTarget(id: string)`: Stops monitoring a specific credential.
    *   `listTargets()`: Retrieves all currently monitored targets.
3.  **Monitoring Lifecycle**:
    *   `start()`:
        *   Calls `registerDefaultTargets()` to add common API keys (e.g., `GROK_API_KEY`, `OPENAI_API_KEY`, `DISCORD_BOT_TOKEN`) if not already present.
        *   Immediately performs an initial check via `checkAll()`.
        *   Sets up a `setInterval` to call `checkAll()` repeatedly at the configured `checkIntervalMs`.
    *   `checkAll()`: Iterates through all registered `AuthTarget`s and calls `checkTarget()` for each. If `checkTarget()` returns an `AuthEvent`, it's added to the internal `history` and emitted.
    *   `checkTarget(target: AuthTarget)` (private):
        *   Determines the `newState` based on two primary checks:
            *   **Environment Variable Presence**: If `target.envVar` is specified, it checks `process.env[target.envVar]` for existence and a minimum length.
            *   **Expiration Date**: If `target.expiresAt` is provided, it compares it against the current time and the `expiryWarningMs` threshold.
        *   If the `newState` differs from the `target.state`, an `AuthEvent` is generated and returned.
    *   `stop()`: Clears the `setInterval` timer, halting all monitoring.
4.  **Reporting**:
    *   `getHistory(limit?: number)`: Retrieves a chronological list of past `AuthEvent`s.
    *   `getSummary()`: Provides a count of targets in each `AuthState`.

### Events

The `AuthMonitor` extends `EventEmitter` and emits the following event:

*   `'auth:changed'` (payload: `AuthEvent`): Fired when the `AuthState` of any monitored target changes.

### Example Usage

```typescript
import { AuthMonitor } from './auth-monitoring.js';

const monitor = AuthMonitor.getInstance({
  checkIntervalMs: 60_000, // Check every minute
  expiryWarningMs: 2 * 24 * 60 * 60 * 1000, // Warn 2 days before expiry
});

monitor.addTarget({
  id: 'my-custom-api',
  name: 'My Custom API',
  type: 'provider',
  envVar: 'MY_CUSTOM_API_KEY',
  expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Expires in 3 days
  state: 'unknown',
});

monitor.on('auth:changed', (event) => {
  console.log(`Auth Event: [${event.target.name}] changed from ${event.previousState} to ${event.newState}. Message: ${event.message}`);
  if (event.newState === 'expired' || event.newState === 'invalid') {
    console.error(`Action required: ${event.message}`);
    // Trigger an alert or automated refresh
  }
});

monitor.start();
```

---

## 2. Gmail Trigger (`GmailTrigger`)

The `GmailTrigger` class provides an event-driven mechanism for the agent to react to new emails in a Gmail inbox. It leverages Google Cloud Pub/Sub and the `GmailWebhookAdapter` to receive real-time notifications.

### Purpose
To act as a trigger source, waking or notifying the agent when new emails arrive that match configured filters, and generating a relevant prompt for the agent.

### Key Concepts

*   **`GmailTriggerConfig`**: Configuration for the trigger, including Google Cloud project details (`projectId`, `topicName`), `labelFilter` (e.g., `['INBOX', 'UNREAD']`), and a `promptTemplate` for the agent.
*   **`GmailTriggerEvent`**: The event object emitted when a new email is detected, containing `messageId`, `subject`, `from`, and the generated `prompt`.

### How it Works

The `GmailTrigger` wraps the `GmailWebhookAdapter` (from `src/channels/niche-channels.js`) to manage the underlying Gmail API interactions and Pub/Sub subscription.

1.  **Initialization**:
    *   `constructor(config: GmailTriggerConfig)`: Creates an instance of `GmailWebhookAdapter` using the provided configuration.
    *   `getGmailTrigger(config?: GmailTriggerConfig)`: A singleton-like factory function to ensure only one `GmailTrigger` instance exists.
2.  **Starting the Trigger**:
    *   `start()`:
        *   Calls `this.adapter.start()` to begin listening for Pub/Sub messages.
        *   Calls `this.adapter.setupWatch(this.config.labelFilter)` to establish a Gmail watch, which tells Gmail to send notifications to Pub/Sub for matching emails. Gmail watches expire after 7 days.
        *   Registers an `onNewMessage` listener with the adapter, which calls `handleNewMessage()` when the adapter processes a new email.
        *   Sets up a `setInterval` to periodically call `this.adapter.setupWatch()` again, renewing the Gmail watch before its 7-day expiry (default renewal every 6 days).
3.  **Webhook Handling**:
    *   `handleWebhook(body: { message?: { data?: string; messageId?: string } })`: This method is designed to be exposed as an HTTP endpoint. When Google Pub/Sub sends a notification to the configured webhook URL, this method decodes the Pub/Sub message and passes it to `this.adapter.handlePubSubNotification()`.
4.  **Message Processing**:
    *   `handleNewMessage(msg: { id: string; subject: string; from: string })` (private):
        *   Deduplicates messages using an internal `processedIds` set.
        *   Generates an agent prompt using the `promptTemplate` from the configuration, replacing placeholders like `{from}` and `{subject}`.
        *   Creates a `GmailTriggerEvent` and emits it via the `'trigger'` event.
        *   If `config.autoMarkRead` is true, it calls `this.adapter.markRead(msg.id)` to mark the email as read in Gmail.
5.  **Stopping the Trigger**:
    *   `stop()`: Clears the watch renewal timer and calls `this.adapter.stop()` to stop the underlying Pub/Sub listener.
    *   `resetGmailTrigger()`: Stops and clears the singleton instance.
6.  **Status**:
    *   `getStatus()`: Provides current operational status, including whether the trigger is running, watch activity, expiry, and processed counts.

### Events

The `GmailTrigger` extends `EventEmitter` and emits the following event:

*   `'trigger'` (payload: `GmailTriggerEvent`): Fired when a new email matching the filters is detected and processed.

### Architecture Diagram

```mermaid
graph TD
    A[External Webhook Endpoint] --> B{handleWebhook(body)}
    B --> C{GmailWebhookAdapter.handlePubSubNotification(data)}
    C -- New Message --> D{GmailWebhookAdapter.onNewMessage(msg)}
    D --> E{handleNewMessage(msg)}
    E -- Deduplicate & Prompt --> F[Emit 'trigger' event]
    F --> G[Agent Workflow]
    H[GmailTrigger.start()] --> I{GmailWebhookAdapter.start()}
    H --> J{GmailWebhookAdapter.setupWatch()}
    J -- Periodically --> J
```

### Integration Points

*   **`src/channels/niche-channels.js`**: The `GmailTrigger` is tightly coupled with `GmailWebhookAdapter`, which handles the low-level Google API and Pub/Sub interactions.
*   **External Webhook**: The `handleWebhook` method is designed to be called by an external HTTP endpoint (e.g., an Express route) that receives notifications from Google Cloud Pub/Sub. This is demonstrated in test files like `tests/channels/google-chat.test.ts`.

---

## 3. Polling (`PollManager`)

The `PollManager` class provides a flexible and robust system for periodically fetching data from various external sources and detecting changes.

### Purpose
To enable the agent to monitor external data sources (URLs, files, command outputs) at configurable intervals, triggering events when data changes or is retrieved.

### Key Concepts

*   **`PollType`**: A union type defining the supported polling mechanisms: `'url'`, `'file'`, `'command'`, `'custom'`.
*   **`PollConfig`**: An interface defining a single poll, including:
    *   `id`: Unique identifier.
    *   `name`: Human-readable name.
    *   `type`: The `PollType`.
    *   `target`: The specific resource to poll (URL, file path, command string).
    *   `intervalMs`: How often to poll.
    *   `enabled`: Whether the poll should start automatically.
    *   `onChangeOnly?`: If true, `'poll:result'` is only emitted when data changes.
    *   `maxRetries?`: Maximum retries before stopping a failing poll.
*   **`PollResult`**: An event object containing the `data` retrieved, `previousData`, a `changed` flag, `timestamp`, `durationMs`, and any `error`.

### How it Works

The `PollManager` operates as a singleton, managing multiple independent polls.

1.  **Initialization**:
    *   `PollManager.getInstance()`: Retrieves or creates the singleton instance.
2.  **Poll Management**:
    *   `addPoll(config: PollConfig)`: Registers a new poll. If a poll with the same `id` exists, it's replaced. If `config.enabled` is true, `startPoll()` is called.
    *   `removePoll(id: string)`: Stops and removes a poll.
    *   `listPolls()`: Retrieves all configured polls.
3.  **Polling Lifecycle**:
    *   `startPoll(id: string)`:
        *   Immediately calls `executePoll(id)`.
        *   Sets up a `setInterval` to call `executePoll(id)` repeatedly at the configured `intervalMs`.
    *   `executePoll(id: string)` (private):
        *   Retrieves the `PollConfig` for the given `id`.
        *   Based on `config.type`, it calls one of the specialized private polling methods:
            *   `pollUrl(config: PollConfig)`: Uses `fetch` to retrieve data from a URL. Handles JSON and text responses.
            *   `pollFile(config: PollConfig)`: Uses `fs/promises.readFile` to read file content and `fs/promises.stat` for metadata.
            *   `pollCommand(config: PollConfig)`: Uses `child_process.execSync` to execute a shell command and capture its output.
            *   `'custom'` type is currently a placeholder.
        *   **Error Handling & Retries**: If a poll fails, it increments a retry counter. If `maxRetries` is exceeded, the poll is stopped, and a `'poll:failed'` event is emitted.
        *   **Change Detection**: Compares the newly fetched `data` with the `previousData` (stored in `lastResults`) to determine if `changed` is true.
        *   **Event Emission**: Creates a `PollResult` object.
            *   Emits `'poll:result'` if `config.onChangeOnly` is false, or if `changed` is true.
            *   Emits `'poll:changed'` if `changed` is true.
    *   `stopPoll(id: string)`: Clears the `setInterval` timer for a specific poll.
    *   `stopAll()`: Stops all active polls.
4.  **Results**:
    *   `getLastResult(id: string)`: Retrieves the last successfully polled data for a given poll.

### Events

The `PollManager` extends `EventEmitter` and emits the following events:

*   `'poll:result'` (payload: `PollResult`): Fired after every successful poll execution, or only when data changes if `onChangeOnly` is true.
*   `'poll:changed'` (payload: `PollResult`): Fired specifically when the polled data has changed since the last check.
*   `'poll:failed'` (payload: `{ pollId: string; error: string; retries: number }`): Fired when a poll consistently fails and is stopped due to exceeding `maxRetries`.

### Example Usage

```typescript
import { PollManager } from './polls.js';

const pollManager = PollManager.getInstance();

pollManager.addPoll({
  id: 'github-status',
  name: 'GitHub Status API',
  type: 'url',
  target: 'https://www.githubstatus.com/api/v2/status.json',
  intervalMs: 30_000, // Every 30 seconds
  enabled: true,
  onChangeOnly: true,
});

pollManager.addPoll({
  id: 'local-log-file',
  name: 'Local Log File',
  type: 'file',
  target: '/var/log/agent.log',
  intervalMs: 5_000, // Every 5 seconds
  enabled: true,
  onChangeOnly: true,
});

pollManager.on('poll:changed', (result) => {
  console.log(`Poll [${result.pollId}] changed! New data:`, result.data);
  // Agent can analyze the change and take action
});

pollManager.on('poll:failed', ({ pollId, error, retries }) => {
  console.error(`Poll [${pollId}] failed after ${retries} attempts: ${error}. Stopping poll.`);
});

// To stop a specific poll:
// pollManager.stopPoll('github-status');

// To stop all polls:
// pollManager.stopAll();
```

### Integration Points

*   **`fs/promises`**: Dynamically imported by `pollFile` for file system operations.
*   **`child_process`**: Dynamically imported by `pollCommand` for executing shell commands.
*   **`fetch`**: Used by `pollUrl` for HTTP requests.
*   **`scripts/tests/cat-automation-sdk.ts`**: This module's `PollManager` is used in test scripts to verify its functionality.

---

## Conclusion

The `src/automation` module provides essential infrastructure for building reactive and robust agent systems. By offering capabilities for authentication monitoring, event-driven email processing, and flexible data polling, it empowers the agent to maintain operational integrity, respond to critical external events, and stay informed about its environment. Developers contributing to the agent's core functionality or extending its interaction capabilities will frequently interact with these components.