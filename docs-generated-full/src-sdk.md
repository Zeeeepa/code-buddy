---
title: "src — sdk"
module: "src-sdk"
cohesion: 0.80
members: 0
generated: "2026-03-25T19:21:27.697Z"
---
# src — sdk

The `src/sdk/agent-sdk.ts` module provides the **Agent SDK**, a programmatic interface designed to embed Code Buddy's agent capabilities into other applications. It allows developers to define custom tools, provide prompts, and receive structured or streaming responses, effectively turning Code Buddy into an extensible agent.

## 1. Overview

The Agent SDK acts as a lightweight orchestrator for executing a sequence of operations, primarily involving custom tools and, optionally, an underlying Large Language Model (LLM) for summarization. It abstracts away the complexities of tool parsing, execution, and result aggregation, offering a clean API for agent interaction.

Key features include:
*   **Custom Tool Registration**: Define and register application-specific tools.
*   **Prompt-driven Tool Invocation**: Tools are invoked directly from the user prompt using a specific syntax.
*   **Synchronous and Streaming Execution**: Choose between a single final result or a stream of events.
*   **LLM Integration**: Optionally leverages Code Buddy's LLM client for intelligent summarization of tool outputs.

## 2. Core Concepts

### `AgentSDKConfig`

This interface defines the configuration options for an `AgentSDK` instance:

```typescript
export interface AgentSDKConfig {
  model?: string;        // The LLM model to use (e.g., 'grok-1.0-pro'). Defaults to MODEL_ROLES.fast.xai.
  tools?: string[];      // List of built-in tool names (not currently used for execution, but for listing).
  maxTurns?: number;     // Maximum number of tool invocations allowed per run. Defaults to 10.
  systemPrompt?: string; // The system prompt for the LLM. Defaults to 'You are a helpful coding assistant.'.
}
```

### `SDKToolDefinition`

To extend the agent's capabilities, developers can define and register custom tools. Each tool must conform to this interface:

```typescript
export interface SDKToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON schema for tool input validation (not enforced by SDK, but for LLM context).
  execute: (input: Record<string, unknown>) => Promise<string>; // The function that performs the tool's action.
}
```

The `execute` method is the core logic of the tool, taking a JSON object as input and returning a string representing the tool's output.

### `SDKStreamEvent`

When using the streaming API (`runStreaming`), the agent yields events of various types:

```typescript
export interface SDKStreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'done';
  data: unknown; // The payload associated with the event type.
}
```

*   `tool_use`: Indicates a tool is about to be executed, `data` contains `SDKToolInvocation`.
*   `tool_result`: Provides the output of a tool execution, `data` contains `{ name: string; output: string }`.
*   `text`: The final textual output from the agent.
*   `done`: Signals the completion of the agent run, `data` contains `AgentSDKResult` summary.

### Tool Invocation Pattern

The Agent SDK expects tool invocations to be embedded directly within the user prompt using a specific markdown-like syntax:

```
@tool <tool_name> <JSON_input_object>
```

For example:
`"Please create a file. @tool createFile {"path": "src/index.ts", "content": "console.log('Hello');"}"`

The `AgentSDK` will parse these patterns, extract the tool name and its JSON input, and execute the corresponding registered tool.

## 3. The `AgentSDK` Class

The `AgentSDK` class is the primary entry point for interacting with the agent.

### Initialization

```typescript
export class AgentSDK {
  private config: AgentSDKConfig;
  private customTools: Map<string, SDKToolDefinition> = new Map();
  private client: SDKClient | null = null;

  constructor(config: AgentSDKConfig = {}) {
    this.config = {
      model: config.model ?? MODEL_ROLES.fast.xai,
      tools: config.tools ?? [],
      maxTurns: config.maxTurns ?? 10,
      systemPrompt: config.systemPrompt ?? 'You are a helpful coding assistant.',
    };
    logger.debug(`AgentSDK initialized with model: ${this.config.model}`);
  }
  // ...
}
```

