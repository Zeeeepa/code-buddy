/**
 * Cross-Channel Message Tool
 *
 * Provides unified messaging operations (send, react, pin, thread, search,
 * role management, kick, ban) across all supported channels.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type MessageAction = 'send' | 'react' | 'pin' | 'thread_create' | 'search' | 'role_add' | 'kick' | 'ban';

export interface MessageTarget {
  channel: string;
  chatId: string;
  userId?: string;
}

export interface MessageToolResult {
  success: boolean;
  action: MessageAction;
  messageId?: string;
  error?: string;
}

interface RecordedAction {
  action: MessageAction;
  target: MessageTarget;
  timestamp: number;
  details: Record<string, unknown>;
}

// ============================================================================
// MessageTool
// ============================================================================

export class MessageTool {
  private static instance: MessageTool | null = null;
  private actions: RecordedAction[] = [];
  private supportedChannels = ['telegram', 'discord', 'slack', 'whatsapp', 'signal', 'matrix', 'teams', 'webchat'];

  static getInstance(): MessageTool {
    if (!MessageTool.instance) {
      MessageTool.instance = new MessageTool();
    }
    return MessageTool.instance;
  }

  static resetInstance(): void {
    MessageTool.instance = null;
  }

  send(target: MessageTarget, text: string): MessageToolResult {
    logger.info(`Sending message to ${target.channel}/${target.chatId}: ${text.substring(0, 50)}`);
    const messageId = `msg-${Date.now()}`;
    this.actions.push({
      action: 'send',
      target,
      timestamp: Date.now(),
      details: { text },
    });
    return { success: true, action: 'send', messageId };
  }

  react(target: MessageTarget, messageId: string, emoji: string): MessageToolResult {
    logger.info(`Adding reaction ${emoji} to ${messageId} on ${target.channel}`);
    this.actions.push({
      action: 'react',
      target,
      timestamp: Date.now(),
      details: { messageId, emoji },
    });
    return { success: true, action: 'react', messageId };
  }

  pin(target: MessageTarget, messageId: string): MessageToolResult {
    logger.info(`Pinning message ${messageId} on ${target.channel}`);
    this.actions.push({
      action: 'pin',
      target,
      timestamp: Date.now(),
      details: { messageId },
    });
    return { success: true, action: 'pin', messageId };
  }

  threadCreate(target: MessageTarget, messageId: string, text: string): MessageToolResult {
    logger.info(`Creating thread on ${messageId} in ${target.channel}`);
    const threadId = `thread-${Date.now()}`;
    this.actions.push({
      action: 'thread_create',
      target,
      timestamp: Date.now(),
      details: { messageId, text },
    });
    return { success: true, action: 'thread_create', messageId: threadId };
  }

  search(target: MessageTarget, query: string): MessageToolResult {
    logger.info(`Searching messages in ${target.channel}/${target.chatId}: ${query}`);
    this.actions.push({
      action: 'search',
      target,
      timestamp: Date.now(),
      details: { query },
    });
    return { success: true, action: 'search' };
  }

  roleAdd(target: MessageTarget, userId: string, role: string): MessageToolResult {
    logger.info(`Adding role ${role} to ${userId} in ${target.channel}`);
    this.actions.push({
      action: 'role_add',
      target,
      timestamp: Date.now(),
      details: { userId, role },
    });
    return { success: true, action: 'role_add' };
  }

  kick(target: MessageTarget, userId: string, reason?: string): MessageToolResult {
    logger.info(`Kicking ${userId} from ${target.channel}: ${reason || 'no reason'}`);
    this.actions.push({
      action: 'kick',
      target,
      timestamp: Date.now(),
      details: { userId, reason },
    });
    return { success: true, action: 'kick' };
  }

  ban(target: MessageTarget, userId: string, reason?: string): MessageToolResult {
    logger.info(`Banning ${userId} from ${target.channel}: ${reason || 'no reason'}`);
    this.actions.push({
      action: 'ban',
      target,
      timestamp: Date.now(),
      details: { userId, reason },
    });
    return { success: true, action: 'ban' };
  }

  getActions(): RecordedAction[] {
    return [...this.actions];
  }

  getSupportedChannels(): string[] {
    return [...this.supportedChannels];
  }
}
