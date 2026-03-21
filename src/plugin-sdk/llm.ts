/**
 * Plugin SDK — LLM Provider Module
 *
 * Provides interfaces and helpers for creating LLM provider plugins.
 * LLM providers allow plugins to add new AI model backends.
 */

import type { PluginProvider } from '../plugins/types.js';
import type { LLMMessage } from '../providers/types.js';

/**
 * Model information for discovery.
 * LLM providers expose their available models via this structure.
 */
export interface ModelInfo {
  /** Model identifier (e.g., 'my-provider/large-v2') */
  name: string;
  /** Context window size in tokens */
  contextWindow: number;
  /** Maximum output tokens */
  maxOutput: number;
  /** Pricing per 1M tokens (optional) */
  pricing?: {
    /** Cost per 1M input tokens in USD */
    input: number;
    /** Cost per 1M output tokens in USD */
    output: number;
  };
  /** Whether the model supports vision/image inputs */
  supportsVision?: boolean;
  /** Whether the model supports tool/function calling */
  supportsToolCalling?: boolean;
  /** Additional model-specific capabilities */
  capabilities?: Record<string, unknown>;
}

/**
 * Chat completion options for LLM providers.
 */
export interface LLMChatOptions {
  /** Temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Stop sequences */
  stop?: string[];
  /** Model to use (overrides default) */
  model?: string;
}

/**
 * LLM provider plugin interface.
 * Extends PluginProvider with LLM-specific methods and model discovery.
 */
export interface LLMProviderPlugin extends PluginProvider {
  /** Must be 'llm' for LLM providers */
  type: 'llm';

  /** Chat completion with message history */
  chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<string>;

  /** Simple text completion (optional, defaults to single-message chat) */
  complete?(prompt: string, options?: LLMChatOptions): Promise<string>;

  /** List available models from this provider */
  listModels(): Promise<ModelInfo[]>;

  /** Get info for a specific model */
  getModelInfo?(modelName: string): Promise<ModelInfo | undefined>;
}

/**
 * Configuration for defineLLMProvider().
 */
export interface LLMProviderConfig {
  /** Unique provider identifier */
  id: string;
  /** Human-readable provider name */
  name: string;
  /** Priority for provider selection (higher = preferred) */
  priority?: number;
  /** Provider-specific configuration */
  config?: Record<string, unknown>;

  /** Initialize the provider (e.g., validate API keys) */
  initialize(): Promise<void>;
  /** Shutdown the provider */
  shutdown?(): Promise<void>;

  /** Chat completion implementation */
  chat(messages: LLMMessage[], options?: LLMChatOptions): Promise<string>;
  /** Simple text completion (optional) */
  complete?(prompt: string, options?: LLMChatOptions): Promise<string>;
  /** List available models */
  listModels(): Promise<ModelInfo[]>;
  /** Get info for a specific model */
  getModelInfo?(modelName: string): Promise<ModelInfo | undefined>;
}

/**
 * Define an LLM provider plugin with type safety.
 *
 * @example
 * ```ts
 * import { defineLLMProvider } from '@phuetz/code-buddy/plugin-sdk/llm';
 *
 * const provider = defineLLMProvider({
 *   id: 'my-llm',
 *   name: 'My LLM Provider',
 *   priority: 10,
 *   async initialize() {
 *     // validate API key, set up client
 *   },
 *   async chat(messages) {
 *     // call your LLM API
 *     return 'response text';
 *   },
 *   async listModels() {
 *     return [{ name: 'my-model', contextWindow: 128000, maxOutput: 4096 }];
 *   },
 * });
 * ```
 */
export function defineLLMProvider(config: LLMProviderConfig): LLMProviderPlugin {
  return {
    id: config.id,
    name: config.name,
    type: 'llm',
    priority: config.priority ?? 0,
    config: config.config,
    initialize: config.initialize.bind(config),
    shutdown: config.shutdown?.bind(config),
    chat: config.chat.bind(config),
    complete: config.complete?.bind(config),
    listModels: config.listModels.bind(config),
    getModelInfo: config.getModelInfo?.bind(config),
  };
}
