/**
 * Agent SDK
 *
 * Programmatic API for embedding Code Buddy as an agent in other applications.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentSDKConfig {
  model?: string;
  tools?: string[];
  maxTurns?: number;
  systemPrompt?: string;
}

export interface AgentSDKResult {
  success: boolean;
  output: string;
  toolCalls: number;
  cost: number;
}

export interface SDKStreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'done';
  data: unknown;
}

export interface SDKToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

// ============================================================================
// AgentSDK
// ============================================================================

export class AgentSDK {
  private config: AgentSDKConfig;
  private customTools: Map<string, SDKToolDefinition> = new Map();

  constructor(config: AgentSDKConfig = {}) {
    this.config = {
      model: config.model ?? 'grok-3-mini',
      tools: config.tools ?? [],
      maxTurns: config.maxTurns ?? 10,
      systemPrompt: config.systemPrompt ?? 'You are a helpful coding assistant.',
    };
    logger.debug(`AgentSDK initialized with model: ${this.config.model}`);
  }

  /**
   * Run agent loop with a prompt (returns final result)
   */
  async run(prompt: string): Promise<AgentSDKResult> {
    logger.debug(`AgentSDK.run: ${prompt.slice(0, 100)}`);

    // Stub implementation - in production this would invoke the agent loop
    return {
      success: true,
      output: `Processed: ${prompt}`,
      toolCalls: 0,
      cost: 0,
    };
  }

  /**
   * Run agent loop with streaming events
   */
  async *runStreaming(prompt: string): AsyncGenerator<SDKStreamEvent> {
    logger.debug(`AgentSDK.runStreaming: ${prompt.slice(0, 100)}`);

    yield { type: 'text', data: `Processing: ${prompt}` };
    yield { type: 'done', data: { success: true, toolCalls: 0, cost: 0 } };
  }

  /**
   * Register a custom tool
   */
  addTool(definition: SDKToolDefinition): void {
    if (this.customTools.has(definition.name)) {
      throw new Error(`Tool "${definition.name}" already registered`);
    }
    this.customTools.set(definition.name, definition);
    logger.debug(`Tool registered: ${definition.name}`);
  }

  /**
   * Remove a custom tool
   */
  removeTool(name: string): boolean {
    const deleted = this.customTools.delete(name);
    if (deleted) {
      logger.debug(`Tool removed: ${name}`);
    }
    return deleted;
  }

  /**
   * List all available tools (built-in + custom)
   */
  getTools(): string[] {
    const builtIn = this.config.tools || [];
    const custom = Array.from(this.customTools.keys());
    return [...builtIn, ...custom];
  }

  /**
   * Update system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.config.systemPrompt = prompt;
  }

  /**
   * Get current configuration
   */
  getConfig(): AgentSDKConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createAgent(config: AgentSDKConfig = {}): AgentSDK {
  return new AgentSDK(config);
}
