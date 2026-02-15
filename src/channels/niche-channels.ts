/**
 * Niche Channels & Misc
 * Lightweight stubs for Twitch, Tlon, Gmail, and docs search.
 */

import { logger } from '../utils/logger.js';

export class TwitchAdapter {
  private running: boolean = false;
  private channels: Set<string> = new Set();
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  start(): void {
    this.running = true;
    logger.debug('TwitchAdapter started');
  }

  stop(): void {
    this.running = false;
    this.channels.clear();
    logger.debug('TwitchAdapter stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  sendMessage(channel: string, text: string): { sent: boolean; channel: string } {
    if (!this.running) throw new Error('Adapter not running');
    logger.debug(`Twitch [${channel}]: ${text}`);
    return { sent: true, channel };
  }

  joinChannel(channel: string): void {
    this.channels.add(channel);
  }

  leaveChannel(channel: string): void {
    this.channels.delete(channel);
  }

  getConfig(): Record<string, unknown> {
    return { ...this.config };
  }
}

export class TlonAdapter {
  private running: boolean = false;
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  start(): void {
    this.running = true;
    logger.debug('TlonAdapter started');
  }

  stop(): void {
    this.running = false;
    logger.debug('TlonAdapter stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  sendMessage(shipName: string, text: string): { sent: boolean; ship: string } {
    if (!this.running) throw new Error('Adapter not running');
    logger.debug(`Tlon [${shipName}]: ${text}`);
    return { sent: true, ship: shipName };
  }

  getConfig(): Record<string, unknown> {
    return { ...this.config };
  }
}

export class GmailWebhookAdapter {
  private running: boolean = false;
  private messages: Array<{ id: string; subject: string; read: boolean }> = [];
  private config: Record<string, unknown>;

  constructor(config: Record<string, unknown> = {}) {
    this.config = config;
  }

  start(): void {
    this.running = true;
    logger.debug('GmailWebhookAdapter started');
  }

  stop(): void {
    this.running = false;
    logger.debug('GmailWebhookAdapter stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getMessages(limit?: number): Array<{ id: string; subject: string; read: boolean }> {
    const msgs = [...this.messages];
    return limit ? msgs.slice(0, limit) : msgs;
  }

  markRead(messageId: string): boolean {
    const msg = this.messages.find(m => m.id === messageId);
    if (msg) {
      msg.read = true;
      return true;
    }
    return false;
  }

  getConfig(): Record<string, unknown> {
    return { ...this.config };
  }

  // Test helper to add messages
  _addMessage(id: string, subject: string): void {
    this.messages.push({ id, subject, read: false });
  }
}

export class DocsSearchTool {
  private docs: Map<string, { content: string; url: string }> = new Map();

  constructor() {
    // Pre-populate with some default topics
    this.docs.set('getting-started', { content: 'Install and configure Code Buddy', url: '/docs/getting-started' });
    this.docs.set('tools', { content: 'Available tools and their usage', url: '/docs/tools' });
    this.docs.set('configuration', { content: 'Configuration options and environment variables', url: '/docs/configuration' });
  }

  search(query: string): Array<{ topic: string; snippet: string; url: string }> {
    const results: Array<{ topic: string; snippet: string; url: string }> = [];
    const queryLower = query.toLowerCase();

    for (const [topic, doc] of this.docs) {
      if (topic.includes(queryLower) || doc.content.toLowerCase().includes(queryLower)) {
        results.push({ topic, snippet: doc.content, url: doc.url });
      }
    }

    return results;
  }

  getTopics(): string[] {
    return Array.from(this.docs.keys());
  }

  getDocUrl(topic: string): string | undefined {
    return this.docs.get(topic)?.url;
  }
}
