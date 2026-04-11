---
title: "src — checkpoints"
module: "src-checkpoints"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.396Z"
---
# src — checkpoints

The `src/checkpoints` module provides a suite of tools for managing and restoring file states within a project. It offers various strategies, from simple in-memory undo/redo to persistent, Git-backed versioning, catering to different needs for state preservation and recovery.

## Core Concepts

At the heart of this module are two fundamental interfaces:

*   `FileSnapshot`: Represents the state of a single file at a given moment. It includes the file's `path`, its `content`, and a boolean `existed` indicating if the file was present when the snapshot was taken.
*   `Checkpoint`: A collection of `FileSnapshot`s, representing the state of multiple files (or the entire workspace) at a specific point in time. Each checkpoint has a unique `id`, `timestamp`, `description`, and the `workingDirectory` it was created in.

## Checkpointing Strategies

The module implements four distinct checkpointing mechanisms, each with its own purpose and persistence model.

### 1. In-Memory Checkpoints (`CheckpointManager`)

The `CheckpointManager` provides a lightweight, session-scoped undo/redo capability. It stores checkpoints in an in-memory array, making it suitable for temporary state management during an active session.

**Purpose:**
*   Quick, temporary undo/redo within a single application session.
*   Capturing file states before minor modifications or operations.

**How it Works:**
*   Checkpoints are stored in a private `checkpoints: Checkpoint[]` array.
*   When `createCheckpoint` is called, it takes snapshots of specified files using `fs.readFileSync` and adds them to the array.
*   A `maxCheckpoints` limit (default 50) ensures the array doesn't grow indefinitely, with older checkpoints being `shift()`ed out.
*   `rewindTo` restores files from a specified checkpoint by writing their content back to disk or deleting them if they didn't exist in the snapshot.
*   It emits `checkpoint-created` and `rewind` events.

**Key API:**

*   `constructor(options?: CheckpointManagerOptions)`: Initializes the manager with optional `maxCheckpoints` and `autoCheckpoint` settings.
*   `createCheckpoint(description: string, files?: string[]): Checkpoint`: Creates a new checkpoint, optionally for a specific set of files.
*   `checkpointBeforeEdit(filePath: string, description?: string): Checkpoint`: Convenience method to snapshot a file before it's edited.
*   `checkpointBeforeCreate(filePath: string, description?: string): Checkpoint`: Convenience method to snapshot a file before it's created (useful for tracking non-existent files).
*   `rewindTo(checkpointId: string)`: Restores the workspace to the state of a given checkpoint.
*   `rewindToLast()`: Restores to the most recent checkpoint.
*   `getCheckpoints()`: Returns all stored checkpoints.
*   `formatCheckpointList()`: Provides a human-readable list of checkpoints.

**Usage Example:**

```typescript
import { getCheckpointManager } from './checkpoint-manager.js';

const manager = getCheckpointManager();

// Before making a change
manager.checkpointBeforeEdit('src/my-file.ts', 'Before refactoring function X');

// ... perform file modifications ...

// If something goes wrong, rewind
const result = manager.rewindToLast();
if (result.success) {
  console.log('Successfully rewound:', result.restored);
} else {
  console.error('Failed to rewind:', result.errors);
}

console.log(manager.formatCheckpointList());
```

**Integration:**
The `CheckpointManager` is used by `src/agent/tool-executor.ts` to create checkpoints before tool dispatches, allowing for immediate undo of agent actions.

### 2. Persistent Checkpoints (`PersistentCheckpointManager`)

The `PersistentCheckpointManager` extends the concept of checkpoints by storing them on disk, providing cross-session persistence. This is inspired by tools like Gemini CLI's `/restore` command.

**Purpose:**
*   Maintain a history of file states across application restarts.
*   Provide a robust undo/restore mechanism for a specific project.

**How it Works:**
*   Checkpoints are stored in a dedicated directory structure: `~/.codebuddy/history/<project_hash>/`.
*   A `project_hash` is generated from the `workingDirectory` to isolate checkpoints per project.
*   Each checkpoint is saved as a separate JSON file (`<checkpoint_id>.json`) within the project's history directory.
*   An `index.json` file tracks the order and IDs of checkpoints for the project.
*   `loadIndex` and `saveIndex` manage this index file.
*   `loadCheckpoint` and `saveCheckpoint` handle reading/writing individual checkpoint files, with a `checkpointCache` for performance.
*   `restore` functions similarly to `rewindTo` but operates on disk-loaded checkpoints.

**Key API:**

*   `constructor(options?: PersistentCheckpointManagerOptions)`: Initializes the manager, setting up the history directory.
*   `createCheckpoint(description: string, files?: string[]): PersistentCheckpoint`: Creates and saves a new persistent checkpoint.
*   `restore(checkpointId: string)`: Restores the workspace to a specific persistent checkpoint.
*   `restoreLast()`: Restores to the most recent persistent checkpoint.
*   `getCheckpoints()`: Retrieves all persistent checkpoints for the current project.
*   `clearCheckpoints()`: Deletes all checkpoints for the current project from disk.
*   `getStats()`: Provides statistics like count, total files, and storage size.

