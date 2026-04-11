# Commands

<details>
<summary>Relevant source files</summary>

- `src/commands/handlers/branch-handlers.ts`
- `src/voice/speech-recognition.ts`
- `src/utils/telemetry-config.ts`
- `src/tools/codebase-replace-tool.ts`
- `src/intelligence/proactive-suggestions.ts`
- `src/personas/persona-manager.ts`
- `src/testing/coverage-targets.ts`
- `src/voice/voice-to-code.ts`

</details>

24 [modules](./3-commands-utils.md#modules) in the commands subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "branch-handlers"
  "telemetry-config"
  "codebase-replace-tool"
  "speech-recognition"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/commands/handlers/branch-handlers` | 0 | 0 | 27 |
| `src/voice/speech-recognition` | 0 | 0 | 1 |
| `src/utils/telemetry-config` | 0 | 0 | 2 |
| `src/tools/codebase-replace-tool` | 0 | 0 | 2 |
| `src/intelligence/proactive-suggestions` | 0 | 0 | 1 |
| `src/personas/persona-manager` | 0 | 0 | 1 |
| `src/testing/coverage-targets` | 0 | 0 | 1 |
| `src/voice/voice-to-code` | 0 | 0 | 1 |
| `src/observability/tracing` | 0 | 0 | 1 |
| `src/commands/handlers/bug-handler` | 0 | 0 | 0 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/commands/` (32), `src/observability/` (2), `src/tools/` (1)
**Depends on:** `src/utils/` (3), `src/agent/` (1), `src/persistence/` (1), `src/voice/` (1), `src/tools/` (1)

## Summary

**Commands** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


**Referenced by:** [API Reference](./26-api-reference.md) · [Testing](./27-testing.md)


---
[← Previous: Codebuddy](./9-codebuddy.md) | [Next: Tools (Unified-vfs-router) →](./11-tools-unified-vfs-router-.md)
