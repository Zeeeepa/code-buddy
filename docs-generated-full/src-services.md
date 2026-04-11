---
title: "src — services"
module: "src-services"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.710Z"
---
# src — services

The `src/services` module provides a collection of reusable, domain-specific functionalities that support the core operations of the agent. It abstracts away complex tasks such as codebase exploration, static code analysis, execution plan management, dynamic prompt construction, and unified file system interactions.

This module is designed to offer clear, focused APIs, allowing other parts of the codebase (e.g., agents, command handlers) to consume these capabilities without needing to understand their intricate internal workings.

## Module Overview

The `src/services` module is structured into several distinct components:

*   **Code Analysis**: Services for static analysis of code files and execution plans.
*   **Codebase Exploration**: Tools for scanning and understanding project structure.
*   **Execution Planning**: Services for creating, managing, and analyzing multi-step execution plans.
*   **Prompt Engineering**: Components for dynamically building comprehensive system prompts for LLMs.
*   **Virtual File System (VFS)**: A unified interface for file operations, supporting physical and virtual file systems with security features.

## Core Services

### 1. Code Analyzer (`src/services/analysis/code-analyzer.ts`)

The `CodeAnalyzer` service performs static analysis on individual code files to extract various metrics and detect potential issues. It's designed to provide a quick, high-level understanding of a file's characteristics without requiring a full AST parser.

**Key Capabilities:**

*   **`analyzeFileContent(filePath: string, content: string): FileAnalysis`**: The primary entry point, taking a file path and its content to produce a `FileAnalysis` object.
*   **`detectLanguage(filePath: string): string`**: Infers the programming language based on the file extension.
*   **`extractDependencies(content: string, language: string): FileDependency[]`**: Identifies `import` and `require` statements for JavaScript/TypeScript, and `import` statements for Python.
*   **`extractExports(content: string, language: string): string[]`**: Detects named and default exports in JavaScript/TypeScript files.
*   **`detectIssues(content: string, filePath: string, language: string): CodeIssue[]`**: Scans for:
    *   **Security Patterns**: Hardcoded secrets, dangerous functions (`eval`, `innerHTML`), and potential SQL injection patterns.
    *   **Maintainability**: `TODO`/`FIXME` comments, `console.log` statements, and `any` type usage in TypeScript.
    *   **Style**: Overly long lines.
*   **`estimateComplexity(content: string): number`**: Provides a simple heuristic for code complexity based on control flow structures (if, for, while, switch, try/catch, ternary operators, logical operators).
*   **`generateFileSummary(content: string, _language: string): string`**: Creates a concise summary including line count, function count, class count, and interface count.

**Output:**

The analysis results are encapsulated in the `FileAnalysis` interface, defined in `src/services/analysis/types.ts`.

**Usage Example:**

```typescript
import { CodeAnalyzer } from './services/analysis/code-analyzer.js';

const analyzer = new CodeAnalyzer();
const filePath = 'src/my-module.ts';
const fileContent = `
import { someUtil } from './utils';
const API_KEY = "sk-1234567890abcdefghijklmnopqrstuvwxyz"; // Hardcoded secret
function doSomething(data: any) {
  console.log("Processing data:", data);
  if (data.length > 100) {
    // TODO: Optimize this loop
    for (let i = 0; i < data.length; i++) {
      // ...
    }
  }
}
export default doSomething;
`;

const analysis = analyzer.analyzeFileContent(filePath, fileContent);
console.log(`Language: ${analysis.language}`); // typescript
console.log(`Issues:`, analysis.issues);
// [
//   { type: 'security', severity: 'critical', message: 'Problème de sécurité détecté: hardcodedSecrets', ... },
//   { type: 'maintainability', severity: 'warning', message: 'TODO/FIXME non résolu', ... },
//   { type: 'maintainability', severity: 'warning', message: 'console.log détecté (à supprimer en production)', ... },
//   { type: 'maintainability', severity: 'warning', message: 'Type "any" utilisé', ... }
// ]
```

### 2. Plan Analyzer (`src/services/analysis/plan-analysis.ts`)

The `PlanAnalyzer` service is responsible for performing various analytical computations on an `ExecutionPlan`. It enhances the plan with insights into its structure, risks, and execution characteristics.

**Key Capabilities:**

