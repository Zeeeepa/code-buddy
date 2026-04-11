# Agent + utils (Todo-tracker)

<details>
<summary>Relevant source files</summary>

- `src/agent/todo-tracker.ts`
- `src/utils/output-sanitizer.ts`
- `src/utils/sanitize.ts`
- `src/agent/execution/agent-executor.ts`
- `src/context/restorable-compression.ts`
- `src/agent/execution/query-classifier.ts`
- `src/agent/middleware.ts`
- `src/agent/response-constraint.ts`

</details>

15 [modules](./3-commands-utils.md#modules) in the agent + utils subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
 "sanitize" --> "output-sanitizer"
 "agent-executor" --> "sanitize"
 "agent-executor" --> "output-sanitizer"
 "agent-executor" --> "middleware"
 "agent-executor" --> "todo-tracker"
 "agent-executor" --> "observation-variator"
 "agent-executor" --> "restorable-compression"
 "agent-executor" --> "response-constraint"
 "agent-executor" --> "proactive-compaction"
 "agent-executor" --> "query-classifier"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/agent/todo-tracker` | 0 | 0 | 3 |
| `src/utils/output-sanitizer` | 0 | 0 | 2 |
| `src/utils/sanitize` | 0 | 0 | 3 |
| `src/agent/execution/agent-executor` | 0 | 0 | 1 |
| `src/context/restorable-compression` | 0 | 0 | 2 |
| `src/agent/execution/query-classifier` | 0 | 0 | 1 |
| `src/agent/middleware` | 0 | 0 | 1 |
| `src/agent/response-constraint` | 0 | 0 | 1 |
| `src/context/observation-variator` | 0 | 0 | 1 |
| `src/context/proactive-compaction` | 0 | 0 | 1 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/tools/` (2), `src/agent/` (2), `src/commands/` (1), `src/streaming/` (1)
**Depends on:** `src/utils/` (7), `src/agent/` (6), `src/context/` (3), `src/codebuddy/` (1), `src/errors/` (1), `src/concurrency/` (1), `src/memory/` (1)

## Summary

**Agent + utils (Todo-tracker)** covers:...
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


---
[← Previous: Agent + persistence](./14-agent-persistence.md) | [Next: Plugins →](./16-plugins.md)
