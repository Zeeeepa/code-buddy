# Agent + persistence

<details>
<summary>Relevant source files</summary>

- `src/agent/types.ts`
- `src/agent/profiles.ts`
- `src/persistence/session-store.ts`
- `src/agent/operating-modes.ts`
- `src/persistence/session-lock.ts`
- `src/context/context-files.ts`
- `src/agent/profiles/types.ts`
- `src/agent/agent-mode.ts`

</details>

17 [modules](./3-commands-utils.md#modules) in the agent + persistence subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "session-store" --> "types"
  "session-store" --> "session-lock"
  "operating-modes" --> "profiles"
  "agent-mode" --> "operating-modes"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/agent/types` | 0 | 0 | 10 |
| `src/agent/profiles` | 0 | 0 | 1 |
| `src/persistence/session-store` | 0 | 0 | 9 |
| `src/agent/operating-modes` | 0 | 0 | 3 |
| `src/persistence/session-lock` | 0 | 0 | 1 |
| `src/context/context-files` | 0 | 0 | 1 |
| `src/agent/profiles/types` | 0 | 0 | 1 |
| `src/agent/agent-mode` | 0 | 0 | 3 |
| `src/security/session-encryption` | 0 | 0 | 1 |
| `src/mcp/mcp-resources` | 0 | 0 | 1 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/agent/` (17), `src/mcp/` (3), `src/types/` (1), `src/cli/` (1), `src/infrastructure/` (1), `src/server/` (1)
**Depends on:** `src/database/` (2), `src/codebuddy/` (1), `src/types/` (1), `src/utils/` (1)

## Summary

**Agent + persistence** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


---
[← Previous: Database + analytics](./13-database-analytics.md) | [Next: Agent + utils (Todo-tracker) →](./15-agent-utils-todo-tracker-.md)