The constructor initializes the agent with a provided configuration, applying sensible defaults if options are omitted. It also sets up internal storage for custom tools.

### Public API

#### `run(prompt: string): Promise<AgentSDKResult>`

Executes the agent loop for a given prompt and returns a single `AgentSDKResult` object containing the final output, number of tool calls, and estimated cost. This method is suitable for scenarios where only the final outcome is needed.

```typescript
interface AgentSDKResult {
  success: boolean;
  output: string;
  toolCalls: number;
  cost: number;
}
```

#### `runStreaming(prompt: string): AsyncGenerator<SDKStreamEvent>`

Executes the agent loop and yields `SDKStreamEvent` objects as the process unfolds. This is ideal for user interfaces or applications that need real-time feedback on tool execution and intermediate steps.

#### Tool Management

*   `addTool(definition: SDKToolDefinition): void`: Registers a custom tool with the SDK. Throws an error if a tool with the same name is already registered.
*   `removeTool(name: string): boolean`: Unregisters a custom tool by its name. Returns `true` if the tool was found and removed, `false` otherwise.
*   `getTools(): string[]`: Returns a list of all available tool names, including any built-in tools specified in the configuration and all registered custom tools.

#### Configuration Management

*   `setSystemPrompt(prompt: string): void`: Updates the agent's system prompt, which influences the LLM's persona and behavior during summarization.
*   `getConfig(): AgentSDKConfig`: Returns a copy of the current agent configuration.

### Internal Mechanisms

The `AgentSDK` class encapsulates several private methods that handle the core logic of parsing, executing, and summarizing.

*   `private async getClient(): Promise<SDKClient | null>`:
    This method is responsible for lazily initializing the `CodeBuddyClient` (from `../codebuddy/client.js`). It checks for the `GROK_API_KEY` environment variable. If the key is not present, it returns `null`, indicating that LLM-based summarization cannot be performed.

*   `private parseToolInvocations(prompt: string): SDKToolInvocation[]`:
    Uses a regular expression (`/@tool\s+([a-zA-Z0-9_-]+)\s+({[\s\S]*?})/g`) to find and parse `@tool` invocations within the input `prompt`. It extracts the tool name and its JSON input, limiting the number of invocations to `config.maxTurns`.

*   `private async executeToolInvocations(...)`:
    Iterates through the parsed tool invocations. For each invocation, it looks up the corresponding `SDKToolDefinition` in `this.customTools` and calls its `execute` method. It collects the results of each execution.

*   `private async buildFinalOutput(...)`:
    This method constructs the final output string. If an `SDKClient` (i.e., `CodeBuddyClient`) is available, it attempts to use the LLM to summarize the original prompt and the tool execution results. If the LLM summary fails or no client is available, it falls back to a simple concatenation of the prompt and tool outputs.

*   `private estimateCost(toolCalls: number, output: string): number`:
    Provides a very basic estimation of the cost based on the number of tool calls and the length of the final output.

## 4. Execution Flow

The core execution flow for both `run` and `runStreaming` methods follows a similar pattern:

```mermaid
graph TD
    A[AgentSDK.run/runStreaming(prompt)] --> B{Prompt Validation}
    B -- Valid --> C[parseToolInvocations]
    C --> D[executeToolInvocations]
    D --> E{getClient (CodeBuddyClient)}
    E -- Client Available --> F[buildFinalOutput (LLM Summary)]
    E -- No Client --> G[buildFinalOutput (Local Summary)]
    F --> H[estimateCost]
    G --> H
    H --> I[Return AgentSDKResult / Yield SDKStreamEvent]
    B -- Invalid --> J[Throw Error]
```

