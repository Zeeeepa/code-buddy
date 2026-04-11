---
title: "tests — observer"
module: "tests-observer"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.937Z"
---
# tests — observer

This document provides an overview of the `tests/observer` module, which is responsible for verifying the correctness and reliability of the agent's observation and event triggering mechanisms. It covers the test suites for two core components: `EventTriggerManager` and `ScreenObserver`.

## Module Purpose

The `tests/observer` module ensures that the agent's ability to monitor its environment (e.g., screen changes, file system events) and react to predefined conditions (triggers) functions as expected. It validates the logic for managing triggers, evaluating events against conditions, handling cooldowns, and accurately detecting changes in observed data.

## Event Trigger Management Tests (`event-trigger.test.ts`)

This test suite focuses on the `EventTriggerManager` class, which is central to the agent's reactive capabilities. The `EventTriggerManager` is responsible for storing, managing, and evaluating a collection of `Trigger` objects against incoming `TriggerEvent`s.

### Purpose of `EventTriggerManager`

The `EventTriggerManager` provides a robust system for defining automated responses to various events. Developers can configure `Trigger` objects with specific conditions (e.g., file path patterns, webhook types) and actions. When a `TriggerEvent` occurs, the manager evaluates it against all active triggers, firing those whose conditions are met and respecting rules like cooldown periods.

### Test Suite Overview

The `event-trigger.test.ts` suite uses `describe('EventTriggerManager', ...)` to group tests for this class. A new `EventTriggerManager` instance is created `beforeEach` test, ensuring isolation.

#### Key Functionality Tested:

1.  **Trigger Lifecycle Management**:
    *   `addTrigger()`: Verifies that triggers can be successfully added to the manager.
    *   `listTriggers()`: Ensures all added triggers can be retrieved, and supports filtering by `type`.
    *   `removeTrigger()`: Confirms triggers can be removed by ID, and handles attempts to remove non-existent triggers gracefully.
    *   `setEnabled()`: Tests the ability to enable or disable triggers dynamically.

2.  **Event Evaluation Logic (`evaluate()`):**
    *   **Condition Matching**: Tests `file_change` events against glob patterns (e.g., `src/**/*.ts`) and `webhook` events against wildcard conditions (`*`).
    *   **Disabled Triggers**: Ensures that `evaluate()` correctly ignores triggers marked as `enabled: false`.
    *   **Cooldown Mechanism**: Validates that `cooldownMs` prevents triggers from firing repeatedly within a specified period.
    *   **Fire Count**: Confirms that the `fireCount` property of a trigger is incremented each time it successfully fires.

#### Test Data Generation

The `makeTrigger` helper function is used to create consistent `Trigger` objects for tests, allowing specific properties to be overridden for different test scenarios.

```typescript
const makeTrigger = (overrides: Partial<Trigger> = {}): Trigger => ({
  id: 'test-1',
  name: 'Test Trigger',
  type: 'file_change',
  condition: 'src/**/*.ts',
  action: { type: 'notify', target: 'cli' },
  cooldownMs: 0,
  enabled: true,
  createdAt: new Date(),
  fireCount: 0,
  ...overrides,
});
```

This pattern ensures that tests are readable and focused on the specific aspect being tested, rather than boilerplate trigger setup.

## Screen Observation Tests (`screen-observer.test.ts`)

This test suite validates the `ScreenObserver` class, which is responsible for periodically capturing visual data, detecting changes, and maintaining a history of observations.

### Purpose of `ScreenObserver`

The `ScreenObserver` enables the agent to monitor visual changes in its environment. It periodically captures a "screen" (which can be a screenshot, a specific UI element's state, or any visual data), computes a hash of the captured data, and compares it to previous observations. This allows the agent to detect when the visual state has changed, which can then be used to trigger further actions or analysis.

### Test Suite Overview

The `screen-observer.test.ts` suite uses `describe('ScreenObserver', ...)` to group tests. An `observer` instance is initialized `beforeEach` test with a short `intervalMs` and `maxHistory` for efficient testing. The `observer.stop()` method is called `afterEach` test to clean up any running intervals.

#### Key Functionality Tested:

1.  **Lifecycle Management**:
    *   `start()` and `stop()`: Verifies the observer can be started and stopped, and its `isRunning()` state is accurate.
    *   **Idempotency**: Ensures calling `start()` multiple times does not cause issues.

2.  **Observation Cycle (`observe()`):**
    *   **Initial Observation**: Confirms the first `observe()` call returns a `ScreenDiff` indicating no changes (as there's no prior state).
    *   **Change Detection**: Validates that subsequent `observe()` calls correctly detect changes (by default, using random UUIDs as hashes, ensuring differences).
    *   **Custom Capture Method**: Tests the ability to inject a custom `captureMethod` function, allowing the observer to work with various data sources beyond actual screen captures.

3.  **History Management**:
    *   `getHistory()`: Checks that observations are added to the history.
    *   `maxHistory`: Verifies that the history size is capped according to the configured `maxHistory` value.

4.  **Event Handling**:
    *   `on('change', ...)`: Confirms that the `ScreenObserver` emits a `'change'` event when a difference is detected between observations.

5.  **Configuration Retrieval**:
    *   `getConfig()`: Ensures the observer returns its current configuration parameters.

This module's tests are crucial for ensuring the agent's ability to perceive and react to its environment reliably.