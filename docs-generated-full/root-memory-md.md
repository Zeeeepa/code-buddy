---
title: "Root — MEMORY.md"
module: "root-memory-md"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.237Z"
---
# Root — MEMORY.md

This document describes the `MEMORY.md` file, which serves as a persistent knowledge base and operational log for the `@phuetz/code-buddy` CLI agent. While not a traditional code module with executable functions, `MEMORY.md` is a critical component for the agent's understanding of the project context and its ongoing operations.

## `MEMORY.md` Overview

`MEMORY.md` is a markdown file designed to store essential project information and a chronological log of the `code-buddy` agent's interactions and observations. It acts as a form of long-term memory, providing the agent with a consistent and up-to-date understanding of the project's technical landscape and its own operational history.

### Purpose

The primary purpose of `MEMORY.md` is to:

1.  **Establish Project Context**: Provide fundamental details about the project, its identity, and core technical configurations.
2.  **Guide Agent Behavior**: Inform the AI agent about critical development practices (e.g., test runner, module system) to ensure its suggestions and actions are aligned with the project's setup.
3.  **Maintain Operational History**: Log significant events, responses, and tool usages by the agent, allowing for introspection and continuity across sessions.
4.  **Serve as a Reference**: Offer a human-readable summary of key project facts for developers.

### Structure and Content

The `MEMORY.md` file is structured into distinct sections:

#### 1. Project Identity

This section provides high-level information about the `code-buddy` project itself.

*   **Package**: `@phuetz/code-buddy` v0.4.0
*   **CLI binary**: `buddy` / `code-buddy`
*   **Description**: Terminal-based multi-provider AI coding agent.

#### 2. Key Facts

This section details crucial technical aspects of the project's development environment. These facts are vital for the AI agent to generate accurate and relevant code, tests, or refactorings.

*   **Test Runner**:
    *   **Tool**: Vitest (explicitly *not* Jest/ts-jest).
    *   **Execution**: `package.json` scripts use `vitest run`.
    *   **Configuration**: `vitest.setup.ts` shims `globalThis.jest` to `vi` for compatibility. `vitest.config.ts` defines `@` alias to `./src`, uses `happy-dom` environment, and sets coverage thresholds to 70%.
    *   **Test Locations**: Tests reside in `tests/` and alongside source files in `src/**/*.test.ts`.
*   **Module System**:
    *   **Type**: ESM project (`"type": "module"` in `package.json`).
    *   **Import Style**: Source imports use `.js` extension even for `.ts` files.
    *   **Path Resolution**: `__dirname` is unavailable in ESM; `import.meta.url` combined with `fileURLToPath` should be used for path resolution.

#### 3. `CLAUDE.md` Status

This section acts as a meta-instruction, indicating that `CLAUDE.md` is the primary and authoritative source of project guidance. Any information in `MEMORY.md` should either be derived from or consistent with `CLAUDE.md`, and duplication should be avoided.

#### 4. Extracted Facts (Operational Log)

This is a dynamic section where the `code-buddy` agent logs its interactions and observations. Each entry is timestamped (e.g., `Facts extracted 2026-03-07 (pre-compaction flush)`) and contains a brief description of the agent's activity or a summary of information it processed.

Common log entry types include:

*   **Test response**: Indicates the agent processed or generated a test-related output.
*   **Follow-up response**: Suggests a continuation of a previous interaction or a refined output.
*   **Using tool**: Records when the agent invoked an external tool or function.

The "pre-compaction flush" notation implies that these entries are raw, unsummarized facts, likely awaiting a future "compaction" or summarization process to reduce redundancy and distill key insights into a more concise form.

### Interaction and Maintenance

Developers should be aware of the following when interacting with or modifying the project:

*   **Authoritative Source**: For core project details and guidelines, always refer to `CLAUDE.md`. `MEMORY.md` is a derived or operational document.
*   **Updating Key Facts**: If fundamental project configurations (like the test runner or module system) change, these changes should first be reflected in `CLAUDE.md` and then updated in the "Key Facts" section of `MEMORY.md` to keep the agent's understanding current.
*   **Operational Log**: The "Extracted Facts" section is primarily managed by the `code-buddy` agent itself. Manual modification of this section is generally not recommended, as it represents the agent's internal state and history. Understanding its entries can provide insight into the agent's reasoning and actions.

### No Code Components

As `MEMORY.md` is a documentation and log file, it does not contain executable code, functions, or classes. Therefore, there are no internal calls, outgoing calls, incoming calls, or execution flows associated with this file in a programmatic sense. Its role is purely informational and contextual within the `code-buddy` system.