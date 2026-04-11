# Agent + security

<details>
<summary>Relevant source files</summary>

- `src/optimization/latency-optimizer.ts`
- `src/utils/cost-tracker.ts`
- `src/utils/token-counter.ts`
- `src/mcp/transports.ts`
- `src/checkpoints/checkpoint-manager.ts`
- `src/plugins/sandbox-worker.ts`
- `src/codebuddy/tools.ts`
- `src/errors.ts`

</details>

55 [modules](./3-commands-utils.md#modules) in the agent + security subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "errors"
  "checkpoint-manager"
  "token-counter"
  "tools"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/optimization/latency-optimizer` | 0 | 0 | 3 |
| `src/utils/cost-tracker` | 0 | 0 | 7 |
| `src/utils/token-counter` | 0 | 0 | 8 |
| `src/mcp/transports` | 0 | 0 | 2 |
| `src/checkpoints/checkpoint-manager` | 0 | 0 | 9 |
| `src/plugins/sandbox-worker` | 0 | 0 | 1 |
| `src/codebuddy/tools` | 0 | 0 | 8 |
| `src/errors` | 0 | 0 | 10 |
| `src/optimization/model-routing` | 0 | 0 | 6 |
| `src/utils/json-validator` | 0 | 0 | 1 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/agent/` (30), `src/commands/` (6), `src/ui/` (4), `src/optimization/` (2), `src/services/` (2), `src/infrastructure/` (2), `src/mcp/` (2), `src/tools/` (2)
**Depends on:** `src/utils/` (3), `src/mcp/` (2), `src/tools/` (2), `src/database/` (1), `src/types/` (1), `src/codebuddy/` (1), `src/plugins/` (1)

## Summary

**Agent + security** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


---
[← Previous: Tools](./5-tools.md) | [Next: Context + agent →](./7-context-agent.md)
