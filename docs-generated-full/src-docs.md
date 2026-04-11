---
title: "src — docs"
module: "src-docs"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.443Z"
---
# src — docs

The `src/docs` module is responsible for generating, managing, and providing access to comprehensive documentation for a codebase. It leverages a `KnowledgeGraph` to understand the project's structure, entities, and relationships, producing structured documentation that can be consumed by both human developers and AI agents.

This module encompasses several distinct phases: project discovery, blueprint generation, configuration, documentation rendering and export, and runtime context provision for AI agents.

## Core Concepts

Before diving into the components, understanding the key data structures is crucial:

*   **`KnowledgeGraph`**: The central data source for all documentation generation. It contains triples representing modules, functions, classes, and their relationships (imports, calls, contains, etc.).
*   **`DocsConfig`**: (Defined in `src/docs/config.ts`) Project-specific settings for documentation generation, including output directory, language, depth levels, and inclusion of private APIs or troubleshooting sections.
*   **`ProjectProfile`**: (Defined in `src/docs/discovery/project-discovery.ts`) A comprehensive, LLM-agnostic snapshot of the project derived from the `KnowledgeGraph` and filesystem analysis. It includes metrics, architectural insights (layers, clusters, entry points), detected patterns, dependencies, and extracted context from `README.md` or `CLAUDE.md`.
*   **`ProjectBlueprint`**: (Defined in `src/docs/blueprint-builder.ts`) A verified, structured representation of the project's entities (modules, functions, classes, interfaces) and their relationships. This "ground truth" is crucial for LLM consumption, preventing hallucinations by providing accurate, pre-verified information.
*   **`DocsPageEntry`**: (Internal to `src/docs/docs-context-provider.ts`) A runtime representation of a single documentation page, including its slug, title, description, keywords, and content. Used for efficient search and retrieval by AI agents.

## Key Components and Workflow

The `src/docs` module orchestrates a multi-stage process to generate and serve documentation.

```mermaid
graph TD
    A[KnowledgeGraph] --> B(Project Discovery)
    B --> C{ProjectProfile}
    A --> D(Blueprint Builder)
    D --> E{ProjectBlueprint}

    subgraph Documentation Generation (V2 Pipeline - not shown)
        C & E --> F(LLM-driven Page Generation)
        F --> G(RenderInput Pages)
    end

    subgraph Documentation Generation (V1 - Deprecated)
        C & E --> H(docs-generator.ts)
        H --> G
    end

    G --> I(Doc Exporter)
    I --> J[Generated Docs <br/>(.codebuddy/docs/)]

    J --> K(Docs Context Provider)
    K --> L[Agent Runtime Context]
```

### 1. Configuration Management (`src/docs/config.ts`)

The `config.ts` module handles loading and managing documentation generation settings.

*   **`DocsConfig` Interface**: Defines all configurable options, from output paths and repository details to LLM thinking levels and diagram node limits.
*   **`getDefaultConfig()`**: Provides a baseline set of configuration values.
*   **`loadDocsConfig(cwd: string)`**: Merges default settings with project-specific overrides found in `.codebuddy/docs-config.json`. It also attempts to auto-detect `repoUrl` and `commit` from Git.

This configuration is loaded early in the documentation pipeline to guide subsequent generation steps.

### 2. Project Discovery (`src/docs/discovery/project-discovery.ts`)

The `project-discovery.ts` module performs an initial, LLM-agnostic analysis of the codebase to build a comprehensive `ProjectProfile`. This phase works on any codebase without project-specific assumptions.

*   **`discoverProject(graph: KnowledgeGraph, cwd: string, ...)`**: This asynchronous function is the entry point for project discovery. It performs the following:
    *   Reads `package.json` for basic project info (name, version, scripts, dependencies).
    *   Analyzes the `KnowledgeGraph` to identify modules, classes, and functions.
    *   Detects the source root (`src/`, `app/`, etc.).
    *   Calculates `ProjectMetrics` (total modules, classes, functions, relationships, average connections).
    *   Identifies `coreModules` (top 20 by PageRank + function density) and `entryPoints` (modules with zero importers).
    *   Detects `ArchitecturalLayer`s based on top-level directories.
    *   Uses `community-detection.js` (if available) to find `ModuleCluster`s.
    *   Infers the overall `architecture.type` (monolith, layered, microservices, etc.).
    *   Detects common `DetectedPattern`s (Facade, Singleton, Registry).
    *   Identifies the primary `language` and `framework` based on dependencies and config files.
    *   Extracts `envVars` from `CLAUDE.md`, `README.md`, or `.env.example`.
    *   Parses `README.md` and `CLAUDE.md` for `readmeContext` (problem statement, features, architecture overview, subsystem table, inspired features).
    *   Extracts `apiSurface` (CLI commands, HTTP endpoints) by scanning common entry points and route directories.
    *   Detects `testInfo` (framework, file counts) by scanning test directories and config files.

