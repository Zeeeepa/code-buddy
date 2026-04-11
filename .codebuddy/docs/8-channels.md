# Channels

<details>
<summary>Relevant source files</summary>

- `src/channels/core.ts`
- `src/channels/pro/types.ts`
- `src/channels/pro/scoped-auth.ts`
- `src/channels/reconnection-manager.ts`
- `src/channels/pro/run-tracker.ts`
- `src/channels/pro/ci-watcher.ts`
- `src/channels/pro/diff-first.ts`
- `src/channels/pro/enhanced-commands.ts`

</details>

40 [modules](./3-commands-utils.md#modules) in the channels subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "scoped-auth" --> "types"
  "run-tracker" --> "types"
  "ci-watcher" --> "scoped-auth"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/channels/core` | 0 | 0 | 24 |
| `src/channels/pro/types` | 0 | 0 | 6 |
| `src/channels/pro/scoped-auth` | 0 | 0 | 4 |
| `src/channels/reconnection-manager` | 0 | 0 | 6 |
| `src/channels/pro/run-tracker` | 0 | 0 | 4 |
| `src/channels/pro/ci-watcher` | 0 | 0 | 4 |
| `src/channels/pro/diff-first` | 0 | 0 | 2 |
| `src/channels/pro/enhanced-commands` | 0 | 0 | 2 |
| `src/channels/pro/run-commands` | 0 | 0 | 2 |
| `src/channels/pro/pro-features` | 0 | 0 | 1 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/channels/` (41)
**Depends on:** `src/channels/` (4), `src/utils/` (2)

## Summary

**Channels** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


**Referenced by:** [Key Concepts](./1-2-key-concepts.md) · [Testing](./27-testing.md)


---
[← Previous: Context + agent](./7-context-agent.md) | [Next: Codebuddy →](./9-codebuddy.md)
