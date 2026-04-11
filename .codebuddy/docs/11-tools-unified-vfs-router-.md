# Tools (Unified-vfs-router)

<details>
<summary>Relevant source files</summary>

- `src/services/vfs/unified-vfs-router.ts`
- `src/workspace/workspace-isolation.ts`
- `src/tools/intelligence/ast-parser.ts`
- `src/tools/intelligence/dependency-analyzer.ts`
- `src/tools/intelligence/symbol-search.ts`
- `src/services/vfs/memory-vfs-provider.ts`
- `src/sync/index.ts`
- `src/tools/batch-processor.ts`

</details>

22 [modules](./3-commands-utils.md#modules) in the tools subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "unified-vfs-router" --> "workspace-isolation"
  "ast-parser" --> "unified-vfs-router"
  "dependency-analyzer" --> "unified-vfs-router"
  "dependency-analyzer" --> "ast-parser"
  "symbol-search" --> "unified-vfs-router"
  "symbol-search" --> "ast-parser"
  "memory-vfs-provider" --> "unified-vfs-router"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/services/vfs/unified-vfs-router` | 0 | 0 | 45 |
| `src/workspace/workspace-isolation` | 0 | 0 | 1 |
| `src/tools/intelligence/ast-parser` | 0 | 0 | 4 |
| `src/tools/intelligence/dependency-analyzer` | 0 | 0 | 2 |
| `src/tools/intelligence/symbol-search` | 0 | 0 | 2 |
| `src/services/vfs/memory-vfs-provider` | 0 | 0 | 0 |
| `src/sync/index` | 0 | 0 | 0 |
| `src/tools/batch-processor` | 0 | 0 | 0 |
| `src/tools/changelog-generator` | 0 | 0 | 0 |
| `src/tools/code-formatter` | 0 | 0 | 0 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/tools/` (42), `src/context/` (1)
**Depends on:** `src/utils/` (3), `src/optimization/` (1), `src/types/` (1)

## Summary

**Tools (Unified-vfs-router)** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


---
[← Previous: Commands](./10-commands.md) | [Next: Agent →](./12-agent.md)
