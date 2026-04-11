import { BaseTool, ParameterDefinition } from '../base-tool.js';
import { ToolResult } from '../../types/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { logger } from '../../utils/logger.js';

export class McpToolAdapter extends BaseTool {
  readonly name: string;
  readonly description: string;
  private mcpClient: Client;
  private inputSchema: any;

  constructor(client: Client, toolDef: any) {
    super();
    this.mcpClient = client;
    this.name = toolDef.name;
    this.description = toolDef.description || 'MCP Tool';
    this.inputSchema = toolDef.inputSchema || {};
  }

  protected getParameters(): Record<string, ParameterDefinition> {
    const params: Record<string, ParameterDefinition> = {};
    if (this.inputSchema?.properties) {
      for (const [key, prop] of Object.entries(this.inputSchema.properties)) {
        params[key] = {
          type: (prop as any).type || 'string',
          description: (prop as any).description || '',
          required: this.inputSchema.required?.includes(key) || false,
        };
      }
    }
    return params;
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    try {
      logger.debug(`[MCP] Executing tool ${this.name}`);
      const mcpResult = await this.mcpClient.callTool({
        name: this.name,
        arguments: input,
      });
      const contentArray = mcpResult.content as any[];
      const resultText = contentArray.map(c => c.text).join('\n');
      return this.success(resultText);
    } catch (e: any) {
      logger.error(`[MCP] Tool execution failed for ${this.name}`, { error: String(e) });
      return this.error(`MCP Tool execution failed: ${e.message}`);
    }
  }
}
