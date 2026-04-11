---
title: "src — logging"
module: "src-logging"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.562Z"
---
# src — logging

The `src/logging` module provides a comprehensive system for logging user interactions, AI responses, and tool executions. Its primary goal is to enable session replay, debugging, and analytics by capturing a complete history of each interaction session. This module is designed to be robust, automatically saving session data to disk and offering various methods for retrieval and management.

## Core Concepts & Data Structures

The logging module revolves around a few key data structures that define the shape of a logged session:

*   **`LoggedToolCall`**: Represents a single tool invocation. It captures the tool's ID, name, arguments, execution timestamp, success status, output, and any errors or duration.
*   **`LoggedMessage`**: Represents a single message in the conversation, whether from the system, user, assistant, or a tool. It includes the role, content, timestamp, and can optionally contain an array of `LoggedToolCall` objects if it's an assistant message proposing tools, or a `tool_call_id` if it's a tool's output message.
*   **`SessionMetadata`**: Contains high-level information about an entire session. This includes unique and short IDs, start/end times, duration, the AI model and provider used, working directory, token counts, estimated cost, number of turns, tool calls, and optional tags/description. It also captures Git information if available.
*   **`SessionData`**: The complete log for a single session. It combines the `SessionMetadata` with an ordered array of `LoggedMessage` objects, representing the full conversation history.

## The `InteractionLogger` Class

The `InteractionLogger` class is the central component of this module. It manages the lifecycle of a session, records interactions, and handles persistence to disk.

```mermaid
classDiagram
    direction LR
    class InteractionLogger {
        +startSession(options): string
        +endSession(): void
        +logMessage(message): void
        +logToolCalls(toolCalls): void
        +logToolResult(toolCallId, result): void
        +updateCost(cost): void
        +save(): void
        +getCurrentSession(): SessionData
        +static loadSession(id): SessionData
        +static listSessions(options?): {sessions: SessionMetadata[], total: number}
        +static deleteSession(sessionId): boolean
        +static formatSession(session): string
        +dispose(): void
    }
    class SessionData {
        <<struct>>
    }
    InteractionLogger ..> SessionData : manages/returns
```

### Session Lifecycle Management

An `InteractionLogger` instance manages one active session at a time.

*   **`constructor(options?)`**: Initializes the logger. It can be configured for `autoSave` (default: `true`) and a `saveIntervalMs` (e.g., 30 seconds). If `autoSave` is enabled, it sets up an interval to periodically save the current session to disk.
*   **`startSession(options)`**: Initiates a new logging session. It generates a unique ID and a short ID, populates initial `SessionMetadata` (model, provider, CWD, git info, etc.), and immediately saves the initial session data to disk. Returns the new session's full ID.
*   **`endSession()`**: Marks the current session as complete. It updates the `ended_at` and `duration_ms` in the metadata, performs a final save, and clears the internal `currentSession` state.
*   **`dispose()`**: Cleans up resources, specifically clearing the auto-save interval and calling `endSession()` if a session is active. This should be called when the application is shutting down or the logger is no longer needed.

### Logging Interactions

Once a session is started, various methods are available to record events:

*   **`logMessage(message)`**: Records a new message in the session's history. This method automatically updates `metadata.turns` for user messages and `metadata.total_input_tokens`/`total_output_tokens` based on the message role and provided token count.
*   **`logToolCalls(toolCalls)`**: Records tool calls proposed by the assistant. These tool calls are appended to the `tool_calls` array of the *last assistant message* in the session history. It also increments `metadata.tool_calls`.
*   **`logToolResult(toolCallId, result)`**: Updates the status of a previously logged tool call. It searches through messages to find the `LoggedToolCall` matching `toolCallId` and updates its `success`, `output`, `error`, and `duration_ms` fields.
*   **`updateCost(cost)`**: Allows updating the `metadata.estimated_cost` for the current session.

All logging methods trigger a `save()` operation if `autoSave` is enabled, ensuring data is regularly persisted.

### Data Persistence and Retrieval

The `InteractionLogger` handles saving and loading session data from the file system.

