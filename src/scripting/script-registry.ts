/**
 * Script Registry
 *
 * Provides discovery and management of script templates.
 * Supports both .bs and .fcs extensions.
 *
 * Migrated from src/fcs/script-registry.ts
 */

import * as fs from 'fs';
import * as path from 'path';

/** Supported script extensions */
const SCRIPT_EXTENSIONS = ['.bs', '.fcs', '.codebuddy'];

export interface ScriptTemplate {
  name: string;
  path: string;
  category: string;
  description: string;
  usage?: string;
  envVars?: string[];
}

export interface ScriptCategory {
  name: string;
  description: string;
  scripts: ScriptTemplate[];
}

/**
 * Registry of available script templates
 */
export class ScriptRegistry {
  private templates: Map<string, ScriptTemplate> = new Map();
  private categories: Map<string, ScriptCategory> = new Map();
  private templatesDir: string;

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(
      process.cwd(),
      'scripts/templates'
    );
  }

  /**
   * Load all templates from the templates directory
   */
  async loadTemplates(): Promise<void> {
    this.templates.clear();
    this.categories.clear();

    if (!fs.existsSync(this.templatesDir)) {
      return;
    }

    const categoryDescriptions: Record<string, string> = {
      refactoring: 'Scripts for code refactoring operations',
      testing: 'Scripts for test generation and execution',
      documentation: 'Scripts for documentation generation',
      utilities: 'General utility scripts'
    };

    const entries = fs.readdirSync(this.templatesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const categoryName = entry.name;
        const categoryPath = path.join(this.templatesDir, categoryName);
        const scripts = await this.loadCategoryScripts(categoryName, categoryPath);

        if (scripts.length > 0) {
          this.categories.set(categoryName, {
            name: categoryName,
            description: categoryDescriptions[categoryName] || `${categoryName} scripts`,
            scripts
          });
        }
      } else if (this.isScriptFile(entry.name)) {
        const template = await this.parseTemplate(entry.name, this.templatesDir, 'general');
        if (template) {
          this.templates.set(template.name, template);
        }
      }
    }
  }

  /**
   * Check if a filename is a script file
   */
  private isScriptFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return SCRIPT_EXTENSIONS.includes(ext);
  }

  /**
   * Load scripts from a category directory
   */
  private async loadCategoryScripts(category: string, categoryPath: string): Promise<ScriptTemplate[]> {
    const scripts: ScriptTemplate[] = [];

    if (!fs.existsSync(categoryPath)) {
      return scripts;
    }

    const files = fs.readdirSync(categoryPath);

    for (const file of files) {
      if (this.isScriptFile(file)) {
        const template = await this.parseTemplate(file, categoryPath, category);
        if (template) {
          scripts.push(template);
          this.templates.set(template.name, template);
        }
      }
    }

    return scripts;
  }

  /**
   * Parse a template file to extract metadata
   */
  private async parseTemplate(
    filename: string,
    dir: string,
    category: string
  ): Promise<ScriptTemplate | null> {
    const filePath = path.join(dir, filename);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      let description = '';
      let usage = '';
      const envVars: string[] = [];

      let inHeader = true;
      for (const line of lines) {
        const trimmed = line.trim();

        const envMatch = line.match(/env\("([A-Z_]+)"/g);
        if (envMatch) {
          for (const match of envMatch) {
            const varName = match.match(/env\("([A-Z_]+)"/)?.[1];
            if (varName && !envVars.includes(varName)) {
              envVars.push(varName);
            }
          }
        }

        if (!trimmed.startsWith('//')) {
          inHeader = false;
          continue;
        }

        if (!inHeader) continue;

        const commentContent = trimmed.substring(2).trim();

        if (commentContent.startsWith('Usage:')) {
          usage = commentContent.substring(6).trim();
        } else if (description === '' && commentContent) {
          if (commentContent.includes(' - ')) {
            const parts = commentContent.split(' - ');
            if (parts.length > 1) {
              description = parts.slice(1).join(' - ').trim();
            }
          } else if (!commentContent.match(/\.(bs|fcs|codebuddy)/)) {
            description = commentContent;
          }
        }
      }

      // Strip extension for name
      const ext = path.extname(filename);
      return {
        name: filename.replace(ext, ''),
        path: filePath,
        category,
        description: description || `${filename} script`,
        usage: usage || undefined,
        envVars: envVars.length > 0 ? envVars : undefined
      };
    } catch {
      return null;
    }
  }

  getTemplates(): ScriptTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: string): ScriptTemplate[] {
    return this.getTemplates().filter(t => t.category === category);
  }

  getCategories(): ScriptCategory[] {
    return Array.from(this.categories.values());
  }

  getTemplate(name: string): ScriptTemplate | undefined {
    return this.templates.get(name);
  }

  searchTemplates(keyword: string): ScriptTemplate[] {
    const lowerKeyword = keyword.toLowerCase();
    return this.getTemplates().filter(t =>
      t.name.toLowerCase().includes(lowerKeyword) ||
      t.description.toLowerCase().includes(lowerKeyword) ||
      t.category.toLowerCase().includes(lowerKeyword)
    );
  }

  formatTemplateList(): string {
    const lines: string[] = [
      'Script Templates',
      '='.repeat(50),
      ''
    ];

    for (const category of this.getCategories()) {
      lines.push(`## ${category.name.charAt(0).toUpperCase() + category.name.slice(1)}`);
      lines.push(category.description);
      lines.push('');

      for (const script of category.scripts) {
        lines.push(`  ${script.name}`);
        lines.push(`    ${script.description}`);
        if (script.usage) {
          lines.push(`    Usage: ${script.usage}`);
        }
        lines.push('');
      }
    }

    lines.push('-'.repeat(50));
    lines.push(`Total: ${this.templates.size} templates in ${this.categories.size} categories`);

    return lines.join('\n');
  }
}

let registryInstance: ScriptRegistry | null = null;

export function getScriptRegistry(): ScriptRegistry {
  if (!registryInstance) {
    registryInstance = new ScriptRegistry();
  }
  return registryInstance;
}

export async function initScriptRegistry(templatesDir?: string): Promise<ScriptRegistry> {
  const registry = new ScriptRegistry(templatesDir);
  await registry.loadTemplates();
  registryInstance = registry;
  return registry;
}
