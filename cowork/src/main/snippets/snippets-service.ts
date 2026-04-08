/**
 * SnippetsService — Phase 3 step 5
 *
 * File-backed reusable prompt templates. Each snippet is a Markdown
 * file under `<userData>/snippets/` with a YAML-like frontmatter
 * carrying name/description/tags.
 *
 * @module main/snippets/snippets-service
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { logWarn } from '../utils/logger';

export interface Snippet {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  body: string;
  updatedAt: number;
}

interface ParsedSnippet {
  name: string;
  description: string;
  tags: string[];
  body: string;
}

const DEFAULT_SNIPPETS: Record<string, ParsedSnippet> = {
  'explain-code': {
    name: 'Explain this code',
    description: 'Ask the assistant to walk through a function step by step',
    tags: ['explain', 'onboarding'],
    body: 'Please walk me through this code step by step, calling out any non-obvious behavior, edge cases, and potential improvements.',
  },
  'refactor-for-clarity': {
    name: 'Refactor for clarity',
    description: 'Request a refactor that prioritizes readability',
    tags: ['refactor', 'quality'],
    body: 'Refactor this code for clarity. Keep the external behavior identical but improve naming, extract helpers where helpful, and document tricky parts with concise comments.',
  },
  'write-tests': {
    name: 'Write unit tests',
    description: 'Generate a first round of unit tests',
    tags: ['testing'],
    body: 'Write a first round of unit tests for this module. Cover the happy path, the main edge cases, and any documented failure modes. Use the existing test framework conventions.',
  },
  'review-diff': {
    name: 'Review this diff',
    description: 'Ask for a code review of the currently staged diff',
    tags: ['review'],
    body: 'Review the currently staged diff as if you were a senior engineer. Call out correctness issues first, then readability, then opportunities for follow-up work.',
  },
};

export class SnippetsService {
  private snippetsDir: string;

  constructor() {
    this.snippetsDir = path.join(app.getPath('userData'), 'snippets');
    this.ensureDir();
    this.seedDefaults();
  }

  private ensureDir(): void {
    try {
      if (!fs.existsSync(this.snippetsDir)) {
        fs.mkdirSync(this.snippetsDir, { recursive: true });
      }
    } catch (err) {
      logWarn('[SnippetsService] ensureDir failed:', err);
    }
  }

  private seedDefaults(): void {
    try {
      for (const [id, snip] of Object.entries(DEFAULT_SNIPPETS)) {
        const file = path.join(this.snippetsDir, `${id}.md`);
        if (!fs.existsSync(file)) {
          fs.writeFileSync(file, this.serialize(snip), 'utf-8');
        }
      }
    } catch (err) {
      logWarn('[SnippetsService] seedDefaults failed:', err);
    }
  }

  private parse(raw: string): ParsedSnippet {
    const parsed: ParsedSnippet = { name: '', description: '', tags: [], body: '' };
    if (raw.startsWith('---\n')) {
      const end = raw.indexOf('\n---', 4);
      if (end > 0) {
        const front = raw.slice(4, end);
        parsed.body = raw.slice(end + 4).replace(/^\n/, '');
        for (const line of front.split('\n')) {
          const idx = line.indexOf(':');
          if (idx <= 0) continue;
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          if (key === 'name') parsed.name = value.replace(/^["']|["']$/g, '');
          else if (key === 'description')
            parsed.description = value.replace(/^["']|["']$/g, '');
          else if (key === 'tags')
            parsed.tags = value
              .replace(/^\[|\]$/g, '')
              .split(',')
              .map((t) => t.trim().replace(/^["']|["']$/g, ''))
              .filter(Boolean);
        }
        return parsed;
      }
    }
    parsed.body = raw;
    return parsed;
  }

  private serialize(snip: ParsedSnippet): string {
    const tags = snip.tags.map((t) => `"${t}"`).join(', ');
    return `---
name: "${snip.name.replace(/"/g, '\\"')}"
description: "${snip.description.replace(/"/g, '\\"')}"
tags: [${tags}]
---
${snip.body}
`;
  }

  private sanitizeId(id: string): string {
    return id
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }

  list(): Snippet[] {
    try {
      if (!fs.existsSync(this.snippetsDir)) return [];
      const files = fs.readdirSync(this.snippetsDir).filter((f) => f.endsWith('.md'));
      const result: Snippet[] = [];
      for (const file of files) {
        const id = file.replace(/\.md$/, '');
        const filePath = path.join(this.snippetsDir, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const parsed = this.parse(raw);
          const stat = fs.statSync(filePath);
          result.push({
            id,
            name: parsed.name || id,
            description: parsed.description,
            tags: parsed.tags,
            body: parsed.body,
            updatedAt: stat.mtimeMs,
          });
        } catch {
          /* skip unreadable entries */
        }
      }
      return result.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      logWarn('[SnippetsService] list failed:', err);
      return [];
    }
  }

  get(id: string): Snippet | null {
    const file = path.join(this.snippetsDir, `${this.sanitizeId(id)}.md`);
    if (!fs.existsSync(file)) return null;
    try {
      const raw = fs.readFileSync(file, 'utf-8');
      const parsed = this.parse(raw);
      const stat = fs.statSync(file);
      return {
        id,
        name: parsed.name || id,
        description: parsed.description,
        tags: parsed.tags,
        body: parsed.body,
        updatedAt: stat.mtimeMs,
      };
    } catch (err) {
      logWarn('[SnippetsService] get failed:', err);
      return null;
    }
  }

  save(snippet: {
    id?: string;
    name: string;
    description?: string;
    tags?: string[];
    body: string;
  }): { success: boolean; id?: string; error?: string } {
    try {
      if (!snippet.name || !snippet.body) {
        return { success: false, error: 'Name and body are required' };
      }
      const id = this.sanitizeId(snippet.id ?? snippet.name);
      if (!id) return { success: false, error: 'Invalid id' };
      const file = path.join(this.snippetsDir, `${id}.md`);
      fs.writeFileSync(
        file,
        this.serialize({
          name: snippet.name,
          description: snippet.description ?? '',
          tags: snippet.tags ?? [],
          body: snippet.body,
        }),
        'utf-8'
      );
      return { success: true, id };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  delete(id: string): { success: boolean; error?: string } {
    try {
      const file = path.join(this.snippetsDir, `${this.sanitizeId(id)}.md`);
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

let instance: SnippetsService | null = null;
export function getSnippetsService(): SnippetsService {
  if (!instance) instance = new SnippetsService();
  return instance;
}
