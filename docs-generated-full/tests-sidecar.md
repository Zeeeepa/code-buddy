---
title: "tests — sidecar"
module: "tests-sidecar"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.013Z"
---
# tests — sidecar

This document describes the `tests/sidecar/sidecar-bridge.test.ts` module, which is responsible for thoroughly testing the `SidecarBridge` class and its associated functions.

## Sidecar Bridge Tests

The `sidecar-bridge.test.ts` module contains the unit and integration tests for the `SidecarBridge` class, located in `src/sidecar/sidecar-bridge.ts`. The `SidecarBridge` is a critical component that facilitates communication between the TypeScript application and the Rust-based `codebuddy-sidecar` binary. This communication occurs via JSON-RPC over the standard input/output (stdin/stdout) streams of a spawned child process.

The tests ensure that the `SidecarBridge` correctly handles process lifecycle, JSON-RPC messaging, error conditions, and provides a robust interface for interacting with the sidecar's capabilities (e.g., Speech-to-Text, desktop automation).

### Module Under Test: `SidecarBridge`

The `SidecarBridge` class is designed as a singleton to manage a single instance of the `codebuddy-sidecar` process. Its primary responsibilities include:
*   Detecting the sidecar binary's availability.
*   Spawning and managing the sidecar child process.
*   Sending JSON-RPC requests to the sidecar via `stdin`.
*   Parsing JSON-RPC responses and notifications from the sidecar via `stdout`.
*   Handling timeouts and errors during communication.
*   Providing high-level convenience methods for specific sidecar functionalities.
*   Gracefully stopping the sidecar process.

### Testing Philosophy & Mocking Strategy

The majority of the tests for `SidecarBridge` are unit tests that heavily rely on mocking to isolate the `SidecarBridge` logic from the actual `child_process` execution and file system interactions. This allows for predictable testing of various scenarios, including process startup, communication, and error handling, without needing to compile or run the actual Rust binary for every test.

#### `createMockProcess`

A custom factory function, `createMockProcess`, is central to the mocking strategy. It generates an object that mimics a Node.js `ChildProcess` instance. This mock process:
*   Is an `EventEmitter`, allowing tests to simulate `exit` events.
*   Exposes `stdin`, `stdout`, and `stderr` as `PassThrough` streams. This is crucial for simulating data flow:
    *   Tests can listen to `currentMockProcess.stdin` to verify what the `SidecarBridge` writes to the sidecar.
    *   Tests can `push` data into `currentMockProcess.stdout` to simulate responses coming *from* the sidecar.
*   Includes a `vi.fn()` mock for `kill()`, allowing verification of process termination.

#### `child_process` Mock

The `child_process` module, specifically its `spawn` function, is mocked globally using `vi.mock('child_process', ...)`. This mock ensures that whenever `SidecarBridge` attempts to spawn a child process, it receives the `currentMockProcess` created by `createMockProcess` instead of a real system process.

#### `fs` Mock

The `fs` module's `existsSync` function is mocked to control the perceived availability of the sidecar binary. This allows tests to simulate scenarios where the binary is found or not found, influencing the `isAvailable()` method's behavior.

#### `logger` Mock

The internal `logger` utility is mocked to prevent test output from cluttering the console and to allow verification that appropriate log messages are generated during various operations.

#### Test Lifecycle (`beforeEach`, `afterEach`)

*   **`beforeEach`**: Before each test, mocks are cleared (`vi.clearAllMocks()`), a fresh `currentMockProcess` is created, and the `SidecarBridge` module is dynamically imported. Crucially, `resetSidecarBridge()` is called to ensure a clean, new singleton instance for each test, preventing state leakage between tests.
*   **`afterEach`**: `resetSidecarBridge()` is called again to clean up the singleton instance after each test.

### Key Test Suites

The tests are organized into `describe` blocks, each focusing on a specific aspect of the `SidecarBridge`.

#### `isAvailable`

This suite verifies the `SidecarBridge.isAvailable()` method:
*   It checks that the method correctly detects the sidecar binary (based on the `fs.existsSync` mock).
*   It confirms that the availability check is cached, meaning subsequent calls to `isAvailable()` do not re-check the file system.

#### `singleton`

