import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs to avoid real file I/O
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    statSync: vi.fn(),
  };
});

const mockExistsSync = vi.mocked(fs.existsSync);
const mockReaddirSync = vi.mocked(fs.readdirSync);
const mockReadFileSync = vi.mocked(fs.readFileSync);

describe('DocsContextProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function getProvider() {
    const { getDocsContextProvider, resetDocsContextProvider } = await import('@/docs/docs-context-provider.js');
    resetDocsContextProvider();
    return getDocsContextProvider();
  }

  function setupMockDocs(docs: Record<string, string>) {
    mockExistsSync.mockImplementation((p: fs.PathLike) => {
      const s = String(p);
      if (s.endsWith('.codebuddy/docs') || s.endsWith('.codebuddy\\docs')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(Object.keys(docs) as unknown as fs.Dirent[]);
    mockReadFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
      const filename = path.basename(String(p));
      return docs[filename] ?? '';
    });
  }

  describe('loadDocsIndex', () => {
    it('should load and index docs pages', async () => {
      const provider = await getProvider();
      setupMockDocs({
        '1-overview.md': '# Overview\n\nThis is the overview.\n\n## Architecture\n\nPlugin-based.',
        '2-architecture.md': '# Architecture\n\nLayered architecture.\n\n## Layers\n\nMultiple layers.',
      });

      await provider.loadDocsIndex('/test');
      expect(provider.isLoaded).toBe(true);
    });

    it('should not load when docs dir missing', async () => {
      const provider = await getProvider();
      mockExistsSync.mockReturnValue(false);

      await provider.loadDocsIndex('/test');
      expect(provider.isLoaded).toBe(false);
    });

    it('should skip index.md', async () => {
      const provider = await getProvider();
      setupMockDocs({ 'index.md': '# Index', '1-overview.md': '# Overview\n\nDesc.' });

      await provider.loadDocsIndex('/test');
      expect(provider.isLoaded).toBe(true);
      // Only 1 page (overview), not index
      const ctx = provider.getRelevantContext('index');
      // Should not match 'index' as a page
      expect(ctx === null || !ctx.includes('# Index')).toBe(true);
    });
  });

  describe('getRelevantContext', () => {
    it('should return null when not loaded', async () => {
      const provider = await getProvider();
      expect(provider.getRelevantContext('test')).toBeNull();
    });

    it('should match by title keywords', async () => {
      const provider = await getProvider();
      setupMockDocs({
        '1-security.md': '# Security\n\nSecurity model overview.\n\n## Authentication\n\nJWT-based auth.',
        '2-testing.md': '# Testing\n\nVitest framework.\n\n## Running Tests\n\nnpm test.',
      });
      await provider.loadDocsIndex('/test');

      const ctx = provider.getRelevantContext('how does security work?');
      expect(ctx).not.toBeNull();
      expect(ctx).toContain('Security');
    });

    it('should return null for irrelevant queries', async () => {
      const provider = await getProvider();
      setupMockDocs({
        '1-security.md': '# Security\n\nSecurity model.\n\n## Auth\n\nJWT.',
      });
      await provider.loadDocsIndex('/test');

      const ctx = provider.getRelevantContext('the');
      expect(ctx).toBeNull();
    });

    it('should respect maxChars limit', async () => {
      const provider = await getProvider();
      setupMockDocs({
        '1-overview.md': '# Overview\n\n' + 'A'.repeat(2000) + '\n\n## Section\n\n' + 'B'.repeat(2000),
      });
      await provider.loadDocsIndex('/test');

      const ctx = provider.getRelevantContext('overview', 200);
      expect(ctx).not.toBeNull();
      expect(ctx!.length).toBeLessThanOrEqual(200);
    });
  });

  describe('getArchitectureSummary', () => {
    it('should return empty when not loaded', async () => {
      const provider = await getProvider();
      expect(provider.getArchitectureSummary()).toBe('');
    });

    it('should prioritize overview then architecture', async () => {
      const provider = await getProvider();
      setupMockDocs({
        '2-architecture.md': '# Architecture\n\nArch content.',
        '1-overview.md': '# Overview\n\nOverview content.',
        '3-tools.md': '# Tools\n\nTools content.',
      });
      await provider.loadDocsIndex('/test');

      const summary = provider.getArchitectureSummary();
      expect(summary).toContain('Overview');
      // Overview should come before Architecture
      const overviewIdx = summary.indexOf('Overview');
      const archIdx = summary.indexOf('Architecture');
      expect(overviewIdx).toBeLessThan(archIdx);
    });

    it('should strip <details> blocks', async () => {
      const provider = await getProvider();
      setupMockDocs({
        '1-overview.md': '# Overview\n\n<details>\n<summary>Source</summary>\n\n- file.ts\n\n</details>\n\nReal content.',
      });
      await provider.loadDocsIndex('/test');

      const summary = provider.getArchitectureSummary();
      expect(summary).not.toContain('<details>');
      expect(summary).toContain('Real content');
    });

    it('should strip See also footers', async () => {
      const provider = await getProvider();
      setupMockDocs({
        '1-overview.md': '# Overview\n\nContent.\n\n---\n\n**See also:** [Page](./page.md)',
      });
      await provider.loadDocsIndex('/test');

      const summary = provider.getArchitectureSummary();
      expect(summary).not.toContain('See also');
    });

    it('should respect maxChars', async () => {
      const provider = await getProvider();
      setupMockDocs({
        '1-overview.md': '# Overview\n\n' + 'X'.repeat(3000),
      });
      await provider.loadDocsIndex('/test');

      const summary = provider.getArchitectureSummary(500);
      expect(summary.length).toBeLessThanOrEqual(500);
    });
  });
});
