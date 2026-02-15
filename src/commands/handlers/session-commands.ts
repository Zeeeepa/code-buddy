/**
 * Session Commands Handler
 *
 * Provides /rename and /tag commands for session management,
 * including auto-name generation from message context.
 */

import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

interface SessionData {
  name?: string;
  tags: string[];
}

// ============================================================================
// SessionCommandHandler
// ============================================================================

export class SessionCommandHandler {
  private sessions: Map<string, SessionData> = new Map();

  private getOrCreate(sessionId: string): SessionData {
    let data = this.sessions.get(sessionId);
    if (!data) {
      data = { tags: [] };
      this.sessions.set(sessionId, data);
    }
    return data;
  }

  renameSession(sessionId: string, name?: string): string {
    const data = this.getOrCreate(sessionId);
    if (name) {
      data.name = name;
    } else {
      data.name = `session-${sessionId.substring(0, 8)}`;
    }
    logger.info(`Renamed session ${sessionId} to "${data.name}"`);
    return data.name;
  }

  tagSession(sessionId: string, tags: string[]): string[] {
    const data = this.getOrCreate(sessionId);
    for (const tag of tags) {
      const normalized = tag.toLowerCase().trim();
      if (normalized && !data.tags.includes(normalized)) {
        data.tags.push(normalized);
      }
    }
    logger.info(`Tagged session ${sessionId}`, { tags: data.tags });
    return data.tags;
  }

  removeTag(sessionId: string, tag: string): boolean {
    const data = this.sessions.get(sessionId);
    if (!data) {
      return false;
    }
    const normalized = tag.toLowerCase().trim();
    const index = data.tags.indexOf(normalized);
    if (index === -1) {
      return false;
    }
    data.tags.splice(index, 1);
    return true;
  }

  getSessionTags(sessionId: string): string[] {
    const data = this.sessions.get(sessionId);
    return data?.tags || [];
  }

  searchByTag(tag: string): string[] {
    const normalized = tag.toLowerCase().trim();
    const results: string[] = [];
    for (const [sessionId, data] of this.sessions) {
      if (data.tags.includes(normalized)) {
        results.push(sessionId);
      }
    }
    return results;
  }

  generateSessionName(messages: unknown[]): string {
    if (!messages || messages.length === 0) {
      return 'empty-session';
    }

    // Extract text content from messages
    const words: string[] = [];
    for (const msg of messages) {
      const content = typeof msg === 'object' && msg !== null && 'content' in msg
        ? String((msg as { content: unknown }).content)
        : typeof msg === 'string' ? msg : '';
      
      // Extract meaningful words (4+ chars, no common words)
      const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'would', 'could', 'should', 'what', 'when', 'where', 'which', 'there', 'their', 'about', 'your', 'they', 'them', 'then', 'than', 'some', 'into', 'also', 'just', 'very', 'more', 'most', 'make', 'like', 'each', 'does']);
      const extracted = content
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 4 && !stopWords.has(w));
      words.push(...extracted);
    }

    if (words.length === 0) {
      return 'unnamed-session';
    }

    // Pick top keywords by frequency
    const freq = new Map<string, number>();
    for (const w of words) {
      freq.set(w, (freq.get(w) || 0) + 1);
    }
    const top = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w);

    return top.join('-');
  }

  formatSessionInfo(sessionId: string): string {
    const data = this.sessions.get(sessionId);
    if (!data) {
      return `Session ${sessionId}: (no metadata)`;
    }

    const lines: string[] = [];
    lines.push(`Session: ${sessionId}`);
    if (data.name) {
      lines.push(`Name: ${data.name}`);
    }
    if (data.tags.length > 0) {
      lines.push(`Tags: ${data.tags.join(', ')}`);
    }
    return lines.join('\n');
  }
}