*   **`static analyze(plan: ExecutionPlan): void`**: The main method that updates the `analysis` property of an `ExecutionPlan` in-place. It calculates:
    *   `totalSteps`, `totalFiles`, `estimatedComplexity`.
    *   `riskAssessment`: The highest risk level among all steps.
    *   `criticalPath`: The longest sequence of dependent steps, indicating the minimum time required for execution.
    *   `parallelizableGroups`: Identifies groups of steps that can be executed concurrently.
    *   `rollbackPoints`: Suggests steps that are suitable as rollback points in case of failure.
*   **`static calculateCriticalPath(plan: ExecutionPlan): string[]`**: Uses a memoized depth-first search to find the longest dependency chain.
*   **`static findParallelGroups(plan: ExecutionPlan): string[][]`**: Determines groups of steps that can run in parallel by calculating their dependency depth.
*   **`static detectCycles(plan: ExecutionPlan): string[]`**: Identifies circular dependencies within the plan's steps, which would prevent execution.

**Connections:**

This service is primarily used by the `PlanGenerator` to keep the plan's analysis up-to-date after modifications.

### 3. Codebase Explorer (`src/services/codebase-explorer.ts`)

The `CodebaseExplorer` service provides comprehensive capabilities for scanning, analyzing, and reporting on a project's file system structure and content. It's designed to give a holistic view of a codebase.

**Key Classes & Interfaces:**

*   **`CodebaseExplorer`**: The main class for performing exploration.
*   **`FileInfo`**: Detailed information about a single file.
*   **`DirectoryInfo`**: Information about a directory.
*   **`ProjectInfo`**: Detected project type and metadata (e.g., Node.js, Python).
*   **`CodebaseStats`**: Aggregated statistics for the entire codebase.
*   **`ExplorationOptions`**: Configuration for the exploration process (e.g., `maxDepth`, `excludePatterns`).

**Key Capabilities:**

*   **`constructor(rootPath: string, options: Partial<ExplorationOptions>)`**: Initializes the explorer for a given root directory.
*   **`async explore(): Promise<CodebaseStats>`**: Initiates the recursive scan of the codebase, populating internal data structures.
*   **`private async scanDirectory(dirPath: string, depth: number): Promise<void>`**: Recursively traverses directories, respecting `maxDepth` and `excludePatterns`.
*   **`private async analyzeFile(fullPath: string, relativePath: string): Promise<FileInfo | null>`**: Gathers detailed information for each file, including language, category, size, and line count.
*   **`private detectLanguage(ext: string): string`**: Maps file extensions to programming languages.
*   **`private categorizeFile(relativePath: string, name: string, ext: string): FileCategory`**: Assigns files to categories like `source`, `test`, `config`, `documentation`, etc.
*   **`private async detectProject(): Promise<ProjectInfo>`**: Identifies the project type (e.g., `nodejs`, `python`) by looking for common configuration files (`package.json`, `setup.py`, `go.mod`, etc.).
*   **`private calculateStats(): CodebaseStats`**: Aggregates data from all scanned files and directories to produce overall statistics.
*   **Reporting & Utilities**:
    *   **`generateTree(maxDepth = 3): Promise<string>`**: Creates a textual tree view of the codebase.
    *   **`generateReport(): string`**: Produces a detailed summary report including project info, statistics, language distribution, and lists of largest/recently modified files.
    *   **`getFiles()`, `getDirectories()`, `getProjectInfo()`**: Accessors for collected data.
    *   **`findFiles(pattern: string)`, `findByLanguage(language: string)`, `findByCategory(category: FileCategory)`**: Search functionalities.
    *   **`getImportantFiles(): FileInfo[]`**: Identifies key files like entry points and configuration files.

**Helper Functions:**

*   **`createCodebaseExplorer(rootPath: string, options?: Partial<ExplorationOptions>): CodebaseExplorer`**: Factory function.
*   **`exploreCodebase(rootPath: string, options?: Partial<ExplorationOptions>): Promise<{ stats: CodebaseStats; project: ProjectInfo | null; tree: string; report: string; }>`**: A convenience function for a quick, comprehensive exploration.

**Usage Example:**

```typescript
import { exploreCodebase } from './services/codebase-explorer.js';

async function runExploration() {
  const { stats, project, tree, report } = await exploreCodebase(process.cwd(), {
    maxDepth: 5,
    excludePatterns: ['node_modules', '.git'],
  });

  console.log('Project Info:', project);
  console.log('Codebase Stats:', stats);
  console.log('\nCodebase Tree:\n', tree);
  console.log('\nCodebase Report:\n', report);
}

runExploration();
```

### 4. Plan Generator (`src/services/plan-generator.ts`)

The `PlanGenerator` service provides a structured way to create, manage, and track the execution of complex, multi-step tasks. It implements a phased workflow, allowing for detailed planning, analysis, and progress tracking.

