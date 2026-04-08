/**
 * NotificationBridge — Claude Cowork parity
 *
 * Emits proactive notifications to both the renderer (via ServerEvent) and
 * the OS (via Electron Notification). Wraps the core proactive agent where
 * available; falls back to a simple emitter otherwise.
 *
 * @module main/notification/notification-bridge
 */

import { v4 as uuidv4 } from 'uuid';
import { Notification as ElectronNotification } from 'electron';
import { log, logError, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';
import type { ServerEvent, NotificationPriority, NotificationEntry } from '../../renderer/types';

export interface EmitNotificationOptions {
  title: string;
  body: string;
  priority?: NotificationPriority;
  sessionId?: string;
  projectId?: string;
  actionLabel?: string;
  showSystemNotification?: boolean;
}

type CoreNotificationModule = {
  NotificationManager: new (config?: Record<string, unknown>) => {
    on: (event: string, listener: (data: unknown) => void) => void;
    off: (event: string, listener: (data: unknown) => void) => void;
    send?: (notification: {
      title: string;
      body: string;
      priority?: string;
    }) => Promise<void> | void;
  };
};

let cachedModule: CoreNotificationModule | null = null;

async function loadModule(): Promise<CoreNotificationModule | null> {
  if (cachedModule) return cachedModule;
  const mod = await loadCoreModule<CoreNotificationModule>('agent/proactive/notification-manager.js');
  if (mod) {
    cachedModule = mod;
    log('[NotificationBridge] Core notification-manager loaded');
  } else {
    logWarn('[NotificationBridge] Core notification-manager unavailable');
  }
  return mod;
}

export class NotificationBridge {
  private sendToRenderer: (event: ServerEvent) => void;
  private coreManager: { on: (e: string, l: (d: unknown) => void) => void; off: (e: string, l: (d: unknown) => void) => void } | null = null;
  private systemEnabled = true;

  constructor(sendToRenderer: (event: ServerEvent) => void) {
    this.sendToRenderer = sendToRenderer;
  }

  /** Initialize bridge — tries to attach to the core notification manager */
  async init(): Promise<void> {
    const mod = await loadModule();
    if (!mod) return;

    try {
      this.coreManager = new mod.NotificationManager();
      this.coreManager.on('notification', (data: unknown) => {
        const d = data as {
          title?: string;
          body?: string;
          priority?: string;
          sessionId?: string;
        };
        if (d.title && d.body) {
          this.emit({
            title: d.title,
            body: d.body,
            priority: (d.priority as NotificationPriority) ?? 'normal',
            sessionId: d.sessionId,
          });
        }
      });
      log('[NotificationBridge] Attached to core notification manager');
    } catch (err) {
      logError('[NotificationBridge] Failed to init core manager:', err);
    }
  }

  /** Enable/disable OS notifications (still emit renderer events) */
  setSystemNotificationsEnabled(enabled: boolean): void {
    this.systemEnabled = enabled;
  }

  /** Emit a notification to the renderer and (optionally) the OS */
  emit(options: EmitNotificationOptions): NotificationEntry {
    const notification: NotificationEntry = {
      id: uuidv4(),
      title: options.title,
      body: options.body,
      priority: options.priority ?? 'normal',
      timestamp: Date.now(),
      read: false,
      sessionId: options.sessionId,
      projectId: options.projectId,
      actionLabel: options.actionLabel,
    };

    // Emit to renderer
    this.sendToRenderer({
      type: 'notification.message',
      payload: { notification },
    });

    // Show OS notification for high/urgent priority (opt-in)
    const wantsSystem = options.showSystemNotification ?? notification.priority !== 'low';
    if (wantsSystem && this.systemEnabled) {
      try {
        if (ElectronNotification.isSupported()) {
          const osNotif = new ElectronNotification({
            title: notification.title,
            body: notification.body,
            urgency:
              notification.priority === 'urgent'
                ? 'critical'
                : notification.priority === 'high'
                  ? 'normal'
                  : 'low',
          });
          osNotif.show();
        }
      } catch (err) {
        logWarn('[NotificationBridge] Failed to show OS notification:', err);
      }
    }

    return notification;
  }

  /** Convenience: notify task completion */
  notifyTaskComplete(sessionId: string, summary: string, success: boolean): void {
    this.emit({
      title: success ? 'Task Completed' : 'Task Failed',
      body: summary.length > 200 ? summary.slice(0, 197) + '...' : summary,
      priority: success ? 'normal' : 'high',
      sessionId,
      showSystemNotification: true,
    });
  }

  /** Convenience: notify long-running task progress */
  notifyTaskProgress(sessionId: string, message: string): void {
    this.emit({
      title: 'Task Update',
      body: message,
      priority: 'low',
      sessionId,
      showSystemNotification: false,
    });
  }
}
