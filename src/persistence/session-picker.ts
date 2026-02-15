/**
 * Session Picker Enhancement
 *
 * Provides session browsing with branch metadata, search, and table formatting.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface SessionPickerEntry {
  id: string;
  name: string;
  branch?: string;
  messageCount: number;
  lastAccessed: number;
  tags: string[];
}

// ============================================================================
// SessionPicker
// ============================================================================

export class SessionPicker {
  private entries: SessionPickerEntry[];

  constructor(entries: SessionPickerEntry[] = []) {
    this.entries = entries;
    logger.debug(`SessionPicker initialized with ${entries.length} entries`);
  }

  getEntries(limit?: number): SessionPickerEntry[] {
    const sorted = [...this.entries].sort((a, b) => b.lastAccessed - a.lastAccessed);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  searchByBranch(branch: string): SessionPickerEntry[] {
    return this.entries.filter(e => e.branch === branch);
  }

  searchByName(query: string): SessionPickerEntry[] {
    const lower = query.toLowerCase();
    return this.entries.filter(e => e.name.toLowerCase().includes(lower));
  }

  formatEntry(entry: SessionPickerEntry): string {
    const id = entry.id.slice(0, 8);
    const branch = entry.branch || '-';
    const date = new Date(entry.lastAccessed).toISOString().slice(0, 10);
    return `${id}  ${entry.name}  ${branch}  ${entry.messageCount} msgs  ${date}`;
  }

  formatTable(entries: SessionPickerEntry[]): string {
    const header = 'ID        Name                 Branch          Messages  Last Used';
    const divider = '-'.repeat(header.length);
    const rows = entries.map(e => {
      const id = e.id.slice(0, 8).padEnd(10);
      const name = e.name.slice(0, 20).padEnd(21);
      const branch = (e.branch || '-').slice(0, 15).padEnd(16);
      const msgs = String(e.messageCount).padEnd(10);
      const date = new Date(e.lastAccessed).toISOString().slice(0, 10);
      return `${id}${name}${branch}${msgs}${date}`;
    });
    return [header, divider, ...rows].join('\n');
  }
}
