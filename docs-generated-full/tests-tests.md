---
title: "tests — tests"
module: "tests-tests"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.040Z"
---
# tests — tests

This document provides an overview of the testing suite for Code Buddy, located in the `tests/` directory. It covers the testing framework, structure, common patterns, and best practices to help developers understand, write, and contribute to the test codebase.

## 1. Introduction

The `tests/` directory houses the comprehensive test suite for Code Buddy. Its primary purpose is to ensure the reliability, correctness, and security of the application's various components, from core utilities and AI agent logic to security features and user interfaces.

## 2. Testing Framework

Code Buddy uses **Jest** as its primary testing framework, with full TypeScript support provided by `ts-jest`. This combination allows for robust, type-safe tests that integrate seamlessly with the project's development environment.

## 3. Running Tests

Tests can be executed using standard `npm` scripts:

*   **Run all tests**:
    ```bash
    npm test
    ```
*   **Run tests in watch mode** (re-runs tests on file changes):
    ```bash
    npm run test:watch
    ```
*   **Run tests with coverage report**:
    ```bash
    npm run test:coverage
    ```
    To view the detailed coverage report in your browser:
    ```bash
    open coverage/lcov-report/index.html
    ```

## 4. Test Structure

The `tests/` directory is organized to mirror the `src/` directory, making it easy to locate tests for specific modules.

```
tests/
├── utils/              # Utility function tests
│   ├── cache.test.ts       # Cache system tests
│   ├── errors.test.ts      # Error handling tests
│   └── model-utils.test.ts # Model utilities tests
├── agent/              # Agent-related tests (e.g., parallel executor, architect mode)
├── security/           # Security feature tests (e.g., approval modes, data redaction)
├── performance/        # Performance benchmarking tests
├── ...                 # Other categories mirroring src/
└── README.md           # This file
```

Test files are named with a `.test.ts` suffix (e.g., `my-module.test.ts` for `src/utils/my-module.ts`).

## 5. Writing Tests

When contributing to Code Buddy, adhere to the following best practices and common patterns.

### 5.1. General Best Practices

1.  **One test file per source file**: Name test files with `.test.ts` suffix, corresponding to the source file (e.g., `src/module.ts` -> `tests/module.test.ts`).
2.  **Descriptive test names**: Use `it('should ...')` format to clearly state the expected behavior.
3.  **Group related tests**: Use `describe()` blocks to logically group tests for a specific function, class, or feature.
4.  **Test edge cases**: Include tests for error conditions, boundary cases, and unexpected inputs.
5.  **Use setup/teardown**: Leverage `beforeEach()` and `afterEach()` for common setup and cleanup tasks, ensuring test isolation.
6.  **Mock external dependencies**: Isolate unit tests from external systems (e.g., file system, network, AI APIs) using Jest's mocking capabilities.

### 5.2. Asynchronous Code

Jest provides excellent support for asynchronous tests using `async/await`:

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBe('success');
});

