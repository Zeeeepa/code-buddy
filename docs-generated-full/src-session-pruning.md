---
title: "src — session-pruning"
module: "src-session-pruning"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.713Z"
---
# src — session-pruning

The `session-pruning` module provides a robust and configurable system for automatically managing the lifecycle of "prunable items" such as messages, memories, and other session-related data. Its primary goal is to prevent unbounded growth of session data, ensuring efficient resource usage and adherence to defined retention policies.

This module allows developers to define rules based on various conditions (e.g., age, count, size, token usage, type) and specify actions to take when these conditions are met (e.g., delete, archive, summarize, compact).

## Core Concepts

At the heart of the session pruning module are several key interfaces and classes that define how pruning is configured and executed.

### PrunableItem

The `PrunableItem` interface represents any piece of data that can be subject to pruning. It includes essential metadata required for evaluation:

```typescript
interface PrunableItem {
  id: string;
  sessionId: string;
  type: 'message' | 'memory' | 'checkpoint' | 'file';
  createdAt: Date;
  accessedAt?: Date;
  sizeBytes: number;
  tokens?: number;
  metadata?: Record<string, unknown>;
  content?: string; // For summarization/compaction
}
```
When integrating with this module, your data structures must conform to `PrunableItem` to be managed by the `PruningManager`.

### Pruning Rules

Pruning logic is encapsulated in `PruningRule` objects. Each rule consists of:
*   **`id`**: A unique identifier for the rule.
*   **`name`**: A human-readable name.
*   **`priority`**: Rules are evaluated in descending order of priority. The first rule an item matches determines the action.
*   **`enabled`**: Whether the rule is active.
*   **`conditions`**: An array of `PruningCondition`s. *All* conditions in a rule must be met for the rule to apply to an item.
*   **`action`**: A `PruningAction` to perform if all conditions are met.

### Pruning Conditions

`PruningCondition`s define the criteria for an item to be considered for pruning. The module supports several built-in condition types:

*   **`age`**: `AgePruningCondition` - Prunes items older than `maxAgeMs`.
*   **`count`**: `CountPruningCondition` - Prunes items if the session or global item count exceeds `maxCount`.
*   **`size`**: `SizePruningCondition` - Prunes items larger than `maxBytes`.
*   **`tokens`**: `TokenPruningCondition` - Prunes items with more than `maxTokens`.
*   **`type`**: `TypePruningCondition` - Prunes items based on their `type` property (e.g., 'message', 'memory'). Can be configured to `include` or `exclude` specified types.
*   **`custom`**: `CustomPruningCondition` - Allows defining custom evaluation logic via a registered `ConditionEvaluator`.

### Pruning Actions

`PruningAction`s specify what happens to an item once a rule's conditions are met:

*   **`delete`**: `DeletePruningAction` - Permanently removes the item from the manager.
*   **`archive`**: `ArchivePruningAction` - Removes the item from active management and moves it to an internal `archivedItems` collection. This is useful for soft-deletes or moving to secondary storage.
*   **`summarize`**: `SummarizePruningAction` - Reduces the `content` and `tokens` of an item, simulating summarization. *Note: The current implementation provides a basic truncation; a real summarization service would be integrated here.*
*   **`compact`**: `CompactPruningAction` - Reduces the `content`, `sizeBytes`, and `tokens` of an item by a specified `ratio`.

### Pruning Configuration

The `PruningConfig` interface defines the global settings for the `PruningManager`:

```typescript
interface PruningConfig {
  enabled: boolean;
  rules: PruningRule[];
  checkIntervalMs: number; // How often to check if pruning is needed
  minPruneIntervalMs: number; // Minimum time between actual pruning runs
  dryRun: boolean; // If true, items are identified but not modified
  sessionConfigs?: Record<string, SessionPruningConfig>; // Session-specific overrides
}
```
The `DEFAULT_PRUNING_CONFIG` provides sensible defaults, including rules for age, count, and token limits.

`SessionPruningConfig` allows overriding global rules or exempting specific sessions from pruning.

## The PruningManager

The `PruningManager` class is the central orchestrator of the session pruning module. It extends `EventEmitter` to provide real-time feedback on pruning operations.

### Manager Lifecycle

1.  **Instantiation**: A `PruningManager` instance is created, optionally with an initial `PruningConfig`.
    ```typescript
    const manager = new PruningManager({ dryRun: true });
    ```
