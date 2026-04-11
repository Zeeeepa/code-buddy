/**
 * Firecrawl Tool Definitions
 *
 * OpenAI function-calling schemas for Firecrawl search and scrape tools.
 * Native Engine v2026.3.14 alignment.
 */

import type { CodeBuddyTool } from './types.js';

export const FIRECRAWL_SEARCH_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'firecrawl_search',
    description: 'Search the web using Firecrawl. Returns clean, structured results with titles, URLs, and content snippets. Better than basic web search for finding specific information.',
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
  },
};

export const FIRECRAWL_SCRAPE_TOOL: CodeBuddyTool = {
  type: 'function',
  function: {
    name: 'firecrawl_scrape',
    description: 'Scrape a web page and return clean markdown content. Handles JavaScript rendering, popups, and dynamic content. More reliable than basic web_fetch for complex pages.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL to scrape',
        },
        formats: {
          type: 'array',
          items: { type: 'string', enum: ['markdown', 'html', 'text'] },
          description: 'Output formats (default: ["markdown"])',
        },
        waitFor: {
          type: 'number',
          description: 'Wait time in ms for dynamic content to load',
        },
      },
      required: ['url'],
    },
  },
};

export const FIRECRAWL_TOOLS: CodeBuddyTool[] = [
  FIRECRAWL_SEARCH_TOOL,
  FIRECRAWL_SCRAPE_TOOL,
];
