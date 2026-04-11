---
title: "src — persistence"
module: "src-persistence"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.624Z"
---
# src — persistence

The `src/persistence` module is responsible for managing the long-term storage, retrieval, and manipulation of conversation data within Code Buddy. It provides mechanisms for persisting chat sessions, handling conversation branches, exporting/replaying sessions, and ensuring data integrity through file locking.

## Core Concepts: Sessions, Branches, and Exports

Before diving into the components, it's important to understand the distinct concepts of "sessions," "branches," and "exported sessions" as handled by this module:

1.  **Sessions (Managed by `SessionStore`)**:
    *   Represent the primary, ongoing conversation history with Code Buddy.
    *   Persisted as individual JSON files (and partially to SQLite) in the user's home directory (`~/.codebuddy/sessions`).
    *   Can be created, loaded, updated, listed, searched, and resumed.
    *   Support basic metadata, working directory, and model information.
    *   Designed for continuity across Code Buddy invocations.

2.  **Conversation Branches (Managed by `ConversationBranchManager`)**:
    *   Allow forking and merging of conversation histories, similar to Git branches.
    *   Each branch is a distinct sequence of messages, potentially diverging from a parent branch at a specific message index.
    *   Persisted as individual JSON files in `~/.codebuddy/branches`.
    *   Primarily used for exploring alternative conversational paths without losing the original context.

3.  **Exported Sessions (Managed by `SessionRecorder`, `SessionExporter`, `SessionPlayer`)**:
    *   A snapshot of a conversation, designed for sharing, debugging, or replaying.
    *   `SessionRecorder` captures messages and metadata in memory.
    *   `SessionExporter` converts this in-memory snapshot into various formats (JSON, Markdown, HTML).
    *   `SessionPlayer` can load an exported JSON session and replay it, simulating the original conversation flow.
    *   These components operate independently of the live `SessionStore` and `ConversationBranchManager`, focusing on the *representation* and *playback* of a session rather than its live management.

## Architecture Overview

The `persistence` module is composed of several distinct classes, each with a specialized role. `SessionStore` and `ConversationBranchManager` handle the live, mutable state of conversations, while `SessionRecorder`, `SessionExporter`, and `SessionPlayer` deal with immutable snapshots for export and replay. `SessionLock` provides a critical utility for `SessionStore` to prevent data corruption.

```mermaid
graph TD
    subgraph Live Conversation Management
        SS[SessionStore] -->|Persists & Loads| SessionFiles(Session JSON Files)
        SS -->|Uses for concurrency| SL(SessionLock)
        SS -->|Partially writes to| DB(SQLite Database)
        CBM[ConversationBranchManager] -->|Persists & Loads| BranchFiles(Branch JSON Files)
    end

    subgraph Session Export & Replay
        SR[SessionRecorder] -->|Records messages into| ExportedSession(In-memory Session)
        ExportedSession --> SE[SessionExporter]
        ExportedSession --> SP[SessionPlayer]
        SE -->|Outputs| JSON(JSON String)
        SE -->|Outputs| MD(Markdown String)
        SE -->|Outputs| HTML(HTML String)
        SP -->|Consumes| JSON
    end

    subgraph Utilities
        SPicker[SessionPicker] -->|Reads from| SessionFiles
    end

    subgraph External Dependencies
        SS -- Calls --> GRT[generateConversationTitle (utils)]
        SE -- Calls --> DRE[DataRedactionEngine (security)]
        SL -- Calls --> Process(OS Process API)
    end

    style SS fill:#e0f7fa,stroke:#00796b,stroke-width:2px
    style CBM fill:#e0f7fa,stroke:#00796b,stroke-width:2px
    style SR fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    style SE fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    style SP fill:#fff3e0,stroke:#ff8f00,stroke-width:2px
    style SL fill:#e8f5e9,stroke:#4caf50,stroke-width:2px
    style SPicker fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    style SessionFiles fill:#f5f5f5,stroke:#9e9e9e,stroke-dasharray: 5 5
    style BranchFiles fill:#f5f5f5,stroke:#9e9e9e,stroke-dasharray: 5 5
    style ExportedSession fill:#f5f5f5,stroke:#9e9e9e,stroke-dasharray: 5 5
    style DB fill:#f5f5f5,stroke:#9e9e9e,stroke-dasharray: 5 5
```