**Usage Example:**

```typescript
import { getPersistentCheckpointManager } from './persistent-checkpoint-manager.js';

const manager = getPersistentCheckpointManager();

// On application start, load existing checkpoints
console.log(manager.formatCheckpointList());

// Create a checkpoint before a major operation
manager.createCheckpoint('Before attempting complex refactor');

// ... application runs, potentially restarts ...

// Restore to a specific checkpoint from the list
const result = manager.restore('cp_123abc_def456');
if (result.success) {
  console.log('Restored to checkpoint:', result.checkpoint?.description);
}
```

**Integration:**
The `PersistentCheckpointManager` is used by `commands/handlers/extra-handlers.ts` for the `/undo` command, allowing users to revert to previous states. `src/features/index.ts` also uses it to report feature status.

### 3. Git-based Ghost Snapshots (`GhostSnapshotManager`)

The `GhostSnapshotManager` leverages Git to create "ghost" commits that capture the workspace state without polluting the user's main Git history. This is ideal for automatic, frequent snapshots, especially for agent-driven development, enabling easy undo/redo of agent turns.

**Purpose:**
*   Automatic, lightweight snapshots of the workspace before each agent turn.
*   Provides a robust undo/redo mechanism for agent actions.
*   Keeps snapshot history separate from the main Git history.

**How it Works:**
*   It uses Node.js `child_process.execFile` to run Git commands.
*   `initialize()` checks if the current working directory is a Git repository.
*   `createSnapshot()`:
    1.  Stages all changes (`git add -A`).
    2.  If there are changes, it creates a commit (`git commit --allow-empty -m "[ghost]..."`) but then immediately performs a `git reset --soft HEAD~1` to unstage the changes, leaving them in the working directory.
    3.  The commit hash is then stored as a Git reference under a special namespace: `refs/codebuddy/ghost/<snapshot_id>`. This makes the commit reachable by its ref but not part of any branch.
    4.  If no changes, it just records the current `HEAD` hash.
*   `restoreSnapshot()`: Uses `git checkout <commit_hash> -- .` to restore the working directory to the state of a ghost commit.
*   `undoLastTurn()` and `redoLastTurn()` manage a stack of snapshots to facilitate navigation through the history.
*   Old snapshots are pruned to `MAX_GHOST_SNAPSHOTS` (default 50).

**Key API:**

*   `constructor(cwd?: string)`: Initializes the manager for a given working directory.
*   `initialize()`: Checks if the current directory is a Git repo.
*   `createSnapshot(description?: string)`: Creates a ghost snapshot, returning `null` if not in a Git repo or if an error occurs.
*   `restoreSnapshot(snapshotId: string)`: Restores the workspace to a specific ghost snapshot.
*   `undoLastTurn()`: Reverts to the previous ghost snapshot.
*   `redoLastTurn()`: Reapplies a previously undone snapshot.
*   `getTimeline()`: Returns all snapshots and the current navigation state.
*   `listSnapshots()`: Returns all ghost snapshots.

**Usage Example:**

```typescript
import { getGhostSnapshotManager } from './ghost-snapshot.js';

const manager = getGhostSnapshotManager();
await manager.initialize();

if (manager.isGitRepo) {
  // Before an agent performs an action
  await manager.createSnapshot('Agent turn 1: Implemented feature X');

  // ... agent modifies files ...

  // If the user wants to undo the last agent turn
  const undone = await manager.undoLastTurn();
  if (undone) {
    console.log('Undone to:', undone.description);
  }

  // If the user wants to redo
  const redone = await manager.redoLastTurn();
  if (redone) {
    console.log('Redone to:', redone.description);
  }
} else {
  console.log('Not in a Git repository, ghost snapshots are disabled.');
}
```

**Integration:**
The `GhostSnapshotManager` is primarily used for features inspired by OpenAI Codex CLI, as indicated by `codex-inspired-features.test.ts`.

### 4. Checkpoint Versioning (`CheckpointVersioning`)

The `CheckpointVersioning` system provides a more advanced, Git-like version control layer on top of the basic `Checkpoint` concept. It allows for named versions, branches, tags, and diffing capabilities.

**Purpose:**
*   Advanced version control for checkpoints, including branching and tagging.
*   Detailed history tracking with metadata.
*   Ability to compare states between versions.

**How it Works:**
*   It maintains an in-memory graph of `Version` objects, where each `Version` wraps a `Checkpoint` and includes additional metadata (parent ID, branch name, author, tags).
*   `createVersion()` generates a content-based hash for the version ID and links it to a parent version, forming a history chain.
*   `createBranch()` and `switchBranch()` manage different lines of development.
*   `createTag()` allows assigning human-readable names to specific versions.
*   `diff()` compares the file contents between two versions, providing `added`, `modified`, `deleted` lists and detailed `DiffHunk`s for modified files.
*   `checkout()` restores the workspace to a specific version, similar to Git checkout, with rollback capabilities on failure.
*   State (versions, branches, tags) is persisted to disk in `.codebuddy/versions/versions.json` using `fs-extra` for cross-session availability. `save()` and `load()` handle this.
*   `prune()` cleans up old versions based on a `maxVersionsPerBranch` limit.

