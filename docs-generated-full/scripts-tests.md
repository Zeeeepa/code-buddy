---
title: "scripts — tests"
module: "scripts-tests"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.343Z"
---
# scripts — tests

The `scripts/tests` module houses the **Real-Conditions Test Suite** for Code Buddy. This comprehensive suite is designed to validate the core functionality of the application by exercising real module imports and, where applicable, making live API calls. Unlike traditional unit tests that might rely heavily on mocks, this suite aims to test the integration and behavior of various subsystems under conditions closer to a production environment.

## Purpose

The primary goal of this test suite is to ensure the stability and correctness of Code Buddy's internal logic and external integrations. It achieves this by:

*   **Real Module Imports**: Directly importing and using modules from `src/` without extensive mocking, ensuring that components interact as they would in the live application.
*   **Broad Subsystem Coverage**: Spanning over 40 distinct subsystems, from context management and security to channels, tools, and API providers.
*   **API Validation**: Performing actual HTTP calls to the Gemini 2.5 Flash API for tests that involve LLM interactions, verifying the end-to-end flow with a real provider.
*   **Robustness Testing**: Incorporating retry mechanisms and timeouts to handle transient issues, especially with external API calls.

This suite is crucial for catching integration bugs and regressions that might be missed by isolated unit tests.

## How to Run

To execute the entire test suite, follow these steps:

1.  **Set your Google API Key**: Many tests interact with the Gemini API.
    ```bash
    export GOOGLE_API_KEY="AIza..."
    ```
2.  **Execute the runner script**:
    ```bash
    npx tsx scripts/run-all-tests.ts
    ```

Test reports are automatically saved to `.custom-output/gemini-extended-test-{timestamp}.json`.

## Architecture and Execution Flow

The test suite is structured around a set of TypeScript files (`cat-*.ts`) that define categories and individual tests. The `scripts/run-all-tests.ts` script acts as the orchestrator, importing these category files and executing their defined tests.

### Key Components (`scripts/tests/types.ts`)

The `types.ts` file defines the fundamental structures and helper functions for the test harness:

*   **`TestDef`**: An interface defining a single test case.
    ```typescript
    interface TestDef {
      name: string; // Unique name for the test (e.g., "91.1-instantiation")
      fn: () => Promise<{ pass: boolean; metadata?: Record<string, unknown>; tokenUsage?: TokenUsage }>; // The test logic
      timeout?: number; // Optional timeout in milliseconds
      retries?: number; // Optional number of retries for flaky tests
      mandatory?: boolean; // If true, failure aborts the entire suite
    }
    ```
*   **`CategoryDef`**: An interface defining a group of related tests.
    ```typescript
    interface CategoryDef {
      name: string; // Name of the category (e.g., "Cat 91: Lessons Tracker")
      tests: TestDef[]; // Array of TestDef objects
      abortOnFirst?: boolean; // If true, category execution stops on first test failure
    }
    ```
*   **`runWithRetry(fn, label, maxRetries=2, delays=[1500,3000])`**: A utility function that executes an asynchronous function, retrying on failure with exponential backoff. This is critical for API-dependent tests.
*   **`runTest(test, category)`**: Wraps a single `TestDef`'s `fn` with timeout and retry logic.
*   **`runCategory(name, tests, abortOnFirst?)`**: Executes all tests within a `CategoryDef` sequentially, introducing an 800ms delay between tests to prevent rate limiting or resource contention.

### Execution Flow

The `run-all-tests.ts` script dynamically imports all `cat-*.ts` files. For each file, it iterates through the exported `CategoryDef` arrays, calling `runCategory` for each. `runCategory` then calls `runTest` for every `TestDef` within that category. The `TestDef.fn` is where the actual application code from `src/` is imported and exercised.

```mermaid
graph TD
    A[scripts/run-all-tests.ts] --> B{Import cat-*.ts files};
    B --> C{For each CategoryDef};
    C --> D[runCategory(category.name, category.tests)];
    D --> E{For each TestDef in category.tests};
    E --> F[runTest(testDef, category)];
    F --> G[runWithRetry(testDef.fn)];
    G --> H{testDef.fn()};
    H --> I[Imports src/module.js];
    I --> J[Executes src/module.js logic];
```

For API-dependent tests (e.g., `cat-api-advanced.ts`, `cat-api-gemini-extended.ts`), the `run-all-tests.ts` script also calls `initApiAdvanced` and `initApiGeminiExtended` to inject the `GeminiProvider` instance and the `GOOGLE_API_KEY` into the test files, allowing them to make authenticated API calls.

## Test Structure and Organization

Tests are organized into categories, each focusing on a specific module or subsystem. The naming convention `cat-NN-Description.ts` (e.g., `cat-agent-advanced.ts`) clearly indicates the content.

Each `cat-*.ts` file exports one or more functions (e.g., `cat91LessonsTracker()`, `cat92TodoTracker()`) that return an array of `TestDef` objects. The tests within these arrays are numbered sequentially (e.g., `91.1`, `91.2`), making it easy to reference specific test cases.

