/**
 * TaskDispatch — Claude Cowork parity
 *
 * Accepts task dispatch requests from remote channels (mobile app, webhooks,
 * gateway) and turns them into background sessions within the desktop app.
 * Emits notifications when the task completes so the remote client can be
 * alerted.
 *
 * @module main/remote/task-dispatch
 */

import { log, logError } from '../utils/logger';

export interface DispatchRequest {
  source: 'mobile' | 'webhook' | 'gateway' | 'channel';
  title: string;
  prompt: string;
  cwd?: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
}

export interface DispatchResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

type SessionManagerLike = {
  startBackgroundSession: (
    title: string,
    prompt: string,
    cwd?: string,
    projectId?: string
  ) => Promise<{ id: string }>;
};

type NotificationBridgeLike = {
  notifyTaskProgress(sessionId: string, message: string): void;
};

export class TaskDispatch {
  private sessionManager: SessionManagerLike;
  private notificationBridge?: NotificationBridgeLike;

  constructor(sessionManager: SessionManagerLike, notificationBridge?: NotificationBridgeLike) {
    this.sessionManager = sessionManager;
    this.notificationBridge = notificationBridge;
  }

  /** Dispatch a task from a remote source */
  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    try {
      log('[TaskDispatch] Dispatching task from', request.source, ':', request.title);

      const session = await this.sessionManager.startBackgroundSession(
        `[${request.source}] ${request.title}`,
        request.prompt,
        request.cwd,
        request.projectId
      );

      // Notify dispatch acceptance
      this.notificationBridge?.notifyTaskProgress(
        session.id,
        `Task "${request.title}" accepted from ${request.source}`
      );

      return {
        success: true,
        sessionId: session.id,
      };
    } catch (err) {
      logError('[TaskDispatch] Dispatch failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Validate a dispatch request before accepting it */
  validate(request: DispatchRequest): { valid: boolean; reason?: string } {
    if (!request.title || request.title.trim().length === 0) {
      return { valid: false, reason: 'Title is required' };
    }
    if (!request.prompt || request.prompt.trim().length === 0) {
      return { valid: false, reason: 'Prompt is required' };
    }
    if (request.title.length > 200) {
      return { valid: false, reason: 'Title too long (max 200 chars)' };
    }
    if (request.prompt.length > 10000) {
      return { valid: false, reason: 'Prompt too long (max 10000 chars)' };
    }

    const allowedSources = ['mobile', 'webhook', 'gateway', 'channel'];
    if (!allowedSources.includes(request.source)) {
      return { valid: false, reason: `Invalid source: ${request.source}` };
    }

    return { valid: true };
  }
}
