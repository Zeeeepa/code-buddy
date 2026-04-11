---
title: "tests — tools"
module: "tests-tools"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:28.046Z"
---
# tests — tools

This document provides an overview of the `tests/tools` module, which contains the unit and integration tests for the various tools available in the `src/tools` directory. Its primary purpose is to ensure the correctness, reliability, and security of these tools, which are critical components for the agent's interaction with the environment.

While this documentation focuses on the *tests*, it implicitly describes the expected behavior and functionality of the tools themselves.

## Module Purpose

The `tests/tools` module is dedicated to validating the functionality and robustness of the agent's toolset. Each test file corresponds to a specific tool or a set of related tool utilities, ensuring that:

1.  **Core functionality works as expected**: Tools perform their intended operations correctly.
2.  **Edge cases are handled gracefully**: Unexpected inputs or environmental conditions do not cause crashes or incorrect behavior.
3.  **Security measures are effective**: Dangerous commands or operations are blocked, especially for tools interacting with the operating system or sensitive data.
4.  **Integration with core services is sound**: Tools correctly interact with components like the Virtual File System (VFS), Confirmation Service, and Sandbox Manager.
5.  **Performance and resource management**: Streaming, timeouts, and session management are tested for efficiency and stability.

## General Testing Principles

The tests in this module employ several common strategies to achieve comprehensive coverage:

*   **Extensive Mocking**: Dependencies like the `UnifiedVfsRouter`, `child_process`, `ConfirmationService`, `SandboxManager`, and `SelfHealingEngine` are frequently mocked to isolate the tool logic and control test scenarios. This allows for testing specific outcomes without relying on external system states or actual resource consumption.
*   **Temporary Resources**: For tools that interact with the file system or Git repositories (`GitTool`, `LessonsTools`), tests often create and clean up temporary directories and files (`os.tmpdir()`, `fs.mkdtempSync`) to ensure isolation and prevent side effects on the host system.
*   **Platform-Specific Tests**: Recognizing differences between operating systems (e.g., `sleep` command availability, file paths), tests use `process.platform === 'win32' ? it.skip : it` to conditionally run or skip tests, ensuring compatibility and preventing failures on unsupported platforms.
*   **Security-Focused Testing**: Especially for `BashTool`, there's a strong emphasis on testing blocked commands, protected paths, environment variable filtering, and various command injection attempts to ensure the agent operates within a safe execution boundary.
*   **Streaming vs. Batch Execution**: Tools offering both streaming and batch execution modes (e.g., `BashTool`) have dedicated tests for each mode to verify correct behavior, output handling, and error propagation.
*   **Error Handling Validation**: Tests explicitly check for expected error messages and `success: false` results when operations fail due to invalid input, permissions, timeouts, or blocked actions.
*   **Structured Data Verification**: When tools return structured data (e.g., `GitTool.blame` returning an array of objects), tests validate the structure and content of this data.

## Overview of Tool Tests

The following sections detail the specific aspects covered by the tests for each tool.

### AudioTool Tests (`audio-tool.test.ts`)

These tests validate the `AudioTool`'s ability to interact with audio files via the Virtual File System (VFS).

*   **File System Interaction**: Mocks `UnifiedVfsRouter` to simulate file existence, reading, and directory listing.
*   **Audio Information Retrieval (`getInfo`)**:
    *   Handles cases where files do not exist or have unsupported formats.
    *   Extracts basic information (filename, format, size).
    *   Parses specific audio headers (e.g., WAV) to retrieve details like channels and sample rate.
*   **Base64 Encoding (`toBase64`)**: Verifies correct conversion of audio file content to base64 strings and identification of media types.
*   **Audio File Listing (`listAudioFiles`)**: Ensures only recognized audio files are listed from a directory.
*   **Format Identification (`isAudio`)**: Confirms the tool correctly identifies audio file extensions.

### BashTool Tests (`bash-tool.test.ts`, `bash-streaming.test.ts`, `bash.test.ts`)

The `BashTool` is one of the most critical and security-sensitive tools, reflected in its extensive test suite across multiple files.

