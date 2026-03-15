# Configuration System

Three-tier configuration hierarchy with environment variable overrides:

## Configuration Hierarchy

```
1. Default (in-code)     — Base behavior
2. User (~/.codebuddy/)  — Personal preferences
3. Project (.codebuddy/) — Project-specific settings
4. Environment variables — Runtime overrides
5. CLI flags             — Highest priority
```

## Key Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `config.toml` | `~/.codebuddy/` or `.codebuddy/` | Main configuration |
| `settings.json` | `.codebuddy/` | Model, theme, max rounds |
| `mcp.json` | `.codebuddy/` | MCP server configuration |
| `hooks.json` | `.codebuddy/` | Tool execution hooks |
| `CODEBUDDY.md` | `.codebuddy/` | Project instructions |
| `CONTEXT.md` | `.codebuddy/` | Additional context |
| `PROJECT_KNOWLEDGE.md` | `.codebuddy/` | Auto-generated project knowledge |

## Model Configuration

Models configured via `src/config/model-tools.ts` with glob matching:

- Per-model: `contextWindow`, `maxOutputTokens`, `patchFormat`
- Provider auto-detection from model name or base URL
- Supports: Grok, Claude, GPT, Gemini, Ollama, LM Studio