/**
 * Agent Definition Loader
 *
 * Loads custom agent definitions from `.codebuddy/agents/*.md` (project)
 * and `~/.codebuddy/agents/*.md` (user) directories.
 * Uses YAML frontmatter for configuration and markdown body for system prompt.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logger } from '../../utils/logger.js';

export interface AgentDefinition {
  name: string;
  description: string;
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  tools?: string[];
  disallowedTools?: string[];
  maxTurns?: number;
  preloadedSkills?: string[];
  systemPrompt?: string;
}

/**
 * Parse YAML frontmatter from a markdown file.
 * Reuses the same pattern as SkillRegistry.parseFrontmatter.
 */
function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const meta: Record<string, unknown> = {};
  let body = content;

  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) {
    return { meta, body };
  }

  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) {
    return { meta, body };
  }

  const block = trimmed.slice(3, endIdx).trim();
  body = trimmed.slice(endIdx + 3).trim();

  const lines = block.split('\n');
  let currentArrayKey: string | null = null;
  let currentArray: string[] = [];

  const flushArray = (): void => {
    if (currentArrayKey && currentArray.length > 0) {
      meta[currentArrayKey] = currentArray;
    }
    currentArrayKey = null;
    currentArray = [];
  };

  for (const line of lines) {
    // Check for array item (indented with -)
    if (currentArrayKey && /^\s+-\s+/.test(line)) {
      const val = line.replace(/^\s+-\s+/, '').trim();
      if (val) {
        currentArray.push(val);
      }
      continue;
    }

    // Flush any pending array
    flushArray();

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    if (!val) {
      // Possibly an array header
      currentArrayKey = key;
      currentArray = [];
      continue;
    }

    // Try to parse as number
    const num = Number(val);
    if (!isNaN(num) && val !== '') {
      meta[key] = num;
    } else {
      meta[key] = val;
    }
  }

  flushArray();

  return { meta, body };
}

export function parseAgentFile(filePath: string): AgentDefinition {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { meta, body } = parseFrontmatter(content);

  const name = (meta.name as string) || path.basename(filePath, '.md');
  const description = (meta.description as string) || '';

  const definition: AgentDefinition = {
    name,
    description,
  };

  if (meta.model && typeof meta.model === 'string') {
    const validModels = ['sonnet', 'opus', 'haiku', 'inherit'];
    if (validModels.includes(meta.model)) {
      definition.model = meta.model as AgentDefinition['model'];
    }
  }

  if (Array.isArray(meta.tools)) {
    definition.tools = meta.tools as string[];
  }

  if (Array.isArray(meta.disallowedTools)) {
    definition.disallowedTools = meta.disallowedTools as string[];
  }

  if (typeof meta.maxTurns === 'number') {
    definition.maxTurns = meta.maxTurns;
  }

  if (Array.isArray(meta.preloadedSkills)) {
    definition.preloadedSkills = meta.preloadedSkills as string[];
  }

  if (body) {
    definition.systemPrompt = body;
  }

  return definition;
}

function scanDirectory(dirPath: string): AgentDefinition[] {
  const definitions: AgentDefinition[] = [];

  if (!fs.existsSync(dirPath)) {
    return definitions;
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    logger.warn(`Failed to read agent definitions directory: ${dirPath}`);
    return definitions;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;

    const filePath = path.join(dirPath, entry);
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) continue;

      const def = parseAgentFile(filePath);
      definitions.push(def);
    } catch (err) {
      logger.warn(`Failed to parse agent definition: ${filePath}: ${err}`);
    }
  }

  return definitions;
}

let cachedDefinitions: AgentDefinition[] | null = null;

export async function loadAgentDefinitions(baseDir?: string): Promise<AgentDefinition[]> {
  const projectDir = path.join(baseDir || process.cwd(), '.codebuddy', 'agents');
  const userDir = path.join(os.homedir(), '.codebuddy', 'agents');

  const userDefs = scanDirectory(userDir);
  const projectDefs = scanDirectory(projectDir);

  // Project definitions override user definitions with the same name
  const byName = new Map<string, AgentDefinition>();
  for (const def of userDefs) {
    byName.set(def.name, def);
  }
  for (const def of projectDefs) {
    byName.set(def.name, def);
  }

  cachedDefinitions = Array.from(byName.values());
  logger.info(`Loaded ${cachedDefinitions.length} agent definitions`);
  return cachedDefinitions;
}

export function getAgentDefinition(name: string): AgentDefinition | undefined {
  if (!cachedDefinitions) return undefined;
  return cachedDefinitions.find((d) => d.name === name);
}

export function resetDefinitionCache(): void {
  cachedDefinitions = null;
}
