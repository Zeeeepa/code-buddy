# Tools

<details>
<summary>Relevant source files</summary>

- `src/types.ts`
- `src/knowledge/knowledge-graph.ts`
- `src/tools/registry/types.ts`
- `src/knowledge/graph-pagerank.ts`
- `src/tools.ts`
- `src/tools/base-tool.ts`
- `src/knowledge/community-detection.ts`
- `src/knowledge/knowledge-manager.ts`

</details>

126 [modules](./3-commands-utils.md#modules) in the tools subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "knowledge-graph" --> "graph-pagerank"
  "base-tool" --> "types"
  "community-detection" --> "knowledge-graph"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/types` | 0 | 0 | 155 |
| `src/knowledge/knowledge-graph` | 0 | 0 | 33 |
| `src/tools/registry/types` | 0 | 0 | 38 |
| `src/knowledge/graph-pagerank` | 0 | 0 | 2 |
| `src/tools` | 0 | 0 | 8 |
| `src/tools/base-tool` | 0 | 0 | 6 |
| `src/knowledge/community-detection` | 0 | 0 | 3 |
| `src/knowledge/knowledge-manager` | 0 | 0 | 2 |
| `src/knowledge/scanners` | 0 | 0 | 2 |
| `src/security/dependency-vuln-scanner` | 0 | 0 | 2 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/tools/` (151), `src/agent/` (31), `src/knowledge/` (19), `src/commands/` (8), `src/context/` (8), `src/docs/` (6), `src/input/` (3), `src/hooks/` (2)
**Depends on:** `src/utils/` (3), `src/knowledge/` (1)

## Summary

**Tools** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


**Referenced by:** [Overview](./1-overview.md) · [Testing](./27-testing.md)


---
[← Previous: Agent + utils](./4-agent-utils.md) | [Next: Agent + security →](./6-agent-security.md)
