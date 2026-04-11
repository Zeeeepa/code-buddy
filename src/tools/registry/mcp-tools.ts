import { ITool } from './types.js';
import { getMcpManager } from '../mcp/mcp-manager.js';

export function createMcpTools(): ITool[] {
  const manager = getMcpManager();
  return manager.getTools();
}
