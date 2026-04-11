---
title: "src — elevated-mode"
module: "src-elevated-mode"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.478Z"
---
# src — elevated-mode

This document provides a comprehensive overview of the `src/elevated-mode` module, designed for developers who need to understand, use, or contribute to its functionality.

---

## Elevated Mode Module Documentation

The `elevated-mode` module provides a robust system for managing permissions and privileged operations within the application. It introduces a hierarchical permission model, allowing different parts of the system to request specific capabilities, which can then be granted or denied based on the current session's security context and user interaction.

### Purpose

The primary goals of this module are:

*   **Granular Permission Control**: Define and enforce permissions for sensitive operations (e.g., file system access, process management, network operations).
*   **Session-based Elevation**: Allow temporary elevation of privileges for a user session, with automatic expiration.
*   **User Confirmation**: Provide a mechanism for requiring explicit user confirmation for dangerous or ungranted operations.
*   **Auditing**: Maintain a history of permission requests for transparency and debugging.
*   **Configuration**: Allow flexible configuration of default behaviors, timeouts, and permission categories.

### Core Concepts

The module revolves around several key concepts:

*   **Permission Levels (`PermissionLevel`)**: A hierarchy of privilege levels: `user` < `elevated` < `admin` < `system`. Operations require a minimum level.
*   **Permission Categories (`PermissionCategory`)**: Specific types of actions, such as `file:read`, `process:spawn`, `system:modify`.
*   **Permissions (`Permission`)**: A combination of a `PermissionCategory`, an optional `resource` (which can be a glob pattern), and a `PermissionLevel`.
*   **Permission Requests (`PermissionRequest`)**: When an operation requires a permission not currently held, a request is generated. These requests can be pending, awaiting a decision.
*   **Permission Grants (`PermissionGrant`)**: An explicit allowance for a specific permission. Grants can be `allow-once`, `allow-session`, `allow-always`, or `deny`. They can also expire.
*   **Elevated Session (`ElevatedSession`)**: Represents the current security context, including the active `PermissionLevel`, active `PermissionGrant`s, and a history of requests.

### Architecture Overview

The `elevated-mode` module is centered around the `ElevatedModeManager` class, which is typically accessed as a singleton instance via `getElevatedMode()`. This manager maintains the current `ElevatedSession`, processes permission requests, manages grants, and handles privilege elevation/de-elevation.

```mermaid
graph TD
    A[Application Component] --> B{getElevatedMode()};
    B --> C[ElevatedModeManager Singleton];
    C -- Emits Events --> D[Event Listeners];

    subgraph Permission Request Flow
        C --> E[requestPermission(category, options)];
        E --> F{hasPermission() or auto-grant?};
        F -- Yes --> G[Return existing/new Grant];
        F -- No --> H[Create PermissionRequest];
        H --> I[Emit 'permission-request'];
        I --> J[Store pending request];
        J --> K[Return Promise<PermissionGrant | null>];
        L[User/System UI] --> M[grantRequest(requestId) / denyRequest(requestId)];
        M --> J;
        M --> N[Resolve Promise];
    end

    subgraph Level Management
        C --> O[elevate(level, durationMs)];
        O --> P[Set session.level, expiresAt];
        P --> Q[Start expiration timer];
        Q --> R[dropElevation() on timeout];
        C --> S[dropElevation()];
        S --> T[Reset session.level, clear session grants];
    end
```

### Key Components and Functionality

#### Types

The module defines several interfaces and types to structure its data:

