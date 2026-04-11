/**
 * Memory VFS Provider
 *
 * Stores files in .codebuddy/agent-memory/ with TTL support.
 * Used for ephemeral agent workspace data that should auto-expire.
 *
 * Default TTL: 24 hours (configurable).
 */

import fs from 'fs-extra';
import * as path from 'path';
import type { IVfsProvider, IFileStat, VfsEntry } from './unified-vfs-router.js';
import { logger } from '../../utils/logger.js';

// ── Types ──────────────────────────────────────────────────────────

export interface MemoryVfsConfig {
  /** Base directory for memory storage (default: .codebuddy/agent-memory) */
  baseDir: string;
  /** Default TTL in milliseconds (default: 24 hours) */
  defaultTtlMs: number;
  /** Enable auto-cleanup of expired files (default: true) */
  autoCleanup: boolean;
  /** Cleanup interval in milliseconds (default: 1 hour) */
  cleanupIntervalMs: number;
}

interface FileMetadata {
  createdAt: number;
  updatedAt: number;
  ttlMs: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// ── Provider ────────────────────────────────────────────────────────

export class MemoryVfsProvider implements IVfsProvider {
  private config: MemoryVfsConfig;
  private metadata: Map<string, FileMetadata> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<MemoryVfsConfig> = {}) {
    this.config = {
      baseDir: config.baseDir || path.join(process.cwd(), '.codebuddy', 'agent-memory'),
      defaultTtlMs: config.defaultTtlMs ?? DEFAULT_TTL_MS,
      autoCleanup: config.autoCleanup ?? true,
      cleanupIntervalMs: config.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS,
    };

    if (this.config.autoCleanup) {
      this.startCleanup();
    }
  }

  // ── IVfsProvider implementation ──────────────────────────────────

  async readFile(filePath: string, encoding: string = 'utf-8'): Promise<string> {
    const fullPath = this.resolveFull(filePath);

    // Check TTL
    if (this.isExpired(filePath)) {
      await this.removeExpired(filePath);
      throw new Error(`File expired: ${filePath}`);
    }

    return fs.readFile(fullPath, encoding as BufferEncoding);
  }

  async readFileBuffer(filePath: string): Promise<Buffer> {
    const fullPath = this.resolveFull(filePath);

    if (this.isExpired(filePath)) {
      await this.removeExpired(filePath);
      throw new Error(`File expired: ${filePath}`);
    }

    return fs.readFile(fullPath);
  }

  async writeFile(filePath: string, content: string, encoding: string = 'utf-8'): Promise<void> {
    const fullPath = this.resolveFull(filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, encoding as BufferEncoding);

    const now = Date.now();
    const existing = this.metadata.get(filePath);
    this.metadata.set(filePath, {
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ttlMs: existing?.ttlMs ?? this.config.defaultTtlMs,
    });

    logger.debug('Memory VFS: wrote file', { path: filePath });
  }

  async writeFileBuffer(filePath: string, content: Buffer): Promise<void> {
    const fullPath = this.resolveFull(filePath);
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);

    const now = Date.now();
    const existing = this.metadata.get(filePath);
    this.metadata.set(filePath, {
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ttlMs: existing?.ttlMs ?? this.config.defaultTtlMs,
    });
  }

  async exists(filePath: string): Promise<boolean> {
    if (this.isExpired(filePath)) {
      await this.removeExpired(filePath);
      return false;
    }
    const fullPath = this.resolveFull(filePath);
    return fs.pathExists(fullPath);
  }

  async stat(filePath: string): Promise<IFileStat> {
    if (this.isExpired(filePath)) {
      await this.removeExpired(filePath);
      throw new Error(`File expired: ${filePath}`);
    }
    const fullPath = this.resolveFull(filePath);
    return fs.stat(fullPath);
  }

  async readdir(dirPath: string): Promise<string[]> {
    const fullPath = this.resolveFull(dirPath);
    if (!await fs.pathExists(fullPath)) return [];
    return fs.readdir(fullPath);
  }

  async readDirectory(dirPath: string): Promise<VfsEntry[]> {
    const fullPath = this.resolveFull(dirPath);
    if (!await fs.pathExists(fullPath)) return [];
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      isFile: entry.isFile(),
    }));
  }

  async ensureDir(dirPath: string): Promise<void> {
    const fullPath = this.resolveFull(dirPath);
    return fs.ensureDir(fullPath);
  }

  async remove(filePath: string): Promise<void> {
    const fullPath = this.resolveFull(filePath);
    this.metadata.delete(filePath);
    return fs.remove(fullPath);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const fullOld = this.resolveFull(oldPath);
    const fullNew = this.resolveFull(newPath);
    await fs.ensureDir(path.dirname(fullNew));
    await fs.rename(fullOld, fullNew);

    // Move metadata
    const meta = this.metadata.get(oldPath);
    if (meta) {
      this.metadata.delete(oldPath);
      this.metadata.set(newPath, { ...meta, updatedAt: Date.now() });
    }
  }

  resolvePath(filePath: string, _baseDir: string): { valid: boolean; resolved: string; error?: string } {
    const resolved = this.resolveFull(filePath);
    const normalized = path.normalize(resolved);
    const normalizedBase = path.normalize(this.config.baseDir);

    if (!normalized.startsWith(normalizedBase + path.sep) && normalized !== normalizedBase) {
      return {
        valid: false,
        resolved,
        error: `Path traversal not allowed in memory VFS: ${filePath}`,
      };
    }

    return { valid: true, resolved };
  }

  // ── TTL management ──────────────────────────────────────────────

  /** Set TTL for a specific file */
  setTtl(filePath: string, ttlMs: number): void {
    const meta = this.metadata.get(filePath);
    if (meta) {
      meta.ttlMs = ttlMs;
    }
  }

  /** Check if a file has expired */
  isExpired(filePath: string): boolean {
    const meta = this.metadata.get(filePath);
    if (!meta) return false; // No metadata = not tracked = not expired
    return Date.now() - meta.updatedAt > meta.ttlMs;
  }

  /** Get file metadata */
  getMetadata(filePath: string): FileMetadata | undefined {
    return this.metadata.get(filePath);
  }

  // ── Cleanup ──────────────────────────────────────────────────────

  /** Remove all expired files */
  async cleanupExpired(): Promise<number> {
    let removed = 0;
    const now = Date.now();

    for (const [filePath, meta] of this.metadata) {
      if (now - meta.updatedAt > meta.ttlMs) {
        try {
          const fullPath = this.resolveFull(filePath);
          await fs.remove(fullPath);
          this.metadata.delete(filePath);
          removed++;
        } catch {
          // File may already be gone
          this.metadata.delete(filePath);
        }
      }
    }

    if (removed > 0) {
      logger.debug('Memory VFS: cleaned up expired files', { count: removed });
    }

    return removed;
  }

  /** Start periodic cleanup */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(
      () => void this.cleanupExpired(),
      this.config.cleanupIntervalMs,
    );
    // Don't prevent process exit
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /** Stop periodic cleanup and release resources */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ── Internal ─────────────────────────────────────────────────────

  private resolveFull(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath;
    return path.join(this.config.baseDir, filePath);
  }

  private async removeExpired(filePath: string): Promise<void> {
    try {
      const fullPath = this.resolveFull(filePath);
      await fs.remove(fullPath);
    } catch {
      // Ignore
    }
    this.metadata.delete(filePath);
  }

  /** Get the base directory */
  getBaseDir(): string {
    return this.config.baseDir;
  }

  /** Get count of tracked files */
  getTrackedCount(): number {
    return this.metadata.size;
  }
}