The resulting `ProjectProfile` provides a rich, structured understanding of the codebase, which is then used by LLM-driven generation processes (in V2) or directly by the deprecated V1 generator.

### 3. Blueprint Generation (`src/docs/blueprint-builder.ts`)

The `blueprint-builder.ts` module creates a `ProjectBlueprint` from the `KnowledgeGraph`. This blueprint serves as a verified, factual representation of the codebase, primarily designed to provide ground truth to LLMs and prevent hallucinations.

*   **`buildProjectBlueprint(graph: KnowledgeGraph)`**: This synchronous function processes the `KnowledgeGraph` to:
    *   Identify all modules and their paths.
    *   List functions, classes, and interfaces contained within each module.
    *   Map module imports and modules that import them (`imports`, `importedBy`).
    *   Calculate PageRank for each module.
    *   Collect all verified entity names (functions, classes, interfaces) into a `Set`.
    *   Identify `topModules` by PageRank.
    *   Compute overall counts for modules, functions, and classes.
*   **`serializeBlueprintForLLM(blueprint: ProjectBlueprint, maxChars: number)`**: Converts the `ProjectBlueprint` into a compact, human-readable text block suitable for injection into LLM prompts. It highlights top modules, their ranks, and key contents.
*   **`isVerifiedEntity(blueprint: ProjectBlueprint, name: string)`**: Checks if a given identifier (function, class, interface name) exists in the project's verified entities, including partial matches for method names (e.g., `ClassName.methodName`).
*   **`findClosestEntity(blueprint: ProjectBlueprint, name: string)`**: Attempts to find the closest matching verified entity name for a potentially hallucinated or misspelled input, using a Levenshtein-like prefix matching.

The `ProjectBlueprint` is a critical component for LLM-based documentation, ensuring that the AI operates on accurate, pre-validated information about the codebase's structure and entities.

### 4. Documentation Generation (V1 - Deprecated) (`src/docs/docs-generator.ts`)

The `docs-generator.ts` module represents the *deprecated* V1 documentation generation approach. It directly generates a fixed set of markdown files based on hardcoded section logic. While deprecated in favor of the LLM-driven V2 pipeline (`docs-pipeline.ts`), its internal section generation functions provide insight into the types of content produced.

*   **`generateDocs(graph: KnowledgeGraph, options: DocsGeneratorOptions)`**: The main entry point for V1 generation. It orchestrates the creation of various markdown files:
    *   `1-overview.md`: Project summary, statistics, core modules, entry points, and technology stack.
    *   `2-architecture.md`: System layers, core module dependencies (with Mermaid diagrams), and agent flow.
    *   `3-subsystems.md`: Detailed breakdown of architectural subsystems (communities) detected in the graph, with module lists and optional call flowcharts. This file can be split into multiple smaller files (e.g., `3a-agent-orchestration.md`) if it exceeds a certain line count.
    *   `4-metrics.md`: Code quality metrics, including a health score, dead code analysis, and module coupling.
    *   `5-tools.md`: Overview of the tool system, categories, and RAG-based selection process.
    *   `6-security.md`: Security architecture, features (confirmation, sandbox, guardian agent), and relevant modules.
    *   `7-context-memory.md`: Context management and memory system modules.
    *   `8-configuration.md`: Configuration hierarchy, key files, and environment variables.
    *   `9-api-reference.md`: CLI subcommands, slash commands, and HTTP API routes.
    *   `10-development.md`: Getting started guide, build commands, project structure, coding conventions, and testing.
    *   `11-changelog.md`: Recent Git commits.
    *   `index.md`: A table of contents for all generated sections.
*   **Post-processing**: After initial generation, `addCrossLinksAndCitations` adds "See also" links and source file citations, and `addInlineConceptLinks` creates internal hyperlinks between related concepts across different documentation pages.
*   **Helper Functions**: This module contains numerous helper functions like `inferModuleDescription`, `deriveSubsystemLabel`, `readPkg`, `readFileSafe`, and `computeHealthScore` (which dynamically imports `graph-analytics.js`).

