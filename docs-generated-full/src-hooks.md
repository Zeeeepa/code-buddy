---
title: "src — hooks"
module: "src-hooks"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.515Z"
---
# src — hooks

The `src/hooks` module is a central component for extending, automating, and managing various aspects of the Code Buddy application. It provides multiple, distinct hook systems and related utilities, allowing developers to inject custom logic at different points in the application's lifecycle, integrate with external services, manage session state, log actions, and enhance user interface interactions.

This module can be broadly categorized into:
1.  **Core Event & Lifecycle Hook Systems**: For executing commands or custom logic in response to application events.
2.  **Advanced, LLM-Integrated Hook Systems**: More sophisticated, Enterprise-grade hooks that can interact with LLMs or external HTTP services.
3.  **Specialized Hook-Related Utilities**: Components that support or enhance the hook systems, such as asynchronous execution, environment persistence, or a global event bus.
4.  **Moltbot-Inspired Hooks**: A suite of managers for handling session introductions, persistence, and command logging.
5.  **UI-Related React Hooks**: For managing user input, history, and suggestions within the chat interface.

## I. Core Event & Lifecycle Hook Systems

This section covers the foundational hook systems that primarily execute shell commands or custom handlers in response to various application events.

### A. `HookSystem` (`src/hooks/hook-system.ts`)

The `HookSystem` provides a basic, file-based mechanism for executing shell commands at predefined lifecycle events. It's designed for straightforward automation tasks.

*   **Purpose**: To run shell commands at specific points like `pre-commit`, `post-edit`, `on-file-change`, etc.
*   **Configuration**: Hooks are defined in `.codebuddy/hooks.json` (project-level) and `~/.codebuddy/hooks.json` (global).
*   **Key Features**:
    *   **`HookType`**: A set of predefined event types (e.g., `pre-commit`, `post-edit`, `on-session-start`).
    *   **Command Interpolation**: Supports placeholders like `{file}`, `{files}`, `{command}` in hook commands, which are safely escaped before execution.
    *   **Error Handling**: Hooks can be configured to `continueOnError` or stop the entire chain.
    *   **Singleton Access**: `getHookSystem(workingDirectory?: string)` provides a singleton instance, optionally re-initializing for a new working directory.
*   **Usage**:
    ```typescript
    import { getHookSystem, HookType } from './hooks/hook-system.js';

    const hookSystem = getHookSystem();
    if (hookSystem.hasHooks('pre-commit')) {
      const results = await hookSystem.executeHooks('pre-commit', { files: ['src/index.ts'] });
      // Process results
    }
    ```

### B. `HookManager` (`src/hooks/hook-manager.ts`)

The `HookManager` is another command-execution hook system, offering slightly different event types and a more structured approach to configuration loading (global then project-level). It also introduces the concept of hooks blocking operations or modifying arguments via JSON output.

*   **Purpose**: To execute shell commands based on `HookEvent`s, with support for blocking operations or modifying tool arguments.
*   **Configuration**: Loads hooks from `~/.codebuddy/hooks.json` (global) and then `.codebuddy/hooks.json` (project-level), allowing project hooks to extend or override global ones.
*   **Key Features**:
    *   **`HookEvent`**: A distinct set of events (e.g., `PreToolUse`, `PostToolUse`, `Notification`, `SessionStart`).
    *   **Pattern Matching**: Hooks can specify a `pattern` (regex) to match against `toolName` for more granular control.
    *   **JSON Output Protocol**: Command hooks can output JSON to `stdout` to signal `blocked` status or `modifiedArgs`. A special exit code `77` also signifies blocking.
    *   **Singleton Access**: `getHookManager()` provides a singleton instance.
*   **Usage**:
    ```typescript
    import { getHookManager, HookEvent } from './hooks/hook-manager.js';

    const hookManager = getHookManager();
    const result = await hookManager.executeHooks(HookEvent.PreToolUse, {
      toolName: 'bash',
      toolArgs: { command: 'ls -la' },
    });
    if (result.blocked) {
      console.log('Operation blocked:', result.error);
    }
    ```

