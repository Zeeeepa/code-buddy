/**
 * KnowledgeService — Claude Cowork parity
 *
 * Wraps Code Buddy's KnowledgeManager, scoped to the active project's
 * workspace. Provides CRUD + search operations for knowledge files stored
 * in `.codebuddy/knowledge/` folders.
 *
 * @module main/knowledge/knowledge-service
 */

import { join, basename } from 'path';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  statSync,
} from 'fs';
import { log, logError, logWarn } from '../utils/logger';

export interface KnowledgeEntry {
  id: string;
  title: string;
  tags: string[];
  scope: string[];
  priority: number;
  content: string;
  source: 'global' | 'project' | 'local';
  path: string;
  updatedAt: number;
}

export interface KnowledgeCreateInput {
  title: string;
  content: string;
  tags?: string[];
  scope?: string[];
  priority?: number;
}

export interface KnowledgeSearchResult {
  entry: KnowledgeEntry;
  score: number;
  excerpt: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

function buildFrontmatter(input: KnowledgeCreateInput): string {
  const fm: string[] = ['---'];
  fm.push(`title: ${input.title}`);
  if (input.tags && input.tags.length > 0) {
    fm.push(`tags: [${input.tags.join(', ')}]`);
  }
  if (input.scope && input.scope.length > 0) {
    fm.push(`scope: [${input.scope.join(', ')}]`);
  }
  if (typeof input.priority === 'number') {
    fm.push(`priority: ${input.priority}`);
  }
  fm.push('---', '');
  return fm.join('\n');
}

function parseFrontmatter(content: string): {
  meta: Partial<KnowledgeEntry>;
  body: string;
} {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return { meta: {}, body: content };

  const yamlBlock = match[1];
  const body = match[2];
  const meta: Partial<KnowledgeEntry> = {};

  for (const line of yamlBlock.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;

    if (key === 'title') {
      meta.title = value.trim();
    } else if (key === 'priority') {
      meta.priority = parseInt(value.trim(), 10) || 0;
    } else if (key === 'tags' || key === 'scope') {
      const inline = value.match(/^\[(.*)\]$/);
      if (inline) {
        meta[key] = inline[1]
          .split(',')
          .map((t) => t.trim().replace(/['"]/g, ''))
          .filter(Boolean);
      }
    }
  }

  return { meta, body };
}

export class KnowledgeService {
  /** Resolve the knowledge directory for a given project workspace */
  private knowledgeDir(workspacePath: string): string {
    return join(workspacePath, '.codebuddy', 'knowledge');
  }

  /** Ensure the knowledge directory exists */
  private ensureDir(workspacePath: string): string {
    const dir = this.knowledgeDir(workspacePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /** List all knowledge entries for a workspace */
  list(workspacePath: string): KnowledgeEntry[] {
    if (!existsSync(workspacePath)) return [];
    const dir = this.knowledgeDir(workspacePath);
    if (!existsSync(dir)) return [];

    const entries: KnowledgeEntry[] = [];
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const filePath = join(dir, file);
        try {
          const content = readFileSync(filePath, 'utf-8');
          const { meta, body } = parseFrontmatter(content);
          const stat = statSync(filePath);
          entries.push({
            id: basename(file, '.md'),
            title: meta.title ?? basename(file, '.md'),
            tags: meta.tags ?? [],
            scope: meta.scope ?? [],
            priority: meta.priority ?? 0,
            content: body,
            source: 'project',
            path: filePath,
            updatedAt: stat.mtimeMs,
          });
        } catch (err) {
          logWarn('[KnowledgeService] Failed to read knowledge file:', filePath, err);
        }
      }
    } catch (err) {
      logError('[KnowledgeService] Failed to list knowledge dir:', err);
    }

    return entries.sort((a, b) => b.priority - a.priority);
  }

  /** Get a single knowledge entry by id */
  get(workspacePath: string, id: string): KnowledgeEntry | null {
    const all = this.list(workspacePath);
    return all.find((e) => e.id === id) ?? null;
  }

  /** Create a new knowledge entry */
  create(workspacePath: string, input: KnowledgeCreateInput): KnowledgeEntry {
    const dir = this.ensureDir(workspacePath);
    const safeId = input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    const id = safeId || `entry-${Date.now()}`;
    const filePath = join(dir, `${id}.md`);

    const fullContent = buildFrontmatter(input) + input.content;
    writeFileSync(filePath, fullContent, 'utf-8');

    log('[KnowledgeService] Created entry:', id);

    return {
      id,
      title: input.title,
      tags: input.tags ?? [],
      scope: input.scope ?? [],
      priority: input.priority ?? 0,
      content: input.content,
      source: 'project',
      path: filePath,
      updatedAt: Date.now(),
    };
  }

  /** Update an existing knowledge entry */
  update(
    workspacePath: string,
    id: string,
    updates: Partial<KnowledgeCreateInput>
  ): KnowledgeEntry | null {
    const existing = this.get(workspacePath, id);
    if (!existing) return null;

    const merged: KnowledgeCreateInput = {
      title: updates.title ?? existing.title,
      content: updates.content ?? existing.content,
      tags: updates.tags ?? existing.tags,
      scope: updates.scope ?? existing.scope,
      priority: updates.priority ?? existing.priority,
    };

    const fullContent = buildFrontmatter(merged) + merged.content;
    writeFileSync(existing.path, fullContent, 'utf-8');

    log('[KnowledgeService] Updated entry:', id);

    return {
      ...existing,
      title: merged.title,
      content: merged.content,
      tags: merged.tags ?? [],
      scope: merged.scope ?? [],
      priority: merged.priority ?? 0,
      updatedAt: Date.now(),
    };
  }

  /** Delete a knowledge entry */
  delete(workspacePath: string, id: string): boolean {
    const existing = this.get(workspacePath, id);
    if (!existing) return false;

    try {
      unlinkSync(existing.path);
      log('[KnowledgeService] Deleted entry:', id);
      return true;
    } catch (err) {
      logError('[KnowledgeService] Failed to delete entry:', err);
      return false;
    }
  }

  /** Simple keyword search over knowledge entries */
  search(
    workspacePath: string,
    query: string,
    limit = 10
  ): KnowledgeSearchResult[] {
    const all = this.list(workspacePath);
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery) return [];

    const keywords = lowerQuery.split(/\s+/).filter((k) => k.length > 2);
    if (keywords.length === 0) return [];

    const results: KnowledgeSearchResult[] = [];
    for (const entry of all) {
      const haystack = `${entry.title}\n${entry.tags.join(' ')}\n${entry.content}`.toLowerCase();
      let score = 0;
      let firstMatchIdx = -1;

      for (const kw of keywords) {
        const idx = haystack.indexOf(kw);
        if (idx !== -1) {
          score += 1;
          if (firstMatchIdx === -1 || idx < firstMatchIdx) firstMatchIdx = idx;
        }
      }

      if (score === 0) continue;

      // Bonus for title match
      if (entry.title.toLowerCase().includes(lowerQuery)) score += 2;

      // Build excerpt around first match
      const excerptStart = Math.max(0, firstMatchIdx - 80);
      const excerptEnd = Math.min(entry.content.length, firstMatchIdx + 200);
      const excerpt =
        (excerptStart > 0 ? '...' : '') +
        entry.content.slice(excerptStart, excerptEnd).trim() +
        (excerptEnd < entry.content.length ? '...' : '');

      results.push({
        entry,
        score: score / (keywords.length + 2),
        excerpt,
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
}