## Key Components

### `SessionStore` (`src/persistence/session-store.ts`)

The `SessionStore` is the primary component for managing the persistence of Code Buddy's main conversation sessions. It handles saving and loading session data, including messages and metadata, to disk.

**Key Features:**

*   **Session Management**: `createSession`, `loadSession`, `updateCurrentSession`, `addMessageToCurrentSession`, `deleteSession`, `resumeSession`.
*   **Storage**: Sessions are primarily stored as JSON files in `~/.codebuddy/sessions`.
    *   It also has a `useSQLite` configuration option. When enabled, `createSession` and `addMessageToCurrentSession` will write basic session and message data to an SQLite database via `SessionRepository`. However, `loadSession` and `listSessions` *still read exclusively from JSON files*. This means SQLite is used for *recording* new data, but not for *retrieving* full session state or listing existing sessions.
*   **Auto-Save**: Supports an `autoSave` mode to automatically persist changes.
*   **Ephemeral Mode**: Sessions can be marked as `ephemeral` (`setEphemeral(true)`), preventing them from being written to disk. Useful for one-off queries.
*   **Session Locking**: Uses `SessionLock` to prevent concurrent writes to the same session file, ensuring data integrity.
*   **Task State Persistence**: Provides `saveTaskState` and `loadTaskState` for cross-session continuity of agent task states.
*   **Export**: Includes methods to `exportToMarkdown`, `exportToJson`, and `exportToHtml` for a given session.
*   **Session Discovery**: `listSessions`, `getRecentSessions`, `searchSessions`, `getLastSession`, `getSessionByPartialId`.
*   **Branching/Cloning**: `cloneSession` and `branchSession` allow creating new sessions based on existing ones.
*   **Singleton**: Accessed via `getSessionStore()`.

**Usage Example:**

```typescript
import { getSessionStore } from './persistence/session-store.js';
import type { ChatEntry } from '../agent/types.js';

const sessionStore = getSessionStore();

async function manageSession() {
  // Create a new session
  const newSession = await sessionStore.createSession("My New Project Chat");
  console.log(`Created session: ${newSession.id}`);

  // Add a message
  const userMessage: ChatEntry = {
    type: 'user',
    content: 'Hello Code Buddy, how can I refactor this?',
    timestamp: new Date(),
  };
  await sessionStore.addMessageToCurrentSession(userMessage);

  // Load a session
  const loadedSession = await sessionStore.loadSession(newSession.id);
  if (loadedSession) {
    console.log(`Loaded session "${loadedSession.name}" with ${loadedSession.messages.length} messages.`);
  }

  // List recent sessions
  const recent = await sessionStore.getRecentSessions(5);
  console.log("Recent sessions:\n", sessionStore.formatSessionList());

  // Export to Markdown
  const markdownPath = await sessionStore.exportSessionToFile(newSession.id, 'my-session.md');
  console.log(`Session exported to ${markdownPath}`);
}

manageSession();
```

### `ConversationBranchManager` (`src/persistence/conversation-branches.ts`)

The `ConversationBranchManager` enables Git-like branching and merging of conversation histories. This is crucial for exploring different solutions or conversational paths without losing the original context.

**Key Features:**

*   **Branch Lifecycle**: `createBranch`, `fork`, `forkFromMessage`, `checkout`, `deleteBranch`, `renameBranch`.
*   **Message Management**: `addMessage`, `setMessages`, `getMessages` (for the current branch).
*   **Merging**: `merge` allows combining messages from one branch into another, with "append" or "replace" strategies. Includes `findCommonAncestor` for intelligent merging.
*   **Persistence**: Branches are stored as individual JSON files in `~/.codebuddy/branches`.
*   **Branch Traversal**: `getAllBranches`, `getBranchTree`, `getBranchHistory`.
*   **Event Emitter**: Emits events like `branch:created`, `branch:forked`, `branch:checkout`, `branch:merged`, `branch:deleted`, `branch:renamed`.
*   **Formatting**: `formatBranches` and `formatBranchTree` provide human-readable output for CLI.
*   **Singleton**: Accessed via `getBranchManager()`.

