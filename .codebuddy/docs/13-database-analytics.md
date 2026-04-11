# Database + analytics

<details>
<summary>Relevant source files</summary>

- `src/database/schema.ts`
- `src/database/database-manager.ts`
- `src/database/repositories/analytics-repository.ts`
- `src/events.ts`
- `src/database/repositories/session-repository.ts`
- `src/database/repositories/memory-repository.ts`
- `src/database/repositories/cache-repository.ts`
- `src/analytics.ts`

</details>

18 [modules](./3-commands-utils.md#modules) in the database + analytics subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "database-manager" --> "schema"
  "database-manager" --> "events"
  "session-repository" --> "schema"
  "session-repository" --> "database-manager"
  "analytics-repository" --> "schema"
  "analytics-repository" --> "database-manager"
  "memory-repository" --> "schema"
  "memory-repository" --> "database-manager"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/database/schema` | 0 | 0 | 12 |
| `src/database/database-manager` | 0 | 0 | 11 |
| `src/database/repositories/analytics-repository` | 0 | 0 | 4 |
| `src/events` | 0 | 0 | 2 |
| `src/database/repositories/session-repository` | 0 | 0 | 5 |
| `src/database/repositories/memory-repository` | 0 | 0 | 4 |
| `src/database/repositories/cache-repository` | 0 | 0 | 2 |
| `src/analytics` | 0 | 0 | 1 |
| `src/database/migration` | 0 | 0 | 1 |
| `src/database/repositories/embedding-repository` | 0 | 0 | 1 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/database/` (9), `src/learning/` (3), `src/memory/` (3), `src/utils/` (3), `src/analytics/` (2), `src/persistence/` (2), `src/server/` (1), `src/undo/` (1)
**Depends on:** `src/utils/` (2)

## Summary

**Database + analytics** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


---
[← Previous: Agent](./12-agent.md) | [Next: Agent + persistence →](./14-agent-persistence.md)
