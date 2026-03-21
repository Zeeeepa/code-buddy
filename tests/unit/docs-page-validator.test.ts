import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import type { GeneratedPage } from '@/docs/generation/page-generator.js';

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(true),
  };
});

const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockWriteFileSync = vi.mocked(fs.writeFileSync);

describe('validatePages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makePage(slug: string, content: string): GeneratedPage {
    return {
      page: {
        id: '1', slug, title: slug, description: '',
        sourceFiles: [], relatedPages: [], pageType: 'component',
      },
      content,
      filePath: `/docs/${slug}.md`,
    };
  }

  it('should remove [TBD] placeholders', async () => {
    const page = makePage('test', '# Test\n\nSome [TBD] text here.');
    mockReadFileSync.mockReturnValue(page.content);

    const { validatePages } = await import('@/docs/validation/page-validator.js');
    const result = validatePages('/docs', [page]);

    expect(result.placeholdersRemoved).toBe(1);
    expect(mockWriteFileSync).toHaveBeenCalled();
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    expect(written).not.toContain('[TBD]');
  });

  it('should remove [Guide] placeholders', async () => {
    const page = makePage('test', '# Test\n\n[Guide to setup] more text.');
    mockReadFileSync.mockReturnValue(page.content);

    const { validatePages } = await import('@/docs/validation/page-validator.js');
    const result = validatePages('/docs', [page]);

    expect(result.placeholdersRemoved).toBe(1);
  });

  it('should fix unclosed code fences', async () => {
    const page = makePage('test', '# Test\n\n```mermaid\ngraph TD\nA --> B');
    mockReadFileSync.mockReturnValue(page.content);

    const { validatePages } = await import('@/docs/validation/page-validator.js');
    const result = validatePages('/docs', [page]);

    expect(result.unclosedFencesFixed).toBe(1);
    const written = mockWriteFileSync.mock.calls[0][1] as string;
    // Should have even number of fences now
    const fenceCount = (written.match(/```/g) ?? []).length;
    expect(fenceCount % 2).toBe(0);
  });

  it('should not touch properly closed fences', async () => {
    const page = makePage('test', '# Test\n\n```ts\nconst x = 1;\n```\n\nDone.');
    mockReadFileSync.mockReturnValue(page.content);

    const { validatePages } = await import('@/docs/validation/page-validator.js');
    const result = validatePages('/docs', [page]);

    expect(result.unclosedFencesFixed).toBe(0);
  });

  it('should remove fake academic citations', async () => {
    const page = makePage('test', '# Test\n\nAs shown (Smith et al., 2024) the system works.');
    mockReadFileSync.mockReturnValue(page.content);

    const { validatePages } = await import('@/docs/validation/page-validator.js');
    const result = validatePages('/docs', [page]);

    expect(result.fakeCitationsRemoved).toBe(1);
  });

  it('should fix broken cross-links to non-existent files', async () => {
    const page1 = makePage('test', '# Test\n\nSee [link](./nonexistent.md).');
    mockReadFileSync.mockReturnValue(page1.content);

    const { validatePages } = await import('@/docs/validation/page-validator.js');
    const result = validatePages('/docs', [page1]);

    expect(result.brokenLinksFixed).toBe(1);
  });
});
