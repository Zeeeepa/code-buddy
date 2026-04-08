/**
 * MCPMarketplaceBridge — Claude Cowork parity Phase 2
 *
 * Exposes the curated MCP server registry (from mcp-marketplace-registry.ts)
 * annotated with install state from the existing MCPConfigStore. Provides
 * one-click install that writes to the config store and refreshes the
 * running MCPManager.
 *
 * @module main/mcp/mcp-marketplace-bridge
 */

import { randomUUID } from 'crypto';
import { log, logWarn } from '../utils/logger';
import {
  MCP_MARKETPLACE_REGISTRY,
  searchRegistry,
  getRegistryById,
  type MCPRegistryEntry,
} from './mcp-marketplace-registry';

// These types are the same ones used by the existing MCPManager. Importing
// the value would create a circular init path; we only need the shape.
export interface MCPServerConfigLike {
  id: string;
  name: string;
  type: 'stdio' | 'sse' | 'http' | 'streamable-http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  enabled: boolean;
}

export interface MCPMarketplaceItem extends MCPRegistryEntry {
  /** true if the user already installed this entry */
  installed: boolean;
  /** When installed, the server id in the live config store */
  installedServerId?: string;
  /** When installed, whether the server is currently enabled */
  enabled?: boolean;
}

export interface MCPToolSummary {
  name: string;
  description?: string;
  serverId: string;
  serverName: string;
  inputSchema?: unknown;
}

export interface MCPToolInvokeResult {
  success: boolean;
  durationMs: number;
  result?: unknown;
  error?: string;
}

/**
 * Interface the bridge expects from the host to avoid a hard import cycle.
 * The host (main/index.ts) wires it via `configure()` after construction.
 */
export interface MCPMarketplaceHost {
  listInstalledServers: () => MCPServerConfigLike[];
  saveServer: (config: MCPServerConfigLike) => Promise<void> | void;
  deleteServer: (serverId: string) => Promise<void> | void;
  updateServer: (config: MCPServerConfigLike) => Promise<void> | void;
  listTools: () => Array<{
    name: string;
    description?: string;
    serverId: string;
    serverName?: string;
    inputSchema?: unknown;
  }>;
  /** Substitute `{WORKSPACE}` etc. at install time */
  expandArgs: (args: string[]) => string[];
  /** Invoke an MCP tool by its fully-qualified name */
  callTool?: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
}

export class MCPMarketplaceBridge {
  private host: MCPMarketplaceHost | null = null;

  configure(host: MCPMarketplaceHost): void {
    this.host = host;
    log('[MCPMarketplaceBridge] Host configured');
  }

  /** Return the full registry with install annotations. */
  list(): MCPMarketplaceItem[] {
    return this.annotate(MCP_MARKETPLACE_REGISTRY);
  }

  /** Search the registry (name/description/tags) with install annotations. */
  search(query: string): MCPMarketplaceItem[] {
    return this.annotate(searchRegistry(query));
  }

  /** Get one entry with install state. */
  get(id: string): MCPMarketplaceItem | null {
    const entry = getRegistryById(id);
    if (!entry) return null;
    return this.annotate([entry])[0] ?? null;
  }