*   `PermissionLevel`: `'user' | 'elevated' | 'admin' | 'system'`
*   `PermissionCategory`: A comprehensive list of actions like `'file:read'`, `'process:spawn'`, `'system:modify'`, etc.
*   `Permission`: `{ category: PermissionCategory; resource?: string; level: PermissionLevel; description?: string; }`
*   `PermissionRequest`: Details of a request, including a unique `id`, the `permission` requested, `context` (source, reason), `timestamp`, and `timeoutMs`.
*   `PermissionGrant`: Details of a granted permission, including `id`, `requestId`, `permission`, `type` (`'allow-once'`, `'allow-session'`, `'allow-always'`, `'deny'`), `expiresAt`, `grantedAt`, and `grantedBy`.
*   `ElevatedSession`: The current state of the elevated mode, including `id`, `level`, `elevatedAt`, `expiresAt`, `grants` (a `Map` of active grants), and `requestHistory`.
*   `ElevatedModeConfig`: Configuration options for the manager, such as `defaultLevel`, `elevationTimeoutMs`, `autoGrantSafe`, `requestTimeoutMs`, `requireConfirmation`, `safeCategories`, `dangerousCategories`, and `maxGrantsPerSession`.
*   `ElevatedModeEvents`: Defines the events emitted by the `ElevatedModeManager`, allowing external components to react to permission requests, grants, denials, level changes, and session/grant expirations.

#### Permission Utilities

A set of helper functions for working with permissions:

*   `compareLevels(a: PermissionLevel, b: PermissionLevel): number`: Compares two permission levels based on `LEVEL_HIERARCHY`. Returns a negative number if `a` is lower than `b`, 0 if equal, and a positive number if `a` is higher.
*   `meetsLevel(current: PermissionLevel, required: PermissionLevel): boolean`: Checks if the `current` level is sufficient for the `required` level.
*   `matchesPattern(resource: string, pattern: string): boolean`: Performs simple glob matching (using `*` and `?`) for resource strings.
*   `permissionKey(permission: Permission): string`: Generates a canonical string key for a `Permission` (e.g., `file:read:/path/to/file` or `file:write:*`). This is used for storing and retrieving grants efficiently.

#### `ElevatedModeManager` Class

This is the central class for managing elevated mode. It extends `EventEmitter` to provide a publish-subscribe mechanism for important events.

**Constructor and Initialization:**

*   `constructor(config: Partial<ElevatedModeConfig> = {})`: Initializes the manager with default or provided configuration and creates an initial `ElevatedSession`.
*   `private createSession(): ElevatedSession`: Internal method to generate a new, clean `ElevatedSession`.

**Permission Checking:**

*   `hasPermission(permission: Permission): boolean`: The core method to determine if a given `permission` is currently active. It checks:
    1.  If the `session.level` meets the `permission.level`.
    2.  If an exact `PermissionGrant` exists and is not expired.
    3.  If any existing `PermissionGrant` with a resource pattern matches the requested resource.
*   `isSafePermission(permission: Permission): boolean`: Checks if the permission's category is listed in `config.safeCategories`. Safe permissions can often be auto-granted.
*   `isDangerousPermission(permission: Permission): boolean`: Checks if the permission's category is listed in `config.dangerousCategories`. Dangerous permissions typically require higher levels or explicit user confirmation.

**Permission Requests:**

*   `async requestPermission(category, options)`: Initiates a request for a permission.
    *   If the permission is already held (by level or grant), it returns the existing grant or an implicit session grant.
    *   If `config.autoGrantSafe` is true and the permission is safe, it auto-grants an `allow-session` grant.
    *   Otherwise, it creates a `PermissionRequest`, adds it to `session.requestHistory`, emits a `'permission-request'` event, and returns a `Promise` that resolves when the request is granted or denied (or times out).
*   `grantRequest(requestId, type?, grantedBy?)`: Resolves a pending `PermissionRequest` by granting it. Clears the request's timeout and resolves the associated promise.
*   `denyRequest(requestId, reason?)`: Resolves a pending `PermissionRequest` by denying it. Clears the request's timeout, emits a `'permission-deny'` event, and resolves the associated promise with `null`.
*   `private createGrant(...)`: Internal method to construct and store a `PermissionGrant`. It handles grant expiration, `allow-session` grants, and enforces `maxGrantsPerSession` by removing the oldest grant if the limit is reached.
*   `private getRequiredLevel(category: PermissionCategory): PermissionLevel`: Determines the default `PermissionLevel` required for a given category based on `safeCategories` and `dangerousCategories` configuration.

