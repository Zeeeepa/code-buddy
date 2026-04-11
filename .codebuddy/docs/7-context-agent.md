# Context + agent

<details>
<summary>Relevant source files</summary>

- `src/codebuddy/client.ts`
- `src/persistence/conversation-branches.ts`
- `src/utils/retry.ts`
- `src/config/model-tools.ts`
- `src/utils/rate-limit-display.ts`
- `src/providers/circuit-breaker.ts`
- `src/tools/types.ts`
- `src/context/context-engine.ts`

</details>

48 [modules](./3-commands-utils.md#modules) in the context + agent subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "client" --> "model-tools"
  "client" --> "retry"
  "client" --> "circuit-breaker"
  "client" --> "rate-limit-display"
  "context-engine" --> "client"
  "types" --> "client"
  "conversation-branches" --> "client"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/codebuddy/client` | 0 | 0 | 66 |
| `src/persistence/conversation-branches` | 0 | 0 | 2 |
| `src/utils/retry` | 0 | 0 | 3 |
| `src/config/model-tools` | 0 | 0 | 3 |
| `src/utils/rate-limit-display` | 0 | 0 | 2 |
| `src/providers/circuit-breaker` | 0 | 0 | 1 |
| `src/tools/types` | 0 | 0 | 4 |
| `src/context/context-engine` | 0 | 0 | 5 |
| `src/context/token-counter` | 0 | 0 | 9 |
| `src/context/types` | 0 | 0 | 3 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/agent/` (32), `src/context/` (22), `src/commands/` (7), `src/tools/` (7), `src/streaming/` (3), `src/cache/` (2), `src/lsp/` (2), `src/optimization/` (2)
**Depends on:** `src/utils/` (7)

## Summary

**Context + agent** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


---
[← Previous: Agent + security](./6-agent-security.md) | [Next: Channels →](./8-channels.md)