**Key Classes & Interfaces:**

*   **`PlanGenerator`**: The main class for managing execution plans.
*   **`ExecutionPlan`**: The central data structure representing a complete plan.
*   **`PlanStep`**: A single, atomic unit of work within an `ExecutionPlan`.
*   **`PlanPhase`**: Defines the current stage of the plan (e.g., `analysis`, `strategy`, `execution`, `completed`).
*   **`PlanGeneratorOptions`**: Configuration for plan generation (e.g., `maxSteps`, `includeTests`).

**Key Capabilities:**

*   **`constructor(options: Partial<PlanGeneratorOptions>)`**: Initializes the generator with specific options.
*   **`createPlan(title: string, goal: string, description: string): ExecutionPlan`**: Starts a new execution plan.
*   **`addStep(step: Omit<PlanStep, "id" | "status">): PlanStep`**: Adds a new step to the current plan.
*   **`addSteps(steps: Omit<PlanStep, "id" | "status">[]): PlanStep[]`**: Adds multiple steps.
*   **`removeStep(stepId: string): boolean`**: Removes a step and its dependencies.
*   **`reorderSteps(stepIds: string[]): boolean`**: Changes the order of steps.
*   **`transitionPhase(newPhase: PlanPhase): boolean`**: Moves the plan through its lifecycle phases.
*   **`updateStepStatus(stepId: string, status: PlanStep["status"], notes?: string): boolean`**: Updates the status of individual steps (`pending`, `in_progress`, `completed`, `failed`).
*   **`getNextStep(): PlanStep | null`**: Returns the next pending step whose dependencies are met.
*   **`getParallelSteps(): PlanStep[]`**: Returns all pending steps whose dependencies are met, allowing for parallel execution.
*   **`validate(): { valid: boolean; issues: string[] }`**: Checks the plan for structural issues like circular dependencies or missing dependencies.
*   **Persistence**:
    *   **`loadPlan(json: string): ExecutionPlan`**: Loads a plan from a JSON string.
    *   **`exportPlan(): string`**: Exports the current plan to a JSON string.
    *   **`async savePlan(filePath: string): Promise<void>`**: Saves the plan to a file.
    *   **`async loadPlanFromFile(filePath: string): Promise<ExecutionPlan>`**: Loads a plan from a file.
*   **Reporting**:
    *   **`generateSummary(): string`**: Creates a human-readable text summary of the plan.
    *   **`generateMarkdown(): string`**: Generates a Markdown representation of the plan.
*   **`private updateAnalysis(): void`**: Internally calls `PlanAnalyzer.analyze` to keep the plan's analysis up-to-date.

**Singleton Pattern:**

The `plan-generator.ts` module also provides `getPlanGenerator()` and `resetPlanGenerator()` functions to manage a singleton instance of the `PlanGenerator`, ensuring a consistent view of the active plan across the application.

**Connections:**

*   Relies heavily on `PlanAnalyzer` for plan analysis and validation.
*   Uses `fs/promises` for file persistence.
*   The `ExecutionPlan` and `PlanStep` types are defined in `src/services/plan-types.ts`.

### 5. Prompt Builder (`src/services/prompt-builder.ts`)

The `PromptBuilder` service is a critical component responsible for dynamically constructing the comprehensive system prompt provided to the LLM agent. It aggregates information from various sources to create a rich and context-aware prompt.

**Key Class:**

*   **`PromptBuilder`**: The main class for prompt construction.

**Key Capabilities:**

*   **`constructor(config: PromptBuilderConfig, promptCacheManager: PromptCacheManager, memory?: EnhancedMemory, moltbotHooksManager?: MoltbotHooksManager, persistentMemory?: PersistentMemoryManager)`**: Initializes the builder with configuration and optional context managers.
*   **`async buildSystemPrompt(systemPromptId: string | undefined, modelName: string, customInstructions: string | null): Promise<string>`**: The core method that orchestrates the prompt building process. It integrates:
    *   **Moltbot Intro Hooks**: Content from `intro_hook.txt` for role/personality injection.
    *   **Memory Context**: Information from `EnhancedMemory` (project context, preferences, recent summaries) and `PersistentMemoryManager`.
    *   **Prompt Management**: Uses `getPromptManager()` to load specific prompts by ID or `autoSelectPromptId()` based on the model.
    *   **Bootstrap Context**: Content from `BOOTSTRAP.md`, `AGENTS.md`, `SOUL.md`.
    *   **Persona Instructions**: Active persona definitions from `getPersonaManager()`.
    *   **Knowledge Base**: Context from `getKnowledgeManager()`.
    *   **Documentation Summary**: Architecture summary from `getDocsContextProvider()`.
    *   **Modular Rules**: Rules from `getRulesLoader()`.
    *   **Skill Enhancements**: Active skill prompts from `getSkillManager()`.
    *   **Identity**: Information from `getIdentityManager()`.
    *   **Coding Style**: Auto-detected conventions from `getCodingStyleAnalyzer()`.
    *   **Workflow Rules**: Orchestration rules from `getWorkflowRulesBlock()`.
    *   **Prompt Variation**: Applies variations (`varySystemPrompt`) to prevent brittle model repetition.
    *   **Truncation**: Ensures the prompt fits within the model's context window.
    *   **Caching**: Uses `PromptCacheManager` to cache generated prompts.

