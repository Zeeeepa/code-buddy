/**
 * MCP Bridge
 *
 * Bridges Cowork's MCPManager tool definitions into the Code Buddy
 * engine's tool system. When the Electron app discovers MCP tools
 * via its own MCPManager, this bridge injects them as additional
 * tool definitions available to the CodeBuddyAgent.
 *
 * @module desktop/mcp-bridge
 */

import { logger } from '../utils/logger.js';

/** Minimal MCP tool definition shape */
export interface MCPToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  serverName?: string;
}

/** Tool definition in OpenAI function-calling format */
export interface FunctionToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * Bridges MCP tools from Cowork into Code Buddy's tool system.
 *
 * Usage:
 * ```ts
 * const bridge = new MCPToolBridge();
 *
 * // When Cowork discovers MCP tools:
 * bridge.registerTools(mcpManager.getAllTools());
 *
 * // Get tools in OpenAI function-calling format:
 * const tools = bridge.getToolDefinitions();
 * ```
 */
export class MCPToolBridge {
  private tools: Map<string, MCPToolDefinition> = new Map();
  private executors: Map<string, (args: Record<string, unknown>) => Promise<string>> = new Map();

  /**
   * Register MCP tools discovered by Cowork's MCPManager.
   */
  registerTools(tools: MCPToolDefinition[]): void {
    for (const tool of tools) {
      const key = tool.serverName
        ? `${tool.serverName}__${tool.name}`
        : tool.name;
      this.tools.set(key, tool);
    }
    logger.info('[MCPToolBridge] registered tools', { count: tools.length });
  }

  /**
   * Register an executor for a specific MCP tool.
   * The executor calls back into Cowork's MCPManager to run the tool.
   */
  registerExecutor(
    toolName: string,
    executor: (args: Record<string, unknown>) => Promise<string>,
  ): void {
    this.executors.set(toolName, executor);
  }

  /**
   * Execute an MCP tool by name.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const executor = this.executors.get(toolName);
    if (!executor) {
      throw new Error(`No executor registered for MCP tool: ${toolName}`);
    }
    return executor(args);
  }

  /**
   * Get all registered tools in OpenAI function-calling format.
   */
  getToolDefinitions(): FunctionToolDefinition[] {
    const definitions: FunctionToolDefinition[] = [];

    for (const [key, tool] of this.tools) {
      definitions.push({
        type: 'function',
        function: {
          name: key,
          description: tool.description || `MCP tool: ${tool.name}`,
          parameters: tool.inputSchema || { type: 'object', properties: {} },
        },
      });
    }

    return definitions;
  }

  /**
   * Check if a tool name belongs to a bridged MCP tool.
   */
  isMCPTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Clear all registered tools and executors.
   */
  clear(): void {
    this.tools.clear();
    this.executors.clear();
  }

  /**
   * Number of registered tools.
   */
  get toolCount(): number {
    return this.tools.size;
  }
}
