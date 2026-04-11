---
title: "tests — elevated-mode"
module: "tests-elevated-mode"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.885Z"
---
# tests — elevated-mode

This document provides an overview of the test suite for the `elevated-mode` module, located at `tests/elevated-mode/elevated.test.ts`. Its primary purpose is to ensure the robustness, correctness, and expected behavior of the `ElevatedModeManager` class and its associated utility functions.

## 1. Introduction

The `elevated-mode` module (`src/elevated-mode/index.js`) is responsible for managing application-level permissions, user elevation levels, and handling requests for sensitive operations. It provides a structured way to define permissions, request user consent, and enforce access control based on current elevation levels and granted permissions.

The `elevated.test.ts` file serves as the comprehensive test suite for this critical module. It covers various aspects of permission management, session handling, and configuration, ensuring that changes to the core `elevated-mode` logic maintain expected functionality.

## 2. Test Suite Structure

The test suite is organized into three main `describe` blocks, reflecting the logical components of the `elevated-mode` module:

1.  **Permission Utilities**: Tests individual helper functions related to permission comparison, pattern matching, and key generation.
2.  **`ElevatedModeManager`**: The most extensive section, covering the core `ElevatedModeManager` class's lifecycle, permission checking, request handling, level management, grant management, session management, and configuration.
3.  **Singleton**: Verifies the singleton pattern implementation for `ElevatedModeManager` via `getElevatedMode()` and `resetElevatedMode()`.

Each test block uses `beforeEach` and `afterEach` hooks to ensure a clean and isolated state for every test, typically by calling `resetElevatedMode()` and `manager.resetSession()`.

## 3. Detailed Test Coverage

### 3.1. Permission Utilities Tests

This section focuses on the standalone utility functions exported by the `elevated-mode` module.

*   **`compareLevels(levelA, levelB)`**:
    *   Verifies the correct ordinal comparison of `PermissionLevel` values (e.g., 'user', 'elevated', 'admin', 'system').
    *   Ensures `0` for equality, `<0` if `levelA` is lower, and `>0` if `levelA` is higher.
*   **`meetsLevel(currentLevel, requiredLevel)`**:
    *   Checks if a `currentLevel` satisfies a `requiredLevel`.
    *   For example, an 'elevated' user meets a 'user' requirement, but not vice-versa.
*   **`matchesPattern(resource, pattern)`**:
    *   Tests resource string matching against patterns.
    *   Covers exact string matches.
    *   Validates wildcard (`*`) behavior for matching zero or more characters.
    *   Validates single-character wildcard (`?`) behavior.
*   **`permissionKey(permission)`**:
    *   Ensures a consistent string key is generated for a given `Permission` object.
    *   Handles cases where `resource` is provided and where it's missing (defaulting to `*`).

### 3.2. `ElevatedModeManager` Tests

This is the core of the test suite, validating the `ElevatedModeManager` class. An instance of `ElevatedModeManager` is created with default configuration (`defaultLevel: 'user'`, `autoGrantSafe: true`, `requestTimeoutMs: 1000`) for most tests.

#### 3.2.1. Permission Checking

*   **`manager.hasPermission(permission)`**:
    *   Tests basic permission checks based on the current session level.
    *   Verifies that permissions requiring a higher level than the current session level are denied.
    *   Confirms that explicitly granted permissions are recognized.
*   **`manager.isSafePermission(permission)`**:
    *   Identifies permissions configured as "safe" (e.g., read operations) which might be auto-granted.
*   **`manager.isDangerousPermission(permission)`**:
    *   Identifies permissions configured as "dangerous" (e.g., system modifications) which typically require explicit user consent.

#### 3.2.2. Permission Requests

