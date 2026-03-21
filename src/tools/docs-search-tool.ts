/**
 * Docs Search Tool
 *
 * LLM-callable tool that searches the project's generated documentation.
 * Returns relevant snippets from .codebuddy/docs/ based on a query.
 */

import { ToolResult } from '../types/index.js';
import { Tool } from './tool-manager.js';
import { getDocsContextProvider } from '../docs/docs-context-provider.js';

export class DocsSearchTool implements Tool {
  name = 'docs_search';
  description = 'Search the project documentation for architecture, subsystem, API, security, or configuration information. Use this when you need to understand how a part of the codebase is designed.';

  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query (e.g., "security model", "how does authentication work", "channel architecture")',
      },
      scope: {
        type: 'string',
        enum: ['all', 'architecture', 'api', 'security', 'config', 'testing'],
        description: 'Limit search to a specific doc category (default: all)',
      },
    },
    required: ['query'],
  };

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = String(args.query ?? '');
    if (!query) return { success: false, error: 'Query is required' };

    const provider = getDocsContextProvider();
    if (!provider.isLoaded) {
      try {
        await provider.loadDocsIndex();
      } catch {
        return { success: false, error: 'No project documentation found. Run /docs-generate first.' };
      }
    }

    if (!provider.isLoaded) {
      return { success: false, error: 'No project documentation found in .codebuddy/docs/. Run /docs-generate to generate it.' };
    }

    // Use scope to refine query if provided
    const scope = String(args.scope ?? 'all');
    const effectiveQuery = scope !== 'all' ? `${scope} ${query}` : query;

    const result = provider.getRelevantContext(effectiveQuery, 2000);

    if (!result) {
      return { success: true, output: `No documentation matches found for "${query}". The docs may not cover this topic yet.` };
    }

    return { success: true, output: result };
  }
}