### C. `HooksManager` (Comprehensive Lifecycle Hooks - `src/hooks/lifecycle-hooks.ts`)

This `HooksManager` provides a more comprehensive and extensible lifecycle hook system, supporting not just shell commands but also script files and direct JavaScript handler functions. It comes with a set of `BUILTIN_HOOKS` and a rich set of event types.

*   **Purpose**: To manage and execute hooks at various points in the application's lifecycle, including pre/post operations for edits, bash commands, LLM interactions, and agent/session events.
*   **Configuration**: Hooks are defined in `.codebuddy/hooks.json` (project-level) and can include `BUILTIN_HOOKS` which are registered by default.
*   **Key Features**:
    *   **Extensive `HookType`s**: Covers a wide range of events, including `pre-edit`, `post-bash`, `pre-prompt`, `model:request`, `task:completed`, etc.
    *   **Multiple Handler Types**: Hooks can be defined with a `command` (shell), `script` (Node.js file), or an inline `handler` function.
    *   **Context Matching**: Hooks can be filtered by `filePatterns` or `commandPatterns`.
    *   **`HookResult`**: Provides detailed results including `success`, `output`, `error`, `duration`, and `modified` context (e.g., `modified.prompt`).
    *   **Singleton Access**: `getHooksManager(workingDirectory?: string, config?: Partial<HooksConfig>)` provides a singleton instance.
*   **Usage**:
    ```typescript
    import { getHooksManager, HookType } from './hooks/lifecycle-hooks.js';

    const hooksManager = getHooksManager();
    hooksManager.registerHook({
      name: 'custom-pre-edit',
      type: 'pre-edit',
      handler: async (context) => {
        console.log(`Pre-edit hook for ${context.file}`);
        return { success: true, duration: 10 };
      },
      enabled: true,
      timeout: 5000,
      failOnError: false,
    });

    const results = await hooksManager.executeHooks(HookType['pre-edit'], { file: 'test.txt' });
    ```

## II. Advanced, LLM-Integrated Hook Systems (Enterprise-grade)

These systems offer more sophisticated hook capabilities, including interaction with LLMs and HTTP services, often inspired by the extensibility model of tools natively.

### A. `HookRunner` (Extended Hooks with Multiple Handlers - `src/hooks/hook-runner.ts` & `src/hooks/hook-types.ts`)

The `HookRunner` implements an advanced, Enterprise-grade hook system with support for various handler types beyond just shell commands. It uses `hook-types.ts` to define its rich type system.

*   **Purpose**: To provide a flexible and powerful hook system that can execute shell commands, make HTTP requests, evaluate LLM prompts, or delegate to sub-agents.
*   **Configuration**: Hooks are defined under the `extendedHooks` array key within `.codebuddy/hooks.json`.
*   **Key Features**:
    *   **`ExtendedHookEvent`**: A superset of events, including `PreToolUse`, `PostToolUseFailure`, `PreCompact`, `PermissionRequest`, `ModelRequest`, etc.
    *   **`HookHandlerType`**: Supports `command`, `http`, `prompt`, and `agent` handlers.
        *   **`CommandHandler`**: Executes shell commands, sending context on stdin. Supports exit codes `0` (success), `2` (block), and JSON output for `updatedInput` or `permissionDecision`.
        *   **`HttpHandler`**: POSTs context JSON to a URL. Supports HTTP status codes `2xx` (success), `403` (block), and JSON response for `updatedInput` or `permissionDecision`.
        *   **`PromptHandler`**: Evaluates a prompt using an LLM (requires model integration).
        *   **`AgentHandler`**: Delegates evaluation to a named sub-agent (requires agent registry integration).
    *   **`ExtendedHookResult`**: Provides `success`, `output`, `error`, `blocked`, `updatedInput`, and `permissionDecision`.
    *   **Singleton Access**: `getHookRunner(projectRoot?: string)` provides a singleton instance.
