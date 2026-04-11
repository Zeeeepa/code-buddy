---
title: "tests — docs"
module: "tests-docs"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.880Z"
---
# tests — docs

This document provides an overview and detailed explanation of the `tests/docs/renderers.test.ts` module. This module is crucial for ensuring the correctness and reliability of the documentation rendering pipeline, specifically for the `MultiFormatRenderer` and `HtmlThemeEngine` components.

## Introduction

The `renderers.test.ts` module contains unit tests for the core logic responsible for transforming structured documentation input into various output formats (Markdown, JSON, HTML, Wiki). It validates the functionality of `MultiFormatRenderer` and `HtmlThemeEngine`, ensuring that documentation is consistently and accurately generated across different targets.

Developers contributing to the documentation generation process, adding new output formats, or modifying existing rendering logic should refer to these tests to understand expected behavior and ensure new changes do not introduce regressions.

## Core Components Under Test

This test module primarily focuses on two key classes:

1.  **`MultiFormatRenderer`**: This class is responsible for orchestrating the generation of documentation in multiple formats from a common `RenderInput` structure. It handles tasks like slug generation, section extraction, and delegating to format-specific rendering methods.
2.  **`HtmlThemeEngine`**: This class provides the foundational capabilities for converting Markdown content into HTML, applying styling, and handling HTML-specific utilities like escaping. It's a dependency for `MultiFormatRenderer` when generating HTML-based outputs.

The relationship between these components can be visualized as follows:

```mermaid
graph TD
    A[MultiFormatRenderer] --> B[HtmlThemeEngine]
    A --> C{Output Formats}
    C --> D[Markdown]
    C --> E[JSON]
    C --> F[HTML]
    C --> G[Wiki (HTML, JSON)]
```

## Test Fixtures

To facilitate consistent testing, the module defines two helper functions for creating mock `RenderInput` data:

*   **`makeInput(overrides?: Partial<RenderInput>): RenderInput`**: Creates a standard `RenderInput` object representing a single module's documentation. It includes common fields like `moduleId`, `title`, `markdown`, `members`, `cohesion`, `filePaths`, and `generatedAt`. This function allows for easy customization of specific fields for individual test cases.
*   **`makeModules(): RenderInput[]`**: Returns an array of `RenderInput` objects, typically used when testing features that involve multiple modules, such as sidebar navigation or index page generation.

## Detailed Test Coverage

The tests are organized by the methods they validate, providing clear examples of expected inputs and outputs.

### `MultiFormatRenderer.slug`

This suite tests the utility method for converting arbitrary strings into a URL-friendly, lowercase kebab-case slug.

*   **Converts to lowercase kebab-case**: Ensures basic conversion, e.g., `AgentExecutor` -> `agentexecutor`.
*   **Replaces non-alphanumeric with hyphens**: Handles special characters and spaces, e.g., `agent/executor_v2` -> `agent-executor-v2`.
*   **Trims leading and trailing hyphens**: Cleans up slugs, e.g., `--hello--world--` -> `hello-world`.
*   **Collapses multiple special chars into single hyphen**: Prevents excessive hyphens, e.g., `a...b___c` -> `a-b-c`.
*   **Handles empty string**: Ensures robustness for edge cases.

### `MultiFormatRenderer.extractSections`

This suite validates the logic for parsing Markdown content and extracting sections based on H2 headings.

*   **Splits by H2 headings**: Verifies that content under H2 headings is correctly identified and stored under a slugified key.
*   **Captures intro content before first H2**: Ensures any content preceding the first H2 is captured under the special `_intro` key.
*   **Strips YAML frontmatter before extracting**: Confirms that YAML frontmatter is removed before section parsing.
*   **Handles markdown with no H2 headings**: Ensures all content is placed in `_intro` if no H2s are present.
*   **Handles empty markdown**: Verifies graceful handling of empty input.

### `MultiFormatRenderer.toMarkdown`

This suite tests the generation of Markdown output, including the addition of YAML frontmatter.

*   **Adds YAML frontmatter**: Checks for the presence and correct formatting of metadata like `title`, `module`, `cohesion`, `members`, and `generated`.
*   **Preserves original markdown after frontmatter**: Ensures the original Markdown content is untouched after the frontmatter.
*   **Escapes double quotes in title**: Verifies proper escaping for YAML compatibility.
*   **Reports correct size in bytes**: Confirms the `sizeBytes` property accurately reflects the content's byte length.

### `MultiFormatRenderer.toJson`

