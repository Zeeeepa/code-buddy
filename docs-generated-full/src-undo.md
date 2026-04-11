---
title: "src — undo"
module: "src-undo"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.785Z"
---
# src — undo

The `src/undo` module provides a robust checkpointing and undo/redo system for managing file state changes within a working directory. It allows Code Buddy to create snapshots of the file system, revert to previous states, and view differences between checkpoints, ensuring a safety net for potentially destructive operations.

## Overview

The primary goal of this module is to offer a reliable mechanism for tracking and reverting changes made by automated tools or user actions. It acts as a local version control system, independent of Git, specifically for the operations performed by Code Buddy.

**Key Features:**

*   **File State Checkpoints:** Capture the state of specified files at a given moment.
*   **Undo/Redo Operations:** Navigate forward and backward through the history of checkpoints.
*   **Checkpoint Naming & Tagging:** Organize checkpoints with descriptive names and searchable tags.
*   **Diff Viewing:** Generate detailed diffs between any two checkpoints.
*   **Automatic Checkpoints:** Configurable automatic checkpoints, especially before "dangerous" operations (e.g., file deletion, overwrites).
*   **Git Integration:** Records current Git branch and commit hash in checkpoint metadata for context.

## Core Concepts & Data Structures

The module defines several interfaces to structure the checkpoint data:

*   **`Checkpoint`**: Represents a single snapshot of the working directory's state.
    *   `id`: Unique identifier.
    *   `name`, `description`: Human-readable labels.
    *   `timestamp`: When the checkpoint was created.
    *   `files`: An array of `CheckpointFile` objects detailing the state of each tracked file.
    *   `metadata`: Contextual information (`CheckpointMetadata`).
    *   `tags`: String tags for categorization.
    *   `parentId`: Links to the previous checkpoint, forming a linear history.
*   **`CheckpointFile`**: Describes a single file's state within a checkpoint.
    *   `path`, `relativePath`: Absolute and relative paths to the file.
    *   `hash`: SHA256 hash of the file's content.
    *   `size`, `mode`: File size and permissions.
    *   `exists`, `isNew`, `isDeleted`: Flags indicating the file's status relative to the working directory or previous checkpoints.
*   **`CheckpointMetadata`**: Provides operational context for a checkpoint.
    *   `workingDirectory`: The root directory being tracked.
    *   `gitBranch`, `gitCommit`: Git information at the time of checkpoint creation.
    *   `operation`: A string describing the action that led to the checkpoint (e.g., 'auto', 'refactor', 'delete').
    *   `tool`: The tool that initiated the operation.
    *   `automatic`: Boolean indicating if the checkpoint was created automatically.
*   **`FileChange`**: Used for representing differences between two checkpoints.
    *   `path`: Relative path of the changed file.
    *   `type`: `'created'`, `'modified'`, or `'deleted'`.
    *   `oldContent`, `newContent`: Optional content for diffing.
    *   `diff`: A patch-formatted string representing the changes.
*   **`CheckpointConfig`**: Defines the configurable behavior of the `CheckpointManager`.
    *   `enabled`: Master switch for the system.
    *   `maxCheckpoints`: Maximum number of checkpoints to retain.
    *   `autoCheckpoint`, `autoCheckpointInterval`: Settings for periodic automatic checkpoints.
    *   `checkpointOnDangerousOps`: Whether to automatically checkpoint before operations marked as dangerous.
    *   `excludePatterns`: Glob patterns for files/directories to ignore.
    *   `maxFileSize`: Maximum file size to checkpoint (in bytes).
    *   `compressCheckpoints`: (Currently unimplemented, but part of the interface).

## The `CheckpointManager` Class

The `CheckpointManager` class is the central component of this module. It extends `TypedEventEmitter<CheckpointEvents>`, allowing it to emit type-safe events for various lifecycle actions.

### Initialization and Configuration

The `CheckpointManager` is instantiated with a `workingDirectory` and an optional `Partial<CheckpointConfig>`. It merges the provided config with `DEFAULT_CONFIG`.

```typescript
const manager = new CheckpointManager('/path/to/project', {
  maxCheckpoints: 50,
  autoCheckpoint: true,
});
```

