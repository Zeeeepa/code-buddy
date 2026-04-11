---
title: "test-scripts"
module: "test-scripts"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.812Z"
---
# test-scripts

The `test-scripts` module is a collection of Grok Script files (`.bs`) designed to demonstrate and validate the core features and built-in capabilities of the Grok Script language and its runtime environment. These scripts serve as executable examples, integration tests, and a reference for developers working with or extending the Grok Script interpreter.

## Purpose

The primary purposes of the `test-scripts` module are:

1.  **Feature Demonstration**: Showcase the syntax, semantics, and available built-in functions and modules of Grok Script.
2.  **Integration Testing**: Verify that the Grok Script runtime correctly implements various language constructs (loops, conditionals, functions) and integrates properly with system-level functionalities (file I/O, shell execution).
3.  **Developer Reference**: Provide clear, runnable examples for developers to understand how to use specific Grok Script features or to debug issues within the interpreter.

These scripts are self-contained and do not expose any APIs for other modules within the codebase. Instead, they act as consumers of the Grok Script runtime's public interface.

## Module Overview

The `test-scripts` module currently comprises three distinct Grok Script files, each focusing on different aspects of the language:

*   **`hello.bs`**: A basic "Hello World" script demonstrating fundamental language features.
*   **`fcs-style.bs`**: A comprehensive demo inspired by "FileCommander Script" features, covering a wide range of language constructs, built-in functions, and system interactions.
*   **`file-test.bs`**: A focused script specifically testing file system operations and Bash command execution.

## Key Scripts

### `hello.bs`

This script is the simplest entry point, designed to verify the most basic functionalities of the Grok Script interpreter.

**Demonstrates:**

*   Variable declaration (`let`).
*   Output to console (`console.log`).
*   Basic arithmetic operations (`+`).
*   Array literals and property access (`items.length`).
*   Object literals and property access (`config.name`).
*   Function definition and invocation.
*   Conditional statements (`if/else`).
*   C-style `for` loops.

**Purpose:** To serve as a quick sanity check that the Grok Script runtime can parse and execute fundamental language constructs.

### `fcs-style.bs`

This script provides a broad and detailed demonstration of many Grok Script features, including more advanced language constructs and interactions with the host system.

**Demonstrates:**

*   **Language Constructs:**
    *   `for...in` loops with `range()` and `keys()`.
    *   `while` loops.
    *   Ternary operator (`condition ? true_val : false_val`).
    *   Recursive function definitions.
*   **Built-in Functions:**
    *   `range(start, end, [step])`: Iterating over numerical sequences.
    *   `push(array, ...items)`: Adding elements to an array.
    *   `len(collection)`: Getting the length of arrays or strings.
    *   `keys(object)`: Retrieving an object's keys.
*   **String Operations:**
    *   String repetition (`"char" * count`).
*   **Array Operations:**
    *   Array modification via `push`.
*   **File Operations (via `file` module):**
    *   `file.write(path, content)`: Writing data to a file.
    *   `file.read(path)`: Reading content from a file.
    *   `file.list(directory)`: Listing contents of a directory.
    *   `file.delete(path)`: Deleting a file.
*   **Bash Integration (via `bash` module):**
    *   `bash.exec(command)`: Executing shell commands and capturing stdout.

**Purpose:** To provide a comprehensive showcase of Grok Script's capabilities, particularly those inspired by scripting languages used in file management tools, and to serve as a robust integration test for various built-in modules.

### `file-test.bs`

This script specifically focuses on testing the `file` and `bash` modules, ensuring robust interaction with the underlying operating system.

**Demonstrates:**

*   **File Operations (via `file` module):**
    *   `file.write`, `file.read`, `file.delete` (as in `fcs-style.bs`).
    *   `file.exists(path)`: Checking for file existence.
    *   `file.list` (as in `fcs-style.bs`).
*   **Bash Integration (via `bash` module):**
    *   `bash.exec(command)`: Executes a command and returns its standard output. This function is expected to throw an error if the command fails.
    *   `bash.run(command)`: Executes a command and returns an object containing `stdout`, `stderr`, and `code` (exit code), allowing for more granular error handling.

**Purpose:** To thoroughly test the reliability and functionality of file system interactions and external command execution, which are critical for many scripting tasks.

## Demonstrated Grok Script Features

The scripts in this module collectively exercise a wide array of Grok Script features, which can be broadly categorized:

### Language Constructs

*   **Variables:** `let` for declaration and assignment.
*   **Data Types:** Numbers, strings, booleans, arrays, objects.
*   **Operators:** Arithmetic (`+`, `*`), comparison (`>`, `<=`), logical (`? :` for ternary).
*   **Control Flow:**
    *   `if/else` statements.
    *   `for` loops (C-style and `for...in` with iterators).
    *   `while` loops.
*   **Functions:** Definition (`function name(args) { ... }`), invocation, recursion.

### Built-in Functions

*   `console.log(...)`: Outputting values to the standard output.
*   `range(start, end, [step])`: Generates a sequence of numbers for iteration.
*   `push(array, ...items)`: Modifies an array by appending elements.
*   `len(collection)`: Returns the length of an array or string.
*   `keys(object)`: Returns an array of an object's property names.
*   `JSON.stringify(value)`: Converts a Grok Script value to its JSON string representation (useful for debugging complex data structures).

### Standard Modules

*   **`file` Module:** Provides an API for interacting with the file system.
    *   `file.write(path, content)`
    *   `file.read(path)`
    *   `file.exists(path)`
    *   `file.list(directory)`
    *   `file.delete(path)`
*   **`bash` Module:** Enables execution of external shell commands.
    *   `bash.exec(command)`: For simple command execution where only stdout is needed and errors should halt execution.
    *   `bash.run(command)`: For more advanced scenarios requiring access to stdout, stderr, and the exit code.

## Relationship to the Grok Script Runtime

The `test-scripts` module is a **consumer** of the Grok Script runtime. It does not provide any internal APIs or functionality to other parts of the Grok Script project. Instead, these scripts are executed *by* the runtime to validate its behavior.

The "Call Graph & Execution Flows" data confirms this:
*   **Internal calls: None**
*   **Outgoing calls: None**
*   **Incoming calls: None**
*   **Execution flows: No execution flows detected for this module.**

This indicates that the scripts are standalone execution units. They interact with the Grok Script interpreter's built-in environment (e.g., `console`, `file`, `bash` objects) rather than calling into other *code modules* within the project's architecture.

## Contribution Guidelines

When contributing to the `test-scripts` module:

1.  **New Features**: If a new language feature, built-in function, or standard module is added to Grok Script, create a new `.bs` file or extend an existing one to demonstrate and test its functionality.
2.  **Clarity**: Scripts should be clear, well-commented, and focus on demonstrating specific features. Avoid overly complex logic unless it's specifically testing a complex interaction.
3.  **Isolation**: Where possible, new test cases should be isolated. For file operations, ensure proper cleanup (e.g., `file.delete`) to avoid leaving artifacts.
4.  **Naming**: Name new script files descriptively (e.g., `network-test.bs`, `json-parsing.bs`).
5.  **Output**: Use `console.log` liberally to provide clear output indicating what is being tested and the results. This is crucial for understanding script execution.