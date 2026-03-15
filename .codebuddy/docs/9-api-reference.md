# CLI & API Reference

## CLI Commands

| Command | Description |
|---------|-------------|
| `buddy` | Start interactive chat |
| `buddy [message]` | Process message and enter chat |
| `buddy --prompt <text>` | Headless mode — process and exit |
| `buddy --model <name>` | Override model |
| `buddy --continue` | Resume last session |
| `buddy onboard` | Interactive setup wizard |
| `buddy doctor` | Environment diagnostics |
| `buddy dev plan\|run\|pr\|fix-ci` | Dev workflows |
| `buddy research "<topic>"` | Wide research mode |
| `buddy flow "<goal>"` | Planning flow |
| `buddy daemon start\|stop\|status` | Background daemon |
| `buddy server --port N` | HTTP/WS server |
| `buddy hub search\|install` | Skills marketplace |
| `buddy nodes list\|pair` | Device management |
| `buddy secrets list\|set\|get` | Encrypted vault |
| `buddy deploy platforms\|init` | Cloud deployment |

## Slash Commands (Interactive)

| Command | Purpose |
|---------|---------|
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/models` | Switch AI model |
| `/yolo on\|off\|safe` | Toggle autonomy mode |
| `/think off\|shallow\|medium\|deep` | Set reasoning depth |
| `/persona list\|use\|info` | Manage AI personas |
| `/compact [level]` | Compress conversation context |
| `/docs generate [--with-llm]` | Generate documentation |
| `/plan` | Enter read-only research mode |

## HTTP API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Health check |
| GET | `/api/metrics` | Usage metrics |
| POST | `/api/chat` | Send message |
| POST | `/api/chat/completions` | OpenAI-compatible |
| GET/POST | `/api/sessions` | Session management |
| GET/POST | `/api/memory` | Memory CRUD |
| GET | `/api/daemon/status` | Daemon health |
| GET | `/api/hub/search` | Skills search |

## WebSocket Protocol

| Event | Direction | Purpose |
|-------|-----------|---------|
| `authenticate` | Client → Server | JWT authentication |
| `chat_stream` | Bidirectional | Streaming conversation |
| `tool_execute` | Server → Client | Tool execution notifications |
| `ping/pong` | Bidirectional | Keep-alive |

Default ports: HTTP 3000, Gateway WS 3001.