# @phuetz/code-buddy v0.5.0

> Open-source multi-provider AI coding agent for the terminal. Supports Grok, Claude, ChatGPT, Gemini, Ollama and LM Studio with 52+ tools, multi-channel messaging, skills system, and OpenClaw-inspired architecture.

@phuetz/code-buddy is a terminal-based AI coding agent built in TypeScript/Node.js. It supports multiple LLM providers with automatic failover and provides 14 302 functions across 1075 modules.

## Key Capabilities

- Multi-channel messaging (Telegram, Discord, Slack, WhatsApp, etc.)
- Background daemon with health monitoring
- Voice interaction with wake-word activation
- Sandboxed execution (Docker, OS-level)
- Advanced reasoning (Tree-of-Thought, MCTS)
- Code graph analysis (49084 relationships)
- Automated program repair (fault localization + LLM)
- Agent-to-Agent protocol (Google A2A spec)
- Workflow engine with DAG execution
- Cloud deployment (Fly.io, Railway, Render, GCP)

## Project Statistics

| Metric | Value |
|--------|-------|
| Version | 0.5.0 |
| Modules | 1075 |
| Classes | 906 |
| Functions | 14 302 |
| Code Relationships | 49 084 |
| Dependencies | 35 |
| Dev Dependencies | 23 |

## Core Modules (by architectural importance)

Ranked by PageRank — higher rank means more modules depend on this one:

| Module | PageRank | Importers | Description |
|--------|----------|-----------|-------------|
| `src/channels/dm-pairing` | 0.019 | 9 | Messaging channel integrations |
| `src/codebuddy/client` | 0.018 | 11 | LLM client and tool definitions |
| `src/agent/codebuddy-agent` | 0.013 | 10 | Core agent system |
| `src/optimization/cache-breakpoints` | 0.010 | 2 | cache breakpoints |
| `src/agent/extended-thinking` | 0.010 | 1 | Core agent system |
| `src/memory/enhanced-memory` | 0.009 | 2 | Memory and persistence |
| `src/persistence/session-store` | 0.008 | 6 | session store |
| `src/channels/index` | 0.007 | 5 | Messaging channel integrations |
| `src/agent/repo-profiling/cartography` | 0.007 | 1 | Core agent system |
| `src/nodes/device-node` | 0.006 | 2 | device node |
| `src/codebuddy/tools` | 0.006 | 4 | LLM client and tool definitions |
| `src/tools/screenshot-tool` | 0.006 | 3 | Tool implementations |
| `src/agent/repo-profiler` | 0.005 | 3 | Core agent system |
| `src/deploy/cloud-configs` | 0.005 | 2 | Cloud deployment |
| `src/embeddings/embedding-provider` | 0.005 | 2 | embedding provider |
| `src/utils/confirmation-service` | 0.005 | 3 | confirmation service |
| `src/prompts/prompt-manager` | 0.005 | 3 | prompt manager |
| `src/commands/dev/workflows` | 0.005 | 2 | CLI and slash commands |
| `src/agent/specialized/agent-registry` | 0.005 | 1 | Core agent system |
| `src/agent/thinking/extended-thinking` | 0.005 | 1 | Core agent system |

## Entry Points

- **`src/channels/index`** — Messaging channel integrations (5 dependents)
- **`src/daemon/index`** — Background daemon service (2 dependents)
- **`src/server/index`** — HTTP/WebSocket server (2 dependents)
- **`src/index`** — index (0 dependents)

## Technology Stack

| Category | Technologies |
|----------|-------------|
| CLI Framework | commander |
| Terminal UI | ink, react |
| LLM SDKs | openai |
| HTTP Server | express, ws, cors |
| Database | better-sqlite3 |
| Validation | zod |