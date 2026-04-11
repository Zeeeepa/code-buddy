---
title: "Root — AGENTS.md"
module: "root-agents-md"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.189Z"
---
# Root — AGENTS.md

This document, `AGENTS.md`, serves as the foundational guide for developers contributing to the `grok-cli` project. Unlike a typical code module, it does not contain executable code but rather defines the project's development standards, workflow, and the prescribed usage of the GitNexus code intelligence platform.

Its primary purpose is to ensure consistency, maintainability, and safe development practices across the codebase by providing clear instructions on environment setup, coding style, testing, contribution workflow, and leveraging advanced code analysis tools.

## Project Development Guidelines

This section outlines the essential practices and conventions for developing within the `grok-cli` repository. Adhering to these guidelines is crucial for maintaining code quality and project health.

### Environment and Setup

*   **Runtime**: Node.js version 18 or higher is required.
*   **Installation**:
    1.  Run `npm install` to install dependencies.
    2.  Copy `.env.example` to `.env` and configure the necessary environment variables.
*   **Package Manager**: Use `npm` as the default package manager to prevent lockfile conflicts. `bun` is an optional alternative but should not be mixed with `npm` on the same branch.

### Project Structure

The repository follows a standard structure to organize different types of files:

*   `src/`: Contains the main TypeScript source code. The CLI entry point is `src/index.ts`.
*   `tests/`: Houses Vitest test suites (`*.test.ts`, `*.spec.ts`) for feature and integration testing.
*   `scripts/`, `benchmarks/`: Utility scripts and performance testing assets.
*   `docs/`, `examples/`, `assets/`: Documentation, sample configurations, and diagrams.
*   `dist/`, `coverage/`: Generated output directories; these should never be manually edited.
*   `vscode-extension/`, `extensions/vscode/`: Code specific to the VS Code extension.

### Build, Test, and Development Commands

A set of `npm` scripts are provided to streamline common development tasks:

*   **Development**:
    *   `npm run dev` or `npm run dev:node`: Runs the CLI directly from source.
*   **Build & Run**:
    *   `npm run build`: Compiles the TypeScript source to JavaScript.
    *   `npm start`: Executes the compiled `dist/index.js`.
*   **Testing**:
    *   `npm test`: Runs all test suites.
    *   `npm run test:watch`: Runs tests in watch mode.
    *   `npm run test:coverage`: Runs tests and generates a coverage report.
*   **Quality Gates**:
    *   `npm run lint`: Runs ESLint checks.
    *   `npm run lint:fix`: Runs ESLint and attempts to fix issues automatically.
    *   `npm run typecheck`: Performs TypeScript type checking.
    *   `npm run validate`: Comprehensive check combining linting, type checking, and all tests.

### Coding Style and Naming Conventions

*   **Formatting**: Prettier is configured for single quotes, semicolons, 2-space indentation, and a 100-character line width.
*   **File Encoding**: `.editorconfig` enforces LF line endings and UTF-8 encoding.
*   **Linting**: ESLint with `@typescript-eslint` is mandatory. Avoid `any` types; prefer explicit type definitions.
*   **Naming**:
    *   Files: `kebab-case` (e.g., `tool-orchestrator.ts`).
    *   Functions/Variables: `camelCase`.
    *   Types/Classes: `PascalCase`.
    *   Constants: `UPPER_SNAKE_CASE`.

### Testing Guidelines

*   **Framework**: Vitest is used with the `happy-dom` test environment.
*   **File Patterns**: Tests are located in `tests/**/*.{test,spec}.{ts,tsx}` and `src/**/*.{test,spec}.{ts,tsx}`.
*   **Coverage**: A minimum of 70% coverage is enforced for lines, functions, branches, and statements.
*   **Determinism**: Tests must be deterministic. Mock external dependencies like APIs, filesystem, and network interactions.
*   **Scope**:
    *   Small fix: `npm test -- <pattern>`
    *   Module refactor: `npm test && npm run typecheck`
    *   Broad change: `npm run validate`

### Contribution Workflow

1.  **Branching**: Create a new branch following conventional naming (e.g., `feat/new-feature`, `fix/bug-fix`, `docs/update-readme`).
2.  **Implementation**: Implement changes, ensuring focused tests are written.
3.  **Validation**: Run `npm run validate` to ensure all quality checks pass.
4.  **Commit**: Commit changes using Conventional Commits.
5.  **Pull Request**: Open a Pull Request, linking to relevant issues and providing evidence of validation.

### Commit and Pull Request Guidelines

*   **Commits**: Must adhere to Conventional Commits (e.g., `feat`, `fix`, `docs`, `test`, `refactor`, `chore`). This is enforced by Husky and commitlint.
    *   Subject lines are limited to 100 characters.
    *   Examples: `feat(agent): add retry policy for tool execution`, `fix(security): harden path validation`.
*   **Hooks**:
    *   `pre-commit`: Runs `lint-staged`.
    *   `pre-push`: Runs `npm run test:coverage` and `npm audit --audit-level=moderate`.
*   **Pull Requests**: Should include a summary of the problem and solution, links to related issues, test evidence, and updates to documentation for any behavior changes.