**Key API:**

*   `constructor(config?: VersioningConfig)`: Initializes the manager with configuration for storage, max versions, and default branch.
*   `createVersion(checkpoint: Checkpoint, options?: { name?: string; description?: string; metadata?: Partial<VersionMetadata> }): Version`: Creates a new version from an existing `Checkpoint`.
*   `createTag(versionId: string, tagName: string)`: Tags a specific version.
*   `createBranch(name: string, fromVersionId?: string, description?: string): Branch`: Creates a new branch, optionally from an existing version.
*   `switchBranch(name: string): Branch`: Changes the active branch.
*   `checkout(versionId: string)`: Restores the workspace to the state of a specific version.
*   `diff(fromVersionId: string, toVersionId: string): VersionDiff`: Computes the difference between two versions.
*   `findCommonAncestor(versionId1: string, versionId2: string): Version | undefined`: Finds the nearest common ancestor of two versions.
*   `save()`: Persists the versioning state to disk.
*   `load()`: Loads the versioning state from disk.
*   `getVersionHistory()`: Retrieves the history of versions for the current or specified branch.

**Usage Example:**

```typescript
import { getCheckpointVersioning } from './checkpoint-versioning.js';
import { CheckpointManager, getCheckpointManager } from './checkpoint-manager.js';

const versioning = getCheckpointVersioning();
const checkpointManager = getCheckpointManager(); // CheckpointVersioning uses Checkpoint objects

await versioning.load(); // Load previous state

// Create a base checkpoint
const initialCp = checkpointManager.createCheckpoint('Initial project setup');
const v1 = versioning.createVersion(initialCp, { name: 'v1.0', description: 'First stable version' });
versioning.createTag(v1.id, 'release-1.0');

// Create a new branch for a feature
versioning.createBranch('feature/new-ui', v1.id);
versioning.switchBranch('feature/new-ui');

// ... make changes, create more checkpoints ...
const featureCp = checkpointManager.createCheckpoint('Added new UI component');
const v2 = versioning.createVersion(featureCp, { description: 'New UI component added' });

// Diff between versions
const diffResult = versioning.diff(v1.id, v2.id);
console.log('Diff:', diffResult);

// Checkout a previous version
await versioning.checkout(v1.id);

await versioning.save(); // Save current state
```

**Integration:**
The `CheckpointVersioning` module is tested by `checkpoint-versioning.test.ts`, indicating its role in providing advanced version control features.

## Module Architecture Overview

The `src/checkpoints` module is designed with distinct responsibilities for each manager. While `CheckpointVersioning` wraps `Checkpoint` objects, the managers generally operate independently, each providing a specialized form of state management.

```mermaid
graph TD
    subgraph Checkpoints Module
        A[CheckpointManager] -->|Manages in-memory| B(Checkpoint[])
        A -->|Uses| C(fs, path)
        A -->|Emits events| D(EventEmitter)

        E[PersistentCheckpointManager] -->|Manages on disk| F(Checkpoint files in ~/.codebuddy/history)
        E -->|Uses| C
        E -->|Uses| G(crypto for project hashing)
        E -->|Emits events| D

        H[GhostSnapshotManager] -->|Manages via Git| I(Git refs/codebuddy/ghost)
        H -->|Uses| J(child_process.execFile for 'git' commands)
        H -->|Emits events| D

        K[CheckpointVersioning] -->|Manages version graph| L(Version Map)
        K -->|Wraps| B
        K -->|Uses| M(fs-extra, crypto)
        K -->|Persists to| N(.codebuddy/versions/versions.json)
        K -->|Emits events| D
    end

    style B fill:#f9f,stroke:#333,stroke-width:2px
    style F fill:#f9f,stroke:#333,stroke-width:2px
    style I fill:#f9f,stroke:#333,stroke-width:2px
    style L fill:#f9f,stroke:#333,stroke-width:2px
```

## Singleton Access

Each checkpoint manager provides a singleton instance via a `get...Manager()` function (e.g., `getCheckpointManager()`, `getPersistentCheckpointManager()`). This ensures that only one instance of each manager exists throughout the application's lifecycle, maintaining a consistent state. A corresponding `reset...Manager()` function is available for testing or explicit cleanup.

## When to Use Which Manager

*   **`CheckpointManager`**: For simple, temporary undo/redo within a single session. Ideal for capturing states before minor, reversible operations.
*   **`PersistentCheckpointManager`**: For robust, project-specific undo/restore that needs to survive application restarts. Useful for user-initiated "save points" or major operational rollbacks.
*   **`GhostSnapshotManager`**: For automatic, frequent, and non-intrusive snapshots, especially in agent-driven workflows where an undo/redo of "turns" is desired without affecting the main Git history.
*   **`CheckpointVersioning`**: For advanced version control needs, including branching, tagging, and detailed diffing, where a more structured history and comparison capabilities are required. This is suitable for more complex development scenarios or internal tooling that needs a full versioning system.