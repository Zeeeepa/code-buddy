---
title: "src — presence"
module: "src-presence"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.636Z"
---
# src — presence

The `src/presence/typing-indicator.ts` module provides a robust mechanism for managing "typing" indicators and overall system presence. It's designed to allow other parts of the application to signal active user input (e.g., a bot typing a response) and to reflect the system's general availability status.

## Module Overview

This module centralizes the logic for:
1.  **Signaling Typing Activity**: Initiating and stopping "typing..." indicators for specific communication channels and chats.
2.  **Maintaining System Presence**: Tracking the overall status of the application (e.g., `online`, `busy`, `idle`).
3.  **Event-Driven Communication**: Notifying subscribers about changes in typing status or system presence.

It's a self-contained utility that other modules (e.g., channel-specific integrations like Telegram or Discord bots) can leverage to provide a more responsive and informative user experience.

## Key Concepts

### `ChannelType`
A union type defining the supported communication channels.
```typescript
type ChannelType = 'telegram' | 'discord' | 'slack' | 'terminal';
```

### `TypingSession`
An interface representing an active typing indicator for a specific chat.
```typescript
interface TypingSession {
  channel: ChannelType;
  chatId: string;
  interval: ReturnType<typeof setInterval> | null; // The interval for periodic updates
  active: boolean; // Whether the session is currently active
  startedAt: number; // Timestamp when the session began
}
```

### `PresenceState`
An interface defining the overall presence status of the system.
```typescript
interface PresenceState {
  status: 'online' | 'busy' | 'idle' | 'offline';
  lastActivity: number; // Timestamp of the last status update
  currentTask?: string; // Optional description of the current task
}
```

## `TypingIndicatorManager` Class

The `TypingIndicatorManager` is the core class of this module. It extends Node.js's `EventEmitter`, allowing it to emit events when typing status or presence changes.

### Initialization

```typescript
class TypingIndicatorManager extends EventEmitter {
  private sessions: Map<string, TypingSession> = new Map();
  private presence: PresenceState = { status: 'online', lastActivity: Date.now() };
  private intervalMs: number;

  constructor(intervalMs: number = 4000) {
    super();
    this.intervalMs = intervalMs; // How often to re-emit 'typing' events
  }
  // ...
}
```
The constructor initializes the manager with an optional `intervalMs` parameter, which dictates how frequently the `'typing'` event should be re-emitted while a session is active. This is crucial for platforms that require periodic "typing" signals to keep the indicator visible.

### Core Functionality

#### `startTyping(channel: ChannelType, chatId: string): string`
Initiates a typing indicator for a specific `channel` and `chatId`.
-   If a typing session for the given `channel` and `chatId` already exists, it returns the existing key without creating a new session.
-   Creates a new `TypingSession` and stores it internally.
-   Immediately emits a `'typing'` event with `typing: true`.
-   Sets up an `setInterval` to periodically re-emit the `'typing'` event, ensuring the indicator remains active on the client side.
-   Updates the system's overall presence to `'busy'`.
-   Returns a unique `key` (e.g., `"telegram:12345"`) for the session, which can be used to stop it later.

#### `stopTyping(key: string): void`
Stops a specific typing indicator session identified by its `key`.
-   Clears the associated `setInterval` to stop periodic `'typing'` events.
-   Emits a `'typing'` event with `typing: false` to signal the end of typing.
-   Removes the session from internal tracking.
-   If no other typing sessions are active, the system's overall presence is updated back to `'online'`.

#### `stopAll(): void`
Stops all currently active typing indicator sessions. This method iterates through all active sessions and calls `stopTyping` for each.

### Presence Management

#### `updatePresence(status: PresenceState['status'], task?: string): void`
Manually updates the system's overall presence state.
-   Sets the `status` (e.g., `'online'`, `'idle'`, `'busy'`, `'offline'`) and optionally a `currentTask`.
-   Updates `lastActivity` to the current timestamp.
-   Emits a `'presence'` event with the new state.

#### `getPresence(): PresenceState`
Returns a copy of the current `PresenceState`.

#### `getActiveCount(): number`
Returns the number of currently active typing sessions.

### Lifecycle

#### `dispose(): void`
Performs cleanup for the `TypingIndicatorManager`.
-   Calls `stopAll()` to clear all active typing intervals.
-   Removes all registered event listeners, preventing memory leaks.

## Events Emitted

The `TypingIndicatorManager` emits two types of events:

1.  **`'typing'`**:
    -   **Payload**: `{ channel: ChannelType, chatId: string, typing: boolean }`
    -   **Description**: Fired when a typing indicator starts (`typing: true`), stops (`typing: false`), or periodically to maintain an active indicator.
    -   **Use Case**: Channel-specific integration modules would listen to this event to send the appropriate "typing" signal to their respective platforms (e.g., `bot.sendChatAction('typing')` for Telegram).

2.  **`'presence'`**:
    -   **Payload**: `{ status: 'online' | 'busy' | 'idle' | 'offline', lastActivity: number, currentTask?: string }`
    -   **Description**: Fired whenever the system's overall presence state changes, either automatically by typing activity or via a manual `updatePresence` call.
    -   **Use Case**: A dashboard or monitoring system could subscribe to this to display the application's current status.

## Internal Flow

The following diagram illustrates the core interactions within the `TypingIndicatorManager` when handling typing sessions:

```mermaid
graph TD
    subgraph TypingIndicatorManager
        A[startTyping(channel, chatId)] --> B{Create TypingSession}
        B --> C[Emit 'typing' (true)]
        C --> D[setInterval(emit 'typing' (true))]
        D -- periodically --> C
        D --> E[updatePresence('busy')]

        F[stopTyping(key)] --> G{Clear interval}
        G --> H[Emit 'typing' (false)]
        H --> I{Delete TypingSession}
        I --> J{If no sessions, updatePresence('online')}
    end
```

## Integration with the Codebase

The `TypingIndicatorManager` is designed to be a central service for managing presence and typing states.
-   **Incoming Calls**: Primarily from higher-level modules that need to signal activity (e.g., a bot handler before sending a long response) or from testing utilities.
-   **Outgoing Calls**: None directly to other modules. Its primary interaction mechanism is through emitting events, allowing for a decoupled architecture.

A typical integration pattern would involve:
1.  Instantiating `TypingIndicatorManager` once in the application's bootstrap phase.
2.  Channel-specific modules (e.g., `TelegramAdapter`, `DiscordAdapter`) subscribing to the `'typing'` event.
3.  Core application logic or command handlers calling `startTyping` and `stopTyping` as needed.
4.  Monitoring or dashboard components subscribing to the `'presence'` event.

This module ensures that the application can communicate its activity and availability effectively across various platforms without tightly coupling the presence logic to specific channel implementations.