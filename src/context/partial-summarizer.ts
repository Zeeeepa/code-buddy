/**
 * Partial Summarizer
 *
 * Summarizes a portion of the conversation from a given index,
 * using keyword extraction rather than LLM calls for fast,
 * deterministic summarization.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// PartialSummarizer
// ============================================================================

let instance: PartialSummarizer | null = null;

export class PartialSummarizer {
  private lastMessageCount: number = 0;
  private lastTokensSaved: number = 0;

  static getInstance(): PartialSummarizer {
    if (!instance) {
      instance = new PartialSummarizer();
    }
    return instance;
  }

  static resetInstance(): void {
    instance = null;
  }

  /**
   * Estimate token count for a string (rough: ~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract text content from a message object
   */
  private extractContent(msg: unknown): string {
    if (typeof msg === 'string') return msg;
    if (typeof msg === 'object' && msg !== null && 'content' in msg) {
      return String((msg as { content: unknown }).content);
    }
    return '';
  }

  /**
   * Extract role from a message object
   */
  private extractRole(msg: unknown): string {
    if (typeof msg === 'object' && msg !== null && 'role' in msg) {
      return String((msg as { role: unknown }).role);
    }
    return 'unknown';
  }

  summarizeFrom(messages: unknown[], fromIndex: number): string {
    if (fromIndex < 0 || fromIndex >= messages.length) {
      return '';
    }
    const subset = messages.slice(fromIndex);
    return this.generateSummary(subset);
  }

  summarizeRange(messages: unknown[], startIndex: number, endIndex: number): string {
    const start = Math.max(0, startIndex);
    const end = Math.min(messages.length, endIndex);
    if (start >= end) {
      return '';
    }
    const subset = messages.slice(start, end);
    return this.generateSummary(subset);
  }

  generateSummary(messagesToSummarize: unknown[]): string {
    if (!messagesToSummarize || messagesToSummarize.length === 0) {
      this.lastMessageCount = 0;
      this.lastTokensSaved = 0;
      return '';
    }

    this.lastMessageCount = messagesToSummarize.length;

    // Collect all content
    const allContent: string[] = [];
    const roleGroups: Map<string, string[]> = new Map();

    for (const msg of messagesToSummarize) {
      const content = this.extractContent(msg);
      const role = this.extractRole(msg);
      if (content) {
        allContent.push(content);
        if (!roleGroups.has(role)) {
          roleGroups.set(role, []);
        }
        roleGroups.get(role)!.push(content);
      }
    }

    const fullText = allContent.join(' ');
    const originalTokens = this.estimateTokens(fullText);

    // Extract key topics via word frequency
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may',
      'who', 'did', 'get', 'got', 'let', 'say', 'she', 'too', 'use', 'way',
      'this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could',
      'should', 'what', 'when', 'where', 'which', 'there', 'their', 'about',
    ]);

    const words = fullText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length >= 3 && !stopWords.has(w));

    const freq = new Map<string, number>();
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }

    const topKeywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);

    // Build summary
    const lines: string[] = [];
    lines.push(`[Summary of ${messagesToSummarize.length} messages]`);
    
    if (topKeywords.length > 0) {
      lines.push(`Key topics: ${topKeywords.join(', ')}`);
    }

    for (const [role, contents] of roleGroups) {
      lines.push(`${role}: ${contents.length} message(s)`);
    }

    const summary = lines.join('\n');
    const summaryTokens = this.estimateTokens(summary);
    this.lastTokensSaved = Math.max(0, originalTokens - summaryTokens);

    logger.debug('Generated partial summary', {
      messageCount: messagesToSummarize.length,
      originalTokens,
      summaryTokens,
      tokensSaved: this.lastTokensSaved,
    });

    return summary;
  }

  getMessageCount(): number {
    return this.lastMessageCount;
  }

  getTokensSaved(): number {
    return this.lastTokensSaved;
  }
}

export function getPartialSummarizer(): PartialSummarizer {
  return PartialSummarizer.getInstance();
}

export function resetPartialSummarizer(): void {
  PartialSummarizer.resetInstance();
}