*   **Basic Command Execution**: Verifies standard commands like `echo`, `ls`, `pwd`, `cat`, `head`, `wc` execute correctly and return expected output.
*   **Blocked Command Detection**: Comprehensive tests for a wide array of dangerous commands, including:
    *   File system manipulation (`rm -rf`, `chmod`, `chown`).
    *   Disk operations (`dd`, `mkfs`).
    *   System control (`sudo`, `reboot`, `shutdown`, `crontab`).
    *   Network utilities (`nc`/`netcat`).
    *   Exploits (`fork bomb`, `wget|sh`, `curl|bash`).
*   **Blocked Paths**: Ensures access to sensitive system and user configuration files/directories (e.g., `/etc/passwd`, `~/.ssh`) is prevented.
*   **Environment Variable Filtering**: Validates that only whitelisted environment variables (`PATH`, `HOME`, `CI`, `NO_COLOR`, `GIT_TERMINAL_PROMPT`) are passed to child processes, while sensitive ones (e.g., `GROK_API_KEY`) are filtered out.
*   **Streaming Execution (`executeStreaming`)**:
    *   Verifies line-by-line output streaming using generators.
    *   Tests error handling for blocked commands, failed commands, and timeouts in streaming mode.
*   **Timeout Handling**: Confirms that long-running commands are terminated within specified timeouts, returning appropriate error messages.
*   **Working Directory Management**: Tests the `cd` command's ability to change directories and that subsequent commands execute in the new working directory. Handles valid and invalid directory changes.
*   **Command Output Handling**: Checks for correct trimming of whitespace, handling of empty output, and inclusion of `stderr` in results.
*   **Error Handling**: Validates responses for command not found, permission denied, and non-zero exit codes.
*   **Security Edge Cases (Injection)**: Extensive tests against various command injection techniques, including:
    *   Command chaining (` ; `, ` && `, ` || `).
    *   Pipe to shell (`| sh`, `| bash`).
    *   Command substitution (`$()`, `` ` ``).
    *   Process substitution, here-strings.
    *   Control characters, ANSI escape sequences.
    *   Base64-decoded commands piped to shell.
    *   Execution of scripting languages (`python -c`, `perl -e`).
    *   Dangerous variable expansion and `eval`.
    *   Reverse shell patterns, `awk system()` calls.
*   **Self-Healing Integration**: Tests the `BashTool`'s interaction with the `SelfHealingEngine`, including toggling its state.
*   **Helper Methods**: Validates `listFiles`, `findFiles`, and `grep` functionality.
*   **Confirmation Service Integration**: Ensures commands are only executed when approved by the `ConfirmationService`.

### ComputerControlTool Browser Ref Handling Tests (`computer-control-browser-refs.test.ts`)

These tests focus on a specific security and usability aspect of the `ComputerControlTool`: preventing it from interacting with browser elements that lack valid screen coordinates.

*   **Browser-Sourced Element Detection**: Mocks `getSmartSnapshotManager` to return elements with `attributes.source === 'browser-accessibility'`.
*   **Zero-Coordinate Error**: Verifies that if a browser-sourced element has zero `x`, `y`, `width`, `height` bounds, the tool returns a descriptive error guiding the LLM to use the browser tool instead.
*   **Normal Element Handling**: Ensures that standard desktop elements, or browser elements with valid (non-zero) coordinates, are processed without this specific error.

### DiagramTool Tests (`diagram-tool.test.ts`)

These tests validate the `DiagramTool`'s ability to generate various diagrams using Mermaid syntax.

*   **Mermaid Generation (`generateFromMermaid`)**:
    *   Tests generation of ASCII diagrams.
    *   Verifies integration with the `mmdc` (Mermaid CLI) for SVG/PNG output, including version checks and handling `mmdc` failures or its absence (falling back to Mermaid code output).
    *   Mocks `UnifiedVfsRouter` for file operations and `child_process` for `mmdc` execution.
*   **Specific Diagram Types**: Tests dedicated methods for generating:
    *   Flowcharts (`generateFlowchart`).
    *   Sequence Diagrams (`generateSequenceDiagram`).
    *   Class Diagrams (`generateClassDiagram`).
    *   Pie Charts (`generatePieChart`).
    *   Gantt Charts (`generateGanttChart`).
*   **Diagram Listing (`listDiagrams`)**: Checks the ability to list previously generated diagram files, handling cases with no diagrams or non-existent directories.

### FirecrawlTool Tests (`firecrawl-tool.test.ts`)

These tests validate the integration with the Firecrawl API for web scraping and searching.

*   **API Key Check (`isFirecrawlEnabled`)**: Verifies that the tool is enabled only when `FIRECRAWL_API_KEY` is set in the environment.
*   **Web Search (`firecrawlSearch`)**:
    *   Mocks `globalThis.fetch` to simulate API responses.
    *   Tests successful search queries, formatted output, handling of empty results, and graceful handling of API errors (e.g., rate limits).
*   **Web Scraping (`firecrawlScrape`)**:
    *   Mocks `globalThis.fetch` for scrape responses.
    *   Tests successful scraping, returning markdown content, handling scrape failures, and truncating very long content to prevent excessive token usage.

### GitTool Tests (`git-tool.test.ts`)

The `GitTool` tests are robust integration tests that operate on a *real* temporary Git repository, providing high confidence in its functionality.

*   **Repository Management**: Tests `isGitRepo`, `getStatus`, `getLog`, `add`, `commit`.
*   **Blame Operations (`blame`)**:
    *   Retrieves blame information for committed files.
    *   Verifies structured blame data (line number, commit hash, author, date, content).
    *   Tests line range filtering (start/end lines).
    *   Tracks multiple authors across commits.
    *   Handles non-existent or uncommitted files gracefully.
*   **Cherry-Pick Operations (`cherryPick`)**:
    *   Tests successful cherry-picking of commits between branches.
    *   Verifies `--no-commit` flag behavior.
    *   Detects and reports merge conflicts, including listing conflicting files.
    *   Handles invalid commit hashes.
    *   Tests cherry-picking multiple sequential commits.
*   **Bisect Operations (`bisectStart`, `bisectStep`, `bisectReset`)**:
    *   Tests starting a bisect session with optional bad/good refs.
    *   Verifies marking commits as 'bad', 'good', or 'skip'.
    *   Simulates a full bisect workflow to find a "bad" commit.
    *   Tests resetting the bisect session.
    *   Handles bisect steps/resets when no session is active.
*   **GitOperationTool (Registry Adapter)**: Validates the schema, metadata, and input validation for all exposed Git operations, ensuring they conform to the tool registry's requirements.
*   **Edge Cases**: Includes tests for single-line files, exact line ranges, cherry-picking already applied commits, and special characters in blame output.

### Lessons Tools Tests (`lessons-tools.test.ts`)

These tests validate the tools for managing a knowledge base of "lessons" or insights. They use a real file system in a temporary directory, mocking `os.homedir` to ensure isolation.

*   **LessonsAddTool**:
    *   Validates schema and required `content` field.
    *   Tests successful addition of lessons, including the lesson ID in the output.
    *   Verifies handling of invalid categories and successful addition with valid categories (`PATTERN`, `RULE`, `CONTEXT`, `INSIGHT`).
*   **LessonsSearchTool**:
    *   Validates schema and required `query` field.
    *   Tests searching for existing lessons and reporting the count of found lessons.
    *   Handles cases where no lessons are found for a given query.
*   **LessonsListTool**:
    *   Validates schema.
    *   Tests listing all recorded lessons and handling cases where no lessons have been recorded.
*   **TaskVerifyTool**: (Implied by file name, but not detailed in snippet) Likely tests the ability to verify tasks against recorded lessons.

### Tool Hooks & Session Management Tests (`result-sanitizer.test.ts`, `session-lanes.test.ts`, `tool-hooks.test.ts`)

These tests cover the infrastructure for managing tool call lifecycles, output sanitization, and concurrent execution.

#### ResultSanitizer Tests

*   **Basic Sanitization**: Ensures tool outputs are cleaned by:
    *   Truncating excessively long outputs/errors.
    *   Stripping ANSI escape codes.
    *   Removing control characters (while preserving newlines and tabs).
*   **Provider-Specific Policies**: Validates that different LLM providers (e.g., OpenAI, Mistral, Anthropic, Gemini) have specific policies for:
    *   Maximum result sizes.
    *   Image dimensions.
    *   Tool call ID formatting (e.g., Mistral's alphanumeric ID requirement).
*   **Custom Sanitizers**: Tests the ability to apply additional, custom sanitization functions.
*   **Image Format Detection**: Correctly identifies image formats (PNG, JPEG) from base64 data.
*   **Size Calculation**: Accurately calculates original and final sizes of tool results.
*   **ToolUseResultPairing**: Validates the pairing of tool calls with their results, detecting orphaned results (results without a corresponding call) and synthesizing missing results (calls without a corresponding result).

#### SessionLanesManager Tests

*   **Basic Execution**: Verifies synchronous and asynchronous task execution within session lanes, including error handling and global lane execution.
*   **Serialized Execution**: Ensures tasks within the same session lane execute sequentially (FIFO with priority), while tasks in different sessions can run in parallel.
*   **Timeout Handling**: Confirms that tasks exceeding their configured timeout are correctly terminated.
*   **Cancellation**: Tests the ability to cancel individual tasks via `AbortSignal` and to cancel all pending tasks within a session.
*   **Wait Functionality**: Validates the `wait` method for polling a condition until it's met or a timeout occurs.
*   **Lane Management**: Tests the creation, destruction, and retrieval of information for session lanes, including tracking execution statistics (total executed, errors).
*   **Events**: Verifies that the manager emits lifecycle events such as `task:queued`, `task:completed`, `task:failed`, and `lane:created`.
*   **Singleton Pattern**: Ensures `getSessionLanesManager` consistently returns the same instance and `resetSessionLanesManager` correctly creates a new one.

#### ToolHooksManager Tests

*   **Hook Registration**: Tests the ability to register `before_tool_call`, `after_tool_call`, `tool_result_persist`, and `tool_error` hooks, including setting priorities, associating with plugins, and enabling/disabling them.
*   **Hook Execution Order**: Verifies that hooks are executed in the correct sequence based on their priority.
*   **Context and Result Modification**: Tests that `before` hooks can modify the tool call context (arguments) and `after` hooks can modify the tool result.
*   **Error Handling**: Ensures that errors within hooks are handled gracefully, and that subsequent hooks can still execute if configured to do so.
*   **Metrics and Events**: Validates that the manager tracks execution metrics for hooks and emits events for hook registration, execution, and errors.
*   **Singleton Pattern**: Confirms `getToolHooksManager` returns a single instance and `resetToolHooksManager` works as expected.

## Architecture Diagram

The `tests/tools` module primarily interacts with the `src/tools` modules, often relying on mocked or controlled versions of core dependencies to isolate and validate tool behavior.

```mermaid
graph TD
    subgraph "Test Modules (tests/tools)"
        A[audio-tool.test.ts]
        B[bash-tool.test.ts]
        C[computer-control.test.ts]
        D[diagram-tool.test.ts]
        E[firecrawl.test.ts]
        F[git-tool.test.ts]
        G[lessons-tools.test.ts]
        H[tool-hooks.test.ts]
        I[result-sanitizer.test.ts]
        J[session-lanes.test.ts]
    end

    subgraph "Production Modules (src/tools)"
        TA[AudioTool]
        TB[BashTool]
        TC[ComputerControlTool]
        TD[DiagramTool]
        TE[Firecrawl functions]
        TF[GitTool]
        TG[Lessons Tools]
        TH[ToolHooksManager]
        TI[ResultSanitizer]
        TJ[SessionLanesManager]
    end

    subgraph "Key Dependencies (Mocked/Controlled)"
        M1[Virtual File System (VFS)]
        M2[Child Process Execution]
        M3[Security Sandbox]
        M4[Confirmation Service]
        M5[Temporary File System]
        M6[External APIs (e.g., Firecrawl)]
        M7[Desktop Automation]
    end

    A --> TA
    B --> TB
    C --> TC
    D --> TD
    E --> TE
    F --> TF
    G --> TG
    H --> TH
    I --> TI
    J --> TJ

    A,D -- uses --> M1
    B,D -- uses --> M2
    B -- uses --> M3, M4
    C -- uses --> M7
    E -- uses --> M6
    F,G -- uses --> M5
```

## Contributing to Tool Tests

When contributing to the `src/tools` directory, developers should:

*   **Write comprehensive tests**: Ensure new features, bug fixes, and edge cases are covered.
*   **Follow existing patterns**: Utilize mocking, temporary resources, and platform-specific skips as demonstrated in existing tests.
*   **Prioritize security**: For tools interacting with the system, always consider potential vulnerabilities and write tests to prevent them.
*   **Validate input and output**: Ensure tools handle invalid inputs gracefully and produce outputs in the expected format.
*   **Consider performance**: For streaming or long-running operations, ensure timeouts and resource management are tested.