import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { logger } from '../../utils/logger.js';
import { McpToolAdapter } from './mcp-tool-adapter.js';

class McpManager {
  private static instance: McpManager | null = null;
  private client: Client | null = null;
  private tools: McpToolAdapter[] = [];
  private isInitialized = false;

  private constructor() {}

  static getInstance(): McpManager {
    if (!McpManager.instance) {
      McpManager.instance = new McpManager();
    }
    return McpManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // For PoC/Integration, we assume a local MCP server or we check an environment config
    const mcpCommand = process.env.CODEBUDDY_MCP_COMMAND;
    const mcpArgs = process.env.CODEBUDDY_MCP_ARGS ? process.env.CODEBUDDY_MCP_ARGS.split(' ') : [];

    if (!mcpCommand) {
        logger.debug('No CODEBUDDY_MCP_COMMAND defined. MCP integration is disabled.');
        this.isInitialized = true;
        return;
    }

    try {
      const transport = new StdioClientTransport({
        command: mcpCommand,
        args: mcpArgs,
      });

      this.client = new Client({
        name: "codebuddy-core",
        version: "1.0.0",
      }, {
        capabilities: {}
      });

      await this.client.connect(transport);
      const toolsList = await this.client.listTools();
      
      this.tools = toolsList.tools.map((tool: any) => new McpToolAdapter(this.client!, tool));
      logger.info(`Loaded ${this.tools.length} MCP tools from ${mcpCommand}.`);
    } catch (e: any) {
      logger.error('Failed to initialize MCP Manager', { error: String(e) });
    } finally {
      this.isInitialized = true;
    }
  }

  getTools(): McpToolAdapter[] {
    return this.tools;
  }
}

export function getMcpManager(): McpManager {
    return McpManager.getInstance();
}