**Level Management:**

*   `getLevel(): PermissionLevel`: Returns the current `PermissionLevel` of the session, automatically dropping elevation if it has expired.
*   `elevate(level: PermissionLevel, durationMs?: number): boolean`: Attempts to raise the session's `PermissionLevel`. If successful, it sets `session.elevatedAt` and `session.expiresAt`, and starts a timer to automatically call `dropElevation()` when the duration expires. Emits a `'level-change'` event.
*   `dropElevation(): void`: Resets the session's `PermissionLevel` to `config.defaultLevel`, clears elevation timers, and revokes all `allow-session` grants. Emits a `'level-change'` event if the level actually changed.
*   `isElevated(): boolean`: Returns `true` if the current `PermissionLevel` is higher than `'user'`.
*   `getElevationTimeRemaining(): number`: Returns the milliseconds remaining until the current elevation expires, or `0` if not elevated or expired.

**Grant Management:**

*   `getGrants(): PermissionGrant[]`: Returns an array of all active `PermissionGrant`s in the current session.
*   `revokeGrant(grantId: string): boolean`: Removes a specific grant by its ID. Emits a `'grant-expire'` event.
*   `revokeCategory(category: PermissionCategory): number`: Removes all grants associated with a specific `PermissionCategory`. Emits `'grant-expire'` for each revoked grant.
*   `clearGrants(): void`: Removes all active grants from the session. Emits `'grant-expire'` for each.

**Session Management:**

*   `getSession()`: Returns a summary object of the current `ElevatedSession` state, including level, elevation times, and counts of grants, requests, and pending requests.
*   `getRequestHistory(): PermissionRequest[]`: Returns a copy of the session's `requestHistory`.
*   `resetSession(): void`: Clears all pending requests, timers, and creates a brand new `ElevatedSession`. Emits a `'session-expire'` event for the old session.

**Configuration:**

*   `getConfig(): ElevatedModeConfig`: Returns a copy of the current configuration.
*   `updateConfig(config: Partial<ElevatedModeConfig>): void`: Merges partial configuration updates into the current configuration.

#### Singleton Access

The module provides singleton access to the `ElevatedModeManager` to ensure a single, consistent security context across the application.

*   `getElevatedMode(config?: Partial<ElevatedModeConfig>): ElevatedModeManager`: Returns the singleton instance of `ElevatedModeManager`. If called for the first time, it initializes the manager with the provided (or default) configuration.
*   `resetElevatedMode(): void`: Resets the singleton instance, effectively creating a new, clean security context for the application. This is primarily useful for testing or when a complete security state reset is required (e.g., after a user logs out).

### Integration and Usage

#### Obtaining the Manager

Most interactions will start by getting the singleton instance:

```typescript
import { getElevatedMode } from './elevated-mode';

const elevatedMode = getElevatedMode();
```

#### Requesting Permissions

To perform an operation that requires a specific permission:

```typescript
import { getElevatedMode, PermissionCategory } from './elevated-mode';

async function readFileWithPermission(filePath: string) {
  const elevatedMode = getElevatedMode();
  const permission = { category: 'file:read' as PermissionCategory, resource: filePath, level: 'user' };

  if (elevatedMode.hasPermission(permission)) {
    console.log(`Permission to read ${filePath} already granted.`);
    // Proceed with file read
    return;
  }

  console.log(`Requesting permission to read ${filePath}...`);
  const grant = await elevatedMode.requestPermission(
    'file:read',
    {
      resource: filePath,
      source: 'FileViewer',
      reason: 'User opened file for viewing',
    }
  );

  if (grant) {
    console.log(`Permission granted: ${grant.type}`);
    // Proceed with file read
  } else {
    console.log('Permission denied or timed out.');
    // Handle denial
  }
}
```