2.  **Configuration**: Rules, session-specific settings, and custom evaluators can be added or modified dynamically using methods like `addRule()`, `setSessionConfig()`, and `registerEvaluator()`.
3.  **Item Management**: `PrunableItem`s are added to the manager using `addItem()`. The manager maintains an internal collection of these items.
4.  **Automatic Pruning**: Call `manager.start()` to begin periodic checks and pruning based on `checkIntervalMs`.
5.  **Manual Pruning**: Call `manager.prune()` to trigger an immediate pruning run.
6.  **Stopping**: Call `manager.stop()` to halt automatic pruning.

### Configuration Management

The `PruningManager` provides methods to manage its configuration:

*   `getConfig()`: Retrieves the current configuration.
*   `updateConfig(config: Partial<PruningConfig>)`: Merges new settings into the existing configuration. If `checkIntervalMs` changes, the automatic pruning interval is restarted.
*   `addRule(rule: PruningRule)`: Adds or updates a pruning rule. Rules are automatically sorted by `priority`.
*   `removeRule(ruleId: string)`: Removes a rule by its ID.
*   `setRuleEnabled(ruleId: string, enabled: boolean)`: Enables or disables a specific rule.
*   `setSessionConfig(sessionId: string, config: Partial<SessionPruningConfig>)`: Applies specific pruning settings for a given session, including exemption.
*   `removeSessionConfig(sessionId: string)`: Clears session-specific settings.
*   `registerEvaluator(name: string, evaluator: ConditionEvaluator)`: Registers a custom function for `custom` pruning conditions.

### Item Management

The manager acts as a simple in-memory store for `PrunableItem`s:

*   `addItem(item: PrunableItem)`: Adds an item to be managed.
*   `removeItem(id: string)`: Removes an item by its ID.
*   `getItem(id: string)`: Retrieves an item.
*   `getAllItems()`: Returns all currently managed items.
*   `getSessionItems(sessionId: string)`: Returns items belonging to a specific session.
*   `getArchivedItems()`: Returns items that have been moved to the archive.
*   `clearItems()`: Removes all managed items.

### Pruning Operations

The core pruning logic resides in `checkAndPrune()` and `prune()`.

#### `checkAndPrune()`

This method is called periodically when the manager is `start()`ed. It first checks:
1.  If pruning is `enabled` in the configuration.
2.  If `minPruneIntervalMs` has passed since the last prune.
3.  If any global thresholds (total items, tokens, or size) defined in the rules are exceeded via `shouldPrune()`.

If all checks pass, it triggers an actual `prune()` operation.

#### `prune()`

This is the main entry point for executing a pruning run. It performs the following steps:

```mermaid
graph TD
    A[PruningManager.prune()] --> B{Get Items & Build Context};
    B --> C[buildEvaluationContext()];
    B --> D[findCandidates(items, context)];
    D --> E{For each candidate};
    E -- Session Exempt? --> F[Skip Item];
    E -- Not Exempt --> G[executeAction(candidate)];
    G --> H[Add to prunedItems];
    F --> I[Add to skippedItems];
    H --> E;
    I --> E;
    E -- All candidates processed --> J[calculateStats()];
    J --> K[Emit 'complete' event];
    K --> L[Return PruningResult];
```

1.  **Initialization**: Sets up tracking for `prunedItems`, `skippedItems`, and `errors`. Emits a `start` event.
2.  **Item Selection**: Gathers all `PrunableItem`s, optionally filtering by `sessionId` if specified.
3.  **Context Building**: Calls `buildEvaluationContext()` to prepare `SessionStats` and `GlobalStats` for efficient condition evaluation.
4.  **Candidate Identification**: `findCandidates()` iterates through items and rules. For each item, it checks if *all* conditions of any enabled rule are met using `evaluateConditions()`. The first matching rule determines the candidate. Candidates are sorted by rule priority.
5.  **Action Execution**: For each `PruningCandidate`:
    *   It checks if the item's session is `exempt` (unless `force` pruning is enabled).
    *   If not exempt, `executeAction()` is called to perform the specified `PruningAction` (delete, archive, summarize, compact).
    *   `item-pruned` or `item-skipped` events are emitted.
6.  **Statistics & Completion**: After processing all candidates, `calculateStats()` compiles a `PruningStats` summary. A `complete` event is emitted with the `PruningResult`.

### Condition Evaluation

The `conditionEvaluators` map holds functions that implement the logic for each `PruningCondition` type. When `evaluateConditions()` is called, it retrieves the appropriate evaluator based on `condition.type` and executes it.

