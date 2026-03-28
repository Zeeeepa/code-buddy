/**
 * Tests for VFS Router and Memory Provider
 *
 * Tests UnifiedVfsRouter singleton pattern and path resolution,
 * and MemoryVfsProvider TTL and metadata tracking.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';

// Mock logger
vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock latency-optimizer
vi.mock('../../../src/optimization/latency-optimizer.js', () => ({
  measureLatency: vi.fn((_label: string, fn: () => any) => fn()),
}));

// Mock workspace-isolation
vi.mock('../../../src/workspace/workspace-isolation.js', () => ({
  getWorkspaceIsolation: vi.fn(() => ({
    getConfig: () => ({ enabled: false }),
    validatePath: (filePath: string) => ({ valid: true, resolved: filePath }),
  })),
}));

import { UnifiedVfsRouter } from '../../../src/services/vfs/unified-vfs-router.js';
import { MemoryVfsProvider } from '../../../src/services/vfs/memory-vfs-provider.js';

describe('UnifiedVfsRouter', () => {
  it('returns a singleton instance', () => {
    const instance1 = UnifiedVfsRouter.Instance;
    const instance2 = UnifiedVfsRouter.Instance;
    expect(instance1).toBe(instance2);
  });

  it('has resolvePath method', () => {
    const router = UnifiedVfsRouter.Instance;
    expect(typeof router.resolvePath).toBe('function');
  });

  it('resolvePath validates paths within base dir', () => {
    const router = UnifiedVfsRouter.Instance;
    const baseDir = process.cwd();
    const result = router.resolvePath('src/index.ts', baseDir);
    expect(result.valid).toBe(true);
    expect(result.resolved).toBeDefined();
  });

  it('implements IVfsProvider interface methods', () => {
    const router = UnifiedVfsRouter.Instance;
    expect(typeof router.readFile).toBe('function');
    expect(typeof router.writeFile).toBe('function');
    expect(typeof router.exists).toBe('function');
    expect(typeof router.stat).toBe('function');
    expect(typeof router.readdir).toBe('function');
    expect(typeof router.readDirectory).toBe('function');
    expect(typeof router.ensureDir).toBe('function');
    expect(typeof router.remove).toBe('function');
    expect(typeof router.rename).toBe('function');
  });
});

describe('MemoryVfsProvider', () => {
  it('creates provider with default config', () => {
    const provider = new MemoryVfsProvider({ autoCleanup: false });
    expect(provider.getBaseDir()).toContain('agent-memory');
    provider.dispose();
  });

  it('write and read file', async () => {
    const tmpBase = path.join(os.tmpdir(), `test-memory-vfs-${Date.now()}`);
    const provider = new MemoryVfsProvider({
      baseDir: tmpBase,
      autoCleanup: false,
    });

    await provider.writeFile('test.txt', 'hello');
    const content = await provider.readFile('test.txt');
    expect(content).toBe('hello');

    // Clean up
    await provider.remove('test.txt');
    provider.dispose();
  });

  it('tracks file metadata with TTL', async () => {
    const tmpBase = path.join(os.tmpdir(), `test-memory-vfs-${Date.now()}`);
    const provider = new MemoryVfsProvider({
      baseDir: tmpBase,
      defaultTtlMs: 60000,
      autoCleanup: false,
    });

    await provider.writeFile('meta-test.txt', 'data');
    const meta = provider.getMetadata('meta-test.txt');
    expect(meta).toBeDefined();
    expect(meta!.ttlMs).toBe(60000);
    expect(meta!.createdAt).toBeGreaterThan(0);
    expect(meta!.updatedAt).toBeGreaterThan(0);

    await provider.remove('meta-test.txt');
    provider.dispose();
  });

  it('removes metadata when file is removed', async () => {
    const tmpBase = path.join(os.tmpdir(), `test-memory-vfs-${Date.now()}`);
    const provider = new MemoryVfsProvider({
      baseDir: tmpBase,
      autoCleanup: false,
    });

    await provider.writeFile('remove-test.txt', 'data');
    expect(provider.getMetadata('remove-test.txt')).toBeDefined();

    await provider.remove('remove-test.txt');
    expect(provider.getMetadata('remove-test.txt')).toBeUndefined();

    provider.dispose();
  });

  it('reports tracked file count', async () => {
    const tmpBase = path.join(os.tmpdir(), `test-memory-vfs-${Date.now()}`);
    const provider = new MemoryVfsProvider({
      baseDir: tmpBase,
      autoCleanup: false,
    });

    expect(provider.getTrackedCount()).toBe(0);
    await provider.writeFile('a.txt', 'data');
    expect(provider.getTrackedCount()).toBe(1);
    await provider.writeFile('b.txt', 'data');
    expect(provider.getTrackedCount()).toBe(2);

    await provider.remove('a.txt');
    await provider.remove('b.txt');
    provider.dispose();
  });
});
