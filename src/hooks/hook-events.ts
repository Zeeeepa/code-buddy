/**
 * Hook Events
 *
 * EventEmitter-based hook system for PreCompact, Notification, and PermissionRequest events.
 * Singleton pattern for global event coordination.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface PreCompactContext {
  messageCount: number;
  tokenCount: number;
}

export type NotificationType = 'permission_prompt' | 'idle_prompt' | 'auth_success' | 'elicitation_dialog';

export interface NotificationPayload {
  type: NotificationType;
  message: string;
}

export interface PermissionRequestPayload {
  tool: string;
  input: string;
}

export interface PermissionResponse {
  action: 'allow' | 'deny' | 'ask';
  updatedPermissions?: Record<string, string>;
}

// ============================================================================
// HookEventEmitter
// ============================================================================

export class HookEventEmitter extends EventEmitter {
  private static instance: HookEventEmitter | null = null;

  constructor() {
    super();
    logger.debug('HookEventEmitter initialized');
  }

  static getInstance(): HookEventEmitter {
    if (!HookEventEmitter.instance) {
      HookEventEmitter.instance = new HookEventEmitter();
    }
    return HookEventEmitter.instance;
  }

  static resetInstance(): void {
    if (HookEventEmitter.instance) {
      HookEventEmitter.instance.removeAllListeners();
    }
    HookEventEmitter.instance = null;
  }

  emitPreCompact(context: PreCompactContext): void {
    this.emit('PreCompact', context);
  }

  emitNotification(notification: NotificationPayload): void {
    this.emit('Notification', notification);
  }

  emitPermissionRequest(request: PermissionRequestPayload): PermissionResponse {
    const listeners = this.listeners('PermissionRequest');
    if (listeners.length === 0) {
      return { action: 'ask' };
    }
    // Call the first listener synchronously and return its result
    const handler = listeners[0] as (req: PermissionRequestPayload) => PermissionResponse;
    return handler(request);
  }

  onPreCompact(handler: (context: PreCompactContext) => void): void {
    this.on('PreCompact', handler);
  }

  onNotification(handler: (notification: NotificationPayload) => void): void {
    this.on('Notification', handler);
  }

  onPermissionRequest(handler: (request: PermissionRequestPayload) => PermissionResponse): void {
    this.on('PermissionRequest', handler);
  }
}