*   **`save()`**: Writes the `currentSession` object to its designated log file as a pretty-printed JSON string. It ensures the target directory structure exists before writing.
*   **`getCurrentSession()`**: Returns the `SessionData` object for the currently active session.
*   **`getCurrentSessionId()`**: Returns the unique ID of the currently active session.

The module also provides static methods for managing sessions across the application:

*   **`InteractionLogger.loadSession(sessionId)`**: Loads a specific session from disk using its full or short ID.
*   **`InteractionLogger.searchSessions(partialId)`**: Searches for sessions whose full or short ID matches a given `partialId`. Returns an array of matching `SessionData` objects, sorted by most recent first.
*   **`InteractionLogger.getLatestSession()`**: Retrieves the most recently modified session from disk.
*   **`InteractionLogger.listSessions(options?)`**: Provides a paginated list of `SessionMetadata` objects, with optional filtering by tags, model, and date range.
*   **`InteractionLogger.deleteSession(sessionId)`**: Deletes the log file(s) associated with a given session ID.
*   **`InteractionLogger.formatSession(session)`**: Generates a human-readable string representation of a `SessionData` object, useful for displaying session details in a CLI or UI.

### Internal Helpers

*   **`generateShortId(uuid)`**: Creates an 8-character short ID from a UUID.
*   **`getLogPath(sessionId)`**: Determines the file path for a session's log file, creating date-based directories as needed.
*   **`findSessionFiles(idPattern)`**: A private static helper that scans the log directory structure to find files matching a session ID pattern, returning paths sorted by modification time.

## Storage Mechanism

Session logs are stored in the user's home directory under `~/.codebuddy/logs`.
The directory structure is organized by date:

```
~/.codebuddy/logs/
├── YYYY-MM-DD/
│   ├── <session-id-1>.json
│   ├── <session-id-2>.json
│   └── ...
└── YYYY-MM-DD/
    ├── <session-id-N>.json
    └── ...
```

Each log file is a JSON representation of the `SessionData` interface, ensuring a consistent and easily parseable format. The `version` field in `SessionData` allows for future schema evolution.

## Accessing the Logger

The module provides two ways to obtain an `InteractionLogger` instance:

*   **`getInteractionLogger()`**: This is the primary method for accessing the logger throughout the application. It implements a singleton pattern, ensuring that only one instance of `InteractionLogger` is active at any given time, managing the global current session.
*   **`createInteractionLogger(options?)`**: This factory function creates and returns a *new, independent* `InteractionLogger` instance. This is particularly useful for testing scenarios where isolated logger instances are required without affecting the global singleton.

## Integration Points

The `InteractionLogger` is a foundational module, integrated across various parts of the codebase:

*   **`src/index.ts` (Main Application Flow)**:
    *   Uses `getInteractionLogger()` to obtain the singleton instance.
    *   Calls `startSession()` at the beginning of a new interaction flow.
    *   Calls `endSession()` or `dispose()` when the application exits or an interaction flow concludes.
*   **`src/hooks/use-input-handler.ts` (User Input Processing)**:
    *   Uses `logMessage()` to record user input and AI responses.
    *   Uses `logToolCalls()` to record tool invocations suggested by the AI.
    *   Uses `logToolResult()` to update the status and output of executed tools.
    *   Uses `getCurrentSessionId()` to associate actions with the current session.
*   **`commands/handlers/session-handlers.ts` (CLI Session Management)**:
    *   Leverages static methods like `searchSessions()`, `loadSession()`, `listSessions()`, `getLatestSession()`, and `formatSession()` to provide CLI commands for viewing and managing past sessions.
*   **Tests (`tests/interaction-logger.test.ts`, `tests/unit/logging.test.ts`)**:
    *   Utilizes `createInteractionLogger()` to create isolated logger instances for testing specific functionalities without side effects on a global state.
    *   Tests various logging, saving, loading, and management methods.

This module provides a robust and centralized mechanism for capturing and managing the rich history of interactions, crucial for debugging, analysis, and future features like session replay.