**Usage Example:**

```typescript
import { getBranchManager } from './persistence/conversation-branches.js';
import { CodeBuddyMessage } from '../codebuddy/client.js';

const branchManager = getBranchManager();

async function manageBranches() {
  // Ensure 'main' branch exists and is current
  branchManager.checkout("main");

  // Add some initial messages
  branchManager.addMessage({ role: 'user', content: 'Initial query' } as CodeBuddyMessage);
  branchManager.addMessage({ role: 'assistant', content: 'Initial response' } as CodeBuddyMessage);

  // Fork a new branch
  const featureBranch = branchManager.fork("feature-a");
  console.log(`Forked to branch: ${featureBranch.name} (${featureBranch.id})`);

  // Add messages to the feature branch
  branchManager.addMessage({ role: 'user', content: 'On feature-a: new question' } as CodeBuddyMessage);
  branchManager.addMessage({ role: 'assistant', content: 'On feature-a: new answer' } as CodeBuddyMessage);

  // Checkout back to main
  branchManager.checkout("main");
  branchManager.addMessage({ role: 'user', content: 'On main: another question' } as CodeBuddyMessage);

  // Merge feature-a into main
  branchManager.merge(featureBranch.id, "append");
  console.log(`Merged ${featureBranch.name} into main.`);

  console.log(branchManager.formatBranches());
  console.log(branchManager.formatBranchTree());
}

manageBranches();
```

### `SessionRecorder`, `SessionExporter`, `SessionPlayer` (`src/persistence/session-export.ts`)

These three classes work together to provide advanced capabilities for recording, exporting, and replaying conversation sessions. They operate on an `ExportedSession` data structure, which is a self-contained snapshot of a conversation.

#### `SessionRecorder`

Records messages, tool calls, and metadata into an in-memory `ExportedSession` object.

**Key Features:**

*   **Recording**: `start()`, `stop()`, `addMessage`, `addUserMessage`, `addAssistantMessage`, `addToolResult`.
*   **Metadata**: `updateUsage`, `createCheckpoint`, `addTags`, `setSummary`.
*   **Event Emitter**: Emits `recording:started`, `recording:stopped`, `message:added`, `checkpoint:created`.
*   **Singleton**: `getSessionRecorder()` provides a global instance for live recording.

#### `SessionExporter`

Takes an `ExportedSession` and converts it into various output formats.

**Key Features:**

*   **Export Formats**: `export()` method supports `json`, `markdown`, and `html`.
*   **File Export**: `exportToFile()` simplifies writing to a file, inferring format from extension.
*   **Options**: Supports options for redacting secrets, including tool results, metadata, and checkpoints.
*   **Data Redaction**: Integrates with `getDataRedactionEngine` from `src/security/data-redaction.ts` to redact sensitive information.

#### `SessionPlayer`

Loads an `ExportedSession` (typically from a JSON file) and replays it, simulating the original conversation flow.

**Key Features:**

*   **Loading**: `loadFromFile()`, `load()`.
*   **Replay Control**: `replay()`, `pause()`, `resume()`, `stop()`.
*   **Navigation**: `jumpToCheckpoint()`, `jumpToIndex()`.
*   **Replay Options**: Configurable speed, start/stop points, pausing at tool calls, skipping tool execution.
*   **Event Emitter**: Emits `loaded`, `replay:started`, `replay:ended`, `message`, `toolcall`, `paused`, `resumed`, `stopped`, `paused:toolcall`, `jumped`.

**Usage Example (Recorder/Exporter):**

```typescript
import { getSessionRecorder, SessionExporter } from './persistence/session-export.js';

const recorder = getSessionRecorder(); // Global singleton
recorder.start();

recorder.addUserMessage("What's the capital of France?");
recorder.addAssistantMessage("Paris.");
recorder.updateUsage(10, 0.0001);
recorder.createCheckpoint("Initial Q&A");

const sessionData = recorder.getSession();
recorder.stop();

const exporter = new SessionExporter();
const markdownOutput = exporter.export(sessionData, { format: 'markdown' });
console.log(markdownOutput);

// To export to file:
// await exporter.exportToFile(sessionData, 'exported-session.html', { format: 'html' });
```