*   **Usage**:
    ```typescript
    import { getHookRunner, ExtendedHookEvent } from './hooks/hook-runner.js';

    const runner = getHookRunner();
    const result = await runner.run(ExtendedHookEvent.PreToolUse, {
      toolName: 'git',
      toolArgs: { command: 'commit' },
    });
    if (result.blocked) {
      console.log('Git commit blocked by hook:', result.error);
    }
    ```

### B. `AdvancedHookRunner` & `HookRegistry` (`src/hooks/advanced-hooks.ts`)

This module presents another Native Engine-like hook system, focusing on command, prompt, and agent hooks with a dedicated registry for managing them.

*   **Purpose**: To provide an advanced, LLM-integrated hook system with a clear registry for CRUD operations on hooks.
*   **Configuration**: Hooks are managed programmatically via the `HookRegistry`.
*   **Key Features**:
    *   **`AdvancedHookType`**: Supports `command`, `prompt`, and `agent` hook types.
    *   **`HookEvent`**: An enum defining events like `PreToolUse`, `PostToolUse`, `SessionStart`, `PermissionRequest`.
    *   **`HookRegistry`**: Manages `AdvancedHook` definitions, including `addHook`, `removeHook`, `getHooksForEvent`, and `markFired` for one-shot hooks.
    *   **`AdvancedHookRunner`**: Executes hooks based on their type:
        *   **Command Hooks**: Spawns shell commands, passing context via environment variables. Expects JSON output for `HookDecision` (`allow`, `deny`, `ask`).
        *   **Prompt Hooks**: Uses `CodeBuddyClient` to evaluate a prompt with an LLM, returning a `HookDecision`.
        *   **Agent Hooks**: Delegates to a sub-agent via `CodeBuddyClient` for evaluation, returning a `HookDecision`.
    *   **Async Execution**: `runHookAsync` allows fire-and-forget execution.
    *   **Singleton Access**: `getHookRegistry()` and `getAdvancedHookRunner(workingDirectory?: string)` provide singleton instances.
*   **Usage**:
    ```typescript
    import { getHookRegistry, getAdvancedHookRunner, HookEvent } from './hooks/advanced-hooks.js';

    const registry = getHookRegistry();
    registry.addHook({
      name: 'security-check',
      event: HookEvent.PreToolUse,
      type: 'command',
      command: 'security-script.sh',
      matcher: /^(npm|yarn)$/,
    });

    const runner = getAdvancedHookRunner();
    const decision = await runner.runHook(registry.getHook('security-check')!, {
      event: HookEvent.PreToolUse,
      toolName: 'npm',
      input: { args: ['install'] },
    });
    console.log('Hook decision:', decision.action);
    ```

## III. Specialized Hook-Related Utilities

These modules provide supporting functionality that can be used independently or in conjunction with the various hook systems.

### A. `AsyncHookManager` (`src/hooks/async-hooks.ts`)

Manages the asynchronous execution of hooks, providing concurrency control, job tracking, and result collection.

*   **Purpose**: To run hooks in the background without blocking the main thread, with features like concurrency limits, timeouts, and status tracking.
*   **Key Features**:
    *   **`AsyncHookJob`**: Tracks the status (`running`, `completed`, `failed`, `timeout`, `cancelled`) and results of each asynchronous hook execution.
    *   **Concurrency Control**: Limits the number of `maxConcurrent` hooks.
    *   **Timeout Management**: Hooks can be configured with a `timeout`.
    *   **System Message Generation**: `getSystemMessages()` formats completed hook results into messages suitable for injecting into a conversation.
    *   **Cancellation**: Supports cancelling running jobs.
