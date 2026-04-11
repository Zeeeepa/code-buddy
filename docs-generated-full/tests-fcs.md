---
title: "tests — fcs"
module: "tests-fcs"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.895Z"
---
# tests — fcs

This document provides an overview of the `tests/fcs` module, which is dedicated to verifying the functionality and compatibility of the FileCommander Script (FCS) interpreter and its integrated bindings.

## Module Overview

The `tests/fcs` module contains comprehensive test suites for the FileCommander Script (FCS) runtime. Its primary goals are:

1.  **FCS Language Compatibility**: Ensure the interpreter correctly tokenizes, parses, and executes core FCS language constructs, maintaining fidelity with the original FileCommander Script syntax and semantics.
2.  **Grok-CLI Bindings Validation**: Verify the correct integration and behavior of various namespaces and functions exposed to FCS scripts, which provide access to Grok-CLI functionalities like AI interaction, file system operations, Git, and agent execution.

These tests are crucial for maintaining the stability and correctness of the FCS interpreter and its interaction with the broader Grok-CLI ecosystem.

## FCS Compatibility Tests (`fcs-compatibility.test.ts`)

This test file focuses on the core language features of FileCommander Script, ensuring that the lexer, parser, and runtime behave as expected and are fully compatible.

### Purpose

To guarantee that the FCS interpreter accurately processes and executes scripts written in the FileCommander Script language, covering fundamental syntax, control flow, and built-in operations.

### Key Test Areas

The tests are organized into several `describe` blocks, each targeting a specific aspect of the FCS interpreter:

#### Lexer
Tests the `parseFCS` function's tokenization phase. It verifies that various language elements are correctly identified and categorized into tokens.

*   **Basic Expressions**: Ensures correct tokenization of keywords (`let`), identifiers, operators (`=`, `+`), and numbers.
*   **Strings with Interpolation**: Validates the handling of string literals, including embedded expressions (`${name}`).
*   **Pipeline Operator**: Confirms recognition of the `|>` operator.
*   **Decorators**: Checks for correct tokenization of `@` prefixed decorators.

#### Parser
Tests the `parseFCS` function's parsing phase, verifying that the Abstract Syntax Tree (AST) is correctly constructed from the token stream.

*   **Variable Declarations**: Parses `let x = 10`.
*   **Function Declarations**: Handles `func greet(name) { ... }` syntax.
*   **For-in Loops**: Parses `for x in items { ... }` constructs.
*   **If Statements**: Verifies parsing of `if x > 10 { ... }` without requiring parentheses around the condition.
*   **Class Declarations**: Parses `class Person { ... }` syntax.

#### Runtime
Tests the `executeFCS` function, which runs the parsed AST and verifies the output and side effects.

*   **Basic Statements**: `print`, variable assignment, arithmetic (`+`, `**`).
*   **Function Calls**: Defines and calls user-defined functions, including nested functions.
*   **Control Flow**: `for` loops with `range`, `if-else` statements.
*   **Built-in Operations**: String manipulation (`upper`, `lower`, `trim`), array operations (`len`, `push`), and math constants (`PI`, `E`).
*   **Error Handling**: `try-catch` blocks.

#### FileCommander Script Compatibility
Specifically targets features that are characteristic of the original FileCommander Script, ensuring full compatibility.

*   **`func` Keyword**: Confirms support for `func` for function declarations (as opposed to `function`).
*   **`for-in` with `range`**: Validates the common FCS pattern for iteration.
*   **Dictionary Literals**: Tests object/dictionary creation using `{ key: value }` syntax.
*   **String Multiplication**: Verifies `print("x" * 3)` behavior, which is common in FCS.

### Execution Flow

The tests primarily use two functions from `../../src/scripting/index.js`:
*   `parseFCS(script: string)`: Returns an object containing `tokens` and the `ast`. Used for Lexer and Parser tests.
*   `executeFCS(script: string)`: Executes the script and returns a `Promise` resolving to an object with `success` (boolean) and `output` (array of strings). Used for Runtime and Compatibility tests.