### Example: `cat-agent-advanced.ts`

This file covers several agent-related functionalities:

*   **Cat 91: Lessons Tracker**: Validates the `LessonsTracker` module (`src/agent/lessons-tracker.js`), which manages learned patterns, rules, and insights. Tests cover instantiation, adding/removing lessons, listing, searching, retrieving statistics, and exporting data.
    *   **`91.1-instantiation`**: Checks if `LessonsTracker` can be instantiated.
    *   **`91.2-add-lesson`**: Verifies that lessons can be added and their properties are correctly stored.
    *   **`91.7-export-formats`**: Ensures lessons can be exported in various formats (JSON, Markdown, CSV).
*   **Cat 92: Todo Tracker**: Focuses on the `TodoTracker` module (`src/agent/todo-tracker.js`), which helps agents manage tasks. Tests include adding, completing, removing, and listing todo items, as well as checking for pending tasks and clearing completed ones.
*   **Cat 93: Conversation Branching**: Tests the `ConversationBranchManager` (`src/advanced/conversation-branching.js`), which enables branching and merging conversation histories. This includes singleton access, creating/switching/deleting/renaming branches, and adding messages.
*   **Cat 94: Selective Rollback**: Validates the `SelectiveRollbackManager` (`src/advanced/selective-rollback.js`), a system for saving and restoring file versions. Tests cover saving versions, retrieving them, comparing versions, and getting statistics.
*   **Cat 95: Three-Way Diff**: Examines the `ThreeWayDiff` utility (`src/advanced/three-way-diff.js`), which is crucial for merging changes and detecting conflicts. Tests include scenarios with no conflicts, ours-only changes, conflict detection, conflict resolution, and formatting conflict markers.

Many tests in `cat-agent-advanced.ts` (and other files) demonstrate common patterns like:
*   **Singleton Pattern Validation**: Checking `getInstance()` and `resetInstance()` methods (e.g., `93.1-singleton-access`).
*   **Temporary File System Usage**: Creating and cleaning up temporary directories (`os.tmpdir()`, `fs.mkdirSync`, `fs.rmSync`) to ensure tests are isolated and don't leave artifacts (e.g., `91.1-instantiation`).

## Coverage and Scope

The test suite provides extensive coverage across Code Buddy's architecture. The `TESTS.md` file includes a detailed "Summary by Subsystem" table, which is the best reference for understanding the breadth of coverage.

Key areas covered include:

*   **Context & Memory**: `ContextManagerV2`, `HybridMemorySearch`, `ObservationVariator`, `RestorableCompression`, `Head-Tail Truncation`, `Stable JSON`, `ContextManagerV3`, `Auto Memory Manager`, `Memory Flush`.
*   **Security**: `Security Modes`, `Dangerous Patterns`, `Skill Scanner`, `Tool Policy Groups`, `Auto-Sandbox Router`.
*   **Configuration**: `TOML Config`, `Advanced Config`, `Config Backup Rotation`, `File Suggestion Provider`, `Tool Aliases`.
*   **Tools & Workflows**: `Tool Registry`, `Tool Metadata`, `Lobster Engine`, `Plan Tool`, `Codebase Explorer`.
*   **Channels & Messaging**: `Message Preprocessing`, `Channel Core Types`, `DM Pairing Manager`, `Reconnection Manager`, `Offline Queue`, `Plugin Manifest Manager`.
*   **Agent Capabilities**: `Prompt Suggestions`, `Background Tasks`, `Lessons Tracker`, `Todo Tracker`, `Conversation Branching`, `Selective Rollback`, `Three-Way Diff`.
*   **API Providers**: Extensive testing of `GeminiProvider` for structured output, streaming, multi-turn conversations, and edge cases.
*   **Utilities**: `Token Counter`, `Retry Utility`, `LRU Cache`, `Fuzzy Match`, `Rate Limiter`, `History Manager`, `Response Cache`, `Diff Generator`, `Sanitize Utilities`, `Glob Matcher`, `Base URL`.

The suite includes approximately 560 non-API tests (unit/integration) and 26 API tests, with a few mixed tests. This balance ensures both internal logic and external integrations are thoroughly vetted.

## Integration with the Codebase

The `scripts/tests` module is tightly integrated with the main `src/` codebase. Test functions directly import and instantiate classes or call functions from `src/` modules. For example, `cat91LessonsTracker` imports `LessonsTracker` from `../../src/agent/lessons-tracker.js`. This direct import strategy ensures that the tests are validating the actual production code, not just mocked interfaces.

The `GOOGLE_API_KEY` is passed to the `GeminiProvider` and `CodeBuddyClient` instances, which are then used by the API tests. This setup allows the tests to perform real network requests to the LLM, providing confidence in the API integration layer.

Developers contributing to Code Buddy should refer to this test suite to understand how different modules are expected to behave and to add new tests for any new features or bug fixes. Adhering to the existing `TestDef` and `CategoryDef` patterns will ensure consistency and maintainability of the test suite.