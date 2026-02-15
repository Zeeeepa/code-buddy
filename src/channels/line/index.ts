/**
 * LINE Channel Adapter
 *
 * Connects to LINE Messaging API for sending/receiving messages.
 * This is a stub implementation.
 */

import { logger } from '../../utils/logger.js';

export interface LINEConfig {
  channelAccessToken: string;
  channelSecret: string;
  port?: number;
}

export class LINEAdapter {
  private config: LINEConfig;
  private running = false;

  constructor(config: LINEConfig) {
    this.config = { ...config };
    if (this.config.port === undefined) {
      this.config.port = 8080;
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('LINEAdapter is already running');
    }
    logger.debug('LINEAdapter: starting webhook server', { port: this.config.port });
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      throw new Error('LINEAdapter is not running');
    }
    logger.debug('LINEAdapter: stopping webhook server');
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async sendMessage(userId: string, text: string): Promise<{ success: boolean }> {
    if (!this.running) {
      throw new Error('LINEAdapter is not running');
    }
    logger.debug('LINEAdapter: sending message', { userId, textLength: text.length });
    return { success: true };
  }

  async sendImage(userId: string, imageUrl: string): Promise<{ success: boolean }> {
    if (!this.running) {
      throw new Error('LINEAdapter is not running');
    }
    logger.debug('LINEAdapter: sending image', { userId, imageUrl });
    return { success: true };
  }

  async sendSticker(userId: string, packageId: string, stickerId: string): Promise<{ success: boolean }> {
    if (!this.running) {
      throw new Error('LINEAdapter is not running');
    }
    logger.debug('LINEAdapter: sending sticker', { userId, packageId, stickerId });
    return { success: true };
  }

  async getProfile(userId: string): Promise<{ userId: string; displayName: string; pictureUrl: string; statusMessage: string }> {
    if (!this.running) {
      throw new Error('LINEAdapter is not running');
    }
    return {
      userId,
      displayName: `User ${userId}`,
      pictureUrl: '',
      statusMessage: '',
    };
  }

  getConfig(): LINEConfig {
    return { ...this.config };
  }
}

export default LINEAdapter;