## Grok-CLI Bindings Tests (`grok-bindings.test.ts`)

This test file validates the integration of FCS with Grok-CLI specific functionalities, which are exposed to FCS scripts through various global namespaces.

### Purpose

To ensure that FCS scripts can correctly interact with Grok-CLI's AI capabilities, file system tools, context management, Git operations, agent execution, and other internal services. It also verifies the `dryRun` mode.

### Key Test Areas

The tests are structured by the global namespaces available within the FCS runtime environment:

#### `grok` Namespace
Tests functions related to AI interaction.
*   `grok.ask()`: Verifies that it returns a mock response when no AI client is configured.
*   `grok.chat()`: Checks conversation history management.
*   `grok.history()`: Retrieves conversation history.
*   `grok.clearHistory()`: Clears the conversation history.

#### `tool` Namespace
Tests file system and utility operations. These tests create and clean up temporary directories and files using Node.js `fs` and `path` modules.
*   `tool.read(filename)`: Reads file content.
*   `tool.write(filename, content)`: Creates or overwrites a file.
*   `tool.edit(filename, search, replace)`: Modifies content within a file.
*   `tool.ls(directory)`: Lists directory contents.
*   `tool.stat(path)`: Retrieves file/directory information (size, `isDir`).

#### `context` Namespace
Tests functionalities related to managing the current working context (e.g., files relevant to an AI task).
*   `context.add(pattern)`: Adds files matching a pattern to the context.
*   `context.list()`: Lists files currently in the context.
*   `context.size()`: Returns the number of files in the context.
*   `context.clear()`: Clears all files from the context.

#### `git` Namespace
Tests Git-related operations.
*   `git.status()`: Retrieves Git repository status.
*   `git.branch()`: Gets the current Git branch name.
*   `git.log(count)`: Fetches recent commit logs.
*   `git.commit(message)`: Tested specifically with `dryRun` to ensure no actual commit occurs.

#### `agent` Namespace
Tests the execution of Grok-CLI agents.
*   `agent.run(task)`: Initiates an agent task.

#### `mcp` Namespace
Tests Multi-Client Protocol (MCP) interactions.
*   `mcp.servers()`: Lists available MCP servers (returns empty without a manager).
*   `mcp.call(server, method, args)`: Simulates an MCP call (returns mock without a manager).

#### `session` Namespace
Tests session management.
*   `session.list()`: Lists active sessions.

#### Dry-Run Mode
Verifies that sensitive operations (like file writes or Git commits) are prevented when `executeFCS` is called with the `dryRun: true` option.
*   `tool.write()`: Confirms no file is created.
*   `git.commit()`: Confirms no actual commit is performed.

### Execution Flow

These tests also primarily use `executeFCS(script: string, options?: { workdir?: string, dryRun?: boolean })`.
*   The `workdir` option is used to specify a temporary directory for file system operations, ensuring tests are isolated and don't affect the actual file system.
*   The `dryRun` option is critical for testing the dry-run behavior of various bindings.

## Module Dependencies

The `tests/fcs` module relies on the following internal and external dependencies:

```mermaid
graph TD
    subgraph Tests
        A[fcs-compatibility.test.ts]
        B[grok-bindings.test.ts]
    end

    subgraph Core Scripting
        C[src/scripting/index.js]
    end

    subgraph Node.js Built-ins
        D[fs]
        E[path]
    end

    A --> C: parseFCS, executeFCS
    B --> C: executeFCS
    B --> D
    B --> E
```

*   `../../src/scripting/index.js`: Provides the core `parseFCS` and `executeFCS` functions that are central to running FCS scripts.
*   `fs` (Node.js built-in): Used in `grok-bindings.test.ts` for creating and managing temporary files and directories for file system binding tests.
*   `path` (Node.js built-in): Used in `grok-bindings.test.ts` for path manipulation, especially when dealing with temporary test files.