/**
 * Agent Roles — Configuration-driven agent behavior presets
 *
 * Three built-in roles:
 *   - default: Standard agent behavior, all tools available
 *   - explorer: Read-only codebase Q&A, fast responses
 *   - worker: Execution focus with file ownership, sequential
 *
 * Roles are TOML config overlays applied at session-flag precedence.
 * Custom roles can be defined in .codebuddy/roles/.
 *
 * Inspired by OpenAI Codex CLI's agent/role.rs
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface AgentRoleConfig {
  /** Role name */
  name: string;
  /** Human-readable description */
  description: string;
  /** System prompt injection for this role */
  systemPrompt: string;
  /** Allowed tool names (empty = all allowed) */
  allowedTools: string[];
  /** Blocked tool names */
  blockedTools: string[];
  /** Whether the agent can spawn sub-agents */
  canSpawnAgents: boolean;
  /** Suggested model override (null = inherit from parent) */
  model: string | null;
  /** Reasoning effort override */
  reasoningEffort: 'low' | 'medium' | 'high' | null;
  /** Whether this role is read-only */
  readOnly: boolean;
}

// ============================================================================
// Built-in Roles
// ============================================================================

const EXPLORER_ROLE: AgentRoleConfig = {
  name: 'explorer',
  description: 'Read-only codebase explorer. Fast, authoritative answers about code structure.',
  systemPrompt: `You are a codebase explorer agent. Your job is to quickly answer questions about the codebase structure, dependencies, and patterns.

Rules:
- Use ONLY read and search tools (grep, glob, read_file, tree, find_references)
- Do NOT modify any files
- Do NOT run shell commands
- Be fast and authoritative — your answers should be trusted without additional verification
- When asked about multiple files, read them in parallel
- Provide specific file paths and line numbers in your answers`,
  allowedTools: [
    'read_file', 'view_file', 'file_read', 'grep', 'glob',
    'list_files', 'search_files', 'find_references', 'tree',
    'get_file_info', 'codebase_map', 'code_graph',
    'knowledge_search', 'knowledge_list',
  ],
  blockedTools: [],
  canSpawnAgents: false,
  model: null,
  reasoningEffort: 'low',
  readOnly: true,
};

const WORKER_ROLE: AgentRoleConfig = {
  name: 'worker',
  description: 'Execution worker. Focused on implementing changes with explicit file ownership.',
  systemPrompt: `You are a worker agent assigned to implement specific changes.

Rules:
- Focus only on the files and tasks explicitly assigned to you
- Do NOT modify files outside your assignment
- You are not alone — other agents may be editing other files simultaneously
- Do NOT revert edits made by other agents
- Run tests after making changes to verify correctness
- Call terminate when your assigned task is complete`,
  allowedTools: [], // all tools
  blockedTools: ['spawn_agent'], // workers don't spawn
  canSpawnAgents: false,
  model: null,
  reasoningEffort: 'medium',
  readOnly: false,
};

const DEFAULT_ROLE: AgentRoleConfig = {
  name: 'default',
  description: 'Standard agent with full capabilities.',
  systemPrompt: '',
  allowedTools: [],
  blockedTools: [],
  canSpawnAgents: true,
  model: null,
  reasoningEffort: null,
  readOnly: false,
};

/** Registry of all known roles */
const roleRegistry = new Map<string, AgentRoleConfig>([
  ['default', DEFAULT_ROLE],
  ['explorer', EXPLORER_ROLE],
  ['worker', WORKER_ROLE],
]);

// ============================================================================
// Public API
// ============================================================================

/**
 * Get a role config by name.
 */
export function getRole(name: string): AgentRoleConfig | undefined {
  return roleRegistry.get(name);
}

/**
 * Register a custom role.
 */
export function registerRole(config: AgentRoleConfig): void {
  roleRegistry.set(config.name, config);
  logger.debug(`Agent role registered: ${config.name}`);
}

/**
 * List all available roles.
 */
export function listRoles(): AgentRoleConfig[] {
  return [...roleRegistry.values()];
}

/**
 * Check if a tool is allowed for a given role.
 */
export function isToolAllowedForRole(role: AgentRoleConfig, toolName: string): boolean {
  // Blocked tools always blocked
  if (role.blockedTools.length > 0 && role.blockedTools.includes(toolName)) {
    return false;
  }
  // If allowedTools is non-empty, whitelist only those
  if (role.allowedTools.length > 0) {
    return role.allowedTools.includes(toolName);
  }
  return true;
}

/**
 * Load custom roles from .codebuddy/roles/ directory.
 */
export function loadCustomRoles(cwd: string = process.cwd()): number {
  const rolesDir = path.join(cwd, '.codebuddy', 'roles');
  if (!fs.existsSync(rolesDir)) return 0;

  let loaded = 0;
  try {
    const files = fs.readdirSync(rolesDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(rolesDir, file), 'utf-8');
        const config = JSON.parse(content) as Partial<AgentRoleConfig>;
        if (config.name) {
          registerRole({
            ...DEFAULT_ROLE,
            ...config,
            name: config.name,
          } as AgentRoleConfig);
          loaded++;
        }
      } catch (err) {
        logger.debug(`Failed to load role ${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch { /* directory read failed */ }

  return loaded;
}

/**
 * Get the built-in role names.
 */
export function getBuiltinRoleNames(): string[] {
  return ['default', 'explorer', 'worker'];
}