**Usage Example (Player):**

```typescript
import { SessionPlayer } from './persistence/session-export.js';
import * as fs from 'fs/promises';

async function replayExample() {
  // Assume 'exported-session.json' exists from a previous export
  const player = new SessionPlayer();
  await player.loadFromFile('exported-session.json');

  player.on('message', ({ message, index }) => {
    console.log(`[${index}] ${message.role}: ${message.content.slice(0, 50)}...`);
  });
  player.on('replay:ended', () => console.log('Replay finished.'));

  await player.replay({ speed: 2, pauseAtToolCalls: true }); // 2x speed, pause on tools
  player.dispose();
}

// replayExample();
```

### `SessionLock` (`src/persistence/session-lock.ts`)

Provides a file-based locking mechanism to prevent multiple processes from concurrently writing to the same session file, which could lead to data corruption.

**Key Features:**

*   **PID-based Locking**: Creates a `.lock` file alongside the target session file, containing the PID of the process holding the lock.
*   **Stale Lock Detection**: Automatically cleans up locks held by dead processes or locks that are older than `LOCK_STALE_MS` (1 minute).
*   **Atomic Acquisition**: Uses `fs.writeFileSync` with the `wx` flag for atomic file creation, preventing race conditions.
*   **Process Exit Cleanup**: Registers handlers to release the lock when the process exits or receives termination signals.
*   **`withSessionLock` Utility**: A convenient async function to wrap operations that require a lock, ensuring it's acquired and released correctly.

**Usage Example (Internal to `SessionStore`):**

```typescript
// Inside SessionStore.saveSession:
import { withSessionLock } from './session-lock.js';

// ...
const filePath = this.getSessionFilePath(session.id);
await withSessionLock(filePath, async () => {
  await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2));
});
// ...
```

### `SessionPicker` (`src/persistence/session-picker.ts`)

A utility class for browsing and formatting session entries, primarily for CLI or UI display.

**Key Features:**

*   **Entry Management**: Stores and provides access to `SessionPickerEntry` objects.
*   **Sorting**: `getEntries()` returns entries sorted by `lastAccessed`.
*   **Searching**: `searchByBranch()`, `searchByName()`.
*   **Formatting**: `formatEntry()` and `formatTable()` provide structured string output for display.

**Usage Example:**

```typescript
import { SessionPicker, SessionPickerEntry } from './persistence/session-picker.js';

const entries: SessionPickerEntry[] = [
  { id: 'session_abc123', name: 'Refactor Utility', branch: 'main', messageCount: 25, lastAccessed: Date.now() - 100000, tags: ['refactor'] },
  { id: 'session_def456', name: 'New Feature Idea', branch: 'feature-x', messageCount: 10, lastAccessed: Date.now() - 50000, tags: ['feature'] },
];

const picker = new SessionPicker(entries);

console.log(picker.formatTable(picker.getEntries()));
// Output:
// ID        Name                 Branch          Messages  Last Used
// --------------------------------------------------
// session_d New Feature Idea     feature-x       10        2023-10-27
// session_a Refactor Utility     main            25        2023-10-27
```

## Data Models

The `persistence` module defines several key interfaces to structure conversation data:

*   **`ConversationBranch`**: Represents a single branch in the conversation tree.
    ```typescript
    interface ConversationBranch {
      id: string;
      name: string;
      parentId?: string;
      parentMessageIndex?: number;
      messages: CodeBuddyMessage[]; // From ../codebuddy/client.js
      createdAt: Date;
      updatedAt: Date;
      metadata?: BranchMetadata;
    }
    ```
*   **`BranchMetadata`**: Additional information for a `ConversationBranch`.
*   **`Session`**: Represents a live, ongoing conversation session.
    ```typescript
    interface Session {
      id: string;
      name: string;
      workingDirectory: string;
      model: string;
      messages: SessionMessage[];
      createdAt: Date;
      lastAccessedAt: Date;
      metadata?: SessionMetadata;
    }
    ```