1.  **Prompt Validation**: The input `prompt` is checked to ensure it's not empty.
2.  **Tool Parsing**: `parseToolInvocations` extracts all `@tool` calls from the prompt.
3.  **Tool Execution**: `executeToolInvocations` sequentially executes each identified tool using its registered `execute` method.
4.  **Client Retrieval**: `getClient` attempts to initialize or retrieve the `CodeBuddyClient` for LLM interaction.
5.  **Output Construction**: `buildFinalOutput` generates the final response. If the `CodeBuddyClient` is available, it sends the original prompt and tool results to the LLM for a concise summary. Otherwise, it constructs a basic summary from the prompt and tool outputs.
6.  **Cost Estimation**: `estimateCost` calculates a rudimentary cost based on activity.
7.  **Result Delivery**: The final `AgentSDKResult` is returned (`run`) or `SDKStreamEvent`s are yielded (`runStreaming`).

## 5. Integration and Dependencies

### External Dependencies

The `AgentSDK` module relies on a few internal Code Buddy utilities:

*   `../utils/logger.js`: For logging debug and error messages.
*   `../config/model-defaults.js`: To provide default LLM model names.
*   `../codebuddy/client.js`: Dynamically imported by `getClient()` to interact with the Code Buddy LLM service. This dependency is optional at runtime, as the SDK can operate without an LLM client for tool execution only.

### Consumers

The `AgentSDK` is primarily designed for external integration and testing within the Code Buddy ecosystem:

*   **Tests**:
    *   `tests/unit/agent-sdk-tools.test.ts`: Unit tests for tool management and execution.
    *   `tests/features/cicd-chrome-sdk-pr.test.ts`: Feature tests demonstrating end-to-end usage, including adding/removing tools, setting prompts, and running streaming.
*   **Automation Scripts**:
    *   `scripts/tests/cat-automation-sdk.ts`: Used in automation scripts, likely for integration testing or specific agent-driven tasks.

These consumers demonstrate the intended usage patterns for developers looking to integrate the Agent SDK into their applications.

## 6. Usage Example

Here's a conceptual example of how a developer might use the `AgentSDK`:

```typescript
import { createAgent, SDKToolDefinition, SDKStreamEvent } from './agent-sdk.js';

// 1. Define a custom tool
const myCustomTool: SDKToolDefinition = {
  name: 'greetUser',
  description: 'Greets a user by name.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The name of the user' },
    },
    required: ['name'],
  },
  execute: async (input: Record<string, unknown>): Promise<string> => {
    const name = input.name as string;
    if (!name) {
      throw new Error('Name is required for greetUser tool.');
    }
    return `Hello, ${name}! Welcome to the Code Buddy SDK.`;
  },
};

async function runMyAgent() {
  // 2. Create an AgentSDK instance
  const agent = createAgent({
    systemPrompt: 'You are a friendly assistant that can greet users.',
    maxTurns: 5,
  });

  // 3. Register the custom tool
  agent.addTool(myCustomTool);

  // 4. Prepare a prompt that invokes the tool
  const prompt = "Please greet John Doe. @tool greetUser {\"name\": \"John Doe\"}";

  console.log('--- Running agent in streaming mode ---');
  for await (const event of agent.runStreaming(prompt)) {
    switch (event.type) {
      case 'tool_use':
        console.log(`[STREAM] Using tool: ${(event.data as any).name}`);
        break;
      case 'tool_result':
        console.log(`[STREAM] Tool result: ${(event.data as any).output}`);
        break;
      case 'text':
        console.log(`[STREAM] Final text: ${event.data}`);
        break;
      case 'done':
        console.log(`[STREAM] Agent finished. Success: ${(event.data as any).success}`);
        break;
    }
  }

  console.log('\n--- Running agent in non-streaming mode ---');
  const result = await agent.run(prompt);
  console.log(`Final Output: ${result.output}`);
  console.log(`Tool Calls: ${result.toolCalls}`);
  console.log(`Estimated Cost: ${result.cost}`);
}

runMyAgent().catch(console.error);
```