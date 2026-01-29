# Code Buddy API Reference

This document covers both the programmatic API and the HTTP/WebSocket server API.

## Table of Contents

1. [HTTP Server API](#http-server-api)
   - [Authentication](#authentication)
   - [REST Endpoints](#rest-endpoints)
   - [WebSocket API](#websocket-api)
2. [Plugin Provider API](#plugin-provider-api)
3. [Programmatic API](#programmatic-api)
   - [CodeBuddyAgent](#codebuddyagent)
   - [Tool Executor](#tool-executor)
   - [Tools](#tools)
   - [Providers](#providers)
4. [Types Reference](#types-reference)

---

# HTTP Server API

## Quick Start

```bash
# Start the server
buddy server --port 3000

# Test the health endpoint
curl http://localhost:3000/api/health
```

## Authentication

The API supports JWT-based authentication. In production, set `JWT_SECRET` environment variable.

### Using Bearer Token

```bash
curl http://localhost:3000/api/chat \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

### Using API Key Header

```bash
curl http://localhost:3000/api/chat \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

## REST Endpoints

### Health

#### GET /api/health

Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.0.0",
  "components": {
    "api": "up",
    "websocket": "up",
    "ai": "up"
  }
}
```

### Metrics

#### GET /api/metrics

Prometheus-compatible metrics.

#### GET /api/metrics/json

JSON format metrics.

**Response:**
```json
{
  "totalRequests": 195,
  "activeConnections": 5,
  "totalTokens": 50000,
  "totalCost": 0.25,
  "averageLatency": 450
}
```

#### GET /api/metrics/dashboard

HTML metrics dashboard.

### Chat

#### POST /api/chat

Send a chat message.

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Explain async/await"}
  ],
  "model": "grok-code-fast-1",
  "temperature": 0.7,
  "maxTokens": 2000,
  "stream": false,
  "sessionId": "optional-session-id",
  "tools": true
}
```

**Response:**
```json
{
  "id": "chat_abc123",
  "content": "Async/await is...",
  "model": "grok-code-fast-1",
  "finishReason": "stop",
  "usage": {
    "promptTokens": 50,
    "completionTokens": 200,
    "totalTokens": 250
  },
  "cost": 0.001,
  "latency": 1200
}
```

#### POST /api/chat/completions

OpenAI-compatible endpoint (supports streaming via SSE).

### Tools

#### GET /api/tools

List available tools.

**Response:**
```json
{
  "tools": [
    {
      "name": "read_file",
      "description": "Read contents of a file",
      "category": "filesystem",
      "parameters": {...}
    }
  ],
  "total": 25
}
```

#### POST /api/tools/:name/execute

Execute a tool.

**Request:**
```json
{
  "parameters": {"path": "/README.md"},
  "confirmed": true,
  "timeout": 30000
}
```

**Response:**
```json
{
  "toolName": "read_file",
  "success": true,
  "output": "# README...",
  "executionTime": 15
}
```

### Sessions

#### GET /api/sessions

List sessions (supports `limit`, `offset` query params).

#### POST /api/sessions

Create a new session.

#### GET /api/sessions/:id

Get session details with messages.

#### DELETE /api/sessions/:id

Delete a session.

### Memory

#### GET /api/memory

List memory entries (supports `type`, `tags`, `limit` query params).

#### POST /api/memory

Create a memory entry.

#### POST /api/memory/search

Semantic search over memories.

**Request:**
```json
{
  "query": "error handling patterns",
  "limit": 10,
  "minScore": 0.5
}
```

## WebSocket API

Connect to `/ws` for real-time streaming.

### Message Format

```json
{
  "type": "message_type",
  "id": "request-id",
  "payload": {}
}
```

### Message Types

| Type | Description |
|:-----|:------------|
| `authenticate` | JWT authentication |
| `chat_stream` | Streaming chat request |
| `tool_execute` | Execute a tool |
| `stop` | Stop streaming |
| `ping` | Keep-alive |

### Example: Streaming Chat

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.send(JSON.stringify({
  type: 'authenticate',
  payload: { token: 'your-jwt-token' }
}));

ws.send(JSON.stringify({
  type: 'chat_stream',
  id: 'req_123',
  payload: {
    messages: [{ role: 'user', content: 'Hello' }]
  }
}));

// Receive responses
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // msg.type: 'stream_start', 'stream_chunk', 'stream_end'
};
```

## Server Configuration

| Variable | Description | Default |
|:---------|:------------|:--------|
| `PORT` | Server port | `3000` |
| `HOST` | Server host | `0.0.0.0` |
| `JWT_SECRET` | JWT secret (required in production) | - |
| `AUTH_ENABLED` | Enable authentication | `true` |
| `RATE_LIMIT_MAX` | Max requests per minute | `100` |
| `WS_ENABLED` | Enable WebSocket | `true` |

## Error Codes

| Code | Status | Description |
|:-----|:-------|:------------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 400 | Invalid request |

---

# Plugin Provider API

Plugins can register custom providers for LLM, embedding, or search.

## Provider Interface

```typescript
interface PluginProvider {
  id: string;
  name: string;
  type: 'llm' | 'embedding' | 'search';
  priority?: number;

  initialize(): Promise<void>;
  shutdown?(): Promise<void>;

  // LLM methods
  chat?(messages: LLMMessage[]): Promise<string>;

  // Embedding methods
  embed?(text: string | string[]): Promise<number[] | number[][]>;

  // Search methods
  search?(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
```

## Example: LLM Provider

```typescript
const myProvider: PluginProvider = {
  id: 'my-llm',
  name: 'My Custom LLM',
  type: 'llm',
  priority: 5,

  async initialize() {},

  async chat(messages) {
    return 'response';
  }
};

context.registerProvider(myProvider);
```

---

# Programmatic API

## CodeBuddyAgent

**File:** `src/agent/codebuddy-agent.ts`

### Constructor

```typescript
const agent = new CodeBuddyAgent(
  apiKey: string,
  baseURL?: string,
  model?: string,
  maxToolRounds?: number
);
```

### Key Methods

| Method | Description |
|:-------|:------------|
| `processUserMessage(prompt)` | Process message with tools |
| `processUserMessageStream(prompt)` | Streaming processing |
| `executeBashCommand(command)` | Execute bash |
| `dispose()` | Cleanup resources |

### Events

```typescript
agent.on('tool:start', (toolName, args) => {});
agent.on('tool:complete', (toolName, result) => {});
agent.on('cost:update', (cost) => {});
```

## Tool Executor

**File:** `src/agent/tool-executor.ts`

```typescript
const executor = new ToolExecutor(tools);

// Single execution
const result = await executor.executeTool(toolCall);

// Parallel execution
const results = await executor.executeToolsConcurrent(toolCalls);
```

## Tools

Available tools in `src/tools/`:

| Tool | Purpose |
|:-----|:--------|
| `BashTool` | Shell commands |
| `TextEditorTool` | File operations |
| `SearchTool` | Code search |
| `WebSearchTool` | Web search |
| `GitTool` | Git operations |

### Example

```typescript
const bash = new BashTool();
const result = await bash.execute('ls -la', { timeout: 30000 });
```

## Providers

**File:** `src/providers/types.ts`

### LLMProvider Interface

```typescript
interface LLMProvider {
  initialize(config: ProviderConfig): Promise<void>;
  complete(options: CompletionOptions): Promise<LLMResponse>;
  stream(options: CompletionOptions): AsyncIterable<StreamChunk>;
  dispose(): void;
}
```

### Supported Providers

| Provider | Type |
|:---------|:-----|
| `grok` | xAI Grok API |
| `claude` | Anthropic Claude |
| `openai` | OpenAI |
| `gemini` | Google Gemini |

---

# Types Reference

## ToolResult

```typescript
interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}
```

## ToolCall

```typescript
interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}
```

## ChatEntry

```typescript
interface ChatEntry {
  type: 'user' | 'assistant' | 'tool_result';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}
```

## LLMResponse

```typescript
interface LLMResponse {
  id: string;
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

## SearchResult (Plugin API)

```typescript
interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}
```

---

## CLI Options

```bash
buddy [options] [prompt]

Options:
  -d, --directory <dir>     Working directory
  -m, --model <model>       AI model
  -p, --prompt <prompt>     Headless mode
  --provider <provider>     grok|claude|openai|gemini
  --security-mode <mode>    suggest|auto-edit|full-auto
  --yolo                    Full autonomy mode
  --continue                Resume last session
```

## Environment Variables

| Variable | Description |
|:---------|:------------|
| `GROK_API_KEY` | API key from x.ai |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `GROK_BASE_URL` | Custom API endpoint |
| `YOLO_MODE` | Full autonomy mode |
| `MAX_COST` | Session cost limit |