*   **Usage**:
    ```typescript
    import { AsyncHookManager } from './hooks/async-hooks.js';
    import { SmartHookConfig } from './hooks/smart-hooks.js'; // Assuming SmartHookConfig is compatible

    const asyncManager = new AsyncHookManager(5); // Max 5 concurrent hooks
    const hookConfig: SmartHookConfig = {
      name: 'long-running-check',
      event: 'PostToolUse',
      type: 'command',
      command: 'sleep 10 && echo "Done"',
    };
    const jobId = asyncManager.submit(hookConfig, { toolName: 'test' });
    // ... later ...
    const completedJobs = asyncManager.getCompletedJobs();
    const systemMessages = asyncManager.getSystemMessages();
    ```

### B. `HookEventEmitter` (`src/hooks/hook-events.ts`)

A global EventEmitter instance for specific, high-level application events, particularly those requiring synchronous responses like permission requests.

*   **Purpose**: To provide a centralized event bus for specific events, allowing different parts of the application to subscribe and react.
*   **Key Features**:
    *   **Singleton**: `getInstance()` ensures a single global instance.
    *   **Specific Events**: `PreCompact`, `Notification`, `PermissionRequest`.
    *   **Synchronous `PermissionRequest`**: `emitPermissionRequest` is designed to call listeners synchronously and return a `PermissionResponse`, enabling immediate decision-making.
*   **Usage**:
    ```typescript
    import { HookEventEmitter, NotificationType } from './hooks/hook-events.js';

    const eventEmitter = HookEventEmitter.getInstance();
    eventEmitter.onNotification((payload) => {
      console.log(`Notification: ${payload.type} - ${payload.message}`);
    });
    eventEmitter.emitNotification({ type: 'auth_success', message: 'User logged in' });

    const response = eventEmitter.emitPermissionRequest({ tool: 'rm', input: 'file.txt' });
    console.log('Permission decision:', response.action);
    ```

### C. `EnvPersistence` (`src/hooks/env-persistence.ts`)

Manages environment variables for a session, persisting them to a temporary `.env` file and allowing them to be applied to `process.env`.

*   **Purpose**: To maintain and persist environment variables across different stages or restarts of a session, ensuring consistent execution environments for tools and commands.
*   **Key Features**:
    *   **Session-Specific Files**: Stores environment variables in `os.tmpdir()/.codebuddy-env/session-{sessionId}.env`.
    *   **`setVar`/`unsetVar`**: Modifies and persists individual environment variables.
    *   **`loadEnv`/`applyToProcess`**: Loads variables from the file and applies them to the current `process.env`.
    *   **`captureEnvChanges`**: Detects and persists changes between two environment snapshots.
    *   **Cleanup**: `cleanup()` removes the session's `.env` file.
*   **Usage**:
    ```typescript
    import { EnvPersistence } from './hooks/env-persistence.js';

    const envManager = new EnvPersistence('my-session-id');
    envManager.setVar('MY_API_KEY', 'some-secret-value');
    envManager.applyToProcess();
    console.log(process.env.MY_API_KEY);

    const before = { ...process.env };
    process.env.NEW_VAR = 'new-value';
    envManager.captureEnvChanges(before, process.env as Record<string, string>);
    ```

## IV. Moltbot-Inspired Hooks (`src/hooks/moltbot/`)

This sub-module provides a suite of managers inspired by Moltbot's approach to session management, introductory messages, and command logging. It's designed to enhance the AI's context and provide auditing capabilities.

### A. Overview

The Moltbot hooks system is composed of three core managers: `IntroHookManager`, `SessionPersistenceManager`, and `CommandLogger`, all orchestrated by the `MoltbotHooksManager`. It aims to provide a robust framework for:
*   Injecting initial context (e.g., project README, AI role instructions) into new sessions.
*   Persisting conversation history and tool calls across restarts.
*   Logging all AI actions for security and debugging, with sensitive data redaction.

### B. `IntroHookManager` (`src/hooks/moltbot/intro-hook-manager.ts`)

Manages the loading and combination of introductory content for new sessions.

