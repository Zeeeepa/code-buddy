---
title: "Root — typedoc.json"
module: "root-typedoc-json"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.298Z"
---
# Root — typedoc.json

The `typedoc.json` file serves as the central configuration for TypeDoc, a documentation generator that creates API documentation from TypeScript source code. This module defines how TypeDoc processes the project's codebase, what content it includes or excludes, and how the final documentation is structured and presented.

Unlike executable code modules, `typedoc.json` does not have internal calls, outgoing calls, or execution flows. It is a static configuration file consumed by the TypeDoc CLI tool.

## Module Overview

The `typedoc.json` file configures TypeDoc to generate comprehensive API documentation for the "Code Buddy" project. It specifies the source files to process, the output directory, naming conventions, and detailed rules for filtering, sorting, and presenting the generated documentation.

## Purpose

The primary purpose of this configuration is to:

1.  **Automate API Documentation**: Generate up-to-date API documentation directly from TypeScript source code comments (JSDoc/TSDoc).
2.  **Maintain Consistency**: Ensure a consistent structure, theme, and content across all generated documentation.
3.  **Control Visibility**: Define which parts of the codebase (e.g., public APIs, internal utilities, private members) are included or excluded from the public documentation.
4.  **Improve Discoverability**: Organize the documentation with logical categories and sorting rules to make it easy for developers to navigate and find relevant information.

## Configuration Breakdown

The `typedoc.json` file is structured into several key sections, each controlling a specific aspect of the documentation generation process.

### 1. Source and Output Configuration

These settings define where TypeDoc finds the source code and where it places the generated documentation.

*   `$schema`: Specifies the JSON schema for validation, aiding in configuration correctness.
*   `entryPoints`: `["src/index.ts"]`
    *   TypeDoc will start parsing from `src/index.ts`. The `entryPointStrategy: "expand"` ensures that TypeDoc will recursively find all modules reachable from this entry point.
*   `out`: `"docs/api"`
    *   The generated HTML documentation will be placed in the `docs/api` directory relative to the project root.
*   `name`: `"Code Buddy API Documentation"`
    *   This name will be displayed as the title of the generated documentation.
*   `readme`: `"README.md"`
    *   The project's main `README.md` file will be included as the homepage or overview for the documentation.
*   `includeVersion`: `true`
    *   The project version (from `package.json`) will be displayed in the documentation.

### 2. Visibility and Filtering

These properties control which declarations (classes, functions, interfaces, etc.) are included or excluded based on their visibility modifiers or file paths.

*   `excludePrivate`: `true`
    *   Members marked with the `private` keyword will not be included.
*   `excludeProtected`: `false`
    *   Members marked with the `protected` keyword *will* be included. This is useful for documenting base classes and their intended extension points.
*   `excludeInternal`: `true`
    *   Declarations marked with the `@internal` TSDoc tag will be excluded.
*   `excludeExternals`: `true`
    *   Declarations imported from external modules (e.g., `node_modules`) will be excluded, focusing documentation solely on the project's own code.
*   `exclude`:
    *   A list of glob patterns to explicitly exclude files or directories from processing.
    *   `"**/node_modules/**"`: Excludes all third-party dependencies.
    *   `"**/tests/**"`, `"**/*.test.ts"`, `"**/*.spec.ts"`: Excludes all test files and directories, ensuring documentation focuses on implementation, not testing.
*   `visibilityFilters`:
    *   `"protected": true`: Protected members are visible in the generated documentation.
    *   `"private": false`: Private members are hidden.
    *   `"inherited": true`: Inherited members are visible.
    *   `"external": false`: External (from `node_modules`) members are hidden.

### 3. Structure and Sorting

These settings dictate how the navigation and content within the documentation are organized.

*   `navigation`:
    *   `"includeCategories": true`: Enables the use of `@category` TSDoc tags to group related declarations.
    *   `"includeGroups": true`: Enables grouping of declarations by kind (e.g., "Classes", "Functions").
*   `categorizeByGroup`: `true`
    *   When both categories and groups are enabled, categories will take precedence, with groups nested within them.
*   `sort`: `["source-order"]`
    *   Declarations within a group or category will be sorted in the order they appear in the source files, which often provides a more natural reading flow.
*   `kindSortOrder`:
    *   Defines the preferred order of different declaration kinds in the navigation and content. For example, `Module`s and `Namespace`s appear before `Class`es and `Interface`s.
*   `categoryOrder`:
    *   Defines a custom order for categories. Categories not explicitly listed will appear at the end, sorted alphabetically (`"*"`). This allows for a logical grouping of core components, agents, tools, etc.

### 4. Theming and Presentation

These options control the visual appearance and minor presentation details of the generated documentation.

*   `theme`: `"default"`
    *   Uses TypeDoc's default theme for the documentation.
*   `hideGenerator`: `false`
    *   The "Generated by TypeDoc" footer will be visible.
*   `customCss`: `""`
    *   No custom CSS is applied, relying entirely on the default theme.
*   `markedOptions`:
    *   `"mangle": false`: Disables email address obfuscation in Markdown, which can sometimes interfere with valid email links.
*   `searchInComments`: `true`
    *   The search functionality will include content from JSDoc/TSDoc comments, making it easier to find relevant information.

### 5. Build Control

*   `cleanOutputDir`: `true`
    *   The `docs/api` directory will be emptied before new documentation is generated, ensuring no stale files remain.
*   `gitRevision`: `"main"`
    *   TypeDoc will link to the `main` branch of the Git repository for source code links, ensuring links point to the correct version of the code.

## Usage

This `typedoc.json` file is typically consumed by the TypeDoc command-line interface (CLI). A common way to invoke it is via an NPM script defined in `package.json`, for example:

```json
// package.json snippet
{
  "scripts": {
    "docs": "typedoc --options typedoc.json"
  }
}
```

Running `npm run docs` would then execute TypeDoc using all the configurations specified in `typedoc.json`, generating the API documentation in the `docs/api` directory.

## Contributing to Documentation

Developers contributing to the "Code Buddy" project should be aware of this configuration to ensure their code is properly documented:

*   **JSDoc/TSDoc Comments**: Use standard JSDoc/TSDoc comments for all public and protected APIs (classes, interfaces, functions, variables, type aliases).
*   **Visibility Modifiers**: Understand that `private` members are excluded, while `protected` members are included.
*   **`@internal` Tag**: Use the `@internal` TSDoc tag for code that should explicitly *not* appear in the public API documentation.
*   **`@category` Tag**: Utilize the `@category` TSDoc tag to assign declarations to logical groups (e.g., `@category Core`, `@category Agent`). Refer to the `categoryOrder` in `typedoc.json` for existing categories.
*   **Test Files**: Keep documentation out of test files, as they are explicitly excluded.

By adhering to these guidelines, developers ensure that the generated API documentation accurately reflects the project's public interface and remains consistent with the overall documentation strategy.