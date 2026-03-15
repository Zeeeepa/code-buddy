# Code Quality Metrics

This document provides a comprehensive overview of key code quality metrics, offering insights into the maintainability, efficiency, and architectural health of the codebase. Understanding these metrics is crucial for identifying areas for improvement, reducing technical debt, and ensuring the long-term viability and scalability of the project. By regularly reviewing these metrics, development teams can make informed decisions to enhance code quality and streamline future development efforts.

## Dead Code Analysis

This section presents the findings from the dead code analysis, identifying parts of the codebase that are no longer reachable or used. Eliminating dead code is vital for reducing the overall bundle size, improving performance, and simplifying the codebase, making it easier to understand and maintain. It also reduces cognitive load for developers by removing irrelevant code paths.

The following table summarizes the total count of identified dead code candidates, categorized by the confidence level of the analysis. High confidence indicates a strong likelihood that the code is indeed unused and can be safely removed, while low confidence may warrant further investigation.

| Confidence | Count |
|---|---|
| High | 3097 |
| Medium | 0 |
| Low | 1910 |
| **Total** | **5241** |

### Top Dead Code Candidates

*Note: Exported API methods and dynamic dispatch targets are excluded.*

The following methods and components have been identified as highly confident dead code candidates. Many of these appear to be related to UI management (specifically the `A2UIManager` class, likely found in `src/ui/a2-ui-manager.ts`) and inter-agent communication routing (via the `ACPRouter` class, likely in `src/agent/acp-router.ts`), suggesting potential refactoring or removal of deprecated UI or agent interaction patterns.

- `A2UIManager.cb` (high confidence)
- `A2UIManager.handleUserAction` (high confidence)
- `A2UIManager.renderToHTML` (high confidence)
- `A2UIManager.renderToTerminal` (high confidence)
- `A2UIManager.sendCanvasEvent` (high confidence)
- `A2UIManager.shutdown` (high confidence)
- `A2UITool.getManager` (high confidence)
- `ACPRouter.clearLog` (high confidence)
- `ACPRouter.findByCapability` (high confidence)
- `ACPRouter.getAgent` (high confidence)
- `ACPRouter.getAgents` (high confidence)
- `ACPRouter.getLog` (high confidence)
- `ACPRouter.register` (high confidence)
- `ACPRouter.reject` (high confidence)
- `ACPRouter.request` (high confidence)

**See also:** [Architecture](./2-architecture.md) for an overview of core components like `A2UIManager` and `ACPRouter`.

## Module Coupling

Module coupling measures the degree of interdependence between different modules in the system. High coupling can lead to a brittle architecture, where changes in one module frequently necessitate changes in many others, increasing the risk of bugs and making development slower. This analysis highlights modules with significant interdependencies, indicating potential areas for architectural refactoring to improve modularity and reduce complexity.

The table below details the top module-to-module coupling relationships, quantifying dependencies by the number of calls and imports. Understanding these relationships is crucial for identifying tightly coupled components that might benefit from refactoring to improve maintainability and testability.

| Module A | Module B | Calls | Imports | Total |
|---|---|---|---|---|
| `src/browser-automation/browser-tool` | `src/tools/browser-tool` | 29 | 0 | 29 |
| `src/tools/browser-tool` | `src/tools/browser/playwright-tool` | 20 | 0 | 20 |
| `src/middleware/middlewares` | `src/middleware/types` | 19 | 0 | 19 |
| `src/agent/repo-profiling/infrastructure/index` | `src/agent/repo-profiling/infrastructure/project-meta` | 15 | 0 | 15 |
| `src/errors/index` | `src/tools/git-tool` | 13 | 0 | 13 |
| `src/docs/docs-generator` | `src/tools/doc-generator` | 12 | 0 | 12 |
| `src/cache/cache