*   **Purpose**: To provide the AI with initial context, such as project descriptions, AI role definitions, or coding standards, by loading content from various sources.
*   **Key Features**:
    *   **`IntroSource` Types**: Supports loading content from `inline` strings, `file` paths (project or global), and `url`s.
    *   **Priority-Based Loading**: Sources are loaded and combined based on their defined `priority`.
    *   **Content Truncation**: Ensures combined intro content does not exceed a `maxLength`.
    *   **Caching**: Caches loaded content for performance.
*   **Usage**:
    ```typescript
    import { IntroHookManager } from './hooks/moltbot/intro-hook-manager.js';

    const introManager = new IntroHookManager(process.cwd());
    const introResult = await introManager.loadIntro();
    console.log('Intro content:', introResult.content);
    ```

### C. `SessionPersistenceManager` (`src/hooks/moltbot/session-persistence-manager.ts`)

Handles the saving and loading of conversation sessions, including messages and tool calls.

*   **Purpose**: To ensure continuity of context across application restarts by persisting session data (messages, tool calls, metadata) to disk.
*   **Key Features**:
    *   **`PersistedSession`**: Stores session ID, project path, timestamps, messages, and metadata.
    *   **Auto-Save**: Periodically saves the current session if changes have occurred (`isDirty`).
    *   **Message/Tool Call Logging**: `addMessage` and `addToolCall` append data to the current session.
    *   **Session Lifecycle**: `startSession`, `loadSession`, `endSession`.
    *   **Cleanup**: `cleanupOldSessions` removes sessions exceeding `maxSessions`.
*   **Usage**:
    ```typescript
    import { SessionPersistenceManager } from './hooks/moltbot/session-persistence-manager.js';

    const sessionManager = new SessionPersistenceManager(process.cwd());
    const session = await sessionManager.startSession();
    sessionManager.addMessage({ role: 'user', content: 'Hello' });
    await sessionManager.saveSession();
    ```

### D. `CommandLogger` (`src/hooks/moltbot/command-logger.ts`)

Logs all AI actions, including tool calls, bash commands, and file edits, with support for redaction and log rotation.

*   **Purpose**: To provide a comprehensive audit trail of all AI-driven actions for security, debugging, and compliance.
*   **Key Features**:
    *   **`CommandLogEntry`**: Structured logging for various action types (`tool_call`, `bash`, `file_edit`, `user_input`, `assistant_response`).
    *   **Secret Redaction**: Configurable `secretPatterns` to automatically redact sensitive information from logs.
    *   **Log Rotation**: Rotates logs daily or when `maxLogSize` is exceeded, and cleans up old log files.
    *   **Buffered Writes**: Writes logs in batches to minimize disk I/O.
    *   **Detailed Logging**: `logToolCall`, `logBashCommand`, `logFileEdit`, `logUserInput`, `logAssistantResponse`.
*   **Usage**:
    ```typescript
    import { CommandLogger } from './hooks/moltbot/command-logger.js';

    const commandLogger = new CommandLogger();
    commandLogger.setSessionId('my-session-id');
    commandLogger.logBashCommand('ls -la', { success: true, output: 'file.txt' });
    ```

### E. `MoltbotHooksManager` (Orchestrator - `src/hooks/moltbot/moltbot-hooks-manager.ts`)

The central manager that orchestrates the `IntroHookManager`, `SessionPersistenceManager`, and `CommandLogger`.

*   **Purpose**: To provide a unified interface for initializing, managing, and disposing of all Moltbot-inspired hook functionalities.
*   **Key Features**:
    *   **Unified Initialization**: `initializeSession` loads intro content, starts/resumes a session, and sets the session ID for the command logger.
    *   **Config Management**: Loads and saves a combined `MoltbotHooksConfig` from/to `.codebuddy/moltbot-hooks.json`.
    *   **Event Forwarding**: Forwards events from sub-managers (e.g., `intro-loaded`, `session-saved`, `command-logged`).
    *   **Status Reporting**: `formatStatus()` provides a human-readable summary of all Moltbot hook statuses.
    *   **Singleton Access**: `getMoltbotHooksManager(workingDirectory?: string, config?: Partial<MoltbotHooksConfig>)` provides a singleton instance.
