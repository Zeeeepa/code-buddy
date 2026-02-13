/**
 * Multi-mode Rewind Manager
 *
 * Provides rewind points that capture both conversation and file state,
 * with multiple rewind modes: conversation-only, code-only, full, and fork.
 */

import { logger } from '../utils/logger.js';

export type RewindMode = 'conversation' | 'code' | 'full' | 'fork';

export interface ConversationSnapshot {
  messages: unknown[];
  turnIndex: number;
}

export interface FileSnapshot {
  checkpointId: string;
  files: Map<string, string>;
}

export interface RewindPoint {
  id: string;
  timestamp: number;
  description: string;
  conversation: ConversationSnapshot;
  files: FileSnapshot;
}

export interface RewindResult {
  success: boolean;
  mode: RewindMode;
  restoredTurn?: number;
  restoredFiles?: string[];
  branchId?: string;
}

/**
 * RewindManager manages rewind points and supports multiple rewind modes.
 */
export class RewindManager {
  private points: RewindPoint[] = [];
  private counter = 0;
  private branches: Map<string, RewindPoint> = new Map();

  /**
   * Create a rewind point capturing conversation and file state.
   */
  createRewindPoint(
    conversationState: ConversationSnapshot,
    fileState: FileSnapshot,
    description?: string
  ): string {
    this.counter++;
    const id = `rw-${this.counter}`;

    const point: RewindPoint = {
      id,
      timestamp: Date.now(),
      description: description ?? `Rewind point ${this.counter}`,
      conversation: {
        messages: JSON.parse(JSON.stringify(conversationState.messages)),
        turnIndex: conversationState.turnIndex,
      },
      files: {
        checkpointId: fileState.checkpointId,
        files: new Map(fileState.files),
      },
    };

    this.points.push(point);
    logger.debug(`[RewindManager] Created rewind point ${id}`);
    return id;
  }

  /**
   * Rewind to a specific point using the given mode.
   */
  rewind(pointId: string, mode: RewindMode): RewindResult {
    const point = this.points.find((p) => p.id === pointId);
    if (!point) {
      logger.warn(`[RewindManager] Rewind point ${pointId} not found`);
      return { success: false, mode };
    }

    switch (mode) {
      case 'conversation':
        return {
          success: true,
          mode,
          restoredTurn: point.conversation.turnIndex,
        };

      case 'code':
        return {
          success: true,
          mode,
          restoredFiles: Array.from(point.files.files.keys()),
        };

      case 'full':
        return {
          success: true,
          mode,
          restoredTurn: point.conversation.turnIndex,
          restoredFiles: Array.from(point.files.files.keys()),
        };

      case 'fork': {
        const branchId = `fork-${pointId}-${Date.now()}`;
        this.branches.set(branchId, {
          ...point,
          conversation: {
            messages: JSON.parse(JSON.stringify(point.conversation.messages)),
            turnIndex: point.conversation.turnIndex,
          },
          files: {
            checkpointId: point.files.checkpointId,
            files: new Map(point.files.files),
          },
        });
        logger.debug(`[RewindManager] Forked from ${pointId} as ${branchId}`);
        return {
          success: true,
          mode,
          restoredTurn: point.conversation.turnIndex,
          branchId,
        };
      }

      default:
        return { success: false, mode };
    }
  }

  /**
   * Get all rewind points.
   */
  getRewindPoints(): RewindPoint[] {
    return [...this.points];
  }

  /**
   * Get the latest rewind point.
   */
  getLatestPoint(): RewindPoint | undefined {
    return this.points.length > 0 ? this.points[this.points.length - 1] : undefined;
  }

  /**
   * Clear all rewind history.
   */
  clearHistory(): void {
    this.points = [];
    this.branches.clear();
    logger.debug('[RewindManager] History cleared');
  }
}

// Singleton
let instance: RewindManager | null = null;

export function getRewindManager(): RewindManager {
  if (!instance) {
    instance = new RewindManager();
  }
  return instance;
}

export function resetRewindManager(): void {
  instance = null;
}
