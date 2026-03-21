/**
 * Plugin SDK — Tool Module
 *
 * Provides interfaces and helpers for creating tool plugins.
 * Tool plugins add new capabilities that the AI agent can invoke.
 */

/**
 * Result returned by a tool execution.
 */
export interface ToolResult {
  /** Whether the tool executed successfully */
  success: boolean;
  /** Output text (shown to the LLM) */
  output?: string;
  /** Error message if execution failed */
  error?: string;
  /** Additional metadata (not shown to LLM, used for UI/logging) */
  metadata?: Record<string, unknown>;
}

/**
 * JSON Schema property definition for tool parameters.
 */
export interface ParameterProperty {
  /** Property type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'integer';
  /** Human-readable description */
  description?: string;
  /** Allowed values */
  enum?: (string | number | boolean)[];
  /** Default value */
  default?: unknown;
  /** For array types: schema of array items */
  items?: ParameterProperty;
  /** For object types: nested properties */
  properties?: Record<string, ParameterProperty>;
}

/**
 * JSON Schema for tool parameters (OpenAI function calling format).
 */
export interface ParametersSchema {
  type: 'object';
  properties: Record<string, ParameterProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Tool definition for the plugin SDK.
 * Each tool has a name, description, parameter schema, and an execute function.
 */
export interface ToolDefinition {
  /** Tool name (unique, snake_case recommended) */
  name: string;
  /** Human-readable description (shown to the LLM for tool selection) */
  description: string;
  /** JSON Schema defining the tool's parameters */
  parameters: ParametersSchema;
  /** Whether the tool is read-only (safe for parallel execution) */
  readOnly?: boolean;
  /** Tags for categorization and RAG selection */
  tags?: string[];

  /**
   * Execute the tool with the given arguments.
   * Arguments are validated against the parameters schema before calling.
   */
  execute(args: Record<string, unknown>): Promise<ToolResult>;
}

/**
 * Tool plugin interface.
 * A tool plugin bundles one or more tool definitions.
 */
export interface ToolPlugin {
  /** Plugin identifier */
  id: string;
  /** Human-readable plugin name */
  name: string;
  /** Tool definitions provided by this plugin */
  tools: ToolDefinition[];
}

/**
 * Define a tool plugin with one or more tools.
 *
 * @example
 * ```ts
 * import { defineToolPlugin } from '@phuetz/code-buddy/plugin-sdk/tool';
 *
 * export default defineToolPlugin({
 *   id: 'my-tools',
 *   name: 'My Custom Tools',
 *   tools: [
 *     {
 *       name: 'fetch_weather',
 *       description: 'Get current weather for a city',
 *       parameters: {
 *         type: 'object',
 *         properties: {
 *           city: { type: 'string', description: 'City name' },
 *         },
 *         required: ['city'],
 *       },
 *       async execute({ city }) {
 *         // Fetch weather data
 *         return { success: true, output: `Weather in ${city}: sunny, 22°C` };
 *       },
 *     },
 *   ],
 * });
 * ```
 */
export function defineToolPlugin(config: {
  id: string;
  name: string;
  tools: ToolDefinition[];
}): ToolPlugin {
  // Validate tool names are unique within the plugin
  const names = new Set<string>();
  for (const tool of config.tools) {
    if (names.has(tool.name)) {
      throw new Error(`Duplicate tool name "${tool.name}" in plugin "${config.id}"`);
    }
    names.add(tool.name);
  }

  return {
    id: config.id,
    name: config.name,
    tools: config.tools,
  };
}
