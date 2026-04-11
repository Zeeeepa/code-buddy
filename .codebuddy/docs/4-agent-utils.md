# Agent + utils

<details>
<summary>Relevant source files</summary>

- `src/utils/logger.ts`
- `src/workflows/types.ts`
- `src/utils/session-enhancements.ts`
- `src/workflows/state-manager.ts`
- `src/workflows/step-manager.ts`
- `src/advanced/session-replay.ts`
- `src/agent/agent-loader.ts`
- `src/agent/background-tasks.ts`

</details>

145 [modules](./3-commands-utils.md#modules) in the agent + utils subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "session-enhancements" --> "logger"
  "step-manager" --> "logger"
  "step-manager" --> "types"
  "session-replay" --> "logger"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/utils/logger` | 0 | 0 | 481 |
| `src/workflows/types` | 0 | 0 | 1 |
| `src/utils/session-enhancements` | 0 | 0 | 1 |
| `src/workflows/state-manager` | 0 | 0 | 1 |
| `src/workflows/step-manager` | 0 | 0 | 1 |
| `src/advanced/session-replay` | 0 | 0 | 0 |
| `src/agent/agent-loader` | 0 | 0 | 0 |
| `src/agent/background-tasks` | 0 | 0 | 0 |
| `src/agent/cache-trace` | 0 | 0 | 0 |
| `src/agent/definitions/agent-definition-loader` | 0 | 0 | 0 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/agent/` (56), `src/tools/` (46), `src/context/` (30), `src/utils/` (27), `src/channels/` (25), `src/security/` (23), `src/commands/` (20), `src/plugins/` (18)

## Summary

**Agent + utils** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


---
[← Previous: Commands + utils](./3-commands-utils.md) | [Next: Tools →](./5-tools.md)
