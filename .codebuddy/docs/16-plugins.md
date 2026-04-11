# Plugins

<details>
<summary>Relevant source files</summary>

- `src/plugins/types.ts`
- `src/plugins/bundled/azure-provider.ts`
- `src/plugins/bundled/bedrock-provider.ts`
- `src/plugins/bundled/copilot-provider.ts`
- `src/plugins/bundled/fireworks-provider.ts`
- `src/plugins/bundled/groq-provider.ts`
- `src/plugins/bundled/ollama-provider.ts`
- `src/plugins/bundled/openrouter-provider.ts`

</details>

13 [modules](./3-commands-utils.md#modules) in the plugins subsystem

## [Module Dependencies](./3-commands-utils.md#module-dependencies)

```mermaid
graph TD
  "azure-provider" --> "types"
  "bedrock-provider" --> "types"
  "copilot-provider" --> "types"
  "fireworks-provider" --> "types"
  "groq-provider" --> "types"
```

## Modules

| Module | Functions | Classes | Imported By |
|--------|-----------|---------|-------------|
| `src/plugins/types` | 0 | 0 | 15 |
| `src/plugins/bundled/azure-provider` | 0 | 0 | 1 |
| `src/plugins/bundled/bedrock-provider` | 0 | 0 | 1 |
| `src/plugins/bundled/copilot-provider` | 0 | 0 | 1 |
| `src/plugins/bundled/fireworks-provider` | 0 | 0 | 1 |
| `src/plugins/bundled/groq-provider` | 0 | 0 | 1 |
| `src/plugins/bundled/ollama-provider` | 0 | 0 | 1 |
| `src/plugins/bundled/openrouter-provider` | 0 | 0 | 1 |
| `src/plugins/bundled/together-provider` | 0 | 0 | 1 |
| `src/plugins/bundled/vllm-provider` | 0 | 0 | 1 |

## [Key Functions](./3-commands-utils.md#key-functions)


## [Cross-Subsystem Dependencies](./3-commands-utils.md#cross-subsystem-dependencies)

**Imported by:** `src/plugins/` (12), `src/plugin-sdk/` (3)
**Depends on:** `src/utils/` (10), `src/context/` (1), `src/commands/` (1), `src/providers/` (1), `src/tools/` (1)

## Summary

**Plugins** covers:
1. **Module Dependencies**
2. **Modules**
3. **Key Functions**
4. **Cross-Subsystem Dependencies**


---

**See also:** [Commands + utils](./3-commands-utils.md)


**Referenced by:** [Testing](./27-testing.md)


---
[← Previous: Agent + utils (Todo-tracker)](./15-agent-utils-todo-tracker-.md) | [Next: Ui →](./17-ui.md)
