/**
 * LRU Completion Cache
 *
 * Lightweight cache for LSP completion results with TTL expiry
 * and LRU eviction. Designed to run on every keystroke without
 * adding measurable latency.
 */

export class CompletionCache {
  private cache = new Map<string, { items: any[]; timestamp: number }>();
  private maxEntries = 100;
  private ttlMs = 5000;

  constructor(options?: { maxEntries?: number; ttlMs?: number }) {
    if (options?.maxEntries !== undefined) this.maxEntries = options.maxEntries;
    if (options?.ttlMs !== undefined) this.ttlMs = options.ttlMs;
  }

  get(key: string): any[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.items;
  }

  set(key: string, items: any[]): void {
    // LRU eviction: remove the oldest entry (first inserted) when at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(key, { items, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
