---
title: "Root — commitlint.config.js"
module: "root-commitlint-config-js"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.203Z"
---
# Root — commitlint.config.js

This document provides a comprehensive overview of the `commitlint.config.js` module, which defines the rules for commit message linting within the project.

## `commitlint.config.js`

This file serves as the central configuration for `commitlint`, a tool that helps your team adhere to a consistent commit message convention. By enforcing a structured format, it improves the readability of the Git history, facilitates automated changelog generation, and enables better understanding of changes at a glance.

### Purpose

The primary purpose of `commitlint.config.js` is to:
*   **Enforce Conventional Commits:** Ensure all commit messages follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/).
*   **Maintain Codebase Hygiene:** Promote a clean and understandable Git history, making it easier to track changes, revert commits, and generate release notes.
*   **Standardize Communication:** Provide a common language for describing changes across the development team.

### How it Works

`commitlint.config.js` is a Node.js module that exports an object containing configuration options for the `commitlint` CLI tool. When a developer attempts to commit changes, a Git hook (typically managed by `husky`) invokes `commitlint`. `commitlint` then reads this configuration file to determine the rules against which the commit message should be validated. If the commit message violates any of the defined rules, the commit operation is aborted, and an error message is displayed.

```mermaid
graph TD
    A[Developer Commits Code] --> B{Git Hook (e.g., Husky)};
    B --> C[commitlint CLI];
    C --> D[commitlint.config.js];
    D -- Defines Rules --> C;
    C -- Validates Commit Message --> B;
    B -- Success/Failure --> A;
```

### Key Configuration Details

The `commitlint.config.js` file extends a base configuration and then customizes specific rules.

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only changes
        'style',    // Code style changes (formatting, etc)
        'refactor', // Code refactoring
        'perf',     // Performance improvements
        'test',     // Adding or updating tests
        'chore',    // Maintenance tasks
        'ci',       // CI/CD changes
        'build',    // Build system changes
        'revert',   // Revert a previous commit
      ],
    ],
    'subject-case': [0], // Allow any case for subject
    'subject-max-length': [2, 'always', 100],
  },
};
```

#### `extends: ['@commitlint/config-conventional']`

This line is crucial. It tells `commitlint` to inherit the rules defined by the `@commitlint/config-conventional` package. This package provides a robust baseline for the Conventional Commits specification, including rules for `type`, `scope`, `subject`, `body`, and `footer`. By extending this, we leverage a well-established standard and only need to override or add specific rules.

#### `rules` Object

This object defines or overrides specific linting rules. Each rule is an array with the following structure: `[level, applicable, value]`.

*   **`level`**:
    *   `0`: Disable the rule.
    *   `1`: Treat as a warning.
    *   `2`: Treat as an error (will prevent the commit).
*   **`applicable`**:
    *   `'always'`: Rule must always be met.
    *   `'never'`: Rule must never be met.
*   **`value`**: The specific value or configuration for the rule (e.g., an array of allowed types, a maximum length).

Let's break down the configured rules:

1.  **`type-enum`**:
    *   `[2, 'always', [...]]`
    *   **Purpose**: Enforces that the `type` part of the commit message (e.g., `feat:`, `fix:`) must be one of the explicitly listed values.
    *   **Configuration**:
        *   `2`: This is an error-level rule; an invalid type will prevent the commit.
        *   `'always'`: The type must always be one of the allowed values.
        *   **Allowed Types**:
            *   `feat`: A new feature.
            *   `fix`: A bug fix.
            *   `docs`: Documentation only changes.
            *   `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
            *   `refactor`: A code change that neither fixes a bug nor adds a feature.
            *   `perf`: A code change that improves performance.
            *   `test`: Adding missing tests or correcting existing tests.
            *   `chore`: Other changes that don't modify src or test files (e.g., build process, auxiliary tools, libraries).
            *   `ci`: Changes to our CI configuration files and scripts (e.g., GitHub Actions, Jenkins).
            *   `build`: Changes that affect the build system or external dependencies (e.g., gulp, broccoli, npm).
            *   `revert`: Reverts a previous commit.

2.  **`subject-case`**:
    *   `[0]`
    *   **Purpose**: Controls the casing of the commit subject line.
    *   **Configuration**:
        *   `0`: This rule is explicitly disabled. This means developers are free to use any casing for the subject line (e.g., sentence-case, start-case, lower-case). The conventional config typically enforces `sentence-case` or `start-case`, so this is an intentional override.

3.  **`subject-max-length`**:
    *   `[2, 'always', 100]`
    *   **Purpose**: Limits the maximum length of the commit subject line.
    *   **Configuration**:
        *   `2`: This is an error-level rule; a subject exceeding the limit will prevent the commit.
        *   `'always'`: The subject must always adhere to the length limit.
        *   `100`: The maximum allowed length for the subject line is 100 characters. This helps keep commit messages concise and readable, especially in tools that truncate long lines.

### Contributing and Modifying

Developers needing to adjust the commit message rules should modify `commitlint.config.js`.

*   **Adding a new commit type**: To introduce a new valid `type` (e.g., `security`), add it to the `type-enum` array.
*   **Changing a rule's severity**: Adjust the `level` (0, 1, or 2) for any rule to disable it, make it a warning, or make it an error.
*   **Overriding other rules**: Consult the `@commitlint/config-conventional` documentation or the `commitlint` documentation for a full list of available rules that can be overridden or added. For example, you might want to enforce `subject-full-stop` or `body-leading-blank`.

After any changes, ensure to test them by attempting a commit that would either pass or fail based on your modifications.