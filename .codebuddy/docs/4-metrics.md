# Code Quality Metrics

## Dead Code Analysis

| Confidence | Count |
|---|---|
| High | 3095 |
| Medium | 0 |
| Low | 1910 |
| **Total** | **5239** |

### Top Dead Code Candidates

- `fn:A2AAgentClient.getAgentCard` (high confidence)
- `fn:A2AAgentClient.getTask` (high confidence)
- `fn:A2AAgentClient.listAgents` (high confidence)
- `fn:A2AAgentClient.registerAgent` (high confidence)
- `fn:A2AAgentClient.submitTask` (high confidence)
- `fn:A2AAgentServer.cancelTask` (high confidence)
- `fn:A2AAgentServer.getAgentCard` (high confidence)
- `fn:A2AAgentServer.getTask` (high confidence)
- `fn:A2AAgentServer.submitTask` (high confidence)
- `fn:A2UIManager.cb` (high confidence)
- `fn:A2UIManager.getSurface` (high confidence)
- `fn:A2UIManager.handleUserAction` (high confidence)
- `fn:A2UIManager.renderToHTML` (high confidence)
- `fn:A2UIManager.renderToTerminal` (high confidence)
- `fn:A2UIManager.sendCanvasEvent` (high confidence)

## Module Coupling

| Module A | Module B | Calls | Imports | Total |
|---|---|---|---|---|
| src/browser-automation/browser-tool | src/tools/browser-tool | 29 | 0 | 29 |
| src/tools/browser-tool | src/tools/browser/playwright-tool | 20 | 0 | 20 |
| src/middleware/middlewares | src/middleware/types | 19 | 0 | 19 |
| src/agent/repo-profiling/infrastructure/index | src/agent/repo-profiling/infrastructure/project-meta | 15 | 0 | 15 |
| src/errors/index | src/tools/git-tool | 13 | 0 | 13 |
| src/docs/docs-generator | src/tools/doc-generator | 11 | 0 | 11 |
| src/cache/cache-manager | src/utils/cache | 10 | 0 | 10 |
| src/tools/docker-tool | src/utils/confirmation-service | 10 | 0 | 10 |
| src/tools/kubernetes-tool | src/utils/confirmation-service | 10 | 0 | 10 |
| src/commands/handlers/debug-handlers | src/utils/debug-logger | 9 | 0 | 9 |
| src/themes/theme-manager | src/ui/context/theme-context | 9 | 0 | 9 |
| src/agent/parallel/parallel-executor | src/optimization/parallel-executor | 8 | 0 | 8 |
| src/commands/handlers/branch-handlers | src/persistence/conversation-branches | 8 | 0 | 8 |
| src/commands/handlers/core-handlers | src/utils/autonomy-manager | 8 | 0 | 8 |
| src/context/pruning/index | src/context/pruning/ttl-manager | 8 | 0 | 8 |

Most dependent module: `src/utils/validators`
Most depended-upon: `src/utils/validators`

## Refactoring Suggestions

- **getErrorMessage**: Called by 155 functions — high coupling, consider interface extraction (rank: 1.000, 155 callers, 0 cross-community)
- **isExpired**: Called by 10 functions — high coupling, consider interface extraction (rank: 0.626, 10 callers, 0 cross-community)
- **send**: Called by 41 functions — high coupling, consider interface extraction (rank: 0.547, 41 callers, 0 cross-community)
- **SubagentManager.spawn**: Called by 96 functions — high coupling, consider interface extraction (rank: 0.444, 96 callers, 0 cross-community)
- **generateId**: Called by 17 functions — high coupling, consider interface extraction (rank: 0.429, 17 callers, 0 cross-community)
- **createId**: Called by 27 functions — high coupling, consider interface extraction (rank: 0.427, 27 callers, 0 cross-community)
- **DesktopAutomationManager.ensureProvider**: Called by 30 functions — high coupling, consider interface extraction (rank: 0.363, 30 callers, 0 cross-community)
- **tokenize**: Called by 20 functions — high coupling, consider interface extraction (rank: 0.345, 20 callers, 0 cross-community)
- **BrowserManager.getCurrentPage**: Called by 35 functions — high coupling, consider interface extraction (rank: 0.336, 35 callers, 0 cross-community)
- **formatSize**: Called by 20 functions — high coupling, consider interface extraction (rank: 0.301, 20 callers, 0 cross-community)
