/**
 * Nextcloud Talk Channel Adapter
 *
 * Connects to Nextcloud Talk for messaging and room management.
 * This is a stub implementation.
 */

import { logger } from '../../utils/logger.js';

export interface NextcloudTalkConfig {
  url: string;
  username: string;
  password: string;
}

export class NextcloudTalkAdapter {
  private config: NextcloudTalkConfig;
  private running = false;
  private joinedRooms: Set<string> = new Set();

  constructor(config: NextcloudTalkConfig) {
    this.config = { ...config };
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('NextcloudTalkAdapter is already running');
    }
    logger.debug('NextcloudTalkAdapter: connecting', { url: this.config.url, username: this.config.username });
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) {
      throw new Error('NextcloudTalkAdapter is not running');
    }
    logger.debug('NextcloudTalkAdapter: disconnecting');
    this.joinedRooms.clear();
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async sendMessage(roomToken: string, text: string): Promise<{ success: boolean; messageId: string }> {
    if (!this.running) {
      throw new Error('NextcloudTalkAdapter is not running');
    }
    logger.debug('NextcloudTalkAdapter: sending message', { roomToken, textLength: text.length });
    return { success: true, messageId: `nc_${Date.now()}` };
  }

  async getRooms(): Promise<Array<{ token: string; name: string; type: number }>> {
    if (!this.running) {
      throw new Error('NextcloudTalkAdapter is not running');
    }
    return [];
  }

  async joinRoom(roomToken: string): Promise<{ success: boolean }> {
    if (!this.running) {
      throw new Error('NextcloudTalkAdapter is not running');
    }
    this.joinedRooms.add(roomToken);
    logger.debug('NextcloudTalkAdapter: joined room', { roomToken });
    return { success: true };
  }

  async leaveRoom(roomToken: string): Promise<{ success: boolean }> {
    if (!this.running) {
      throw new Error('NextcloudTalkAdapter is not running');
    }
    const existed = this.joinedRooms.delete(roomToken);
    logger.debug('NextcloudTalkAdapter: left room', { roomToken, existed });
    return { success: existed };
  }

  getConfig(): NextcloudTalkConfig {
    return { ...this.config };
  }
}

export default NextcloudTalkAdapter;