*   **`manager.requestPermission(category, options)`**:
    *   **Auto-granting**: Verifies that safe permissions are automatically granted when `autoGrantSafe` is enabled.
    *   **Manual Granting**: Tests the flow for elevated permissions:
        1.  A request is made.
        2.  The request appears in `getRequestHistory()`.
        3.  `manager.grantRequest(requestId, type)` is called to approve it.
        4.  The `requestPermission` promise resolves with the grant.
    *   **Timeouts**: Ensures that pending requests expire and resolve to `null` if not granted within `requestTimeoutMs`.
    *   **Denial**: Tests `manager.denyRequest(requestId, reason)` to explicitly reject a request, causing the `requestPermission` promise to resolve to `null`.
    *   **Event Emission**: Verifies that `permission-request` and `permission-deny` events are emitted at appropriate times.

#### 3.2.3. Level Management

*   **`manager.getLevel()`**: Retrieves the current session's `PermissionLevel`.
*   **`manager.elevate(newLevel, durationMs?)`**:
    *   Tests successful elevation to a higher level.
    *   Ensures elevation to a *lower* level is prevented.
    *   Verifies `level-change` events are emitted.
    *   **Timed Elevation**: Tests elevation with a specified duration, confirming `isElevated()` and `getElevationTimeRemaining()` work as expected.
    *   **Expiration**: Ensures timed elevations automatically revert to the default level after their duration.
*   **`manager.dropElevation()`**: Resets the session's level back to the default.
*   **`manager.isElevated()`**: Checks if the current level is higher than the default level.

#### 3.2.4. Grant Management

*   **`manager.getGrants()`**: Lists all currently active permission grants.
*   **`manager.revokeGrant(grantId)`**: Revokes a specific grant by its ID.
*   **`manager.revokeCategory(category)`**: Revokes all grants belonging to a specific category.
*   **`manager.clearGrants()`**: Revokes all active grants in the session.
*   **Event Emission**: Verifies that `grant-expire` events are emitted when grants are revoked or expire.

#### 3.2.5. Session Management

*   **`manager.getSession()`**: Retrieves an object containing current session details (ID, level, grant count, pending request count).
*   **`manager.getRequestHistory()`**: Provides a list of all permission requests made during the session, including their status.
*   **`manager.resetSession()`**:
    *   Resets the entire session state, including current level, grants, and request history.
    *   Verifies that `session-expire` events are emitted.

#### 3.2.6. Configuration

*   **`manager.getConfig()`**: Retrieves the current configuration of the `ElevatedModeManager`.
*   **`manager.updateConfig(newConfig)`**: Allows dynamic modification of manager configuration options.

#### 3.2.7. Grant Limits

*   **`maxGrantsPerSession`**: Tests that the `ElevatedModeManager` respects the configured `maxGrantsPerSession` limit, preventing an excessive number of grants from accumulating.

### 3.3. Singleton Tests

This section specifically tests the singleton pattern implementation for the `ElevatedModeManager`.

*   **`getElevatedMode()`**:
    *   Verifies that multiple calls to `getElevatedMode()` return the exact same instance of `ElevatedModeManager`.
*   **`resetElevatedMode()`**:
    *   Confirms that calling `resetElevatedMode()` effectively clears the singleton instance, causing subsequent calls to `getElevatedMode()` to return a *new* instance.

## 4. How to Run These Tests

To execute this test suite, navigate to the project root and run your standard test command, typically:

```bash
npm test
# or
yarn test
# or, to run only this file with Jest:
npx jest tests/elevated-mode/elevated.test.ts
```

## 5. Contributing to Tests

When contributing to the `elevated-mode` module:

*   **New Features**: Always add new test cases to `elevated.test.ts` (or a new, related test file if the feature warrants it) to cover the functionality of your new code.
*   **Bug Fixes**: Add a regression test that specifically fails before your fix and passes after it.
*   **Modifications**: Update existing tests if the expected behavior of a function changes.
*   **Clarity**: Ensure test descriptions (`it('should do X')`) are clear and concise, explaining the specific behavior being tested.
*   **Isolation**: Leverage `beforeEach` and `afterEach` to ensure tests are independent and do not affect each other's state.