### Security and Configuration

*   **Secrets**: Never commit sensitive information. Store credentials exclusively in `.env` files.
*   **Configuration**: Update `.env.example` whenever new required environment variables are introduced.

## GitNexus Code Intelligence Guide

This section details the mandatory use of GitNexus, a code intelligence platform, for understanding, navigating, and safely modifying the `grok-cli` codebase. GitNexus provides advanced capabilities beyond traditional text search, leveraging a comprehensive graph of symbols and execution flows.

### What is GitNexus?

GitNexus indexes the `grok-cli` project (referred to as `grok-cli` within GitNexus) to create a detailed map of its symbols, relationships, and execution flows. This allows developers to perform sophisticated queries, analyze impact, and refactor code with a higher degree of confidence.

### Core Principles for Using GitNexus

**Always Do:**

*   **Impact Analysis**: Before modifying any function, class, or method, you **MUST** run `gitnexus_impact({target: "symbolName", direction: "upstream"})`. Report the blast radius (direct callers, affected processes, risk level) to the user.
*   **Change Detection**: Before committing, you **MUST** run `gitnexus_detect_changes()` to verify that your modifications only affect the expected symbols and execution flows.
*   **Risk Warnings**: If impact analysis returns a `HIGH` or `CRITICAL` risk, you **MUST** warn the user before proceeding with edits.
*   **Code Exploration**: Use `gitnexus_query({query: "concept"})` to find relevant execution flows, which are grouped by process and ranked by relevance.
*   **Symbol Context**: For a complete view of a symbol (callers, callees, process participation), use `gitnexus_context({name: "symbolName"})`.

**Never Do:**

*   **Unanalyzed Edits**: **NEVER** edit a function, class, or method without first running `gitnexus_impact` on it.
*   **Ignoring Risk**: **NEVER** ignore `HIGH` or `CRITICAL` risk warnings from impact analysis.
*   **Unsafe Renames**: **NEVER** rename symbols using simple find-and-replace. Always use `gitnexus_rename` which understands the call graph.
*   **Unchecked Commits**: **NEVER** commit changes without running `gitnexus_detect_changes()` to verify the affected scope.

### Key Use Cases

#### When Debugging

1.  **Identify Flows**: `gitnexus_query({query: "<error or symptom>"})` to find execution flows related to the issue.
2.  **Contextualize Suspects**: `gitnexus_context({name: "<suspect function>"})` to see all callers, callees, and process participation.
3.  **Trace Execution**: `READ gitnexus://repo/grok-cli/process/{processName}` to trace the full execution flow step by step.
4.  **Regression Check**: For regressions, `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` to identify changes introduced by your branch.

#### When Refactoring

*   **Renaming**:
    1.  First, run `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` to preview changes.
    2.  Review the preview (graph edits are safe, text_search edits require manual review).
    3.  Then, run with `dry_run: false` to apply the rename.
*   **Extracting/Splitting**:
    1.  Run `gitnexus_context({name: "target"})` to identify all incoming and outgoing references.
    2.  Run `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
*   **Post-Refactor Verification**: After any refactor, run `gitnexus_detect_changes({scope: "all"})` to confirm only expected files were changed.

### GitNexus Tools Quick Reference

| Tool | When to use | Command Example |
| :----------------- | :-------------------------------- | :------------------------------------------ |
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

### Impact Risk Levels

GitNexus impact analysis provides risk levels to guide your actions:

| Depth | Meaning | Action |
| :---- | :-------------------------------- | :-------------------- |
| d=1 | **WILL BREAK** — direct callers/importers | **MUST** update these |
| d=2 | **LIKELY AFFECTED** — indirect dependencies | Should test |
| d=3 | **MAY NEED TESTING** — transitive dependencies | Test if critical path |

### Resources

| Resource | Use for |
| :---------------------------------- | :------------------------------------ |
| `gitnexus://repo/grok-cli/context` | Codebase overview, index freshness check |
| `gitnexus://repo/grok-cli/clusters` | All functional areas |
| `gitnexus://repo/grok-cli/processes` | All execution flows |
| `gitnexus://repo/grok-cli/process/{name}` | Step-by-step execution trace |

### Self-Check Before Finishing

Before completing any code modification task, verify the following:

1.  `gitnexus_impact` was run for all modified symbols.
2.  No `HIGH` or `CRITICAL` risk warnings were ignored.
3.  `gitnexus_detect_changes()` confirms that changes match the expected scope.
4.  All d=1 (WILL BREAK) dependents were updated.

### Keeping the GitNexus Index Fresh

The GitNexus index becomes stale after code changes. To update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

> **Note**: Running `analyze` without `--embeddings` will delete any previously generated embeddings. Check `.gitnexus/meta.json` for `stats.embeddings` to see if embeddings exist.

### Relationship to the Codebase

`AGENTS.md` is a meta-document that defines the operational framework for developing the `grok-cli` codebase. It does not contain any executable code, nor does it participate in any direct call graphs or execution flows within the project. Instead, it dictates the processes, tools, and standards that *govern* the creation, modification, and maintenance of the actual source code. It is a critical resource for any developer looking to contribute effectively and safely to the `grok-cli` project.