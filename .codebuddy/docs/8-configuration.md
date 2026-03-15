```markdown
# Configuration System

The configuration system is a foundational component of the application, providing a flexible and robust mechanism for managing settings across various environments and user preferences. It establishes a clear hierarchy for how different configuration sources are loaded and prioritized, ensuring that everything from API keys to model parameters can be customized and overridden as needed. Understanding this system is crucial for both developers and users to effectively tailor the application's behavior. The core logic for loading and merging configurations is typically handled by a central configuration service, often found in `src/config/config-service.ts` or similar.

## Configuration Hierarchy

This section details the multi-layered approach to configuration, ensuring that settings can be applied at various scopes—from system defaults to project-specific overrides and runtime environment variables. Understanding this hierarchy is crucial for debugging unexpected behavior and correctly applying custom settings, as it dictates the order in which configuration sources are consulted and merged. The system prioritizes configurations from the highest number, meaning CLI flags override environment variables, which override project settings, and so on.

```mermaid
graph TD
    A[1. Default (in-code)] --> B[2. User (~/.codebuddy/)]
    B --> C[3. Project (.codebuddy/)]
    C --> D[4. Environment variables]
    D --> E[5. CLI flags]

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#bfb,stroke:#333,stroke-width:2px
    style D fill:#fbb,stroke:#333,stroke-width:2px
    style E fill:#ffb,stroke:#333,stroke-width:2px
```

```
1. Default (in-code)     — Base behavior
2. User (~/.codebuddy/)  — Personal preferences
3. Project (.codebuddy/) — Project-specific settings
4. Environment variables — Runtime overrides
5. CLI flags             — Highest priority
```

## Key Configuration Files

This section lists the primary configuration and data files that the system interacts with, detailing their typical locations. These files are essential for defining project settings, storing operational memory, and managing local preferences, often residing in the project root or within the dedicated `.codebuddy/` directory, which is managed by the application's internal file system utilities (e.g., `src/util/file-system.ts`).

| File | Location |
|------|----------|
| `tsconfig.json` | project root |
| `.prettierrc` | project root |
| `vitest.config.ts` | project root |
| `.env.example` | project root |
| `AUDIT-REPORT.md` | .codebuddy/ |
| `autonomy.json` | .codebuddy/ |
| `code-graph-snapshot.json` | .codebuddy/ |
| `code-graph.json` | .codebuddy/ |
| `CODEBUDDY.md` | .codebuddy/ |
| `CODEBUDDY_MEMORY.md` | .codebuddy/ |
| `CONTEXT.md` | .codebuddy/ |
| `GROK.md` | .codebuddy/ |
| `HEARTBEAT.md` | .codebuddy/ |
| `hooks.json` | .codebuddy/ |
| `settings.local.json` | .claude/ |

See also: [Context & Memory](./7-context-memory.md) for details on files like `CODEBUDDY_MEMORY.md` and `CONTEXT.md`.

## Environment Variables

Environment variables provide a powerful mechanism for runtime configuration, allowing sensitive information like API keys to be injected without being committed to version control, and enabling easy deployment across different environments. They represent the fourth tier in the configuration hierarchy, overriding project and user-specific settings, and are typically accessed via `process.env` in Node.js applications.

| Variable | Description |
|----------|-------------|
| `GROK_API_KEY` | API Key (required) |

## Model Configuration

The Model Configuration system defines how the application interacts with various Large Language Models (LLMs), including their specific parameters and provider details. This is critical for ensuring compatibility, optimizing performance, and managing costs across different AI services. All model-related settings are primarily managed through `src/config/model-tools.ts`, which uses glob matching for flexible configuration and provides a unified interface for LLM interactions.

### Key Methods in `src/config/model-tools.ts`

The `src/config/model-tools.ts` module is central to managing LLM interactions, offering methods to retrieve model-specific settings and resolve their underlying providers.

| Method | Purpose |
|---|---|
| `getModelConfig(modelName: string)` | Retrieves the specific configuration for a given model, including context window and output token limits. This method is crucial for dynamically adjusting prompt sizes and response expectations. |
| `resolveModelProvider(modelName: string)` | Determines the LLM provider (e.g., Grok, Claude, OpenAI) based on the model name or configured base URL. This allows the system to correctly route requests to the appropriate API client. |
| `getAvailableModels()` | Lists all models configured and available for use within the system, respecting provider availability and any feature flags. |

Models configured via `src/config/model-tools.ts` with glob matching:

- Per-model: `contextWindow`, `maxOutputTokens`, `patchFormat`
- Provider auto-detection from model name or base URL
- Supports: Grok, Claude, GPT, Gemini, Ollama, LM Studio

See also: [Tool System](./5-tools.md) for how models integrate with available tools, and [Context & Memory](./7-context-memory.md) for how `contextWindow` parameters influence prompt construction.

---

**See also:** [Overview](./1-overview.md) · [Tool System](./5-tools.md) · [Context & Memory](./7-context-memory.md) · [Development Guide](./10-development.md)

**Key source files:** `src/config/model-tools.ts`, `src/config/config-service.ts`
```