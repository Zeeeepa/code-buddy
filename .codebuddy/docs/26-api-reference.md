# API Reference

## CLI [Commands](./10-commands.md)

| Command | Description |
|---------|-------------|
| `git` | — |
| `commit-and-push` | — |
| `channels` | — |
| `server` | — |
| `mcp-server` | — |
| `backup [subcommand] [args...]` | — |
| `cloud [subcommand] [args...]` | — |

## HTTP API

| Method | Path |
|--------|------|
| `GET` | `/.well-known/agent.json` |
| `GET` | `/agents` |
| `POST` | `/tasks/send` |
| `GET` | `/tasks/:id` |
| `POST` | `/tasks/:id/cancel` |
| `GET` | `/agents/by-skill/:skillId` |
| `POST` | `/send` |
| `GET` | `/agents` |
| `POST` | `/request` |
| `GET` | `/tasks/:id` |
| `POST` | `/tasks/:id/yield` |
| `POST` | `/tasks/:id/resume` |
| `POST` | `/sessions` |
| `GET` | `/sessions` |
| `GET` | `/sessions/:name` |
| `DELETE` | `/sessions/:name` |
| `POST` | `/sessions/:name/cancel` |
| `POST` | `/sessions/:name/close` |
| `POST` | `/` |
| `POST` | `/completions` |
| `GET` | `/models` |
| `POST` | `/` |
| `GET` | `/` |
| `GET` | `/:id` |
| `GET` | `/:id/stream` |
| `POST` | `/:id/cancel` |
| `DELETE` | `/:id` |
| `GET` | `/:id/logs` |
| `GET` | `/` |
| `GET` | `/*` |
| `GET` | `/` |
| `GET` | `/ready` |
| `GET` | `/live` |
| `GET` | `/stats` |
| `GET` | `/metrics` |
| `GET` | `/version` |
| `GET` | `/config` |
| `POST` | `/gc` |
| `GET` | `/dependencies` |
| `GET` | `/healthz` |
| `GET` | `/readyz` |
| `GET` | `/livez` |
| `GET` | `/` |
| `POST` | `/` |
| `GET` | `/search` |
| `GET` | `/stats` |
| `POST` | `/clear` |
| `GET` | `/context` |
| `POST` | `/context/compress` |
| `POST` | `/import` |


## Summary

**API Reference** covers:
1. **CLI Commands**
2. **HTTP API**


---

**See also:** [Overview](./1-overview.md)


---
[← Previous: Configuration](./25-configuration.md) | [Next: Testing →](./27-testing.md)