*   **`SessionMessage`**: A message within a `Session`, a more detailed type than `CodeBuddyMessage` for persistence.
    ```typescript
    interface SessionMessage {
      type: 'user' | 'assistant' | 'tool_result' | 'tool_call' | 'reasoning' | 'plan_progress' | 'steer' | 'diff_preview';
      content: string;
      timestamp: string;
      toolCallName?: string;
      toolCallSuccess?: boolean;
      taskState?: Record<string, unknown>; // For cross-session continuity
    }
    ```
*   **`SessionMetadata`**: Additional information for a `Session`.
*   **`ExportedSession`**: A snapshot of a session, used for export and replay.
    ```typescript
    interface ExportedSession {
      version: string;
      exportedAt: number;
      metadata: SessionMetadata;
      messages: SessionMessage[];
      checkpoints?: SessionCheckpoint[];
    }
    ```
*   **`SessionCheckpoint`**: A marker within an `ExportedSession` for replay.
*   **`SessionPickerEntry`**: A simplified view of a session for listing/picking.

## Integration Points & Dependencies

The `persistence` module interacts with several other parts of the Code Buddy codebase:

*   **`src/codebuddy/client.ts`**: `CodeBuddyMessage` type is used within `ConversationBranch`.
*   **`src/utils/logger.ts`**: Used for logging warnings and debug information.
*   **`src/utils/conversation-title.ts`**: `generateConversationTitle` is used by `SessionStore` to auto-name sessions.
*   **`src/security/data-redaction.ts`**: `getDataRedactionEngine` is used by `SessionExporter` to redact sensitive data.
*   **`src/database/repositories/session-repository.ts`**: `SessionStore` interacts with this repository when SQLite is enabled.
*   **`src/agent/types.ts`**: `ChatEntry` type is converted to `SessionMessage` by `SessionStore`.
*   **`commands/handlers/*`**: Command handlers (e.g., `branch-handlers.ts`) directly interact with `ConversationBranchManager` and `SessionStore` to implement CLI commands.
*   **`ui/components/*`**: UI components (e.g., `SessionTimeline.tsx`) might query `ConversationBranchManager` for branch information.
*   **Node.js built-in modules**: `fs`, `fs/promises`, `path`, `os`, `events`.
*   **Third-party modules**: `fs-extra` (for `ConversationBranchManager`).

## Usage Patterns & Entry Points

Developers should primarily interact with this module through its singleton instances and factory functions:

*   **`getSessionStore()`**: The main entry point for managing live chat sessions.
*   **`getBranchManager()`**: The main entry point for managing conversation branches.
*   **`getSessionRecorder()`**: The global instance for recording messages for export.
*   **`new SessionExporter()`**: Instantiate directly to export session data.
*   **`new SessionPlayer()`**: Instantiate directly to replay session data.
*   **`exportSession()` / `replaySession()`**: Convenience functions for quick export/replay operations.

**Important Note on Exports**:
The `src/persistence/index.ts` file only re-exports `conversation-branches.ts`. This means that `SessionStore`, `SessionRecorder`, `SessionExporter`, `SessionPlayer`, `SessionLock`, and `SessionPicker` must be imported directly from their respective files (e.g., `import { getSessionStore } from './persistence/session-store.js';`).

## Contribution Guidelines

*   **Consistency**: When adding new persistence mechanisms or modifying existing ones, ensure consistency in how data is stored (e.g., JSON format, date serialization).
*   **File Locking**: For any new file-based persistence, consider if `SessionLock` or a similar mechanism is needed to prevent concurrent write issues.
*   **SQLite Integration**: If extending `SessionStore`'s SQLite integration, ensure that both read and write paths are fully implemented and tested, and that the JSON file fallback remains robust.
*   **Error Handling**: Persistence operations can fail due to file system issues. Implement robust `try-catch` blocks and appropriate logging (using `logger`) to handle these gracefully.
*   **Performance**: For operations involving many sessions or large message histories, consider performance implications, especially for synchronous file system operations.
*   **Testability**: Design components to be easily testable, ideally by allowing dependency injection or providing clear interfaces. The `resetBranchManager()` and `resetSessionRecorder()` functions are provided for testing purposes.