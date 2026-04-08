/**
 * TemplateService — Claude Cowork parity Phase 2 step 12
 *
 * Surfaces project starter packs (SKILL.md skills tagged `starter` or
 * `scaffold`) for the New Project flow. Wraps SkillMdBridge to filter
 * the available templates and read the SKILL.md preview content.
 *
 * @module main/project/template-service
 */

import * as fs from 'fs';
import { logWarn } from '../utils/logger';
import type { SkillMdBridge, SkillMdSummary } from '../skills/skill-md-bridge';

export interface ProjectTemplate {
  name: string;
  description: string;
  tier: string;
  tags: string[];
  language?: string;
  filePath?: string;
}

const STARTER_TAGS = new Set(['starter', 'scaffold']);

const LANGUAGE_HINT_FROM_NAME: Array<[RegExp, string]> = [
  [/^(typescript|node|react|next|vue|svelte|angular|electron|expo)/, 'TypeScript'],
  [/^python/, 'Python'],
  [/^rust/, 'Rust'],
  [/^go/, 'Go'],
  [/^ruby/, 'Ruby'],
  [/^php/, 'PHP'],
  [/^java/, 'Java'],
  [/^kotlin/, 'Kotlin'],
  [/^csharp|^dotnet/, 'C#'],
  [/^elixir/, 'Elixir'],
  [/^swift/, 'Swift'],
  [/^zig/, 'Zig'],
];

function inferLanguage(name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [pattern, lang] of LANGUAGE_HINT_FROM_NAME) {
    if (pattern.test(lower)) return lang;
  }
  return undefined;
}

function toTemplate(summary: SkillMdSummary): ProjectTemplate {
  return {
    name: summary.name,
    description: summary.description,
    tier: summary.tier,
    tags: summary.tags ?? [],
    language: inferLanguage(summary.name),
    filePath: summary.filePath,
  };
}

export class TemplateService {
  constructor(private skillBridge: SkillMdBridge) {}

  /** List all starter pack templates, sorted by language then name. */
  async list(): Promise<ProjectTemplate[]> {
    try {
      const skills = await this.skillBridge.list();
      const starters = skills.filter((s) =>
        (s.tags ?? []).some((t) => STARTER_TAGS.has(t.toLowerCase()))
      );
      return starters
        .map(toTemplate)
        .sort((a, b) => {
          const la = a.language ?? '';
          const lb = b.language ?? '';
          if (la !== lb) return la.localeCompare(lb);
          return a.name.localeCompare(b.name);
        });
    } catch (err) {
      logWarn('[TemplateService] list failed:', err);
      return [];
    }
  }

  /** Read the raw SKILL.md content for the preview pane. */
  async preview(name: string): Promise<{ content: string; filePath?: string } | null> {
    try {
      const all = await this.skillBridge.list();
      const skill = all.find((s) => s.name === name);
      if (!skill?.filePath) return null;
      if (!fs.existsSync(skill.filePath)) {
        return { content: 'Template file not found', filePath: skill.filePath };
      }
      const content = fs.readFileSync(skill.filePath, 'utf-8');
      return { content, filePath: skill.filePath };
    } catch (err) {
      logWarn('[TemplateService] preview failed:', err);
      return null;
    }
  }

  /**
   * Apply a template to the target workspace by executing the underlying
   * SKILL.md skill. The skill itself defines what files/commands to run.
   */
  async apply(
    name: string,
    workspaceRoot: string
  ): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const result = await this.skillBridge.execute(name, {
        workspaceRoot,
        userInput: `Scaffold a new project in ${workspaceRoot}`,
      });
      return {
        success: result.success,
        output: result.output,
        error: result.error,
      };
    } catch (err) {
      logWarn('[TemplateService] apply failed:', err);
      return {
        success: false,
        error: (err as Error).message ?? 'Template execution failed',
      };
    }
  }
}