#### Handling Permission Requests (UI/System Integration)

External components (e.g., a UI dialog, a system daemon) will listen for `'permission-request'` events and then call `grantRequest` or `denyRequest`.

```typescript
import { getElevatedMode } from './elevated-mode';

const elevatedMode = getElevatedMode();

elevatedMode.on('permission-request', (request) => {
  console.log(`New permission request: ${request.permission.category} on ${request.permission.resource || '*'}`);
  console.log(`Reason: ${request.context.reason}`);

  // In a real application, this would trigger a UI prompt
  // For demonstration, auto-grant after a delay
  setTimeout(() => {
    if (confirm(`Grant permission for ${request.permission.category}?`)) {
      elevatedMode.grantRequest(request.id, 'allow-session', 'user-confirmed');
      console.log('Request granted by user.');
    } else {
      elevatedMode.denyRequest(request.id, 'User denied');
      console.log('Request denied by user.');
    }
  }, 1000);
});
```

#### Elevating Privileges

To temporarily elevate the session's level:

```typescript
import { getElevatedMode } from './elevated-mode';

const elevatedMode = getElevatedMode();

// Listen for level changes
elevatedMode.on('level-change', (from, to) => {
  console.log(`Permission level changed from ${from} to ${to}`);
});

// Elevate to 'admin' for 5 minutes
elevatedMode.elevate('admin', 5 * 60 * 1000);

// Check current level
console.log(`Current level: ${elevatedMode.getLevel()}`);

// Drop elevation manually
// elevatedMode.dropElevation();
```

#### Configuration

The module can be configured at initialization or updated dynamically:

```typescript
import { getElevatedMode } from './elevated-mode';

// Initialize with custom config
const elevatedMode = getElevatedMode({
  elevationTimeoutMs: 10 * 60 * 1000, // 10 minutes
  autoGrantSafe: false, // Require confirmation even for safe ops
  dangerousCategories: ['system:shutdown'], // Only this is dangerous
});

// Update config later
elevatedMode.updateConfig({
  maxGrantsPerSession: 50,
});
```

### Connections to the Codebase

*   **`commands/handlers/security-handlers.ts` (`handleElevated`)**: This is a primary consumer of the `elevated-mode` module. It likely implements commands or UI interactions related to security, such as:
    *   Displaying the current elevation status (`getSession`, `getLevel`, `getElevationTimeRemaining`).
    *   Initiating elevation (`elevate`).
    *   Dropping elevation (`dropElevation`).
    *   Listing and revoking grants (`getGrants`, `revokeGrant`).
    This handler acts as the bridge between user commands/UI and the `ElevatedModeManager`.
*   **`tests/elevated-mode/elevated.test.ts`**: This comprehensive test suite exercises nearly all public methods of the `ElevatedModeManager`, ensuring its correctness and adherence to the defined permission model. It's a good reference for understanding expected behavior.
*   **`src/api/webhooks.ts`**: The call graph indicates `matchesPattern` calls `test` from `src/api/webhooks.ts`. This is an error in the provided call graph. `matchesPattern` uses `RegExp.prototype.test`, which is a standard JavaScript method, not an external module.

### Development Notes

*   **Resource Globbing**: The `matchesPattern` function provides basic glob matching. For more complex scenarios, consider integrating a more robust glob library if needed.
*   **Security Context Persistence**: The current implementation of `ElevatedModeManager` is in-memory and session-based. If persistence across application restarts or user sessions is required, the `ElevatedSession` state (grants, level, history) would need to be serialized and deserialized.
*   **User Interface**: This module provides the backend logic for permission management. A separate UI layer is responsible for presenting permission requests to the user and collecting their decisions.
*   **Event-Driven**: Leverage the `EventEmitter` capabilities to integrate with other parts of the application. For example, a logging module could listen to `'permission-grant'` and `'permission-deny'` events to record security actions.