/**
 * Zalo Channel Adapter
 *
 * Connects to Zalo API for messaging in bot or personal mode.
 * This is a stub implementation.
 */

import { logger } from '../../utils/logger.js';

export interface ZaloConfig {
  appId: string;
  secretKey: string;
  mode: 'bot' | 'personal';
}

export class ZaloAdapter {
  private config: ZaloConfig;
  private running = false;

  constructor(config: ZaloConfig) {
    this.config = { ...config };
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('ZaloAdapter is already running');
    }
    logger.debug('ZaloAdapter: initializing', { appId: this.config.appId, mode: this.config.mode });
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      throw new Error('ZaloAdapter is not running');
    }
    logger.debug('ZaloAdapter: disconnecting');
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async sendMessage(userId: string, text: string): Promise<{ success: boolean }> {
    if (!this.running) {
      throw new Error('ZaloAdapter is not running');
    }
    logger.debug('ZaloAdapter: sending message', { userId, textLength: text.length });
    return { success: true };
  }

  async sendImage(userId: string, imageUrl: string): Promise<{ success: boolean }> {
    if (!this.running) {
      throw new Error('ZaloAdapter is not running');
    }
    logger.debug('ZaloAdapter: sending image', { userId, imageUrl });
    return { success: true };
  }

  getMode(): 'bot' | 'personal' {
    return this.config.mode;
  }

  getConfig(): ZaloConfig {
    return { ...this.config };
  }
}

export default ZaloAdapter;
