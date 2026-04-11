/**
 * RulesBridge — Claude Cowork parity Phase 2
 *
 * Wraps Code Buddy's declarative permission rules (`src/security/declarative-rules.ts`)
 * for visual rule management. The rules live in `.codebuddy/settings.json`
 * under `permissions.allow` / `permissions.deny` in the active project
 * workspace.
 *
 * The bridge also provides a dry-run "test" method so users can verify
 * their rules match the tool calls they expect.
 *
 * @module main/security/rules-bridge
 */

import * as fs from 'fs';
import * as path from 'path';
import { log, logWarn } from '../utils/logger';
import { loadCoreModule } from '../utils/core-loader';

export type PermissionDecision = 'allow' | 'ask' | 'deny';

export interface DeclarativePermissions {
  allow: string[];
  deny: string[];
}

export interface RuleTestResult {
  decision: PermissionDecision;
  matchedRule?: string;
}

function parseRule(rule: string): { toolName: string; argPattern: string | null } {
  const match = rule.match(/^(\w+)\((.+)\)$/);
  if (match) {
    return { toolName: match[1], argPattern: match[2] };
  }
  return { toolName: rule.trim(), argPattern: null };
}

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§DOUBLESTAR§')
    .replace(/\*/g, '[^]*')
    .replace(/§DOUBLESTAR§/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function isPathLikeTool(toolName: string): boolean {
  return [
    'edit',
    'str_replace_editor',
    'str_replace',
    'write',
    'create_file',
    'file_write',
    'read',
    'view_file',
    'file_read',
    'glob',
    'grep',
    'search',
  ].includes(toolName.toLowerCase());
}

function normalizePathLikeValue(value: string): string {
  return value.replace(/\\/g, '/');
}

function extractPrimaryArg(toolName: string, toolArgs: Record<string, unknown>): string | null {
  const name = toolName.toLowerCase();

  if (name === 'bash' || name === 'shell_exec') {
    return (toolArgs.command as string) || (toolArgs.cmd as string) || null;
  }

  if (['edit', 'str_replace_editor', 'str_replace'].includes(name)) {
    return (toolArgs.file_path as string) || (toolArgs.path as string) || null;
  }

  if (['write', 'create_file', 'file_write'].includes(name)) {
    return (toolArgs.file_path as string) || (toolArgs.path as string) || null;
  }

  if (['read', 'view_file', 'file_read'].includes(name)) {
    return (toolArgs.file_path as string) || (toolArgs.path as string) || null;
  }

  if (name === 'glob') {
    return (toolArgs.pattern as string) || (toolArgs.path as string) || null;
  }

  if (name === 'grep' || name === 'search') {
    return (toolArgs.path as string) || (toolArgs.pattern as string) || null;
  }

  if (name.includes('chrome') || name.includes('gui') || name.includes('computer')) {
    return (
      (toolArgs.url as string) ||
      (toolArgs.target as string) ||
      (toolArgs.app as string) ||
      (toolArgs.text as string) ||
      null
    );
  }

  return (
    (toolArgs.url as string) ||
    (toolArgs.target as string) ||
    (toolArgs.app as string) ||
    (toolArgs.file_path as string) ||
    (toolArgs.path as string) ||
    (toolArgs.command as string) ||
    (toolArgs.input as string) ||
    null
  );
}

function splitBashCommands(command: string): string[] {
  return command
    .split(/\s*(?:&&|\|\||;)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchesRule(rule: string, toolName: string, primaryArg: string | null): boolean {
  const parsed = parseRule(rule);
  const normalizedTool = toolName.toLowerCase();
  const normalizedRule = parsed.toolName.toLowerCase();

  if (normalizedRule !== normalizedTool) {
    const aliases: Record<string, string[]> = {
      bash: ['shell_exec', 'bash'],
      edit: ['str_replace_editor', 'str_replace', 'edit'],
      write: ['create_file', 'file_write', 'write'],
      read: ['view_file', 'file_read', 'read'],
    };

    let aliasMatch = false;
    for (const [canonical, aliasList] of Object.entries(aliases)) {
      if (
        (aliasList.includes(normalizedRule) || normalizedRule === canonical) &&
        (aliasList.includes(normalizedTool) || normalizedTool === canonical)
      ) {
        aliasMatch = true;
        break;
      }
    }

    if (!aliasMatch) {
      return false;
    }
  }

  if (parsed.argPattern === null) {
    return true;
  }

  if (primaryArg === null) {
    return false;
  }

  const candidate = isPathLikeTool(toolName) ? normalizePathLikeValue(primaryArg) : primaryArg;
  const pattern = isPathLikeTool(toolName)
    ? normalizePathLikeValue(parsed.argPattern)
    : parsed.argPattern;

  return patternToRegex(pattern).test(candidate);
}

export function explainPermissionWithLocalRules(
  toolName: string,
  toolArgs: Record<string, unknown>,
  permissions: DeclarativePermissions
): RuleTestResult {
  const primaryArg = extractPrimaryArg(toolName, toolArgs);
  const normalizedTool = toolName.toLowerCase();

  if ((normalizedTool === 'bash' || normalizedTool === 'shell_exec') && primaryArg) {
    const subCommands = splitBashCommands(primaryArg);
    if (subCommands.length > 1) {
      for (const subCommand of subCommands) {
        const subResult = explainPermissionWithLocalRules(
          toolName,
          { ...toolArgs, command: subCommand, cmd: subCommand },
          permissions
        );
        if (subResult.decision === 'deny') {
          return subResult;
        }
      }

      let matchedRule: string | undefined;
      for (const subCommand of subCommands) {
        const subResult = explainPermissionWithLocalRules(
          toolName,
          { ...toolArgs, command: subCommand, cmd: subCommand },
          permissions
        );
        if (subResult.decision !== 'allow') {
          return { decision: 'ask' };
        }
        matchedRule = matchedRule || subResult.matchedRule;
      }

      return { decision: 'allow', matchedRule };
    }
  }

  for (const rule of permissions.deny ?? []) {
    if (matchesRule(rule, toolName, primaryArg)) {
      return { decision: 'deny', matchedRule: rule };
    }
  }

  for (const rule of permissions.allow ?? []) {
    if (matchesRule(rule, toolName, primaryArg)) {
      return { decision: 'allow', matchedRule: rule };
    }
  }

  return { decision: 'ask' };
}

type CoreDeclarativeRulesModule = {
  loadPermissions: (projectRoot?: string) => {
    allow?: string[];
    deny?: string[];
  };
  checkDeclarativePermission: (
    toolName: string,
    toolArgs: Record<string, unknown>,
    projectRoot?: string
  ) => PermissionDecision;
  explainDeclarativePermission?: (
    toolName: string,
    toolArgs: Record<string, unknown>,
    projectRoot?: string
  ) => RuleTestResult;
  clearPermissionsCache: () => void;
};

let cachedModule: CoreDeclarativeRulesModule | null = null;

async function loadRulesModule(): Promise<CoreDeclarativeRulesModule | null> {
  if (cachedModule) return cachedModule;
  const mod = await loadCoreModule<CoreDeclarativeRulesModule>(
    'security/declarative-rules.js'
  );
  if (mod) {
    cachedModule = mod;
    log('[RulesBridge] Core declarative rules loaded');
  } else {
    logWarn('[RulesBridge] Core declarative rules unavailable');
  }
  return mod;
}

/** Read the raw `.codebuddy/settings.json` file to preserve non-permission keys. */
function readSettingsFile(projectRoot: string): Record<string, unknown> {
  const settingsPath = path.join(projectRoot, '.codebuddy', 'settings.json');
  if (!fs.existsSync(settingsPath)) return {};
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logWarn('[RulesBridge] Failed to parse settings.json:', err);
    return {};
  }
}

/** Write the updated settings back to disk, creating the directory if needed. */
function writeSettingsFile(projectRoot: string, settings: Record<string, unknown>): void {
  const settingsDir = path.join(projectRoot, '.codebuddy');
  const settingsPath = path.join(settingsDir, 'settings.json');
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

export class RulesBridge {
  /** Read current allow/deny lists for the project. */
  async list(projectRoot: string): Promise<DeclarativePermissions> {
    const mod = await loadRulesModule();
    if (!mod) {
      // Fall back to reading the file directly
      const settings = readSettingsFile(projectRoot);
      const permissions = (settings.permissions ?? {}) as DeclarativePermissions;
      return {
        allow: Array.isArray(permissions.allow) ? permissions.allow : [],
        deny: Array.isArray(permissions.deny) ? permissions.deny : [],
      };
    }
    try {
      const permissions = mod.loadPermissions(projectRoot);
      return {
        allow: permissions.allow ?? [],
        deny: permissions.deny ?? [],
      };
    } catch (err) {
      logWarn('[RulesBridge] list failed:', err);
      return { allow: [], deny: [] };
    }
  }

  /** Add a rule to the allow or deny list and persist. */
  async add(
    projectRoot: string,
    bucket: 'allow' | 'deny',
    rule: string
  ): Promise<{ success: boolean; error?: string }> {
    const trimmed = rule.trim();
    if (!trimmed) {
      return { success: false, error: 'Rule cannot be empty' };
    }
    if (!this.validateRuleSyntax(trimmed)) {
      return {
        success: false,
        error: `Invalid rule syntax: ${trimmed}. Expected Tool or Tool(pattern).`,
      };
    }
    try {
      const settings = readSettingsFile(projectRoot);
      const permissions = (settings.permissions ?? {}) as DeclarativePermissions;
      if (!Array.isArray(permissions.allow)) permissions.allow = [];
      if (!Array.isArray(permissions.deny)) permissions.deny = [];

      const list = permissions[bucket];
      if (list.includes(trimmed)) {
        return { success: true }; // already present
      }
      list.push(trimmed);
      settings.permissions = permissions;
      writeSettingsFile(projectRoot, settings);

      // Invalidate the core module cache so the next check sees the update
      const mod = await loadRulesModule();
      mod?.clearPermissionsCache();

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Remove a rule from the given bucket and persist. */
  async remove(
    projectRoot: string,
    bucket: 'allow' | 'deny',
    rule: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const settings = readSettingsFile(projectRoot);
      const permissions = (settings.permissions ?? {}) as DeclarativePermissions;
      if (!Array.isArray(permissions.allow)) permissions.allow = [];
      if (!Array.isArray(permissions.deny)) permissions.deny = [];

      const list = permissions[bucket];
      const idx = list.indexOf(rule);
      if (idx === -1) {
        return { success: true }; // nothing to remove
      }
      list.splice(idx, 1);
      settings.permissions = permissions;
      writeSettingsFile(projectRoot, settings);

      const mod = await loadRulesModule();
      mod?.clearPermissionsCache();

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /** Reorder/replace one rule in place. */
  async update(
    projectRoot: string,
    bucket: 'allow' | 'deny',
    oldRule: string,
    newRule: string
  ): Promise<{ success: boolean; error?: string }> {
    const trimmed = newRule.trim();
    if (!trimmed || !this.validateRuleSyntax(trimmed)) {
      return { success: false, error: 'Invalid rule syntax' };
    }
    try {
      const settings = readSettingsFile(projectRoot);
      const permissions = (settings.permissions ?? {}) as DeclarativePermissions;
      const list = Array.isArray(permissions[bucket]) ? permissions[bucket] : [];
      const idx = list.indexOf(oldRule);
      if (idx === -1) {
        return { success: false, error: 'Rule not found' };
      }
      list[idx] = trimmed;
      permissions[bucket] = list;
      settings.permissions = permissions;
      writeSettingsFile(projectRoot, settings);

      const mod = await loadRulesModule();
      mod?.clearPermissionsCache();

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Dry-run a tool call against the current rules and return the decision.
   * The call is not actually executed.
   */
  async test(
    projectRoot: string,
    toolName: string,
    toolArgs: Record<string, unknown>
  ): Promise<RuleTestResult> {
    const mod = await loadRulesModule();
    if (!mod) {
      const permissions = await this.list(projectRoot);
      return explainPermissionWithLocalRules(toolName, toolArgs, permissions);
    }
    try {
      if (typeof mod.explainDeclarativePermission === 'function') {
        return mod.explainDeclarativePermission(toolName, toolArgs, projectRoot);
      }
      const decision = mod.checkDeclarativePermission(toolName, toolArgs, projectRoot);
      return { decision };
    } catch (err) {
      logWarn('[RulesBridge] test failed:', err);
      const permissions = await this.list(projectRoot);
      return explainPermissionWithLocalRules(toolName, toolArgs, permissions);
    }
  }

  /** Very lightweight syntax validation: Tool or Tool(pattern) */
  private validateRuleSyntax(rule: string): boolean {
    return /^\w+(\(.+\))?$/.test(rule);
  }
}