Upon construction, the `initialize()` method is called, which:
1.  Ensures the necessary data directories exist (`~/.codebuddy/checkpoints/<hashed_working_dir>/files`).
2.  Loads existing checkpoints from `index.json` within the data directory.
3.  Starts the `autoCheckpointTimer` if `config.autoCheckpoint` is enabled.

### Data Persistence

Checkpoints are stored on the local filesystem:
*   **Index File**: `~/.codebuddy/checkpoints/<hashed_working_dir>/index.json` stores an array of `Checkpoint` objects and the `currentIndex`.
*   **File Contents**: The actual content of files at each checkpoint is stored in `~/.codebuddy/checkpoints/<hashed_working_dir>/files/<checkpoint_id>/<relative_file_path>`.

The `saveIndex()` method is responsible for writing the current state of `this.checkpoints` and `this.currentIndex` to `index.json`. This method is called after any operation that modifies the checkpoint history (creation, deletion, tagging, renaming, restoration).

### Checkpoint Lifecycle

#### Creating Checkpoints

The `createCheckpoint(options)` method is the core function for capturing a snapshot.
1.  It generates a unique ID and timestamp.
2.  It determines which files to checkpoint: either explicitly provided in `options.files` or all tracked files in the `workingDirectory` (via `getTrackedFiles()`).
3.  For each file, `snapshotFile()` is called:
    *   It checks `excludePatterns` and `maxFileSize`.
    *   Reads the file content, calculates its SHA256 hash.
    *   Saves the file content to its specific checkpoint directory (`files/<checkpoint_id>/<relativePath>`).
    *   Determines if the file is new, deleted, or existing.
4.  It fetches Git information (`getGitInfoAsync()`) to enrich the checkpoint metadata.
5.  The new `Checkpoint` object is added to `this.checkpoints`.
6.  Any checkpoints *after* the new `currentIndex` are removed (clearing redo history).
7.  `enforceMaxCheckpoints()` is called to prune older checkpoints if `maxCheckpoints` is exceeded.
8.  The index is saved, and a `checkpoint:created` event is emitted.

#### Managing Checkpoint History (Undo/Redo)

*   **`undo()`**: Moves the `currentIndex` one step backward and calls `restoreCheckpoint()` to revert to the previous state. Emits `undo:noop` if no previous checkpoint exists, or `undo:complete` on success.
*   **`redo()`**: Moves the `currentIndex` one step forward and calls `restoreCheckpoint()` to apply the next state. Emits `redo:noop` if no next checkpoint exists, or `redo:complete` on success.
*   **`canUndo()` / `canRedo()`**: Simple boolean checks to determine if undo/redo operations are possible.

#### Restoring Checkpoints

The `restoreCheckpoint(checkpoint, operation)` method is central to reverting file states.
1.  It first creates a *safety checkpoint* (`"Before ${operation}"`) to allow reverting the restore itself.
2.  It iterates through all files recorded in the `targetCheckpoint`:
    *   If a file was marked as `isDeleted` or `!exists` in the checkpoint, it removes the file from the `workingDirectory`.
    *   Otherwise, it copies the file content from the checkpoint's storage path to the `workingDirectory` and restores its file mode.
3.  Updates `this.currentIndex` to point to the restored checkpoint.
4.  Saves the index.
5.  Emits `undo:complete`, `redo:complete`, or `restore:complete` based on the `operation` parameter.

```mermaid
graph TD
    A[undo() / redo()] --> B{Target Checkpoint Exists?};
    B -- No --> C[Emit :noop event];
    B -- Yes --> D[restoreCheckpoint(target, operation)];
    D --> E[createCheckpoint("Before restore", automatic=true)];
    E --> F{For each file in target Checkpoint};
    F -- File deleted/non-existent --> G[fs.remove(targetPath)];
    F -- File exists --> H[fs.copy(storagePath, targetPath)];
    H --> I[fs.chmod(targetPath, file.mode)];
    I --> J[Add to restoredFiles];
    G --> J;
    J --> F;
    F -- All files processed --> K[Update currentIndex];
    K --> L[saveIndex()];
    L --> M[Emit :complete event];
    M --> N[Return UndoResult];
```