  /** Install an entry by copying the registry config into the user's store. */
  async install(id: string, envOverrides?: Record<string, string>): Promise<{
    success: boolean;
    serverId?: string;
    error?: string;
  }> {
    if (!this.host) {
      return { success: false, error: 'Marketplace host not configured' };
    }
    const entry = getRegistryById(id);
    if (!entry) {
      return { success: false, error: `Unknown registry entry: ${id}` };
    }

    // Check if already installed to avoid duplicates.
    const existing = this.findInstalled(entry);
    if (existing) {
      return { success: true, serverId: existing.id };
    }

    const env: Record<string, string> = {};
    if (entry.requiresEnv) {
      for (const key of entry.requiresEnv) {
        env[key] = envOverrides?.[key] ?? '';
      }
    }

    const args = entry.args ? this.host.expandArgs(entry.args) : [];

    const config: MCPServerConfigLike = {
      id: randomUUID(),
      name: entry.name,
      type: entry.type,
      command: entry.command,
      args,
      url: entry.url,
      env,
      enabled: true,
    };

    try {
      await this.host.saveServer(config);
      log('[MCPMarketplaceBridge] Installed', id, 'as', config.id);
      return { success: true, serverId: config.id };
    } catch (err) {
      logWarn('[MCPMarketplaceBridge] Install failed:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Uninstall by deleting the matching server from the config store. */
  async uninstall(id: string): Promise<{ success: boolean; error?: string }> {
    if (!this.host) {
      return { success: false, error: 'Marketplace host not configured' };
    }
    const entry = getRegistryById(id);
    if (!entry) {
      return { success: false, error: `Unknown registry entry: ${id}` };
    }
    const existing = this.findInstalled(entry);
    if (!existing) {
      return { success: true }; // nothing to do
    }
    try {
      await this.host.deleteServer(existing.id);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Toggle enable/disable for an installed entry. */
  async setEnabled(
    id: string,
    enabled: boolean
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.host) {
      return { success: false, error: 'Marketplace host not configured' };
    }
    const entry = getRegistryById(id);
    if (!entry) {
      return { success: false, error: `Unknown registry entry: ${id}` };
    }
    const existing = this.findInstalled(entry);
    if (!existing) {
      return { success: false, error: 'Server is not installed' };
    }
    try {
      await this.host.updateServer({ ...existing, enabled });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** List MCP tools for a registry entry (only if installed). */
  getTools(id: string): MCPToolSummary[] {
    if (!this.host) return [];
    const entry = getRegistryById(id);
    if (!entry) return [];
    const existing = this.findInstalled(entry);
    if (!existing) return [];

    return this.host
      .listTools()
      .filter((t) => t.serverId === existing.id)
      .map((t) => ({
        name: t.name,
        description: t.description,
        serverId: existing.id,
        serverName: t.serverName ?? existing.name,
        inputSchema: t.inputSchema,
      }));
  }

  /** Phase 3 step 7: list every installed tool across every server. */
  listAllTools(): MCPToolSummary[] {
    if (!this.host) return [];
    const installed = this.host.listInstalledServers();
    const byId = new Map(installed.map((s) => [s.id, s.name] as const));
    return this.host.listTools().map((t) => ({
      name: t.name,
      description: t.description,
      serverId: t.serverId,
      serverName: t.serverName ?? byId.get(t.serverId) ?? 'unknown',
      inputSchema: t.inputSchema,
    }));
  }

  /** Phase 3 step 7: invoke a tool by name with the given arguments. */
  async invokeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolInvokeResult> {
    if (!this.host?.callTool) {
      return {
        success: false,
        durationMs: 0,
        error: 'MCP tool invocation is not wired — host.callTool missing',
      };
    }
    const start = Date.now();
    try {
      const result = await this.host.callTool(toolName, args);
      return { success: true, durationMs: Date.now() - start, result };
    } catch (err) {
      return {
        success: false,
        durationMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private annotate(entries: MCPRegistryEntry[]): MCPMarketplaceItem[] {
    return entries.map((entry) => {
      const existing = this.findInstalled(entry);
      return {
        ...entry,
        installed: Boolean(existing),
        installedServerId: existing?.id,
        enabled: existing?.enabled,
      };
    });
  }

  private findInstalled(entry: MCPRegistryEntry): MCPServerConfigLike | null {
    if (!this.host) return null;
    const servers = this.host.listInstalledServers();
    // Match by name first (human-readable), fall back to command+args shape
    const byName = servers.find((s) => s.name === entry.name);
    if (byName) return byName;
    if (entry.type === 'stdio' && entry.command && entry.args) {
      return (
        servers.find(
          (s) =>
            s.type === 'stdio' &&
            s.command === entry.command &&
            JSON.stringify(s.args?.slice(0, 2)) === JSON.stringify(entry.args?.slice(0, 2))
        ) ?? null
      );
    }
    return null;
  }
}