Developers can extend this by registering custom evaluators using `registerEvaluator()`. This allows for highly specific pruning logic without modifying the core module.

```typescript
manager.registerEvaluator('myCustomCondition', (item, condition, context) => {
  if (condition.type !== 'custom' || condition.fn !== 'myCustomCondition') return false;
  // Example: Prune if item metadata has a specific flag
  return item.metadata?.['doNotKeep'] === true;
});

// Then, define a rule:
manager.addRule({
  id: 'custom-flag-prune',
  name: 'Prune items with custom flag',
  priority: 50,
  enabled: true,
  conditions: [{ type: 'custom', fn: 'myCustomCondition' }],
  action: { type: 'delete' },
});
```

### Statistics

The `getStats()` method provides a snapshot of the current configuration, global statistics (`GlobalStats`), and per-session statistics (`SessionStats`). This is useful for monitoring the state of managed items and understanding pruning triggers.

## Singleton Access

The module provides singleton access to the `PruningManager` for convenience:

*   `getPruningManager(config?: Partial<PruningConfig>)`: Returns the singleton instance, creating it if it doesn't exist. Subsequent calls return the same instance.
*   `resetPruningManager()`: Stops the current manager instance and clears the singleton, allowing a new instance to be created on the next `getPruningManager()` call. This is primarily useful for testing or re-initialization.

## Events

The `PruningManager` extends `EventEmitter` and emits several events during its operation, allowing external components to react to pruning activities:

*   **`start`**: Emitted when a pruning operation begins.
    *   Payload: `PruningConfig`
*   **`progress`**: Emitted periodically during a pruning run, indicating progress.
    *   Payload: `PruningProgress` (`current`, `total`, `percent`, `currentItem`)
*   **`item-pruned`**: Emitted when an item is successfully pruned.
    *   Payload: `PrunedItem` (the item, action taken, reason, saved bytes/tokens)
*   **`item-skipped`**: Emitted when an item is skipped from pruning (e.g., due to session exemption).
    *   Payload: `SkippedItem` (the item, reason)
*   **`error`**: Emitted when an error occurs during pruning.
    *   Payload: `PruningError` (item, rule, error message, recoverability)
*   **`complete`**: Emitted when a pruning operation finishes (successfully or with errors).
    *   Payload: `PruningResult` (summary of the operation)

## Integration Points

To integrate the `session-pruning` module:

1.  **Initialize**: Get the `PruningManager` instance using `getPruningManager()`.
2.  **Configure**: Define your `PruningRule`s and `PruningConfig`. Add rules using `manager.addRule()`.
3.  **Add Items**: Whenever a new `PrunableItem` (e.g., a new message, memory entry) is created, add it to the manager using `manager.addItem()`.
4.  **Start Automatic Pruning**: Call `manager.start()` to enable continuous monitoring and pruning.
5.  **Listen to Events**: Subscribe to relevant events (e.g., `item-pruned`, `error`, `complete`) to handle pruned items, log issues, or update UI.

```typescript
import { getPruningManager, PruningManager, PrunableItem } from './session-pruning/index.js';

const manager: PruningManager = getPruningManager({
  enabled: true,
  checkIntervalMs: 30 * 1000, // Check every 30 seconds
  rules: [
    {
      id: 'my-app-rule',
      name: 'Delete old messages',
      priority: 100,
      enabled: true,
      conditions: [{ type: 'age', maxAgeMs: 7 * 24 * 60 * 60 * 1000 }], // 7 days
      action: { type: 'delete' },
    },
  ],
});

manager.on('item-pruned', (prunedItem) => {
  console.log(`Item ${prunedItem.item.id} was ${prunedItem.action} because: ${prunedItem.reason}`);
  // Here you might update your database or UI
});

manager.on('error', (error) => {
  console.error('Pruning error:', error.error, error.item?.id);
});

manager.on('complete', (result) => {
  console.log(`Pruning run completed. Pruned: ${result.stats.prunedCount}, Skipped: ${result.stats.skippedCount}`);
});

// Start automatic pruning
manager.start();

// Example: Add an item
const message: PrunableItem = {
  id: 'msg-123',
  sessionId: 'session-abc',
  type: 'message',
  createdAt: new Date(),
  sizeBytes: 100,
  tokens: 20,
  content: 'Hello, this is a message.',
};
manager.addItem(message);

// You can also trigger a manual prune
// manager.prune({ force: true });
```