#### Diffing Checkpoints

The `getDiff(fromId, toId)` method calculates the differences between two specified checkpoints.
1.  It retrieves the `fromCheckpoint` and `toCheckpoint` by their IDs.
2.  It compares the files present in both checkpoints:
    *   If a file exists in `toCheckpoint` but not `fromCheckpoint` (or was deleted in `fromCheckpoint`), it's a `'created'` file.
    *   If a file exists in `fromCheckpoint` but not `toCheckpoint` (or was deleted in `toCheckpoint`), it's a `'deleted'` file.
    *   If a file exists in both but has different `hash` values, it's `'modified'`.
3.  For modified files, it uses the `diff_match_patch` library (`this.dmp`) to generate a semantic diff and then converts it to a patch text.
4.  Returns an array of `FileChange` objects.

#### Maintaining Checkpoints

*   **`enforceMaxCheckpoints()`**: Called after `createCheckpoint` to remove the oldest checkpoints if `this.checkpoints.length` exceeds `config.maxCheckpoints`. It also calls `deleteCheckpointFiles()` for the removed checkpoints.
*   **`deleteCheckpoint(id)`**: Removes a specific checkpoint and its associated file contents from disk. Adjusts `currentIndex` if the deleted checkpoint was before or at the current position. Emits `checkpoint:deleted`.
*   **`tagCheckpoint(id, tag)`**: Adds a tag to a checkpoint.
*   **`renameCheckpoint(id, name)`**: Changes the name of a checkpoint.
*   **`getCheckpoints()`, `getCurrentCheckpoint()`, `getCheckpoint(id)`, `searchCheckpoints(query)`**: Provide ways to retrieve and query checkpoint information.

### Automatic Checkpointing

*   **`startAutoCheckpoint()`**: Initiates a `setInterval` timer to periodically call `createCheckpoint()` with `automatic: true`.
*   **`stopAutoCheckpoint()`**: Clears the auto-checkpoint timer.
*   **`shouldAutoCheckpoint(operation)`**: Checks if a given `operation` string matches any of the `DANGEROUS_OPERATIONS` defined in the configuration, indicating if an automatic checkpoint should be triggered.

### Eventing

`CheckpointManager` extends `TypedEventEmitter`, allowing external components to subscribe to its events:

*   `checkpoint:created`: Emitted after a new checkpoint is successfully created.
*   `checkpoint:deleted`: Emitted when a checkpoint is removed.
*   `undo:noop`, `redo:noop`: Emitted when an undo/redo operation is attempted but no history is available.
*   `undo:complete`, `redo:complete`, `restore:complete`: Emitted after a successful undo, redo, or direct restore operation.

## Usage Examples (Conceptual)

