# Agent

<details>
<summary>Relevant source files</summary>

- `src/agent/repo-profiling/types.ts`
- `src/agent/repo-profiling/fs-helpers.ts`
- `src/agent/repo-profiling/languages/language-profiler.ts`
- `src/agent/repo-profiling/repo-profiler.ts`
- `src/agent/repo-profiling/infrastructure/directory-profiler.ts`
- `src/agent/repo-profiling/cache.ts`
- `src/agent/repo-profiling/context-pack.ts`
- `src/agent/repo-profiling/infrastructure.ts`

</details>

21 [modules](./3-commands-utils.md#modules) in the agent subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "language-profiler" --> "types"
  "language-profiler" --> "fs-helpers"
  "repo-profiler" --> "types"
  "repo-profiler" --> "fs-helpers"
  "repo-profiler" --> "cache"
  "repo-profiler" --> "context-pack"
  "repo-profiler" --> "languages"
  "repo-profiler" --> "infrastructure"
  "directory-profiler" --> "types"
  "directory-profiler" --> "fs-helpers"
  "cache" --> "types"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/agent/repo-profiling/types` | 0 | 0 | 15 |
| `src/agent/repo-profiling/fs-helpers` | 0 | 0 | 13 |
| `src/agent/repo-profiling/languages/language-profiler` | 0 | 0 | 9 |
| `src/agent/repo-profiling/repo-profiler` | 0 | 0 | 1 |
| `src/agent/repo-profiling/infrastructure/directory-profiler` | 0 | 0 | 1 |
| `src/agent/repo-profiling/cache` | 0 | 0 | 1 |
| `src/agent/repo-profiling/context-pack` | 0 | 0 | 1 |
| `src/agent/repo-profiling/infrastructure` | 0 | 0 | 1 |
| `src/agent/repo-profiling/languages` | 0 | 0 | 1 |
| `src/agent/repo-profiling/languages/dotnet-profiler` | 0 | 0 | 1 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/agent/` (29)
**Depends on:** `src/utils/` (1)

## Summary

**Agent** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


**Referenced by:** [Overview](./1-overview.md) · [Key Concepts](./1-2-key-concepts.md) · [Testing](./27-testing.md)


---
[← Previous: Tools (Unified-vfs-router)](./11-tools-unified-vfs-router-.md) | [Next: Database + analytics →](./13-database-analytics.md)
