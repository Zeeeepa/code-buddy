---
title: "tests — features"
module: "tests-features"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.898Z"
---
# tests — features

The `tests/features` module is a critical part of the codebase, housing a comprehensive suite of integration and unit tests for many of the core functionalities and external integrations of the application. Its primary purpose is to ensure the correct behavior, stability, and reliability of various features, ranging from user configuration and UI enhancements to complex integrations with cloud platforms, IDEs, and CI/CD systems.

This module is structured as a collection of individual test files, each focusing on a logical grouping of related features. This organization allows for targeted testing and easier maintenance of specific functional areas.

## Module Structure and Coverage

The `tests/features` directory contains several test files, each responsible for validating a distinct set of features. Below is an overview of each file and the key functionalities it covers:

### `basse-features.test.ts`

This file covers a broad range of foundational features, often related to configuration, session management, UI elements, and core skill enhancements.

*   **`UserSettingsManager`**: Tests the application's user settings, including getting/setting various types of preferences (e.g., `spinnerVerbs`, `reduceMotion`, `theme`, `disallowedTools`, `plansDirectory`, `temperatureOverride`). It also verifies the singleton pattern of the manager.
*   **`SessionPicker`**: Validates the functionality for listing, sorting, searching (by branch and name), and formatting session entries, crucial for session management.
*   **`BrailleSpinner`**: Ensures the correct behavior of the UI spinner, including frame progression, shimmer text generation with ANSI codes, and the start/stop/update lifecycle.
*   **`CJKInputHandler`**: Tests the handling of CJK (Chinese, Japanese, Korean) characters, including full-width detection, normalization, and accurate display width calculation.
*   **`ITermProgressBar`**: Verifies iTerm2 terminal detection and the ability to set and clear iTerm2-specific progress bar commands.
*   **`SkillVariableResolver`**: Covers the resolution of dynamic variables within skill prompts, such as `$ARGUMENTS`, `$CLAUDE_SESSION_ID`, `$WORKING_DIR`, and `$GIT_BRANCH`.
*   **`SkillBudgetCalculator`**: Tests the calculation of token budgets for skills and the truncation of content to fit within those limits.
*   **`NestedLaunchGuard`**: Ensures the system can detect and prevent nested application launches by checking environment variables (`CODEBUDDY_SESSION_ID`).
*   **`ConfigBackupManager`**: Validates the functionality for creating, listing, pruning, and restoring configuration backup files.
*   **`FeedbackCommand`**: Tests the generation of GitHub issue URLs and the formatting of feedback messages.
*   **`HookEventEmitter`**: Verifies the event emission and handling mechanism for various application hooks, including `PreCompact`, `Notification`, and `PermissionRequest`, also confirming its singleton nature.
*   **`WorktreeSessionManager`**: Tests the management of Git worktree-based sessions, including creation, listing, finding, cleanup, and checking active status.

### `browser-memory-tools.test.ts`

This file focuses on features related to browser automation, memory search, image processing, tool management, and security. Note that `BrowserTool` and `ImageTool` are stubbed classes within this test file for controlled testing without external dependencies.

*   **`BrowserTool` (Stubbed)**: Tests the simulated browser automation capabilities, including launching, navigating, interacting with elements (click, type, press, hover, drag), taking screenshots/PDFs, managing tabs, executing scripts, and accessing console output. It also confirms the singleton pattern.
*   **`BM25Index`**: Validates the BM25 text indexing functionality, including adding/removing documents, counting, and searching for relevant results.
*   **`HybridMemorySearch`**: Tests the hybrid memory search system, which combines BM25 and semantic search. It covers indexing, searching, setting weights, and clearing the index, confirming its singleton pattern.
*   **`ImageTool` (Stubbed)**: Tests the simulated image analysis capabilities, including supported formats, image validation, analysis (path and URL), comparison, text extraction (OCR), and resizing. It also confirms the singleton pattern.
*   **`ToolProfileManager`**: Verifies the management of tool profiles and groups, including listing built-in profiles, getting profiles/groups by name, setting active profiles, resolving tool lists, and adding/removing custom profiles/groups. It confirms the singleton pattern.
*   **`SafeBinariesChecker`**: Tests the system for checking safe shell commands and command chains, managing a list of safe binaries, and allowing customization of this list. It confirms the singleton pattern.

### `cicd-chrome-sdk-pr.test.ts`

This file covers integrations with CI/CD platforms, browser debugging, agent development, and pull request linking.

*   **`GitHubActionRunner`**: Tests the integration with GitHub Actions, including parsing event payloads (pull request, issues, push), generating structured review comments, suggesting triage labels, formatting action outputs, and creating `action.yml` content.
*   **`GitLabCIRunner`**: Validates the integration with GitLab CI, covering parsing environment variables, generating merge request comments, formatting pipeline outputs, and creating `.gitlab-ci.yml` templates.
*   **`ChromeBridge`**: Tests the functionality of connecting to and interacting with the Chrome DevTools Protocol. This includes connecting/disconnecting, retrieving console errors, getting DOM state, monitoring network requests, executing scripts, and recording user actions. It confirms the singleton pattern.
*   **`AgentSDK`**: Covers the core functionality of the Agent SDK, including configuration, running agent tasks (both synchronous and streaming), managing custom tools (add/remove), and setting system prompts. It also tests the `createAgent` factory function.
*   **`PRSessionLinker`**: Validates the ability to link application sessions to Pull Requests (GitHub/GitLab). This includes linking by PR number or URL, retrieving current PR information, managing review status, unlinking, formatting PR footers, and auto-linking from branch names.
*   **`MCPAutoDiscovery`**: Tests the Multi-Cloud Platform (MCP) tool auto-discovery mechanism, including logic for deferring tool loading based on context window thresholds, searching for tools, and partitioning tools into loaded and deferred sets.

