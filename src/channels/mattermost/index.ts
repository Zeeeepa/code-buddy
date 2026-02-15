/**
 * Mattermost Channel Adapter
 *
 * Connects to Mattermost via WebSocket for real-time messaging.
 * This is a stub implementation.
 */

import { logger } from '../../utils/logger.js';

export interface MattermostConfig {
  url: string;
  token: string;
  teamId?: string;
}

export class MattermostAdapter {
  private config: MattermostConfig;
  private running = false;

  constructor(config: MattermostConfig) {
    this.config = { ...config };
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('MattermostAdapter is already running');
    }
    logger.debug('MattermostAdapter: connecting via WebSocket', { url: this.config.url });
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      throw new Error('MattermostAdapter is not running');
    }
    logger.debug('MattermostAdapter: disconnecting');
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async sendMessage(channelId: string, text: string): Promise<{ success: boolean; postId: string }> {
    if (!this.running) {
      throw new Error('MattermostAdapter is not running');
    }
    logger.debug('MattermostAdapter: sending message', { channelId, textLength: text.length });
    return { success: true, postId: `mm_${Date.now()}` };
  }

  async sendReply(channelId: string, rootId: string, text: string): Promise<{ success: boolean; postId: string }> {
    if (!this.running) {
      throw new Error('MattermostAdapter is not running');
    }
    logger.debug('MattermostAdapter: sending reply', { channelId, rootId, textLength: text.length });
    return { success: true, postId: `mm_reply_${Date.now()}` };
  }

  async getChannels(): Promise<Array<{ id: string; name: string; type: string }>> {
    if (!this.running) {
      throw new Error('MattermostAdapter is not running');
    }
    return [];
  }

  getConfig(): MattermostConfig {
    return { ...this.config };
  }
}

export default MattermostAdapter;