This suite tests the singleton pattern implemented by `getSidecarBridge()` and `resetSidecarBridge()`:
*   It asserts that `getSidecarBridge()` consistently returns the same instance.
*   It verifies that `resetSidecarBridge()` successfully clears the existing instance, causing `getSidecarBridge()` to return a new one on the next call.

#### `call` Mechanism

This is a critical suite that tests the core JSON-RPC communication logic. It simulates the full request-response cycle:

```mermaid
graph TD
    A[SidecarBridge Test] -->|1. bridge.start()| B(Mocked child_process.spawn)
    B -->|2. Returns currentMockProcess| A
    A -->|3. bridge.call(method, params)| C{currentMockProcess.stdin}
    C -->|4. Writes JSON-RPC request| D[SidecarBridge Test]
    D -->|5. Simulates Sidecar Response| E{currentMockProcess.stdout}
    E -->|6. Pushes JSON-RPC response| D
    D -->|7. Awaits callPromise| A
```

*   **Sending Requests**: Tests listen to `currentMockProcess.stdin` to verify that `SidecarBridge.call()` writes correctly formatted JSON-RPC requests.
*   **Receiving Responses**: Tests simulate sidecar responses by pushing JSON-RPC strings into `currentMockProcess.stdout`.
*   **Success Handling**: Verifies that `call()` resolves with the `result` data from a successful JSON-RPC response.
*   **Error Handling**: Tests that `call()` rejects with an error message when the sidecar returns a JSON-RPC error.
*   **Timeout Handling**: Simulates a scenario where the sidecar does not respond within a specified timeout, ensuring `call()` rejects with a timeout error.

#### `convenience methods`

This suite simply verifies the existence of the high-level API methods on the `SidecarBridge` instance, such as `loadModel`, `transcribe`, `sttStatus` (for STT), `paste`, `typeText`, `keyPress`, `clipboardGet`, `clipboardSet` (for desktop automation), and `version`. This ensures the public interface is as expected.

#### `stop`

This suite tests the `SidecarBridge.stop()` method:
*   It verifies that `stop()` calls `currentMockProcess.kill()`, ensuring the sidecar process is terminated.
*   It confirms that calling `stop()` on an already stopped or unstarted bridge is safe and does not throw errors.

#### `process exit handling`

This suite tests how `SidecarBridge` reacts to an unexpected exit of the sidecar process:
*   It simulates the `currentMockProcess` emitting an `exit` event while a `call()` is pending.
*   It asserts that any pending `call()` promises are rejected with an informative error message, indicating the sidecar process exited.

### Real Binary Integration Test

A separate `describe` block, `SidecarBridge real binary integration`, provides a crucial integration test. Unlike the mocked unit tests, this suite attempts to:
*   **Detect a real sidecar binary**: It checks for the `codebuddy-sidecar` executable in the `src-sidecar/target/release` or `src-sidecar/target/debug` directories.
*   **Skip if not available**: If no binary is found, the test is skipped, preventing failures in environments where the Rust sidecar hasn't been built.
*   **Spawn actual process**: If a binary exists, it uses `vi.importActual('child_process').spawn` to launch the *real* sidecar process.
*   **Communicate**: It sends a `version` JSON-RPC request to the actual sidecar and expects a valid response, verifying end-to-end communication with the compiled Rust binary.
*   **Cleanup**: It ensures the spawned process is killed and streams are closed after the test.

This integration test provides confidence that the `SidecarBridge` can successfully interact with a live sidecar, bridging the gap between the mocked unit tests and real-world deployment.

### Contribution & Further Development

When contributing to the `SidecarBridge` or adding new sidecar functionalities:
*   **Add Unit Tests**: For any new methods or logic within `SidecarBridge`, ensure comprehensive unit tests are added to `sidecar-bridge.test.ts`. Leverage the existing mocking infrastructure to cover success, error, and edge cases.
*   **Update Convenience Methods**: If new JSON-RPC methods are exposed by the Rust sidecar, add corresponding convenience methods to `SidecarBridge` and verify their existence in the `convenience methods` test suite.
*   **Consider Integration Tests**: For complex new features, consider adding a dedicated integration test similar to the "real binary integration" suite to validate end-to-end functionality with the actual Rust binary.
*   **Maintain Mock Consistency**: Ensure that any changes to how `SidecarBridge` interacts with `child_process` or `fs` are reflected in the mock implementations to keep the unit tests accurate.