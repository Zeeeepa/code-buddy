/**
 * ConfigExportService — Claude Cowork parity Phase 2 step 19
 *
 * Serializes the user's settings (API config, projects, rules, custom
 * skills, MCP servers) into a versioned JSON bundle and imports them
 * back with conflict resolution.
 *
 * @module main/config/config-export-service
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { logWarn } from '../utils/logger';
import { configStore } from '../config/config-store';
import { mcpConfigStore } from '../mcp/mcp-config-store';
import type { ProjectManager } from '../project/project-manager';

export interface ConfigExportBundle {
  version: number;
  exportedAt: string;
  source: string;
  app: {
    api: Record<string, unknown>;
    theme?: string;
  };
  projects: Array<Record<string, unknown>>;
  mcpServers: Array<Record<string, unknown>>;
  rules?: Array<Record<string, unknown>>;
}

export interface ImportConflict {
  type: 'project' | 'mcpServer' | 'apiKey';
  identifier: string;
  current?: unknown;
  incoming: unknown;
}

export interface ImportPreview {
  bundle: ConfigExportBundle;
  conflicts: ImportConflict[];
  newProjects: number;
  newMcpServers: number;
}

export interface ImportResult {
  success: boolean;
  imported: {
    projects: number;
    mcpServers: number;
    apiUpdated: boolean;
  };
  errors: string[];
}

const BUNDLE_VERSION = 1;

export class ConfigExportService {
  constructor(private projectManager: ProjectManager) {}

  /** Build a bundle from the current state. */
  exportBundle(): ConfigExportBundle {
    const config = configStore.getAll() as unknown as Record<string, unknown>;
    const projects = this.projectManager.list();
    const mcpServers = mcpConfigStore.getServers();

    return {
      version: BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      source: `Code Buddy Cowork ${app.getVersion()}`,
      app: {
        api: this.sanitizeApiConfig(config),
        theme: (config as Record<string, unknown>).theme as string | undefined,
      },
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        workspacePath: p.workspacePath,
        memoryConfig: p.memoryConfig,
        createdAt: p.createdAt,
      })),
      mcpServers: mcpServers.map((s) => ({ ...s })),
    };
  }

  /** Sanitize the API config: drop or mask known secret fields. */
  private sanitizeApiConfig(config: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (/(apiKey|password|secret|token)$/i.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  /** Write the bundle to a file path on disk. */
  saveToFile(targetPath: string): { success: boolean; error?: string; bundle?: ConfigExportBundle } {
    try {
      const bundle = this.exportBundle();
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetPath, JSON.stringify(bundle, null, 2), 'utf-8');
      return { success: true, bundle };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** Read a bundle from disk. */
  loadFromFile(sourcePath: string): { success: boolean; bundle?: ConfigExportBundle; error?: string } {
    try {
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: `File not found: ${sourcePath}` };
      }
      const raw = fs.readFileSync(sourcePath, 'utf-8');
      const parsed = JSON.parse(raw) as ConfigExportBundle;
      if (typeof parsed.version !== 'number') {
        return { success: false, error: 'Invalid bundle: missing version' };
      }
      if (parsed.version > BUNDLE_VERSION) {
        return {
          success: false,
          error: `Bundle version ${parsed.version} is newer than supported ${BUNDLE_VERSION}`,
        };
      }
      return { success: true, bundle: parsed };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** Compute conflicts between an incoming bundle and current state. */
  diffBundle(bundle: ConfigExportBundle): ImportPreview {
    const conflicts: ImportConflict[] = [];
    const currentProjects = this.projectManager.list();
    const currentProjectIds = new Set(currentProjects.map((p) => p.id));
    const currentProjectNames = new Map(currentProjects.map((p) => [p.name, p]));
    const currentServers = mcpConfigStore.getServers();
    const currentServerNames = new Set(currentServers.map((s) => s.name));

    let newProjects = 0;
    for (const proj of bundle.projects) {
      const id = proj.id as string;
      const name = proj.name as string;
      if (currentProjectIds.has(id) || currentProjectNames.has(name)) {
        conflicts.push({
          type: 'project',
          identifier: name,
          current: currentProjectNames.get(name),
          incoming: proj,
        });
      } else {
        newProjects++;
      }
    }

    let newMcpServers = 0;
    for (const server of bundle.mcpServers) {
      const name = server.name as string;
      if (currentServerNames.has(name)) {
        conflicts.push({
          type: 'mcpServer',
          identifier: name,
          current: currentServers.find((s) => s.name === name),
          incoming: server,
        });
      } else {
        newMcpServers++;
      }
    }

    return { bundle, conflicts, newProjects, newMcpServers };
  }

  /**
   * Apply an import bundle. `strategy` controls how conflicts are
   * resolved: `skip` keeps existing items, `overwrite` replaces them.
   */
  importBundle(
    bundle: ConfigExportBundle,
    strategy: 'skip' | 'overwrite' = 'skip'
  ): ImportResult {
    const result: ImportResult = {
      success: true,
      imported: { projects: 0, mcpServers: 0, apiUpdated: false },
      errors: [],
    };

    const currentProjects = this.projectManager.list();
    const currentProjectIds = new Set(currentProjects.map((p) => p.id));
    const currentProjectNames = new Map(currentProjects.map((p) => [p.name, p.id]));
    const currentServers = mcpConfigStore.getServers();
    const currentServerNames = new Set(currentServers.map((s) => s.name));

    // Projects
    for (const proj of bundle.projects) {
      const id = proj.id as string;
      const name = proj.name as string;
      const isConflict = currentProjectIds.has(id) || currentProjectNames.has(name);
      if (isConflict && strategy === 'skip') continue;
      try {
        if (isConflict && strategy === 'overwrite') {
          const existingId = currentProjectIds.has(id) ? id : currentProjectNames.get(name);
          if (existingId) {
            this.projectManager.update(existingId, {
              name: name,
              description: proj.description as string | undefined,
              workspacePath: proj.workspacePath as string | undefined,
            });
          }
        } else {
          this.projectManager.create({
            name,
            description: proj.description as string | undefined,
            workspacePath: proj.workspacePath as string | undefined,
          });
        }
        result.imported.projects++;
      } catch (err) {
        result.errors.push(`project ${name}: ${(err as Error).message}`);
      }
    }

    // MCP servers
    for (const server of bundle.mcpServers) {
      const name = server.name as string;
      const isConflict = currentServerNames.has(name);
      if (isConflict && strategy === 'skip') continue;
      try {
        mcpConfigStore.saveServer(server as never);
        result.imported.mcpServers++;
      } catch (err) {
        result.errors.push(`MCP server ${name}: ${(err as Error).message}`);
      }
    }

    // API config (only update non-secret fields)
    if (bundle.app.api && Object.keys(bundle.app.api).length > 0) {
      try {
        const incoming: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(bundle.app.api)) {
          if (value === '[REDACTED]') continue;
          incoming[key] = value;
        }
        if (Object.keys(incoming).length > 0) {
          configStore.update(incoming as never);
          result.imported.apiUpdated = true;
        }
      } catch (err) {
        result.errors.push(`API config: ${(err as Error).message}`);
      }
    }

    if (result.errors.length > 0) {
      logWarn('[ConfigExportService] import completed with errors:', result.errors);
    }

    return result;
  }
}