This suite validates the generation of JSON output, ensuring a structured representation of the module's documentation.

*   **Produces valid JSON with correct structure**: Checks for the presence of top-level fields like `id`, `title`, `cohesion`, and `members`.
*   **Extracts sections correctly into JSON**: Verifies that Markdown sections are parsed and included in the `sections` object within the JSON output.
*   **Includes filePaths and generatedAt**: Ensures these metadata fields are present.

### `MultiFormatRenderer.toHtml`

This suite tests the generation of a self-contained HTML page for a single module, including navigation and theme features.

*   **Produces self-contained HTML**: Checks for standard HTML document structure, including `<style>` and `<script>` tags.
*   **Includes sidebar with all modules**: Verifies that the generated HTML contains links to all provided modules in a sidebar.
*   **Marks the active module in sidebar**: Ensures the currently rendered module's link is highlighted (e.g., with an `active` class).
*   **Includes theme toggle**: Checks for the presence of UI elements related to theme switching.
*   **Includes search box**: Verifies the inclusion of a search input field.

### `MultiFormatRenderer.toWiki`

This suite tests the generation of files specifically for a "wiki" style documentation output, which typically involves multiple related files.

*   **Returns three outputs: page, index, search-index**: Confirms that `toWiki` produces the expected set of files: the module's HTML page, a global index page, and a search index JSON file.
*   **Wiki page has breadcrumb navigation**: Checks for navigation elements linking back to the home/index page.
*   **Search index contains module data**: Verifies that the `search-index.json` file is correctly populated with searchable metadata for each module.

### `MultiFormatRenderer.buildIndex`

This suite tests the generation of a Markdown table that serves as an index for all modules, with links to various formats.

*   **Generates a markdown table with module rows**: Checks for the presence of a table structure listing module titles.
*   **Includes links for each requested format**: Verifies that links to Markdown, HTML, and JSON outputs are correctly generated for each module.
*   **Uses wiki/ prefix for wiki format links**: Ensures correct pathing for wiki-specific links.
*   **Shows cohesion and member count in table**: Confirms that module metrics are displayed in the index table.

### `HtmlThemeEngine.mdToHtml`

This suite tests the core Markdown-to-HTML conversion capabilities of `HtmlThemeEngine`, ensuring various Markdown syntax elements are correctly rendered.

*   **Converts headings with id anchors**: Checks that headings are converted to `<h1>`-`<h6>` tags with auto-generated `id` attributes.
*   **Converts code blocks with language class**: Verifies that fenced code blocks are converted to `<pre><code class="lang-...">` with syntax highlighting classes.
*   **Converts inline code**: Ensures backtick-enclosed text becomes `<code>`.
*   **Converts bold and italic**: Checks for `<strong>` and `<em>` tags.
*   **Converts links**: Verifies `<a>` tag generation.
*   **Converts unordered lists**: Checks for `<ul>` and `<li>` tags.
*   **Converts tables**: Ensures Markdown tables are rendered as `<table>` elements.
*   **Converts blockquotes**: Checks for `<blockquote>` tags.
*   **Strips YAML frontmatter**: Confirms frontmatter is removed before HTML rendering.
*   **Wraps plain text in paragraphs**: Ensures standalone text lines are wrapped in `<p>` tags.
*   **Handles horizontal rules**: Checks for `<hr>` tag generation.

### `HtmlThemeEngine.escapeHtml`

This suite tests the utility function for escaping HTML special characters.

*   **Escapes &, <, >, ", '**': Verifies that common HTML entities are correctly replaced.
*   **Returns empty string for empty input**: Ensures graceful handling of empty input.

## How to Contribute or Extend

When adding new rendering formats, modifying existing rendering logic, or introducing new Markdown features, follow these guidelines:

1.  **Create new test suites**: If you're adding a completely new format (e.g., `toPdf`), create a new `describe` block for `MultiFormatRenderer.toPdf`.
2.  **Add specific test cases**: For any changes to existing methods, add `it` blocks that cover the new functionality or edge cases.
3.  **Use `makeInput` and `makeModules`**: Leverage the existing fixtures to create consistent test data.
4.  **Verify output structure and content**: Use `expect` assertions to check for specific strings, HTML elements, JSON properties, or file structures in the generated output.
5.  **Consider performance**: While not explicitly tested here, be mindful of the performance implications of rendering large documentation sets.

By maintaining comprehensive and clear tests, we ensure the documentation generation pipeline remains robust and easy to evolve.