---
title: "src — rules"
module: "src-rules"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.654Z"
---
# src — rules

The `src/rules/rules-loader.ts` module provides a robust and modular system for defining and loading project-specific and user-global instructions, often referred to as "rules." Inspired by features natively `.claude/rules/`, this module allows developers to break down complex system prompts into focused, composable Markdown files. These rules are then dynamically injected into the AI's system prompt, ensuring the agent operates with the most relevant and up-to-date guidelines.

## Purpose

The primary goal of the `rules-loader` module is to:

1.  **Modularize Instructions**: Move away from monolithic system prompts by allowing rules to be defined in separate Markdown files.
2.  **Enhance Composability**: Enable rules to be scoped to specific agent modes (e.g., `code`, `plan`) and prioritized for precise placement within the prompt.
3.  **Improve Maintainability**: Make it easier to add, modify, or remove specific instructions without altering the core prompt logic.
4.  **Support User and Project Scopes**: Load rules from both user-level global configurations and project-level directories, with project rules overriding global ones.

## Core Concepts

### Rule Entry (`RuleEntry`)

Each loaded rule is represented by a `RuleEntry` object, which encapsulates its metadata and content:

```typescript
export interface RuleEntry {
  path: string;          // Resolved file path
  title: string;         // Title from frontmatter or filename
  priority: number;      // Lower = injected first; higher = closer to query
  scope: string[];       // Agent modes where this applies (empty = all)
  alwaysApply: boolean;  // Whether to always include (default true)
  content: string;       // Raw markdown content (frontmatter stripped)
  source: 'global' | 'project'; // Source tier
}
```

### Rule Files and Frontmatter

Rules are defined in Markdown files (`.md`) within designated directories. Each file can optionally include YAML-like frontmatter at the top to configure its behavior.

**Example Rule File (`.codebuddy/rules/typescript-conventions.md`):**

```markdown
---
title: TypeScript Conventions
priority: 10
scope: [code, review]
alwaysApply: true
---
## TypeScript Best Practices

- Always use `strict` mode.
- Prefer `interface` over `type` for object shapes.
- Use `const` for variables that do not reassign.
- ...
```

The supported frontmatter fields are:

*   `title`: Overrides the filename as the rule's title.
*   `priority`: An integer determining the order of injection. Lower numbers appear earlier in the prompt.
*   `scope`: An array of strings specifying the agent modes (e.g., `code`, `plan`, `review`) for which this rule applies. If empty, the rule applies to all modes.
*   `alwaysApply`: A boolean (default `true`). If `false`, the rule will only be included if a matching `scope` is provided via the `mode` parameter during context building.

## How it Works

The `RulesLoader` class is responsible for discovering, parsing, and managing these rule files.

### 1. Rule Discovery

The loader searches for `.md` files in two predefined directories, in priority order (later overrides earlier):

1.  **User-level Global Rules**: `~/.codebuddy/rules/`
2.  **Project-level Rules**: `./.codebuddy/rules/` (relative to `process.cwd()`)

### 2. Loading and Parsing

The `RulesLoader.load()` method orchestrates the discovery and parsing process:

1.  It iterates through the `searchDirs`.
2.  For each directory, it reads all `.md` files.
3.  Each file is processed by `RulesLoader.loadFile()`:
    *   The file content is read using `fs.readFile()`.
    *   `parseFrontmatter()` extracts metadata and separates the rule content.
    *   A `RuleEntry` object is created and added to the internal list.
4.  After all files are processed, the `entries` list is sorted by `priority` in ascending order. This ensures rules with lower priority values are placed earlier in the generated context block.

**Important Note on Frontmatter Parsing**: The `parseFrontmatter` function uses a custom, lightweight parser. It does *not* rely on a full YAML parsing library. This means it only supports the specific `key: value` patterns outlined above and simple inline array for `scope`.

### 3. Context Building and Filtering

Once loaded, rules can be retrieved and formatted into a context block suitable for prompt injection.

*   **`RulesLoader.getAll(mode?: string): RuleEntry[]`**: This method filters the loaded rules based on the provided `mode` and the rule's `scope` and `alwaysApply` properties.
    *   If `alwaysApply` is `false` and no `mode` is specified, the rule is skipped.
    *   If a `mode` is specified and the rule has a `scope` defined, the rule is only included if the `mode` is present in its `scope`.
    *   Rules with an empty `scope` are considered applicable to all modes.
*   **`RulesLoader.buildContextBlock(mode?: string): string`**: This is the primary method for generating the final Markdown string. It calls `getAll()` to get the filtered rules, then formats them into a single block with `## Project Rules` as a header, `### Rule Title` for each rule, and `---` as separators between rules.

## `RulesLoader` Class

The `RulesLoader` class is the central component of this module.

```typescript
export class RulesLoader {
  private entries: RuleEntry[] = [];
  private loaded = false;

  async load(): Promise<void> { /* ... */ }
  private async loadFile(filePath: string, source: RuleEntry['source']): Promise<void> { /* ... */ }

  getAll(mode?: string): RuleEntry[] { /* ... */ }
  buildContextBlock(mode?: string): string { /* ... */ }

  list(): RuleEntry[] { /* ... */ }
  get isLoaded(): boolean { /* ... */ }
}
```

### Key Methods:

*   **`load()`**: Asynchronously loads all rules from the configured directories. This method must be called before attempting to retrieve or build context from rules.
*   **`getAll(mode?: string)`**: Returns an array of `RuleEntry` objects, filtered by the optional `mode` parameter.
*   **`buildContextBlock(mode?: string)`**: Returns a formatted Markdown string containing all applicable rules, ready for insertion into a system prompt.
*   **`list()`**: Returns a shallow copy of all currently loaded `RuleEntry` objects, without any filtering.
*   **`isLoaded`**: A boolean getter indicating whether the `load()` operation has completed.

## Singleton Access

To ensure consistent rule management across the application, `RulesLoader` is exposed as a singleton:

*   **`getRulesLoader(): RulesLoader`**: Returns the single instance of `RulesLoader`. If an instance doesn't exist, it creates one.
*   **`resetRulesLoader(): void`**: Resets the singleton instance. This is primarily useful for testing scenarios to ensure a clean state.

## Integration with the System

The `rules-loader` module plays a crucial role in dynamically constructing AI prompts.

```mermaid
graph TD
    A[src/services/prompt-builder.ts] --> B{getRulesLoader()};
    B --> C[RulesLoader Instance];
    C -- buildContextBlock(mode) --> D[Formatted Rules String];
    C -- load() --> E[Rule Files];
    E -- read & parse --> F[parseFrontmatter];
```

### Prompt Building

The primary consumer of the `RulesLoader` is the `src/services/prompt-builder.ts` module. When constructing a system prompt, `prompt-builder` will:

1.  Obtain the `RulesLoader` instance via `getRulesLoader()`.
2.  Call `rulesLoader.buildContextBlock(currentAgentMode)` to retrieve a Markdown string of all relevant rules for the current agent's operation mode.
3.  Inject this string into the overall system prompt, typically before the main task instructions.

### Testing

The `rules-loader.test.ts` unit tests extensively use `getRulesLoader()`, `resetRulesLoader()`, `buildContextBlock()`, and `getAll()` to verify the loading, parsing, filtering, and formatting logic.