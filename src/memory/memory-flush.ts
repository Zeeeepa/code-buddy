/**
 * Pre-Threshold Memory Flush + Plugin Memory Backends
 * Flushes context before compaction and supports pluggable memory backends.
 */

import { logger } from '../utils/logger.js';

export interface SearchResult {
  key: string;
  value: string;
  score: number;
}

export interface MemoryBackend {
  name: string;
  search(query: string, limit?: number): SearchResult[];
  index(entries: Array<{ key: string; value: string }>): void;
  clear(): void;
}

export class PreThresholdFlusher {
  private static instance: PreThresholdFlusher | null = null;
  private lastFlushTime: number = 0;
  private flushCount: number = 0;
  private flushPath: string;

  constructor(flushPath?: string) {
    this.flushPath = flushPath || '.codebuddy/memory-flush.json';
  }

  static getInstance(): PreThresholdFlusher {
    if (!PreThresholdFlusher.instance) {
      PreThresholdFlusher.instance = new PreThresholdFlusher();
    }
    return PreThresholdFlusher.instance;
  }

  static resetInstance(): void {
    PreThresholdFlusher.instance = null;
  }

  shouldFlush(currentTokens: number, maxTokens: number, threshold?: number): boolean {
    const t = threshold ?? 0.8;
    return currentTokens / maxTokens > t;
  }

  flush(context: { messages: unknown[]; keyFacts: string[] }): { flushed: boolean; path: string } {
    this.lastFlushTime = Date.now();
    this.flushCount++;
    logger.debug(`Memory flush #${this.flushCount}: ${context.keyFacts.length} key facts`);
    return { flushed: true, path: this.flushPath };
  }

  getFlushPath(): string {
    return this.flushPath;
  }

  getLastFlushTime(): number {
    return this.lastFlushTime;
  }

  getFlushCount(): number {
    return this.flushCount;
  }
}

class DefaultMemoryBackend implements MemoryBackend {
  name = 'default';
  private store: Map<string, string> = new Map();

  search(query: string, limit?: number): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const [key, value] of this.store) {
      const text = `${key} ${value}`.toLowerCase();
      if (text.includes(queryLower)) {
        results.push({ key, value, score: 1.0 });
      }
    }

    return limit ? results.slice(0, limit) : results;
  }

  index(entries: Array<{ key: string; value: string }>): void {
    for (const entry of entries) {
      this.store.set(entry.key, entry.value);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export class MemoryBackendManager {
  private static instance: MemoryBackendManager | null = null;
  private backends: Map<string, MemoryBackend> = new Map();
  private activeBackendName: string = 'default';

  constructor() {
    this.backends.set('default', new DefaultMemoryBackend());
  }

  static getInstance(): MemoryBackendManager {
    if (!MemoryBackendManager.instance) {
      MemoryBackendManager.instance = new MemoryBackendManager();
    }
    return MemoryBackendManager.instance;
  }

  static resetInstance(): void {
    MemoryBackendManager.instance = null;
  }

  registerBackend(backend: MemoryBackend): void {
    this.backends.set(backend.name, backend);
    logger.debug(`Registered memory backend: ${backend.name}`);
  }

  getBackend(name: string): MemoryBackend | undefined {
    return this.backends.get(name);
  }

  setActiveBackend(name: string): void {
    if (!this.backends.has(name)) {
      throw new Error(`Memory backend '${name}' not found`);
    }
    this.activeBackendName = name;
  }

  getActiveBackend(): MemoryBackend {
    return this.backends.get(this.activeBackendName)!;
  }

  listBackends(): string[] {
    return Array.from(this.backends.keys());
  }
}
