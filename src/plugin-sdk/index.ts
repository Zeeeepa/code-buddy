/**
 * Plugin SDK — Main Barrel Export
 *
 * Provides a unified public API for Code Buddy plugin development.
 * Plugin authors can import from the top-level or from specific subpaths:
 *
 * ```ts
 * // Top-level import (everything)
 * import { definePlugin, defineLLMProvider, defineToolPlugin } from '@phuetz/code-buddy/plugin-sdk';
 *
 * // Subpath imports (tree-shakeable)
 * import { definePlugin } from '@phuetz/code-buddy/plugin-sdk/core';
 * import { defineLLMProvider } from '@phuetz/code-buddy/plugin-sdk/llm';
 * import { defineChannel } from '@phuetz/code-buddy/plugin-sdk/channel';
 * import { defineToolPlugin } from '@phuetz/code-buddy/plugin-sdk/tool';
 * import { createMockPluginContext } from '@phuetz/code-buddy/plugin-sdk/testing';
 * ```
 */

// Core
export {
  PluginSDKVersion,
  definePlugin,
  PluginStatus,
  validateManifest,
  validatePermissions,
  hasPermission,
  validatePluginConfig,
  validateConfigValue,
} from './core.js';

export type {
  Plugin,
  PluginManifest,
  PluginContext,
  PluginPermissions,
  PluginProvider,
  PluginProviderType,
  PluginConfigSchema,
  PluginConfigPropertySchema,
  PluginIsolationConfig,
  SearchResult,
  ValidationResult,
  PluginLifecycle,
  DefinePluginConfig,
} from './core.js';

// Context Engine (OpenClaw v2026.3.7 alignment, ownsCompaction v2026.3.13-1)
export type {
  ContextEngine,
  ContextMeta,
  AssembleResult,
} from '../context/context-engine.js';

/**
 * Helper for plugin engines that do NOT own compaction.
 * Signals to the runtime that it should run built-in auto-compact
 * before calling engine.assemble().
 *
 * Usage: set `ownsCompaction = false` (or omit it) on your engine.
 * This function is a no-op sentinel — exists for documentation
 * and future runtime hooks.
 *
 * OpenClaw v2026.3.13-1 alignment.
 */
export function delegateCompactionToRuntime(): { ownsCompaction: false } {
  return { ownsCompaction: false };
}

// LLM
export {
  defineLLMProvider,
} from './llm.js';

export type {
  LLMProviderPlugin,
  LLMProviderConfig,
  LLMChatOptions,
  ModelInfo,
} from './llm.js';

// Channel
export {
  defineChannel,
} from './channel.js';

export type {
  ChannelPlugin,
  ChannelPluginConfig,
  ChannelMessageToolDescription,
  DefineChannelConfig,
  InboundMessage,
  OutboundMessage,
  DeliveryResult,
  ChannelStatus,
  ChannelType,
  ChannelUser,
  ChannelInfo,
  MessageAttachment,
  MessageButton,
  ContentType,
} from './channel.js';

// Tool
export {
  defineToolPlugin,
} from './tool.js';

export type {
  ToolPlugin,
  ToolDefinition,
  ToolResult,
  ParametersSchema,
  ParameterProperty,
} from './tool.js';

// Testing
export {
  createMockPluginContext,
  createMockLLMProvider,
  assertToolResult,
} from './testing.js';

export type {
  MockLogger,
  MockPluginContext,
  MockPluginContextOptions,
  MockLLMProviderOptions,
  MockLLMProviderInstance,
} from './testing.js';
