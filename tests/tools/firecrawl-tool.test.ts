import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { firecrawlSearch, firecrawlScrape, isFirecrawlEnabled } from '../../src/tools/firecrawl-tool.js';

describe('FirecrawlTool', () => {
  const originalEnv = process.env.FIRECRAWL_API_KEY;

  beforeEach(() => {
    process.env.FIRECRAWL_API_KEY = 'test-key-123';
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.FIRECRAWL_API_KEY = originalEnv;
    } else {
      delete process.env.FIRECRAWL_API_KEY;
    }
    vi.restoreAllMocks();
  });

  describe('isFirecrawlEnabled', () => {
    it('returns true when FIRECRAWL_API_KEY is set', () => {
      expect(isFirecrawlEnabled()).toBe(true);
    });

    it('returns false when FIRECRAWL_API_KEY is not set', () => {
      delete process.env.FIRECRAWL_API_KEY;
      expect(isFirecrawlEnabled()).toBe(false);
    });
  });

  describe('firecrawlSearch', () => {
    it('calls search endpoint and returns formatted results', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: [
            { title: 'Test Page', url: 'https://example.com', content: 'Test content' },
          ],
        }),
        text: () => Promise.resolve(''),
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse as any);

      const result = await firecrawlSearch({ query: 'test query' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Test Page');
      expect(result.output).toContain('https://example.com');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api.firecrawl.dev/v1/search',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key-123',
          }),
        }),
      );
    });

    it('returns no results message when empty', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: [] }),
        text: () => Promise.resolve(''),
      } as any);

      const result = await firecrawlSearch({ query: 'nothing' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('No results');
    });

    it('handles API errors gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: () => Promise.resolve('rate limited'),
      } as any);

      const result = await firecrawlSearch({ query: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('429');
    });
  });

  describe('firecrawlScrape', () => {
    it('calls scrape endpoint and returns markdown', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            url: 'https://example.com',
            markdown: '# Hello World\nSome content here.',
            title: 'Example',
          },
        }),
        text: () => Promise.resolve(''),
      } as any);

      const result = await firecrawlScrape({ url: 'https://example.com' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('# Example');
      expect(result.output).toContain('Hello World');
    });

    it('handles scrape failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false }),
        text: () => Promise.resolve(''),
      } as any);

      const result = await firecrawlScrape({ url: 'https://bad.com' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('no data');
    });

    it('truncates very long content', async () => {
      const longContent = 'x'.repeat(60_000);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { url: 'https://example.com', markdown: longContent, title: 'Long' },
        }),
        text: () => Promise.resolve(''),
      } as any);

      const result = await firecrawlScrape({ url: 'https://example.com' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('truncated');
      expect(result.output!.length).toBeLessThan(60_000);
    });
  });
});
