/**
 * iMessage/BlueBubbles Channel Adapter
 *
 * Connects to a BlueBubbles server to send/receive iMessages.
 * This is a stub implementation that manages internal state
 * without making real connections.
 */

import { logger } from '../../utils/logger.js';

export interface IMessageConfig {
  serverUrl: string;
  password: string;
  port?: number;
}

export class IMessageAdapter {
  private config: IMessageConfig;
  private running = false;

  constructor(config: IMessageConfig) {
    this.config = { ...config };
    if (this.config.port === undefined) {
      this.config.port = 1234;
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('IMessageAdapter is already running');
    }
    logger.debug('IMessageAdapter: connecting to BlueBubbles server', {
      serverUrl: this.config.serverUrl,
      port: this.config.port,
    });
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      throw new Error('IMessageAdapter is not running');
    }
    logger.debug('IMessageAdapter: disconnecting');
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async sendMessage(chatId: string, text: string): Promise<{ success: boolean; messageId: string }> {
    if (!this.running) {
      throw new Error('IMessageAdapter is not running');
    }
    logger.debug('IMessageAdapter: sending message', { chatId, textLength: text.length });
    return { success: true, messageId: `imsg_${Date.now()}` };
  }

  async sendReaction(chatId: string, messageId: string, reaction: string): Promise<{ success: boolean }> {
    if (!this.running) {
      throw new Error('IMessageAdapter is not running');
    }
    logger.debug('IMessageAdapter: sending reaction', { chatId, messageId, reaction });
    return { success: true };
  }

  async getChats(): Promise<Array<{ id: string; name: string; participants: string[] }>> {
    if (!this.running) {
      throw new Error('IMessageAdapter is not running');
    }
    return [];
  }

  async getMessages(chatId: string, limit?: number): Promise<Array<{ id: string; text: string; sender: string; timestamp: Date }>> {
    if (!this.running) {
      throw new Error('IMessageAdapter is not running');
    }
    return [];
  }

  getConfig(): IMessageConfig {
    return { ...this.config };
  }
}

export default IMessageAdapter;