*   **Usage**:
    ```typescript
    import { getMoltbotHooksManager } from './hooks/moltbot/moltbot-hooks-manager.js';

    const moltbotManager = getMoltbotHooksManager(process.cwd());
    const { intro, session } = await moltbotManager.initializeSession();
    console.log(`Session ${session.id} started with intro content.`);
    moltbotManager.getCommandLogger().log({ type: 'system', action: 'session_init' });
    await moltbotManager.endSession();
    ```

### F. Setup Utilities (`src/hooks/moltbot/setup-utilities.ts`)

Convenience functions for checking, setting up, enabling, and disabling Moltbot hooks configuration files.

*   **Purpose**: Simplifies the initial setup and management of Moltbot hooks for users.
*   **Key Functions**: `checkMoltbotSetup`, `setupMoltbotHooks`, `enableMoltbotHooks`, `disableMoltbotHooks`, `getIntroHookContent`, `setIntroHookContent`, `formatSetupStatus`.

## V. UI-Related React Hooks

These hooks are specifically designed for use within React components to manage user input, history, and provide interactive suggestions in the chat interface.

### A. `useEnhancedInput` (`src/hooks/use-enhanced-input.ts`)

A React hook that provides enhanced input field capabilities, including history navigation and command/file suggestions.

*   **Purpose**: To manage the state and behavior of a text input field, offering features like input history, reverse search, and dynamic suggestions.
*   **Key Features**:
    *   **Input State Management**: `inputValue`, `setInputValue`.
    *   **History Navigation**: Integrates with `useInputHistory` for `historyUp`, `historyDown`, `reverseSearch`.
    *   **Suggestions**: Manages `suggestions` and `activeSuggestionIndex`.
    *   **Cursor Position**: Tracks and manages cursor position for precise input manipulation.
*   **Usage**:
    ```typescript
    import { useEnhancedInput } from './hooks/use-enhanced-input.js';

    function MyInputComponent() {
      const { inputValue, setInputValue, handleKeyDown, suggestions } = useEnhancedInput();
      // ... render input and suggestions ...
    }
    ```

### B. `useInputHandler` (`src/hooks/use-input-handler.ts`)

A React hook that centralizes keyboard event handling for the chat input, parsing commands, and dispatching actions.

*   **Purpose**: To process user input events (e.g., `Enter`, `Tab`, arrow keys) and translate them into application actions, such as submitting messages, executing commands, or navigating suggestions.
*   **Key Features**:
    *   **Event Handling**: `handleInputChange`, `handleKeyDown`, `handleInputSubmit`.
    *   **Command Parsing**: Detects and handles slash commands (e.g., `/help`).
    *   **File/Command Suggestions**: Integrates with `useEnhancedInput` to provide context-aware suggestions.
    *   **File Reference Processing**: Extracts and processes file references from user input.
    *   **Direct Command Execution**: `handleDirectCommand` for bypassing LLM for specific commands.
*   **Usage**:
    ```typescript
    import { useInputHandler } from './hooks/use-input-handler.js';

    function ChatInput() {
      const { handleInputChange, handleKeyDown, handleInputSubmit } = useInputHandler();
      // ... render input with these handlers ...
    }
    ```

### C. `useInputHistory` (`src/hooks/use-input-history.ts`)

A React hook for managing the history of user inputs.

*   **Purpose**: To provide a persistent and navigable history of user commands and messages.
*   **Key Features**:
    *   **History Stack**: Stores a list of past inputs.
    *   **Navigation**: `historyUp`, `historyDown` to traverse the history.
    *   **Reverse Search**: `reverseSearch` functionality to find past commands.
    *   **Add/Clear**: `add` new inputs, `clear` history.
