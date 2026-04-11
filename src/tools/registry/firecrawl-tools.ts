/**
 * Firecrawl Tool Adapters
 *
 * ITool-compliant adapters for Firecrawl search and scrape operations.
 * These adapters wrap the firecrawl-tool methods to conform to the formal
 * ITool interface for use with the FormalToolRegistry.
 *
 * Native Engine v2026.3.14 alignment.
 */

import type { ToolResult } from '../../types/index.js';
import type { ITool, ToolSchema, IToolMetadata, IValidationResult, ToolCategoryType } from './types.js';
import { firecrawlSearch, firecrawlScrape, isFirecrawlEnabled } from '../firecrawl-tool.js';

// ============================================================================
// FirecrawlSearchExecuteTool
// ============================================================================

/**
 * FirecrawlSearchExecuteTool - ITool adapter for Firecrawl web search
 */
export class FirecrawlSearchExecuteTool implements ITool {
  readonly name = 'firecrawl_search';
  readonly description = 'Search the web using Firecrawl. Returns clean, structured results with titles, URLs, and content snippets.';

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return await firecrawlSearch({
      query: input.query as string,
      limit: input.limit as number | undefined,
      lang: input.lang as string | undefined,
    });
  }

  getSchema(): ToolSchema {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 5, max: 20)',
          },
          lang: {
            type: 'string',
            description: 'Language code for results (e.g., "en", "fr")',
          },
        },
        required: ['query'],
      },
    };
  }

  validate(input: unknown): IValidationResult {
    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const data = input as Record<string, unknown>;

    if (typeof data.query !== 'string' || data.query.trim() === '') {
      return { valid: false, errors: ['query must be a non-empty string'] };
    }

    return { valid: true };
  }

  getMetadata(): IToolMetadata {
    return {
      name: this.name,
      description: this.description,
      category: 'web' as ToolCategoryType,
      keywords: ['search', 'firecrawl', 'crawl', 'web', 'find', 'query', 'results', 'internet'],
      priority: 8,
      modifiesFiles: false,
      makesNetworkRequests: true,
    };
  }

  isAvailable(): boolean {
    return isFirecrawlEnabled();
  }
}

// ============================================================================
// FirecrawlScrapeExecuteTool
// ============================================================================

/**
 * FirecrawlScrapeExecuteTool - ITool adapter for Firecrawl web scraping
 */
export class FirecrawlScrapeExecuteTool implements ITool {
  readonly name = 'firecrawl_scrape';
  readonly description = 'Scrape a web page and return clean markdown content. Handles JavaScript rendering, popups, and dynamic content.';

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return await firecrawlScrape({
      url: input.url as string,
      formats: input.formats as ('markdown' | 'html' | 'text')[] | undefined,
      waitFor: input.waitFor as number | undefined,
    });
  }

  getSchema(): ToolSchema {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL to scrape',
          },
          formats: {
            type: 'array',
            description: 'Output formats (default: ["markdown"])',
          },
          waitFor: {
            type: 'number',
            description: 'Wait time in ms for dynamic content to load',
          },
        },
        required: ['url'],
      },
    };
  }

  validate(input: unknown): IValidationResult {
    if (typeof input !== 'object' || input === null) {
      return { valid: false, errors: ['Input must be an object'] };
    }

    const data = input as Record<string, unknown>;

    if (typeof data.url !== 'string' || data.url.trim() === '') {
      return { valid: false, errors: ['url must be a non-empty string'] };
    }

    // Basic URL validation
    try {
      new URL(data.url);
    } catch {
      return { valid: false, errors: ['url must be a valid URL'] };
    }

    return { valid: true };
  }

  getMetadata(): IToolMetadata {
    return {
      name: this.name,
      description: this.description,
      category: 'web' as ToolCategoryType,
      keywords: ['scrape', 'firecrawl', 'crawl', 'extract', 'web', 'page', 'content', 'markdown', 'fetch'],
      priority: 8,
      modifiesFiles: false,
      makesNetworkRequests: true,
    };
  }

  isAvailable(): boolean {
    return isFirecrawlEnabled();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create all Firecrawl tool instances
 */
export function createFirecrawlTools(): ITool[] {
  return [
    new FirecrawlSearchExecuteTool(),
    new FirecrawlScrapeExecuteTool(),
  ];
}

/**
 * Reset Firecrawl tool instances (for testing)
 */
export function resetFirecrawlInstances(): void {
  // No shared instance to reset — tools are stateless
}
