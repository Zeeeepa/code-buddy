import { BaseTool, ParameterDefinition } from './base-tool.js';
import { ToolResult } from '../types/index.js';
import { getWorkspaceIndexer } from '../knowledge/workspace-indexer.js';
import { logger } from '../utils/logger.js';

export class SemanticSearchTool extends BaseTool {
  readonly name = 'semantic_search';
  readonly description = 'Search the entire workspace semantically. Use this when you are looking for concepts, features, or patterns rather than exact strings. It searches an AI-generated index of the codebase.';

  constructor() {
    super();
  }

  protected getParameters(): Record<string, ParameterDefinition> {
    return {
      query: {
        type: 'string',
        description: 'The natural language query describing what you are looking for in the codebase (e.g., "authentication middleware", "database connection pool").',
        required: true,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of code chunks to return. Default is 5.',
        required: false,
      },
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const query = input.query as string;
    const limit = (input.limit as number) || 5;

    try {
      const indexer = getWorkspaceIndexer();
      const results = await indexer.search(query, limit);

      if (results.length === 0) {
        return this.success('No semantic matches found. The index might still be building or your query was too specific.');
      }

      const formattedResults = results.map((r: any) => `--- File: ${r.filePath} (Score: ${r.score.toFixed(3)}) ---\n${r.text}`).join('\n\n');

      return this.success(`Found ${results.length} semantic matches:\n\n${formattedResults}`);
    } catch (e) {
      logger.error('Semantic search tool failed', { error: String(e) });
      return this.error('Failed to perform semantic search. Ensure the workspace indexer is initialized.');
    }
  }
}