*   **Usage**:
    ```typescript
    import { useInputHistory } from './hooks/use-input-history.js';

    function HistoryNavigator() {
      const { historyUp, historyDown, currentInput } = useInputHistory();
      // ... use currentInput and navigation functions ...
    }
    ```

## VI. Architectural Overview

The `src/hooks` module is a collection of distinct, yet sometimes overlapping, systems. The following diagram illustrates the high-level categories of hook systems and their primary interactions.

```mermaid
graph TD
    subgraph Hook System Categories
        A[Basic Command Hooks]
        B[Lifecycle Hooks]
        C[Advanced LLM/HTTP Hooks]
        D[Moltbot Session/Logging Hooks]
        E[UI Input Hooks]
    end

    A -->|Config: .codebuddy/hooks.json| F[File System]
    B -->|Config: .codebuddy/hooks.json| F
    C -->|Config: .codebuddy/hooks.json (extendedHooks)| F
    D -->|Config: .codebuddy/moltbot-hooks.json| F
    C -->|Integrates with| G[LLM / HTTP Services]
    D -->|Integrates with| H[Session Storage / Command Logs]
    E -->|Manages| I[User Input & History]

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#ffc,stroke:#333,stroke-width:2px
    style D fill:#cfc,stroke:#333,stroke-width:2px
    style E fill:#ccf,stroke:#333,stroke-width:2px
```

*   **Basic Command Hooks** (`HookSystem`, `HookManager`): These are simpler systems primarily focused on executing shell commands based on file-based configurations.
*   **Lifecycle Hooks** (`HooksManager`): A more comprehensive event-driven system for various application lifecycle events, supporting commands, scripts, and inline handlers.
*   **Advanced LLM/HTTP Hooks** (`HookRunner`, `AdvancedHookRunner`): These are the "Enterprise-grade" systems, capable of interacting with LLMs and external HTTP services, offering richer decision-making and input modification capabilities.
*   **Moltbot Session/Logging Hooks** (`MoltbotHooksManager` and its sub-managers): A specialized suite for managing session context, persistence, and detailed command logging.
*   **UI Input Hooks** (`useEnhancedInput`, `useInputHandler`, `useInputHistory`): React hooks dedicated to enhancing the user input experience in the chat interface.

## VII. Integration Points

The various hook systems in `src/hooks` integrate with the rest of the codebase at different levels:

*   **Command Execution**: Core agent logic and command handlers (e.g., `src/commands/client-dispatcher.ts`, `src/agent/codebuddy-agent.ts`) trigger events and interact with `HookManager`, `HooksManager`, `HookRunner`, and `AdvancedHookRunner` before/after tool use or bash commands.
*   **Configuration Hot Reloading**: `src/config/hot-reload/index.ts` uses `getHookManager().reloadHooks()` to update configurations dynamically.
*   **Agent Facades**: `src/agent/facades/infrastructure-facade.ts` uses `formatStatus()` from `HooksManager` to provide status summaries.
*   **UI Components**: `ui/components/ChatInterface.tsx` directly uses `useInputHandler` for managing user input.
*   **LLM Interaction**: `AdvancedHookRunner` and `HookRunner` (via `PromptHandler`/`AgentHandler`) directly import and use `CodeBuddyClient` (`src/codebuddy/client.ts`) for LLM evaluation.
*   **Session Management**: The main application entry point or session manager would interact with `MoltbotHooksManager` to `initializeSession` and `endSession`.
*   **Logging**: `CommandLogger` integrates with various parts of the application to log tool calls, bash commands, and file operations.
*   **Error Handling**: `getErrorMessage` (`src/errors/index.ts`) is used by `HookManager` and `useInputHandler` for consistent error reporting.
*   **History Management**: `useEnhancedInput` and `useInputHandler` interact with `getHistoryManager` (`src/utils/history-manager.ts`) for input history features.

The `src/hooks/index.ts` file serves as the public API for many of these components, re-exporting key classes, functions, and types for easier consumption throughout the application.