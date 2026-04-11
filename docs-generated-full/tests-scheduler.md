---
title: "tests — scheduler"
module: "tests-scheduler"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.994Z"
---
# tests — scheduler

This document provides an overview of the `tests/scheduler/cron-session.test.ts` module, which is a test suite designed to validate the session binding capabilities of `CronJob` definitions within the scheduler.

## `tests/scheduler/cron-session.test.ts`

### Purpose

This test module verifies the correct implementation and behavior of **Cron Session Binding**, a feature introduced for Native Engine v2026.3.13 alignment. Its primary goal is to ensure that `CronJob` definitions can correctly specify and resolve execution sessions, which is crucial for distributed task execution, session affinity, and managing task lifecycles across different runtime environments.

Specifically, these tests confirm:
1.  The `CronJob` type correctly includes new fields for session management.
2.  The logic for resolving `sessionTarget` values (`'current'`, `'new'`, or a specific ID) behaves as expected.

### Context: Cron Session Binding

In a distributed system, `CronJob`s often need to execute within a specific "session" or context. This could mean:
*   **Affinity**: Running on the same instance or within the same logical group as a previous execution or related service (`'current'`).
*   **Isolation**: Always starting a fresh, new execution environment (`'new'`).
*   **Targeting**: Executing on a pre-defined, specific session ID.

The `sessionTarget` field on a `CronJob` allows developers to declare this intent, while `resolvedSessionId` stores the concrete session ID after resolution by the scheduler.

### Key Concepts Tested

The tests focus on the `CronJob` type definition and the expected resolution logic for its session-related fields:

#### 1. `CronJob` Type Extension

The module first verifies that the `CronJob` type (or an equivalent job-like object) correctly includes the new fields:
*   `sessionTarget`: A string literal type that can be `'current'`, `'new'`, or a specific session ID string. This field declares the desired session behavior.
*   `resolvedSessionId`: A string that holds the concrete session ID after the scheduler's resolution logic has been applied. This field is typically populated internally.

**Test Case**: `should add sessionTarget field to CronJob type`
This test creates a mock `CronJob` object with `sessionTarget: 'current'` and `resolvedSessionId: 'session-123'` and asserts their presence and values. This primarily serves as a compile-time check to ensure the type definition is correct.

#### 2. `sessionTarget: 'current'` Resolution

When `sessionTarget` is set to `'current'`, the scheduler is expected to resolve this to an existing session ID. This typically involves looking for an existing session key associated with the job's delivery context.

**Test Case**: `should resolve "current" to a concrete session ID`
This test simulates the resolution logic: if `sessionTarget` is `'current'`, `resolvedSessionId` should be populated from `job.delivery?.sessionKey` if available, or a newly generated session ID otherwise. The test asserts that `resolvedSessionId` correctly picks up an existing `sessionKey`.

#### 3. `sessionTarget: 'new'` Behavior

If `sessionTarget` is set to `'new'`, it signifies that the job should always initiate a new session. Therefore, the `resolvedSessionId` should *not* be populated by the scheduler's resolution logic; it should remain undefined, indicating that a new session needs to be provisioned at runtime.

**Test Case**: `should keep "new" as-is without resolving session ID`
This test confirms that when `sessionTarget` is `'new'`, the `resolvedSessionId` remains `undefined` after the simulated resolution logic, as the logic for `'current'` should not apply.

#### 4. Specific Session ID as `sessionTarget`

When `sessionTarget` is a specific string (e.g., `'session-specific-789'`), it means the job explicitly targets that particular session. In this scenario, `resolvedSessionId` is expected to simply mirror the `sessionTarget` value.

**Test Case**: `should allow specific session ID as sessionTarget`
This test verifies that if `sessionTarget` is a concrete ID, `resolvedSessionId` is also set to that same ID.

### Test Structure and Execution

The tests are written using `vitest` and are organized within a `describe` block named `'Cron Session Binding'`. Each specific behavior is covered by an `it` block.

*   **Mocking**: The `../../src/utils/logger.js` module is mocked to prevent actual logging during test execution, ensuring tests are isolated and output is clean.
*   **Execution**: These tests can be run as part of the standard test suite using `vitest` or `npm test`.

### Connection to the Codebase

This test module acts as a contract for the scheduler's core logic. While the tests themselves don't implement the session resolution, they define the expected behavior for the components that *will* implement it. Any changes to the `CronJob` type definition or the session resolution logic within the scheduler (e.g., in `src/scheduler/cron-job-processor.ts` or similar modules) must pass these tests to ensure compatibility and correct functionality of the Native Engine v2026.3.13 session binding feature.