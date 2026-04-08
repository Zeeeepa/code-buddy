/**
 * ICMIntegration — Claude Cowork parity
 *
 * Connects Cowork sessions to the ICM MCP server for cross-session memory.
 * Queries ICM at session start to surface relevant prior episodes; stores
 * session summaries at session end. Falls back to no-op if ICM is unavailable.
 *
 * @module main/memory/icm-integration
 */

import { log, logError, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';

export interface ICMMemoryEntry {
  id: string;
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

type ICMBridgeLike = {
  initialize: (caller: {
    callTool: (server: string, tool: string, args: Record<string, unknown>) => Promise<unknown>;
    getConnectedServers: () => string[];
  }) => Promise<void>;
  isAvailable: () => boolean;
  storeEpisode: (content: string, metadata?: Record<string, unknown>) => Promise<void>;
  searchMemory: (query: string, options?: { limit?: number }) => Promise<ICMMemoryEntry[]>;
};

type ICMModule = {
  ICMBridge: new () => ICMBridgeLike;
};

let cachedModule: ICMModule | null = null;

async function loadModule(): Promise<ICMModule | null> {
  if (cachedModule) return cachedModule;
  const mod = await loadCoreModule<ICMModule>('memory/icm-bridge.js');
  if (mod) {
    cachedModule = mod;
    log('[ICMIntegration] Core icm-bridge loaded');
  } else {
    logWarn('[ICMIntegration] Core icm-bridge unavailable');
  }
  return mod;
}

export interface MCPCallerLike {
  callTool: (server: string, tool: string, args: Record<string, unknown>) => Promise<unknown>;
  getConnectedServers: () => string[];
}

export class ICMIntegration {
  private bridge: ICMBridgeLike | null = null;
  private initialized = false;

  /** Initialize with an MCP caller (from Cowork's MCP manager) */
  async initialize(caller: MCPCallerLike): Promise<boolean> {
    if (this.initialized) return this.bridge?.isAvailable() ?? false;
    this.initialized = true;

    const mod = await loadModule();
    if (!mod) return false;

    try {
      this.bridge = new mod.ICMBridge();
      await this.bridge.initialize(caller);
      const available = this.bridge.isAvailable();
      log('[ICMIntegration] Bridge initialized, available:', available);
      return available;
    } catch (err) {
      logError('[ICMIntegration] Failed to initialize bridge:', err);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.bridge?.isAvailable() ?? false;
  }

  /** Query ICM for memories relevant to the current prompt */
  async searchRelevantMemories(
    query: string,
    projectId?: string,
    limit = 5
  ): Promise<ICMMemoryEntry[]> {
    if (!this.bridge || !this.bridge.isAvailable()) return [];

    try {
      const results = await this.bridge.searchMemory(query, { limit });
      // Filter by project if specified
      if (projectId) {
        return results.filter(
          (r) => !r.metadata?.projectId || r.metadata.projectId === projectId
        );
      }
      return results;
    } catch (err) {
      logWarn('[ICMIntegration] Search failed:', err);
      return [];
    }
  }

  /** Store a session episode in ICM */
  async storeEpisode(
    content: string,
    metadata: {
      sessionId: string;
      projectId?: string;
      tags?: string[];
      source?: string;
    }
  ): Promise<void> {
    if (!this.bridge || !this.bridge.isAvailable()) return;

    try {
      await this.bridge.storeEpisode(content, {
        source: metadata.source ?? 'cowork-session',
        sessionId: metadata.sessionId,
        projectId: metadata.projectId,
        tags: metadata.tags ?? [],
      });
      log('[ICMIntegration] Stored episode for session:', metadata.sessionId);
    } catch (err) {
      logWarn('[ICMIntegration] Store failed:', err);
    }
  }

  /** Format relevant memories as a system context block */
  formatContextBlock(memories: ICMMemoryEntry[]): string | null {
    if (memories.length === 0) return null;

    const entries = memories
      .map((m, i) => {
        const score = m.score !== undefined ? ` (${(m.score * 100).toFixed(0)}%)` : '';
        return `${i + 1}.${score} ${m.content}`;
      })
      .join('\n');

    return `<icm_memories>\nRelevant memories from past sessions:\n${entries}\n</icm_memories>`;
  }
}