it('should handle rejections', async () => {
  await expect(failingAsync()).rejects.toThrow('error message');
});
```

### 5.3. Mocking

Mocking is crucial for isolating units of code and controlling external behavior.

*   **Mocking Modules**:
    ```typescript
    jest.mock('../../src/utils/some-module');
    // ... then import the mocked module
    import { someFunction } from '../../src/utils/some-module';
    // (someFunction as jest.Mock).mockReturnValue('mocked value');
    ```
*   **Mocking Functions**:
    ```typescript
    const mockFn = jest.fn();
    mockFn.mockReturnValue('mocked value');
    mockFn.mockResolvedValue('async mocked value'); // For async functions
    // ...
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    ```
*   **Mocking `fs-extra`**: Many modules interact with the file system. `fs-extra` is commonly mocked to prevent actual disk I/O during tests.
    ```typescript
    jest.mock('fs-extra', () => {
      const impl = {
        ensureDir: jest.fn().mockResolvedValue(undefined),
        pathExists: jest.fn().mockResolvedValue(false),
        readJSON: jest.fn().mockResolvedValue({}),
        writeJSON: jest.fn().mockResolvedValue(undefined),
        // ... other fs-extra methods
      };
      return { ...impl, default: impl }; // Handle default export
    });
    ```
*   **Mocking `CodeBuddyClient`**: For tests involving AI interactions, `CodeBuddyClient` is mocked to avoid real API calls and control AI responses.
    ```typescript
    jest.mock('../src/codebuddy/client.js', () => ({
      CodeBuddyClient: jest.fn().mockImplementation(function() { return {
        chat: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mocked AI response' } }],
        }),
      }; }),
    }));
    ```

### 5.4. Testing Singletons

Many core services in Code Buddy are implemented as singletons (e.g., `AdvancedParallelExecutor`, `AnalyticsDashboard`, `BenchmarkSuite`). A common pattern for testing these involves:

1.  Using a `reset` function (e.g., `resetAdvancedParallelExecutor()`) in `beforeEach` to ensure a fresh instance for each test.
2.  Verifying that `get...()` functions return the same instance.
3.  Verifying that `reset...()` indeed creates a new instance.

```typescript
describe('AdvancedParallelExecutor', () => {
  beforeEach(() => {
    resetAdvancedParallelExecutor(); // Ensure fresh state
    executor = new AdvancedParallelExecutor(...);
  });

  it('should return same instance', () => {
    const instance1 = getAdvancedParallelExecutor();
    const instance2 = getAdvancedParallelExecutor();
    expect(instance1).toBe(instance2);
  });

  it('should reset correctly', () => {
    const instance1 = getAdvancedParallelExecutor();
    resetAdvancedParallelExecutor();
    const instance2 = getAdvancedParallelExecutor();
    expect(instance1).not.toBe(instance2);
  });
});
```

### 5.5. Event Testing

Many Code Buddy components emit events. Jest's `jest.fn()` combined with `Promise` can be used to test event emissions:

```typescript
it('should emit parallel:start event', async () => {
  const event = new Promise<void>((resolve, reject) => {
    executor.once('parallel:start', (data) => {
      try {
        expect(data.taskCount).toBeDefined();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });

  const execution = executor.executeParallel([...]);
  await Promise.all([event, execution]); // Wait for both event and execution
});
```

### 5.6. Platform-Specific Tests

Some tests, particularly those involving file paths or shell commands, might behave differently on Windows vs. Unix-like systems. The `itUnix` helper (or similar conditional logic) is used to skip tests on incompatible platforms:

```typescript
const isWin = process.platform === 'win32';
const itUnix = isWin ? it.skip : it;

itUnix('should allow cat on safe files', async () => {
  // ... test logic
});
```

## 6. Key Test Areas and Examples

The test suite covers a wide range of functionalities, demonstrating various testing approaches.

### 6.1. `AdvancedParallelExecutor` (`tests/advanced-parallel-executor.test.ts`)

*   **Purpose**: Verifies the core logic for executing multiple AI agents or tasks in parallel.
*   **Key Tests**:
    *   Constructor configuration and defaults.
    *   `executeParallel` behavior, including priority ordering and batching.
    *   Management of active agents and results.
    *   Cancellation (`cancelAgent`, `cancelAll`).
    *   Result formatting (`formatResults`).
    *   Event emissions (`parallel:start`, `agent:start`, `parallel:complete`, `parallel:warning`).
    *   Singleton instance management (`getAdvancedParallelExecutor`, `resetAdvancedParallelExecutor`).

### 6.2. `AITestRunner` (`tests/ai-integration-tests.test.ts`)

*   **Purpose**: Tests the structure and reporting of AI integration tests, without making actual AI API calls.
*   **Key Tests**:
    *   Initialization with default and custom options.
    *   Factory function (`createAITestRunner`).
    *   Event emissions (`test:start`, `test:complete`, `suite:complete`, `test:skipped`).
    *   Comprehensive result formatting (`AITestRunner.formatResults`), including success/failure, error details, tokens, and cost.
    *   Type definitions for `AITestResult` and `AITestOptions`.

### 6.3. `AnalyticsDashboard` (`tests/analytics-dashboard.test.ts`)

*   **Purpose**: Validates the tracking and reporting of usage, cost, and performance metrics.
*   **Key Tests**:
    *   Session tracking (`startSession`, `endSession`).
    *   Message and tool call tracking (`trackMessage`, `trackToolCall`).
    *   Retrieval of various metrics (`getUsageMetrics`, `getCostMetrics`, `getPerformanceMetrics`).
    *   Budget management (`setBudget`).
    *   Data export (`exportData` to JSON, CSV, Markdown).
    *   Dashboard rendering (`renderDashboard`).
    *   Data reset (`reset`).
    *   Event emissions (`session:start`, `budget:alert`).
    *   Singleton instance management.
    *   **Mocking**: `fs-extra` is mocked to simulate file operations for persistence.

### 6.4. `ApprovalModeManager` (`tests/approval-modes.test.ts`)

*   **Purpose**: Ensures the security approval system (read-only, auto, full-access modes) functions correctly.
*   **Key Tests**:
    *   Mode changes and persistence (`setMode`, `getMode`, `saveConfig`).
    *   Behavior in `read-only` mode (blocking writes, auto-approving reads).
    *   Behavior in `auto` mode (requiring confirmation for dangerous ops, auto-approving safe ops).
    *   Behavior in `full-access` mode (auto-approving most ops, requiring confirmation for destructive).
    *   Command classification (identifying safe, network, destructive commands, fork bombs).
    *   Configuration loading and saving, including error handling.
    *   Operation history and statistics.
    *   Event emissions (`mode:changed`, `config:saved`, `config:error`).
    *   **Mocking**: `fs` module is mocked for configuration persistence.

### 6.5. `ArchitectMode` (`tests/architect-mode.test.ts`)

*   **Purpose**: Tests the AI architect's ability to analyze tasks and implement proposals.
*   **Key Tests**:
    *   `analyze`: Parsing valid JSON proposals (including from Markdown code blocks), handling invalid JSON, and validating proposal structure (e.g., `steps` existence).
    *   `implement`: Executing proposal steps, emitting `editor:step` events, and handling cancellation.
    *   `analyzeAndImplement`: Testing the full analysis-to-implementation flow, including manual approval.
    *   `formatProposal`: Correctly formatting proposals for display.
    *   **Mocking**: `CodeBuddyClient` is mocked to control AI responses for analysis and implementation.

### 6.6. `BashTool` (`tests/bash-tool.test.ts`)

*   **Purpose**: Verifies the security and functionality of the `BashTool`, particularly its command validation.
*   **Key Tests**:
    *   **Blocking Destructive Commands**: `rm -rf /`, `rm -rf ~`, fork bombs, `wget | sh`, `curl | bash`, `sudo rm`, `dd`, `mkfs`, `chmod 777 /`.
    *   **Blocking Sensitive File Access**: `~/.ssh`, `/etc/shadow`, `~/.aws`.
    *   **Allowing Safe Commands**: `ls`, `echo`, `pwd`, `cat package.json`, `grep`.
    *   `cd` command handling.
    *   Command timeouts.
    *   **Mocking**: `ConfirmationService` and `SandboxManager` are mocked to control security decisions.

### 6.7. `BenchmarkSuite` (`tests/benchmark-suite.test.ts`)

*   **Purpose**: Tests the LLM performance benchmarking suite.
*   **Key Tests**:
    *   Constructor configuration (warmup, runs, concurrency, timeout, prompts).
    *   `run`: Executing benchmarks, tracking success/failure, handling timeouts, and emitting phase/run/complete events.
    *   Concurrent execution.
    *   Summary statistics calculation (percentiles, average, std dev, TPS, throughput, token counts, cost).
    *   Result formatting (`formatResults`) and export (`exportJSON`).
    *   Comparison of benchmark results (`compare`).
    *   Singleton instance management.
    *   **Mocking**: A `createMockCallback` function simulates LLM responses with configurable latency, TTFT, output tokens, and failure rates.

### 6.8. `CheckpointManager` (`tests/checkpoint-manager.test.ts`)

*   **Purpose**: Validates the undo/redo and checkpointing system.
*   **Key Tests**:
    *   Checkpoint creation (`createCheckpoint`) with metadata and tags.
    *   Retrieval and management of checkpoints (`getCheckpoints`, `getCurrentCheckpoint`, `getCheckpoint`).
    *   Undo/redo capabilities (`canUndo`, `canRedo`).
    *   Searching, tagging, renaming, and deleting checkpoints.
    *   Auto-checkpointing logic (`shouldAutoCheckpoint`).
    *   Status formatting (`formatStatus`).
    *   Event emissions (`checkpoint:created`, `checkpoint:deleted`).
    *   **Mocking**: `fs-extra`, `child_process`, and `diff-match-patch` are mocked to simulate file system operations and diffing.

### 6.9. `CodeReviewEngine` (`tests/code-review.test.ts`)

*   **Purpose**: Tests the static code analysis engine for identifying issues.
*   **Key Tests**:
    *   **Security Rules**: Detecting hardcoded secrets, `eval` usage, `innerHTML`.
    *   **Performance Rules**: Detecting synchronous file operations, nested loops.
    *   **Bug-prone Code Rules**: Detecting loose equality (`==`), empty catch blocks.
    *   **Best Practice Rules**: Detecting `console` statements, `any` type usage.
    *   **Maintainability Rules**: Detecting `TODO` comments.
    *   Review summary generation (total files, comments, score, grade, severity counts).
    *   Single file review (`reviewFile`) with line numbers.
    *   Configuration options (include patterns, severity threshold).
    *   Text formatting (`formatAsText`).
    *   Factory functions (`createCodeReview`, `reviewProject`).
    *   Event emissions (`progress`).
    *   **Note**: This suite is skipped on Windows due to pathing issues with glob-to-regex.

### 6.10. `ComputerSkills` — LLM Step (`tests/computer-skills-llm.test.ts`)

*   **Purpose**: Verifies the execution of LLM steps within the `ComputerSkills` framework.
*   **Key Tests**:
    *   Executing a skill with an `llm` step, returning content and token usage.
    *   Integration with the built-in `llm-ask` skill.
    *   Handling missing `GROK_API_KEY`.
    *   `llm-ask` appearing in available skills.
    *   **Mocking**: `CodeBuddyClient` is mocked to simulate LLM responses.

### 6.11. `ConfigValidator` (`tests/config-validator.test.ts`)

*   **Purpose**: Ensures that configuration files adhere to their defined JSON schemas.
*   **Key Tests**:
    *   Validation of `settings.json`, `hooks.json`, `mcp.json`, and `yolo.json` schemas.
    *   Accepting valid configurations and rejecting invalid ones (e.g., out-of-range values, incorrect enums, missing required properties).
    *   Warning on unknown properties.
    *   Retrieving default values (`getDefaults`).
    *   Formatting validation results (`formatResult`).
    *   Listing and retrieving available schemas (`getSchemas`, `getSchema`).
    *   Handling unknown schema names.
    *   Singleton instance management.

### 6.12. `ContextManagerV2` (`tests/context-manager-v2.test.ts`)

*   **Purpose**: Tests the advanced context management system for LLM interactions.
*   **Key Tests**:
    *   Constructor configuration and effective token limit calculation.
    *   Token counting (`countTokens`).
    *   Context statistics (`getStats`).
    *   `prepareMessages`: Applying sliding window, preserving system messages, truncating tool results.
    *   Warning system (`shouldWarn`) for approaching context limits.
    *   Configuration updates (`updateConfig`).
    *   Factory functions (`createContextManager`, `getContextManager`) for model-specific defaults and singleton access.
    *   Summarization logic when enabled and context is too large.
    *   Handling edge cases like empty messages, null content, and very long single messages.

### 6.13. `DataRedactionEngine` (`tests/data-redaction.test.ts`)

*   **Purpose**: Validates the sensitive data redaction engine.
*   **Key Tests**:
    *   Detection and redaction of various secret types:
        *   API Keys (OpenAI, Anthropic, xAI/Grok, AWS, Google, GitHub, Stripe).
        *   Tokens (JWT, Bearer, Basic Auth).
        *   Private Keys (RSA, SSH).
        *   Connection Strings (PostgreSQL, MongoDB, MySQL).
        *   PII (Credit Card numbers, SSN).
        *   Environment Variables (`PASSWORD`, `SECRET`).
        *   High-entropy strings.
    *   Redaction within objects (`redactObject`) and arrays.
    *   Whitelisting specific values.
    *   Adding custom redaction patterns.
    *   Statistics tracking (`stats`).
    *   Enabling/disabling the engine.
    *   Singleton instance management and utility functions (`redactSecrets`, `containsSecrets`).

### 6.14. `Database System` (`tests/database.test.ts`)

*   **Purpose**: Comprehensive tests for the SQLite database, repositories, and integration.
*   **Key Tests**:
    *   **Conditional Execution**: Skips tests if `better-sqlite3` native module is unavailable.
    *   **Database Manager**: Initialization, connection, schema migrations, transactions.
    *   **Repositories**:
        *   `MemoryRepository`: Storing and retrieving key-value pairs.
        *   `SessionRepository`: Managing user sessions.
        *   `AnalyticsRepository`: Storing analytics data.
        *   `EmbeddingRepository`: Storing vector embeddings.
        *   `CacheRepository`: Caching data.
    *   Data integrity and CRUD operations for each repository.
    *   Error handling for database operations.
    *   **Note**: The provided source for this test file is truncated, but the description infers the scope.

## 7. Coverage Goals

Code Buddy aims for high test coverage to ensure quality. The following targets are set:

*   **Statements**: 80%+
*   **Branches**: 75%+
*   **Functions**: 80%+
*   **Lines**: 80%+

Developers are encouraged to run coverage reports (`npm run test:coverage`) to identify gaps when adding new features or fixing bugs.

## 8. Continuous Integration

Tests are automatically run on every push via GitHub Actions. All pull requests must have passing tests before they can be merged, enforcing a high standard of code quality.

## 9. Troubleshooting

*   **Tests are slow**:
    *   Increase `jest.setTimeout()` for specific long-running tests.
    *   Mock heavy dependencies.
    *   Ensure Jest is running tests in parallel (default behavior).
*   **Module not found errors**:
    *   Verify `tsconfig.json` paths and `jest.config.js` `moduleNameMapper`.
*   **Coverage not accurate**:
    *   Exclude non-testable files in `collectCoverageFrom` in `jest.config.js`.
    *   Ensure all code paths are exercised by tests.

## 10. Resources

*   [Jest Documentation](https://jestjs.io/docs/getting-started)
*   [Testing TypeScript with Jest](https://jestjs.io/docs/getting-started#via-ts-jest)
*   [Jest Matchers](https://jestjs.io/docs/expect)