**Connections:**

The `PromptBuilder` has extensive outgoing calls to various managers and providers across the codebase, making it a central hub for prompt engineering and context injection. It's typically instantiated and used by the main agent loop.

### 6. System Prompt Override (`src/services/system-prompt-override.ts`)

The `SystemPromptOverride` service provides a mechanism to modify the system prompt using command-line interface (CLI) flags. It allows users to replace the entire prompt or append additional instructions.

**Key Class:**

*   **`SystemPromptOverride`**: The class handling prompt overrides.

**Key Capabilities:**

*   **`apply(basePrompt: string, options: OverrideOptions): string`**: Takes a base system prompt and applies overrides based on the provided `OverrideOptions`.
    *   **Replacement**: If `systemPrompt` or `systemPromptFile` is provided, the `basePrompt` is entirely replaced.
    *   **Appending**: If `appendSystemPrompt` or `appendSystemPromptFile` is provided, their content is appended to the `basePrompt`.
    *   **Validation**: Prevents simultaneous use of replace and append options.
*   **`private readFile(filePath: string): string`**: Utility to read file content for file-based overrides.

**Connections:**

This service is typically used by the agent's initialization logic to incorporate user-defined prompt modifications after the `PromptBuilder` has generated the initial system prompt.

### 7. Unified VFS Router (`src/services/vfs/unified-vfs-router.ts`)

The `UnifiedVfsRouter` acts as the central gateway for all file system operations within the application. Its purpose is to prevent "Split Brain" scenarios by ensuring a single, consistent interface for file access, and to enable the use of virtual file systems.

**Key Interfaces & Classes:**

*   **`IVfsProvider`**: An interface defining the contract for any Virtual File System provider (e.g., `readFile`, `writeFile`, `exists`).
*   **`UnifiedVfsRouter`**: The singleton router class.

**Key Capabilities:**

*   **`static get Instance(): UnifiedVfsRouter`**: Provides a singleton instance of the router.
*   **`mount(prefix: string, provider: IVfsProvider): void`**: Registers a VFS provider to handle paths starting with a specific `prefix` (e.g., `memory://`). Mounts are sorted by prefix length for longest-prefix matching.
*   **`unmount(prefix: string): boolean`**: Removes a mounted provider.
*   **`private findMount(filePath: string): { provider: IVfsProvider; strippedPath: string } | null`**: Internal method to determine which provider (if any) should handle a given path.
*   **Default Behavior**: If no mounted provider matches, operations are delegated to the physical file system using `fs-extra`.
*   **Performance Tracking**: All file operations are wrapped with `measureLatency` for performance monitoring.
*   **Security & Isolation**:
    *   **`resolvePath(filePath: string, baseDir: string): { valid: boolean; resolved: string; error?: string }`**: Validates paths against workspace boundaries, prevents path traversal, and detects symlink escapes using `WorkspaceIsolation`.
    *   **`validateWithIsolation(filePath: string, operation?: string): PathValidationResult`**: Directly exposes the detailed validation result from `WorkspaceIsolation`.

**Architecture Diagram:**

```mermaid
graph TD
    A[Agent File Operations] --> B{UnifiedVfsRouter.Instance};
    B -- "filePath.startsWith('memory://')" --> C[MemoryVfsProvider];
    B -- "Default (physical FS)" --> D[fs-extra (Physical File System)];
    C -- "Stores in .codebuddy/agent-memory" --> E[Disk];
    D -- "Accesses project files" --> E;
    B -- "Path Validation" --> F[WorkspaceIsolation];
```

**Connections:**

*   All file system interactions within the agent should ideally go through `UnifiedVfsRouter.Instance`.
*   It integrates with `WorkspaceIsolation` for robust security checks.
*   It uses `fs-extra` for physical file system operations.

