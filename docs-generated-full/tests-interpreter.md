---
title: "tests — interpreter"
module: "tests-interpreter"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.920Z"
---
# tests — interpreter

This document provides an overview of the `tests/interpreter/computer-skills-security.test.ts` module, which is dedicated to ensuring the security and integrity of the `ComputerSkills` interpreter.

## `tests/interpreter/computer-skills-security.test.ts`

### 1. Purpose

This module contains a suite of security regression tests for the `ComputerSkills` interpreter. Its primary objective is to verify that all forms of dynamic code execution and templating within skills operate within a secure, sandboxed environment. This prevents unauthorized access to system resources, execution of arbitrary code, and other potential vulnerabilities that could arise from processing untrusted or malicious skill definitions.

### 2. Context: The `ComputerSkills` Interpreter

The `ComputerSkills` class (located in `src/interpreter/computer/skills.ts`) is a core component responsible for defining, registering, and executing various "skills." These skills can encapsulate complex logic, often involving steps that require dynamic evaluation:

*   **`code` steps**: Execute arbitrary JavaScript code.
*   **`condition` steps**: Evaluate JavaScript expressions for conditional branching.
*   **`shell` steps**: Execute shell commands, often with interpolated variables.
*   **Template Interpolation**: Dynamic values (e.g., `{{params.name}}`) are injected into strings across various step types.

Given the potential for executing user-defined or dynamically generated content, robust security measures are paramount to prevent privilege escalation, data exfiltration, or system compromise.

### 3. Key Security Principles Validated

The tests in this module enforce the following critical security principles:

*   **No Unsafe Primitives in Core Implementation**: The `ComputerSkills` core itself should avoid direct use of inherently unsafe JavaScript primitives like `new Function()` or `eval()`, which can bypass static analysis and introduce vulnerabilities if not meticulously controlled.
*   **Strict Sandboxing for Code Execution**: Any JavaScript code executed within `code` or `condition` steps must run in an isolated context. This context must be devoid of access to Node.js globals (e.g., `process`, `require`, `fs`, `global`).
*   **Restricted Module Loading**: Dynamic module loading via `require()` must be explicitly blocked within skill execution contexts to prevent arbitrary file system access or loading of malicious external modules.
*   **Safe Template Interpolation**: Variables interpolated into templates must be handled securely, preventing code injection or cross-site scripting (XSS)-like vulnerabilities.

### 4. Test Structure and Setup

The tests are organized within a `describe('ComputerSkills Security', ...)` block.

*   **`beforeEach` Hook**: Before each individual test, a fresh instance of `ComputerSkills` is created:
    ```typescript
    skills = new ComputerSkills({ enableBuiltin: false, cacheEnabled: false });
    ```
    This setup ensures a clean, isolated environment for every test, preventing side effects from previous tests and focusing solely on the security aspects of the registered skills. `enableBuiltin: false` ensures no default skills are loaded, and `cacheEnabled: false` prevents any caching mechanisms from interfering with the test's direct interaction with the interpreter.

### 5. Detailed Test Cases

The module includes several specific test cases, each targeting a particular security concern:

#### 5.1. Core Module Source Code Safety Checks

These tests directly inspect the source code of `src/interpreter/computer/skills.ts` to ensure that certain unsafe constructs are not present in the core implementation. This acts as a preventative measure against accidental introduction of vulnerabilities.

*   **`it('should not have new Function() in skills.ts source')`**:
    *   **Purpose**: Verifies that the `skills.ts` source code does not directly use `new Function()`. This primitive allows for dynamic code creation and execution, which, if not carefully managed within a sandbox, can be a significant security risk. Its absence in the core indicates that dynamic evaluation is handled by a more controlled, dedicated mechanism.
    *   **Mechanism**: Reads the `skills.ts` file, filters out comments and import statements, and asserts that the `new Function` pattern is not found in the remaining code lines.

*   **`it('should not have eval() in skills.ts source')`**:
    *   **Purpose**: Similar to the `new Function()` check, this test ensures that the `eval()` function is not used in the core `skills.ts` implementation. `eval()` is another powerful primitive for dynamic code execution that can easily lead to vulnerabilities if misused.
    *   **Mechanism**: Reads the `skills.ts` file, filters out comments and import statements, and asserts that the `eval()` pattern is not found.

#### 5.2. Sandboxed Execution for `code` Steps

These tests validate the runtime sandboxing of JavaScript code executed within skill `code` steps.

*   **`it('should execute code steps in sandboxed context')`**:
    *   **Purpose**: This is a baseline test to confirm that simple, legitimate JavaScript code can be executed successfully within a `code` step, demonstrating that the sandbox allows intended operations while restricting unsafe ones.
    *   **Mechanism**: Registers a skill with a `code` step containing `content: 'return 1 + 2'`. It then runs the skill and asserts that `result.success` is `true` and `result.output` is `3`.

*   **`it('should block process access in code steps')`**:
    *   **Purpose**: This is a critical test that verifies JavaScript code executed in a `code` step cannot access the Node.js `process` global object. Access to `process` would allow interaction with the operating system environment, environment variables, and other sensitive system information.
    *   **Mechanism**: Registers a skill with a `code` step containing `content: 'return process.env'`. It then runs the skill and asserts that `result.success` is `false` and `result.error` is defined, indicating that the attempt to access `process` was blocked.

*   **`it('should block require in code steps')`**:
    *   **Purpose**: This test ensures that the `require()` function, which allows dynamic module loading in Node.js, is unavailable within the sandboxed execution context. Blocking `require()` is essential to prevent arbitrary file system access (e.g., reading `/etc/passwd`) or loading of malicious external modules.
    *   **Mechanism**: Registers a skill with a `code` step containing `content: 'const fs = require("fs"); return fs.readFileSync("/etc/passwd", "utf-8")'`. It then runs the skill and asserts that `result.success` is `false` and `result.error` is defined.

#### 5.3. Safe Handling of `condition` Steps

*   **`it('should handle condition steps safely')`**:
    *   **Purpose**: Verifies that expressions used in `condition` steps are also evaluated within a secure, sandboxed environment. This ensures that conditional logic cannot be exploited for code injection or unauthorized access, similar to `code` steps.
    *   **Mechanism**: Registers a skill with a `condition` step `condition: 'params.value > 10'`. It runs the skill with `value: 15` and asserts that `result.success` is `true` and `result.output` is `true`. While this specific test doesn't explicitly *prove* sandboxing, it confirms the functionality and implies that the same underlying secure evaluation mechanism is used.

#### 5.4. Safe Handling of Template Interpolation

*   **`it('should handle template interpolation safely')`**:
    *   **Purpose**: Ensures that values interpolated into templates (e.g., `{{params.name}}`) are handled securely and do not allow for code injection or other vulnerabilities. This is crucial for steps like `shell` commands where interpolated values could otherwise lead to command injection.
    *   **Mechanism**: Registers a skill with a `shell` step `content: 'echo "Hello {{params.name}}"'`. The test primarily verifies that the skill can be registered successfully, implying that the underlying templating engine is designed to safely handle and escape interpolated values.

### 6. Relationship to the Codebase

This test module serves as a critical quality gate for the `ComputerSkills` class (`src/interpreter/computer/skills.ts`). It directly interacts with `ComputerSkills` by registering and running skills, then asserting the expected secure behavior. Any changes or additions to the `ComputerSkills` implementation, its underlying JavaScript execution engine, or its templating mechanisms must pass these tests to ensure that no security regressions are introduced. It provides confidence that the interpreter remains robust against common code injection and privilege escalation attempts.