/**
 * MCP Tool Auto-Discovery
 *
 * Defers loading of MCP tool descriptions when they would consume
 * too much of the context window, using on-demand search instead.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface MCPToolInfo {
  name: string;
  description: string;
  server: string;
  inputSchema: Record<string, unknown>;
}

// ============================================================================
// MCPAutoDiscovery
// ============================================================================

export class MCPAutoDiscovery {
  private thresholdPercentage: number = 10;
  private loadedTools: MCPToolInfo[] = [];
  private deferredTools: MCPToolInfo[] = [];

  /**
   * Determine if tool descriptions should be deferred
   * Returns true if total description length exceeds threshold % of context window
   */
  shouldDeferLoading(toolDescriptions: string[], contextWindowSize: number): boolean {
    const totalChars = toolDescriptions.reduce((sum, d) => sum + d.length, 0);
    // Rough token estimate: ~4 chars per token
    const estimatedTokens = totalChars / 4;
    const threshold = (this.thresholdPercentage / 100) * contextWindowSize;

    const shouldDefer = estimatedTokens > threshold;
    logger.debug(
      `MCP auto-discovery: ${estimatedTokens} estimated tokens vs ${threshold} threshold → ${shouldDefer ? 'defer' : 'load'}`
    );
    return shouldDefer;
  }

  /**
   * Search deferred tools by relevance to a query
   */
  searchTools(query: string, allTools: MCPToolInfo[]): MCPToolInfo[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    const scored = allTools.map(tool => {
      let score = 0;
      const nameLower = tool.name.toLowerCase();
      const descLower = tool.description.toLowerCase();

      // Exact name match
      if (nameLower === queryLower) score += 10;
      // Name contains query
      if (nameLower.includes(queryLower)) score += 5;
      // Description contains query
      if (descLower.includes(queryLower)) score += 3;

      // Word-level matching
      for (const word of queryWords) {
        if (nameLower.includes(word)) score += 2;
        if (descLower.includes(word)) score += 1;
      }

      return { tool, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(s => s.tool);
  }

  /**
   * Get currently loaded tool definitions
   */
  getLoadedTools(): MCPToolInfo[] {
    return [...this.loadedTools];
  }

  /**
   * Get deferred tool names
   */
  getDeferredTools(): string[] {
    return this.deferredTools.map(t => t.name);
  }

  /**
   * Set the threshold percentage for deferring
   */
  setThreshold(percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Threshold must be between 0 and 100');
    }
    this.thresholdPercentage = percentage;
  }

  /**
   * Get current threshold
   */
  getThreshold(): number {
    return this.thresholdPercentage;
  }

  /**
   * Partition tools into loaded and deferred sets
   */
  partitionTools(tools: MCPToolInfo[], contextWindowSize: number): {
    loaded: MCPToolInfo[];
    deferred: MCPToolInfo[];
  } {
    const descriptions = tools.map(t => t.description);
    if (!this.shouldDeferLoading(descriptions, contextWindowSize)) {
      this.loadedTools = [...tools];
      this.deferredTools = [];
      return { loaded: this.loadedTools, deferred: [] };
    }

    // When deferring, load no tools eagerly and defer all
    this.loadedTools = [];
    this.deferredTools = [...tools];
    return { loaded: [], deferred: [...tools] };
  }
}