```typescript
import { createCheckpointManager } from './undo/checkpoint-manager.js';

async function main() {
  const workingDir = '/tmp/my-project';
  // Ensure working directory exists for demonstration
  await fs.ensureDir(workingDir);
  await fs.writeFile(path.join(workingDir, 'file1.txt'), 'Initial content');

  const manager = createCheckpointManager(workingDir, {
    maxCheckpoints: 5,
    autoCheckpoint: false, // Disable for manual control in example
  });

  // 1. Create an initial checkpoint
  let cp1 = await manager.createCheckpoint({
    name: 'Initial State',
    operation: 'init',
    description: 'First checkpoint after project setup.',
  });
  console.log(`Created checkpoint: ${cp1.name} (${cp1.id})`);

  // 2. Make some changes and create another checkpoint
  await fs.writeFile(path.join(workingDir, 'file1.txt'), 'Modified content');
  await fs.writeFile(path.join(workingDir, 'new_file.txt'), 'Hello world');
  let cp2 = await manager.createCheckpoint({
    name: 'Added new file',
    operation: 'add_feature',
    tags: ['feature', 'v1'],
  });
  console.log(`Created checkpoint: ${cp2.name} (${cp2.id})`);

  // 3. View status
  console.log('\n--- Current Status ---');
  console.log(manager.formatStatus());

  // 4. Undo to the previous state
  console.log('\n--- Performing Undo ---');
  const undoResult = await manager.undo();
  if (undoResult?.success) {
    console.log(`Undo successful. Restored files: ${undoResult.restoredFiles.join(', ')}`);
    console.log('Content of file1.txt after undo:', await fs.readFile(path.join(workingDir, 'file1.txt'), 'utf-8'));
    console.log('new_file.txt exists after undo:', await fs.pathExists(path.join(workingDir, 'new_file.txt')));
  } else {
    console.error('Undo failed:', undoResult?.errors);
  }

  // 5. Redo to the next state
  console.log('\n--- Performing Redo ---');
  const redoResult = await manager.redo();
  if (redoResult?.success) {
    console.log(`Redo successful. Restored files: ${redoResult.restoredFiles.join(', ')}`);
    console.log('Content of file1.txt after redo:', await fs.readFile(path.join(workingDir, 'file1.txt'), 'utf-8'));
    console.log('new_file.txt exists after redo:', await fs.pathExists(path.join(workingDir, 'new_file.txt')));
  } else {
    console.error('Redo failed:', redoResult?.errors);
  }

  // 6. Get diff between checkpoints
  console.log('\n--- Getting Diff between CP1 and CP2 ---');
  const diffs = await manager.getDiff(cp1.id, cp2.id);
  diffs.forEach(change => {
    console.log(`File: ${change.path}, Type: ${change.type}`);
    if (change.diff) {
      console.log('Diff:\n', change.diff);
    }
  });

  // 7. Clean up
  manager.dispose();
  await fs.remove(workingDir);
}

main().catch(console.error);
```

## Integration Points

The `CheckpointManager` is a self-contained module but interacts with several external libraries and is consumed by other parts of the Code Buddy application.

### Dependencies (Outgoing Calls)

*   **`fs-extra`**: Heavily used for all file system operations: `ensureDir`, `pathExists`, `readJSON`, `writeJSON`, `readFile`, `writeFile`, `stat`, `readdir`, `remove`, `copy`, `chmod`. This is critical for managing checkpoint storage and restoring files.
*   **`path`**: Standard Node.js module for path manipulation (`join`, `relative`, `dirname`, `isAbsolute`).
*   **`os`**: Standard Node.js module for getting the home directory (`os.homedir()`).
*   **`crypto`**: Standard Node.js module for generating unique IDs (`randomBytes`, `createHash`) and hashing file contents.
*   **`child_process` (`spawn`)**: Used by `execGitCommand` to run Git commands (e.g., `rev-parse`) to fetch branch and commit information.
*   **`diff-match-patch`**: An external library (`dmp`) used by `getDiff` to compute and format file differences.
*   **`../types/index.js` (`getErrorMessage`)**: Utility function for consistent error message formatting.
*   **`../events/index.js` (`TypedEventEmitter`, `CheckpointEvents`)**: Provides the base class for type-safe event emission.

### Consumers (Incoming Calls)

The `CheckpointManager` is primarily consumed by command handlers, suggesting its integration into Code Buddy's command-line interface or internal operations.

*   **`commands/handlers/missing-handlers.ts`**:
    *   `handleDiffCheckpoints`: Likely uses `createCheckpointManager` and `getDiff` to show differences between checkpoints.
    *   `handleRestoreCheckpoint`: Likely uses `restoreCheckpoint` to revert to a specific checkpoint.
    *   `handleListCheckpoints`: Likely uses `createCheckpointManager` and `getCheckpoints` to display available checkpoints.
*   **`tests/unit/checkpoint-manager.test.ts` & `tests/checkpoint-manager.test.ts`**: Extensive unit and integration tests validate the functionality of `CheckpointManager` methods like `createCheckpointManager`, `createCheckpoint`, `undo`, `redo`, `restoreCheckpoint`, `getDiff`, `getCheckpoints`, `getCurrentCheckpoint`, `getCheckpoint`, `searchCheckpoints`, `tagCheckpoint`, `renameCheckpoint`, `deleteCheckpoint`, `canUndo`, `canRedo`, `shouldAutoCheckpoint`, and `formatStatus`.