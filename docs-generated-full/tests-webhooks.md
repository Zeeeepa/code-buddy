---
title: "tests — webhooks"
module: "tests-webhooks"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.062Z"
---
# tests — webhooks

This document describes the `tests/webhooks/webhook-manager.test.ts` module, which provides comprehensive unit tests for the `WebhookManager` class located in `src/webhooks/webhook-manager.js`.

## Module Purpose

The primary purpose of this module is to ensure the `WebhookManager` class functions correctly and robustly. It validates all core functionalities, including webhook registration, retrieval, modification, removal, payload processing, signature verification, and data persistence.

By running these tests, developers can be confident that changes to `WebhookManager` or its dependencies do not introduce regressions and that the webhook system behaves as expected under various conditions.

## Testing Environment and Setup

The tests utilize a temporary directory for each test run to ensure isolation and prevent side effects between tests.

*   **Temporary Directory Creation**: Before each test (`beforeEach`), a unique temporary directory is created using `mkdtempSync(join(tmpdir(), 'webhook-test-'))`. This directory serves as the storage location for webhook data managed by the `WebhookManager` instance.
*   **WebhookManager Instantiation**: A new `WebhookManager` instance (`mgr`) is created for each test, initialized with the path to the temporary directory. This ensures a clean state for every test.
*   **Cleanup**: After each test (`afterEach`), the temporary directory and all its contents are recursively removed using `rmSync(tempDir, { recursive: true, force: true })`. This prevents accumulation of test data and ensures a clean environment for subsequent test runs.

## Test Coverage

The test suite covers the following key aspects of the `WebhookManager` functionality:

### 1. Webhook Management Lifecycle

These tests validate the basic CRUD operations for webhooks.

*   **Registration**:
    *   `should register a webhook with an ID`: Verifies that `mgr.register(name, agentMessage, secret?)` successfully creates a webhook, assigns a unique ID, and stores the provided details.
*   **Listing**:
    *   `should list all webhooks`: Confirms that `mgr.list()` returns all currently registered webhooks.
*   **Retrieval**:
    *   `should get webhook by ID`: Ensures `mgr.get(id)` retrieves the correct webhook object.
    *   `should return undefined for unknown ID`: Verifies `mgr.get()` returns `undefined` for non-existent IDs.
*   **Removal**:
    *   `should remove a webhook`: Tests `mgr.remove(id)` successfully deletes a webhook and returns `true`.
    *   `should return false when removing unknown webhook`: Checks `mgr.remove()` returns `false` for non-existent IDs.
*   **Enabling/Disabling**:
    *   `should toggle enabled flag`: Validates `mgr.setEnabled(id, enabled)` correctly updates the `enabled` status of a webhook and returns `true`.
    *   `should return false when setting enabled on unknown webhook`: Checks `mgr.setEnabled()` returns `false` for non-existent IDs.

### 2. Payload Processing and Templating

These tests focus on how `WebhookManager` processes incoming payloads and resolves agent messages.

*   **Template Resolution**:
    *   `should resolve template placeholders in processPayload`: Verifies that `mgr.processPayload(id, payload, signature?)` correctly substitutes `{{body.<path>}}` placeholders in the `agentMessage` with values from the provided `payload`.
    *   `should resolve nested template placeholders`: Tests template resolution for deeply nested properties within the payload.
    *   `should leave unresolved placeholders as-is`: Ensures that placeholders for which no corresponding data exists in the payload are left unchanged in the resulting message.

*   **Error Handling during Processing**:
    *   `should return error for unknown webhook ID`: Confirms `processPayload` returns an error object if the webhook ID is not found.
    *   `should return error for disabled webhook`: Verifies `processPayload` returns an error object if the target webhook is disabled.

### 3. Signature Verification

These tests validate the security mechanism for webhooks using HMAC signatures.

*   **Missing Signature**:
    *   `should reject missing signature when secret is set`: Ensures `processPayload` returns an error if a webhook has a secret configured but no signature is provided.
*   **Invalid Signature**:
    *   `should reject invalid signature`: Confirms `processPayload` returns an error if a signature is provided but does not match the expected HMAC hash.
*   **Valid Signature**:
    *   `should accept valid HMAC signature`: Verifies that `processPayload` successfully processes a payload when a correct HMAC-SHA256 signature is provided, generated using `createHmac('sha256', secret).update(payload).digest('hex')`.

### 4. Persistence

This test ensures that webhook data is correctly persisted to disk and can be reloaded.

*   `should persist and reload webhooks`: This critical test registers a webhook, then creates a *new* `WebhookManager` instance pointing to the *same* temporary directory. It then asserts that the newly instantiated manager can successfully retrieve the previously registered webhook, including its secret. This confirms that webhook data is saved and loaded correctly across `WebhookManager` instances.

## Dependencies

This test module directly imports and uses:

*   `WebhookManager` from `../../src/webhooks/webhook-manager.js`: The class under test.
*   `createHmac` from `crypto`: Used to generate valid HMAC signatures for testing the signature verification logic.
*   `mkdtempSync`, `rmSync` from `fs`: For creating and deleting temporary directories.
*   `join` from `path`: For constructing file paths within the temporary directory.
*   `tmpdir` from `os`: For getting the system's temporary directory path.

The tests rely on the Jest testing framework's global functions like `describe`, `beforeEach`, `afterEach`, `it`, and `expect`.