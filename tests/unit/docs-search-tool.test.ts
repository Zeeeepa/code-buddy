import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

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

function setupMockDocs(docs: Record<string, string>) {
  mockExistsSync.mockImplementation((p: fs.PathLike) => {
    const s = String(p);
    if (s.includes('.codebuddy/docs') || s.includes('.codebuddy\\docs')) return true;
    return false;
  });
  mockReaddirSync.mockReturnValue(Object.keys(docs) as unknown as fs.Dirent[]);
  mockReadFileSync.mockImplementation((p: fs.PathOrFileDescriptor) => {
    const filename = path.basename(String(p));
    return docs[filename] ?? '';
  });
}

describe('DocsSearchTool', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should return results for matching query', async () => {
    // Pre-load the provider
    const { resetDocsContextProvider, getDocsContextProvider } = await import('@/docs/docs-context-provider.js');
    resetDocsContextProvider();
    const provider = getDocsContextProvider();
    setupMockDocs({
      '1-security.md': '# Security\n\nSecurity model overview.\n\n## Authentication\n\nJWT-based auth flow.',
    });
    await provider.loadDocsIndex('/test');

    const { DocsSearchTool } = await import('@/tools/docs-search-tool.js');
    const tool = new DocsSearchTool();
    const result = await tool.execute({ query: 'security authentication' });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Security');
  });

  it('should return guidance when no docs exist', async () => {
    const { resetDocsContextProvider } = await import('@/docs/docs-context-provider.js');
    resetDocsContextProvider();
    mockExistsSync.mockReturnValue(false);

    const { DocsSearchTool } = await import('@/tools/docs-search-tool.js');
    const tool = new DocsSearchTool();
    const result = await tool.execute({ query: 'test' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No project documentation');
  });

  it('should return no matches message for irrelevant query', async () => {
    const { resetDocsContextProvider, getDocsContextProvider } = await import('@/docs/docs-context-provider.js');
    resetDocsContextProvider();
    const provider = getDocsContextProvider();
    setupMockDocs({
      '1-security.md': '# Security\n\nSecurity model.',
    });
    await provider.loadDocsIndex('/test');

    const { DocsSearchTool } = await import('@/tools/docs-search-tool.js');
    const tool = new DocsSearchTool();
    const result = await tool.execute({ query: 'quantum computing blockchain' });

    expect(result.success).toBe(true);
    expect(result.output).toContain('No documentation matches');
  });

  it('should require query parameter', async () => {
    const { DocsSearchTool } = await import('@/tools/docs-search-tool.js');
    const tool = new DocsSearchTool();
    const result = await tool.execute({});

    expect(result.success).toBe(false);
    expect(result.error).toContain('Query is required');
  });
});
