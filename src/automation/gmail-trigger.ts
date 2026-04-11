/**
 * Gmail Pub/Sub Trigger — automation trigger for Gmail notifications.
 *
 * Wraps GmailWebhookAdapter as a trigger source that can wake the agent
 * when new emails arrive matching configured filters.
 *
 * Native Engine parity: Gmail Pub/Sub integration for event-driven agent wake.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { GmailWebhookAdapter } from '../channels/niche-channels.js';

// ============================================================================
// Types
// ============================================================================

export interface GmailTriggerConfig {
  /** Google Cloud project ID */
  projectId: string;
  /** Pub/Sub topic name */
  topicName: string;
  /** Pub/Sub subscription name */
  subscriptionName?: string;
  /** Label filters (e.g., ['INBOX', 'UNREAD']) */
  labelFilter?: string[];
  /** Service account key path */
  serviceAccountKeyPath?: string;
  /** Agent prompt template when email arrives */
  promptTemplate?: string;
  /** Watch renewal interval in hours (default: 144 = 6 days, before 7-day expiry) */
  watchRenewalHours?: number;
  /** Whether to auto-mark emails as read after processing */
  autoMarkRead?: boolean;
}

export interface GmailTriggerEvent {
  /** Event type */
  type: 'new_email';
  /** Email message ID */
  messageId: string;
  /** Email subject */
  subject: string;
  /** Sender address */
  from: string;
  /** Timestamp */
  timestamp: Date;
  /** Generated agent prompt */
  prompt: string;
}

// ============================================================================
// Gmail Trigger
// ============================================================================

export class GmailTrigger extends EventEmitter {
  private adapter: GmailWebhookAdapter;
  private config: GmailTriggerConfig;
  private running = false;
  private watchRenewalTimer: NodeJS.Timeout | null = null;
  private processedIds = new Set<string>();

  constructor(config: GmailTriggerConfig) {
    super();
    this.config = config;
    this.adapter = new GmailWebhookAdapter({
      projectId: config.projectId,
      topicName: config.topicName,
      subscriptionName: config.subscriptionName,
      labelFilter: config.labelFilter,
      serviceAccountKeyPath: config.serviceAccountKeyPath,
    });
  }

  /**
   * Start the Gmail trigger.
   * Sets up watch and begins listening for Pub/Sub notifications.
   */
  async start(): Promise<boolean> {
    if (this.running) return true;

    try {
      this.adapter.start();

      // Set up Gmail watch
      await this.adapter.setupWatch(this.config.labelFilter);

      // Listen for new messages
      this.adapter.onNewMessage((msg) => {
        this.handleNewMessage(msg);
      });

      // Schedule watch renewal (Gmail watches expire in 7 days)
      const renewalMs = (this.config.watchRenewalHours || 144) * 60 * 60 * 1000;
      this.watchRenewalTimer = setInterval(async () => {
        try {
          await this.adapter.setupWatch(this.config.labelFilter);
          logger.debug('Gmail watch renewed');
        } catch (err) {
          logger.error('Gmail watch renewal failed', err instanceof Error ? err : new Error(String(err)));
        }
      }, renewalMs);

      this.running = true;
      logger.info('Gmail trigger started', {
        projectId: this.config.projectId,
        topicName: this.config.topicName,
        labels: this.config.labelFilter,
      });
      return true;
    } catch (err) {
      logger.error('Gmail trigger start failed', err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }

  /**
   * Stop the Gmail trigger.
   */
  stop(): void {
    if (!this.running) return;

    if (this.watchRenewalTimer) {
      clearInterval(this.watchRenewalTimer);
      this.watchRenewalTimer = null;
    }

    this.adapter.stop();
    this.running = false;
    this.processedIds.clear();
    logger.info('Gmail trigger stopped');
  }

  /**
   * Handle incoming Pub/Sub notification from Google.
   * Call this from your webhook endpoint.
   */
  async handleWebhook(body: { message?: { data?: string; messageId?: string } }): Promise<void> {
    if (!this.running) return;

    try {
      // Decode Pub/Sub message
      const data = body.message?.data
        ? JSON.parse(Buffer.from(body.message.data, 'base64').toString())
        : null;

      if (data?.emailAddress && data?.historyId) {
        await this.adapter.handlePubSubNotification(data);
      }
    } catch (err) {
      logger.debug(`Gmail webhook processing failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Process a new message event.
   */
  private handleNewMessage(msg: { id: string; subject: string; from: string }): void {
    // Deduplicate
    if (this.processedIds.has(msg.id)) return;
    this.processedIds.add(msg.id);

    // Cap dedup set size
    if (this.processedIds.size > 1000) {
      const arr = [...this.processedIds];
      this.processedIds = new Set(arr.slice(-500));
    }

    // Generate agent prompt
    const template = this.config.promptTemplate || 'New email from {from}: "{subject}". Please review and summarize.';
    const prompt = template
      .replace('{from}', msg.from)
      .replace('{subject}', msg.subject)
      .replace('{id}', msg.id);

    const event: GmailTriggerEvent = {
      type: 'new_email',
      messageId: msg.id,
      subject: msg.subject,
      from: msg.from,
      timestamp: new Date(),
      prompt,
    };

    this.emit('trigger', event);

    // Auto-mark as read if configured
    if (this.config.autoMarkRead) {
      this.adapter.markRead(msg.id);
    }

    logger.debug(`Gmail trigger fired: ${msg.subject} from ${msg.from}`);
  }

  /**
   * Get trigger status.
   */
  getStatus(): {
    running: boolean;
    watchActive: boolean;
    watchExpiry: Date | null;
    unreadCount: number;
    processedCount: number;
    config: GmailTriggerConfig;
  } {
    return {
      running: this.running,
      watchActive: this.adapter.isWatchActive(),
      watchExpiry: this.adapter.getWatchExpiry(),
      unreadCount: this.adapter.getUnreadCount(),
      processedCount: this.processedIds.size,
      config: { ...this.config },
    };
  }

  /**
   * Get the underlying adapter for direct access.
   */
  getAdapter(): GmailWebhookAdapter {
    return this.adapter;
  }

  isRunning(): boolean {
    return this.running;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let _trigger: GmailTrigger | null = null;

export function getGmailTrigger(config?: GmailTriggerConfig): GmailTrigger | null {
  if (!_trigger && config) {
    _trigger = new GmailTrigger(config);
  }
  return _trigger;
}

export function resetGmailTrigger(): void {
  if (_trigger) {
    _trigger.stop();
    _trigger = null;
  }
}