### 8. Memory VFS Provider (`src/services/vfs/memory-vfs-provider.ts`)

The `MemoryVfsProvider` is an implementation of the `IVfsProvider` interface, designed for ephemeral file storage with a Time-To-Live (TTL) mechanism. It stores files in a dedicated directory (`.codebuddy/agent-memory/`) and automatically cleans up expired entries.

**Key Class:**

*   **`MemoryVfsProvider`**: The VFS provider for memory-backed files.

**Key Capabilities:**

*   **`constructor(config: Partial<MemoryVfsConfig>)`**: Initializes the provider with a base directory, default TTL, and cleanup interval.
*   **`readFile`, `writeFile`, `exists`, `stat`, `readdir`, `remove`, `rename`, `ensureDir`**: Implements all `IVfsProvider` methods, routing them to `fs-extra` within its designated `baseDir`.
*   **TTL Management**:
    *   **`setTtl(filePath: string, ttlMs: number): void`**: Sets a custom TTL for a specific file.
    *   **`isExpired(filePath: string): boolean`**: Checks if a file has passed its TTL.
    *   **`async cleanupExpired(): Promise<number>`**: Manually removes all expired files.
    *   **`private startCleanup(): void`**: Initiates a periodic cleanup process.
*   **Path Resolution**: Ensures that all file operations are confined to its `baseDir` to prevent path traversal.
*   **`dispose(): void`**: Stops the periodic cleanup timer and releases resources.

**Connections:**

*   This provider is designed to be mounted by the `UnifiedVfsRouter` at a specific prefix (e.g., `memory://`).
*   It uses `fs-extra` for underlying file system operations.

### 9. Analysis Types (`src/services/analysis/types.ts`) & Plan Types (`src/services/plan-types.ts`)

These files define the core data structures and enumerations used by the analysis and planning services. They ensure type safety, clarity, and consistency across the module.

**Key Types in `analysis/types.ts`:**

*   `CodeGuardianMode`, `IssueSeverity`, `IssueType`
*   `CodeIssue`, `FileDependency`, `FileAnalysis`
*   `CodeAnalysis`, `RefactorSuggestion`, `PatchStep`, `PatchPlan`, `PatchDiff`

**Key Types in `plan-types.ts`:**

*   `PlanPhase`, `PriorityLevel`, `RiskLevel`, `ActionType`
*   `PlanAction`, `PlanStep`, `PlanAnalysis`, `PlanMetadata`, `ExecutionPlan`

## Interactions and Dependencies

The `src/services` module is a collection of loosely coupled services, but they interact in specific ways:

*   **`PlanGenerator`** relies on **`PlanAnalyzer`** for plan validation and analysis updates.
*   **`UnifiedVfsRouter`** can mount **`MemoryVfsProvider`** (and potentially other VFS providers) to handle specific file paths.
*   **`UnifiedVfsRouter`** integrates with **`WorkspaceIsolation`** (from `src/workspace`) for security.
*   **`PromptBuilder`** has extensive dependencies on various context providers and managers (e.g., `EnhancedMemory`, `MoltbotHooksManager`, `PromptManager`, `KnowledgeManager`, `DocsContextProvider`, `RulesLoader`, `SkillManager`, `IdentityManager`, `CodingStyleAnalyzer`, `WorkflowRules`) from other modules to construct a comprehensive system prompt.
*   The agent's core logic (e.g., `src/agent/codebuddy-agent.ts`) instantiates and utilizes `PromptBuilder`, `CodebaseExplorer`, and `PlanGenerator`.
*   `SystemPromptOverride` modifies the output of `PromptBuilder`.

## Usage Patterns

Developers interacting with this module will typically:

1.  **Explore a Codebase**: Use `CodebaseExplorer` to get an overview of a project, find specific files, or generate reports.
2.  **Analyze Code**: Use `CodeAnalyzer` for static checks on individual files, often as part of a larger analysis pipeline.
3.  **Manage Execution Plans**: Use `PlanGenerator` to define, modify, track, and persist multi-step tasks, leveraging `PlanAnalyzer` for insights.
4.  **Build Agent Prompts**: The `PromptBuilder` is a core internal service for the agent, dynamically assembling the LLM's system prompt from many sources. Developers might extend it by adding new context providers.
5.  **Interact with the File System**: All file operations should ideally go through `UnifiedVfsRouter.Instance` to ensure consistency, security, and support for virtual file systems. This allows for flexible environments like sandboxed execution or in-memory workspaces.