**Note on Deprecation**: While `docs-generator.ts` is provided, the comments and call graph indicate that `src/docs/docs-pipeline.ts` (V2) is the current recommended approach. The V2 pipeline likely uses the `ProjectProfile` and `ProjectBlueprint` to inform LLM calls (via `src/docs/llm-docs-generator.ts`) for more dynamic and intelligent content generation, rather than the fixed structure of V1.

### 5. Documentation Export (`src/docs/doc-exporter.ts`)

The `doc-exporter.ts` module is responsible for taking rendered documentation pages and writing them to disk in various formats.

*   **`DocExporter.export(pages: RenderInput[], options: ExportOptions)`**: The static entry point for exporting. It:
    *   Ensures the `outputDir` exists.
    *   Iterates through each `RenderInput` page and each requested `OutputFormat` (markdown, html, json, wiki).
    *   Calls `DocExporter.renderPage` to get the content for each format.
    *   Writes the content to the appropriate file path within the `outputDir`.
    *   Generates a `README.md` index file for the documentation root.
    *   Returns an `ExportResult` with statistics on files and bytes written.
*   **`DocExporter.renderPage(page: RenderInput, allPages: RenderInput[], format: OutputFormat)`**: A private helper that dispatches to the `MultiFormatRenderer` (not provided in source, but implied by imports) to convert a `RenderInput` page into the specified `OutputFormat`. It returns an array of `RenderOutput` because the `wiki` format can generate multiple files per page.

This module acts as the final stage of the documentation pipeline, persisting the generated content.

### 6. Runtime Docs Context Provider (`src/docs/docs-context-provider.ts`)

The `docs-context-provider.ts` module makes the generated documentation available to AI agents at runtime. It acts as a searchable index for the documentation, allowing agents to retrieve relevant context based on user queries or to get an architectural overview.

*   **`DocsContextProvider` Class**:
    *   **`index`**: A `Map<string, DocsPageEntry>` storing parsed documentation pages.
    *   **`loadDocsIndex(cwd?: string)`**: Asynchronously loads and parses markdown files from the `.codebuddy/docs/` directory. It extracts titles, descriptions, and keywords from each page to build the internal index. It also includes a staleness check to reload if the underlying files have changed.
    *   **`getRelevantContext(message: string, maxChars: number)`**: Takes a user message, extracts keywords, scores documentation pages based on keyword relevance (title, description, keywords, content), and returns a concise snippet from the most relevant sections. This is used by agents to provide context for user queries.
    *   **`getArchitectureSummary(maxChars: number)`**: Retrieves content from architecture-related documentation pages, strips out non-essential elements (like `<details>` blocks), and returns a consolidated summary for injection into system prompts.
*   **Singleton Pattern**: `getDocsContextProvider()` ensures that only a single instance of `DocsContextProvider` exists, allowing it to maintain a consistent index across the application. `resetDocsContextProvider()` is provided for testing or reinitialization.

This component is crucial for enabling AI agents to leverage the generated documentation effectively, providing them with up-to-date and relevant information about the codebase.

## Integration with the Codebase

The `src/docs` module is deeply integrated with the `src/knowledge` module, particularly the `KnowledgeGraph`.

*   **`KnowledgeGraph` as Source**: Both `Project Discovery` and `Blueprint Builder` directly consume the `KnowledgeGraph` to extract structural information about the codebase. The deprecated `docs-generator.ts` also heavily relies on it for generating various sections, including metrics and subsystem diagrams.
*   **LLM Consumption**: The `ProjectBlueprint` (from `blueprint-builder.ts`) and the runtime context (from `docs-context-provider.ts`) are designed for consumption by LLMs. The blueprint provides verified facts to prevent hallucinations, while the context provider allows agents to dynamically retrieve relevant documentation snippets.
*   **V2 Pipeline**: While not fully detailed in the provided source, the call graph indicates that `src/docs/docs-pipeline.ts` is the orchestrator for the V2 documentation generation. This pipeline likely combines the `ProjectProfile` and `ProjectBlueprint` with LLM calls (via `src/docs/llm-docs-generator.ts`) to produce more dynamic and intelligent documentation content, which is then exported by `doc-exporter.ts`.
*   **Agent Tools**: The `DocsContextProvider` is used by agent tools (e.g., `src/tools/docs-search-tool.ts`) and prompt builders (`src/services/prompt-builder.ts`) to inject documentation context into agent prompts, enhancing the agent's understanding and response quality.

In summary, the `src/docs` module provides a robust framework for transforming a codebase's `KnowledgeGraph` into structured, searchable documentation, serving both human developers and AI agents.