### `claude-code-parity.test.ts`

This file focuses on features specifically designed to enhance interaction with Claude models, particularly around "thinking" processes and prompt management.

*   **`ExtendedThinkingManager`**: Tests the extended thinking mode for Claude, including enabling/disabling, setting/getting token budgets (and respecting `MAX_THINKING_TOKENS` environment variable), and providing the correct thinking configuration. It also verifies the singleton pattern and reset functionality.
*   **`PromptSuggestionEngine`**: Validates the generation, caching, and clearing of prompt suggestions. It covers enabling/disabling the engine and ensuring relevant suggestions are produced based on context.
*   **`handleContextVisualization`**: Tests the utility for rendering a visual representation of the LLM's context window usage. This includes verifying the output format, inclusion of percentages and ANSI color codes, handling edge cases (e.g., zero total tokens, full window), and the structure of the `CONTEXT_COMMAND`.

### `cloud-lsp-ide.test.ts`

This file covers a wide array of features related to cloud sessions, Language Server Protocol (LSP) integration, and scaffolding for desktop applications and IDE extensions.

*   **`CloudSessionManager`**: Tests the management of cloud web sessions, including creation (with various options), listing, retrieving, pausing, resuming, terminating, and sharing sessions. It also covers sending local tasks to the cloud and tracking session counts.
*   **`TeleportManager`**: Validates the "teleport" functionality for moving sessions between local and cloud environments. This includes teleporting cloud sessions locally, pushing local sessions to the cloud, syncing state, and generating diffs.
*   **`LSPClient`**: Tests the Language Server Protocol client, covering registration of LSP servers, checking language support, detecting languages from file extensions, and simulating various LSP queries (e.g., `goToDefinition`, `findReferences`, `hover`, `getDocumentSymbols`, `getDiagnostics`). It also includes starting/stopping servers and tracking query statistics.
*   **`DesktopAppManager`**: Tests the scaffolding and management for a desktop application. This includes creating/managing windows (main, settings, diff, session picker), focusing windows, closing windows, and generating installer configurations for Electron and Tauri frameworks. It also covers multi-window behavior.
*   **`VSCodeBridge`**: Validates the scaffolding and integration points for a VS Code extension. This includes creating/managing inline diffs (accept/reject), getting editor context (file, language, selection, diagnostics), building `@-mentions`, managing session history, creating/approving plan reviews, and generating `package.json` content.
*   **`JetBrainsBridge`**: Tests the scaffolding and integration points for a JetBrains plugin. This includes creating/managing diffs (modified, created, deleted), getting editor context, handling notifications, managing tool windows, and generating `plugin.xml` content.

## Key Testing Patterns

Developers contributing to or maintaining these tests should be aware of several common patterns:

*   **Mocking External Dependencies**: `jest.mock` is extensively used to isolate the code under test from external systems like `child_process` or internal utilities like `logger`. This ensures tests are fast, deterministic, and focused.
*   **Singleton Pattern Validation**: Many core managers and tools (e.g., `UserSettingsManager`, `BrowserTool`, `HybridMemorySearch`, `ToolProfileManager`, `SafeBinariesChecker`, `ChromeBridge`, `HookEventEmitter`, `ExtendedThinkingManager`) are designed as singletons. Their tests often include explicit checks for `getInstance()` returning the same instance and `resetInstance()` correctly clearing the state for subsequent tests.
*   **Environment Variable Manipulation**: Tests frequently modify `process.env` to simulate different runtime conditions or configurations (e.g., `MAX_THINKING_TOKENS`, `CODEBUDDY_SESSION_ID`, various CI/CD environment variables). It's crucial to reset these in `afterEach` blocks to prevent test pollution.
*   **Lifecycle Hooks (`beforeEach`, `afterEach`)**: These hooks are used for consistent test setup and teardown. Common operations include:
    *   `jest.resetModules()`: Ensures a fresh import of modules for each test, especially important for singletons or modules with global state.
    *   `jest.useFakeTimers()`: For testing time-dependent components like `BrailleSpinner`.
    *   `jest.spyOn()`: To monitor calls to methods or properties without altering their implementation.
    *   File system operations (`fs.mkdtempSync`, `fs.rmSync`): For tests involving file backups or worktrees.
*   **Asynchronous Testing**: Many features involve asynchronous operations (e.g., module imports, simulated network calls, file system interactions). Tests use `async/await` to handle these correctly.
*   **In-Test Stubbing**: For complex external integrations (like `BrowserTool` or `ImageTool`), simplified stub classes are often defined directly within the test file. This allows for precise control over their behavior and avoids the overhead of actual external calls.

## Contributing and Understanding

*   **Running Tests**: To execute these tests, navigate to the project root and run the appropriate Jest command, typically `npm test` or `yarn test`. You can target specific files or `describe` blocks for focused testing.
*   **Adding New Tests**: When adding a new feature or extending an existing one, create a new test file in `tests/features` (if it's a new logical grouping) or add to an existing relevant file. Follow the established patterns for mocking, setup, and assertion.
*   **Understanding Existing Tests**: Each `describe` block typically corresponds to a major feature or class, and `it` blocks describe specific behaviors or scenarios. Pay attention to `beforeEach` and `afterEach` for setup/teardown logic. The comments at the top of each test file provide a quick summary of its coverage.
*   **Debugging**: Use your IDE's debugger or `console.log` statements within the test files to step through execution and inspect variables. Remember that mocks and stubs will alter the actual execution path.

This module is vital for maintaining the quality and correctness of the application. By understanding its structure and common patterns, developers can effectively contribute to and maintain the codebase.