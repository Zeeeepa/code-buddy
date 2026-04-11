# Commands + utils

<details>
<summary>Relevant source files</summary>

- `src/agent/codebuddy-agent.ts`
- `src/config/constants.ts`
- `src/utils/base-url.ts`
- `src/utils/model-utils.ts`
- `src/utils/settings-manager.ts`
- `src/utils/confirmation-service.ts`
- `src/commands/slash/types.ts`
- `src/server/middleware.ts`

</details>

190 modules in the commands + utils subsystem

## Module [Dependencies](./20-client.md#dependencies)

```mermaid
graph TD
  "codebuddy-agent" --> "settings-manager"
  "settings-manager" --> "base-url"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/agent/codebuddy-agent` | 0 | 0 | 41 |
| `src/config/constants` | 0 | 0 | 10 |
| `src/utils/base-url` | 0 | 0 | 2 |
| `src/utils/model-utils` | 0 | 0 | 2 |
| `src/utils/settings-manager` | 0 | 0 | 13 |
| `src/utils/confirmation-service` | 0 | 0 | 21 |
| `src/commands/slash/types` | 0 | 0 | 3 |
| `src/server/middleware` | 0 | 0 | 10 |
| `src/utils/glob-utils` | 0 | 0 | 5 |
| `src/commands/slash-commands` | 0 | 0 | 7 |

## Key Functions


## Cross-Subsystem Dependencies

**Imported by:** `src/commands/` (38), `src/server/` (16), `src/tools/` (13), `src/ui/` (7), `src/mcp/` (5), `src/app/` (3), `src/cli/` (3), `src/hooks/` (3)
**Depends on:** `src/agent/` (9), `src/utils/` (7), `src/security/` (3), `src/codebuddy/` (2), `src/skills/` (2), `src/analytics/` (2), `src/persistence/` (1), `src/types/` (1)

## Summary

**Commands + utils** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Agent + utils](./4-agent-utils.md) · [Tools](./5-tools.md) · [Agent + security](./6-agent-security.md) · [Context + agent](./7-context-agent.md)


**Referenced by:** [Overview](./1-overview.md) · [Agent + utils](./4-agent-utils.md) · [Tools](./5-tools.md) · [Agent + security](./6-agent-security.md) · [Context + agent](./7-context-agent.md) · [Channels](./8-channels.md)


---
[← Previous: Architecture](./2-architecture.md) | [Next: Agent + utils →](./4-agent-utils.md)
