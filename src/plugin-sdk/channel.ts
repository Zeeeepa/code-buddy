/**
 * Plugin SDK — Channel Module
 *
 * Provides interfaces and helpers for creating channel plugins.
 * Channel plugins allow Code Buddy to communicate via new messaging platforms.
 */

import type {
  InboundMessage,
  OutboundMessage,
  DeliveryResult,
  ChannelStatus,
  ChannelType,
  ChannelConfig as CoreChannelConfig,
} from '../channels/core.js';

// Re-export message types for plugin authors
export type {
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
} from '../channels/core.js';

/**
 * Channel plugin configuration.
 * Defines the settings needed to connect to a messaging platform.
 */
export interface ChannelPluginConfig {
  /** Channel type identifier */
  type: ChannelType;
  /** Whether the channel is enabled */
  enabled: boolean;
  /** API token or key for authentication */
  token?: string;
  /** Webhook URL for receiving messages */
  webhookUrl?: string;
  /** List of allowed user IDs (empty = all allowed) */
  allowedUsers?: string[];
  /** List of allowed channel IDs (empty = all allowed) */
  allowedChannels?: string[];
  /** Auto-reply to incoming messages */
  autoReply?: boolean;
  /** Rate limit in messages per minute */
  rateLimit?: number;
  /** Custom platform-specific options */
  options?: Record<string, unknown>;
}

/**
 * Describes a message-action tool exposed by a channel plugin.
 * OpenClaw v2026.3.12 alignment — channel plugins can describe their
 * message tools for discovery by the tool registry.
 */
export interface ChannelMessageToolDescription {
  /** Tool name (e.g., 'slack_send_message') */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for the tool's parameters */
  parameters: Record<string, unknown>;
}

/**
 * Channel plugin interface.
 * Implement this to add support for a new messaging platform.
 */
export interface ChannelPlugin {
  /** Channel type identifier */
  readonly type: ChannelType;

  /** Connect to the messaging platform */
  connect(): Promise<void>;

  /** Disconnect from the messaging platform */
  disconnect(): Promise<void>;

  /** Send a message to the platform */
  send(message: OutboundMessage): Promise<DeliveryResult>;

  /** Get the current connection status */
  getStatus(): ChannelStatus;

  /**
   * Set the message handler callback.
   * The channel implementation calls this when a new message arrives.
   */
  onMessage(handler: (message: InboundMessage) => void): void;

  /**
   * Optional: check if a user is authorized to interact.
   * Defaults to allowing all users if not implemented.
   */
  isUserAllowed?(userId: string): boolean;

  /**
   * Optional: Describe the message tool this channel exposes.
   * Used for tool discovery and registration.
   * OpenClaw v2026.3.12 alignment.
   */
  describeMessageTool?(): ChannelMessageToolDescription;
}

/**
 * Configuration for defineChannel().
 */
export interface DefineChannelConfig {
  /** Channel type identifier */
  type: ChannelType;

  /** Connect to the messaging platform */
  connect(): Promise<void>;
  /** Disconnect from the messaging platform */
  disconnect(): Promise<void>;
  /** Send a message */
  send(message: OutboundMessage): Promise<DeliveryResult>;
  /** Get connection status */
  getStatus(): ChannelStatus;
  /** Register message handler */
  onMessage(handler: (message: InboundMessage) => void): void;
  /** Optional user authorization check */
  isUserAllowed?(userId: string): boolean;
  /** Optional: Describe the message tool for this channel (OpenClaw v2026.3.12) */
  describeMessageTool?(): ChannelMessageToolDescription;
}

/**
 * Define a channel plugin with type safety.
 *
 * @example
 * ```ts
 * import { defineChannel } from '@phuetz/code-buddy/plugin-sdk/channel';
 *
 * const channel = defineChannel({
 *   type: 'webchat',
 *   async connect() {
 *     // set up WebSocket server
 *   },
 *   async disconnect() {
 *     // close connections
 *   },
 *   async send(message) {
 *     // send to connected clients
 *     return { success: true, timestamp: new Date() };
 *   },
 *   getStatus() {
 *     return { type: 'webchat', connected: true, authenticated: true };
 *   },
 *   onMessage(handler) {
 *     // wire up incoming messages to handler
 *   },
 * });
 * ```
 */
export function defineChannel(config: DefineChannelConfig): ChannelPlugin {
  return {
    type: config.type,
    connect: config.connect.bind(config),
    disconnect: config.disconnect.bind(config),
    send: config.send.bind(config),
    getStatus: config.getStatus.bind(config),
    onMessage: config.onMessage.bind(config),
    isUserAllowed: config.isUserAllowed?.bind(config),
    describeMessageTool: config.describeMessageTool?.bind(config),
  };
}
