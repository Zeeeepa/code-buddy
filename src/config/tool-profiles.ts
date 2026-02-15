/**
 * Tool Profiles & Groups
 *
 * Manages tool access profiles for different agent modes.
 * Groups bundle related tools together; profiles combine
 * individual tools and groups into access configurations.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ToolProfile {
  name: string;
  description: string;
  tools: string[];
  groups: string[];
}

export interface ToolGroup {
  name: string;
  tools: string[];
}

// ============================================================================
// Built-in Groups
// ============================================================================

const BUILTIN_GROUPS: ToolGroup[] = [
  { name: 'group:fs', tools: ['read_file', 'write_file', 'edit_file', 'glob', 'grep'] },
  { name: 'group:runtime', tools: ['bash', 'js_repl'] },
  { name: 'group:web', tools: ['web_search', 'web_fetch', 'browser'] },
  { name: 'group:ui', tools: ['canvas_push', 'canvas_reset'] },
  { name: 'group:messaging', tools: ['send_message', 'broadcast'] },
  { name: 'group:git', tools: ['git_status', 'git_diff', 'git_log', 'git_commit', 'git_push', 'git_pull'] },
];

// ============================================================================
// Built-in Profiles
// ============================================================================

const BUILTIN_PROFILES: ToolProfile[] = [
  {
    name: 'minimal',
    description: 'Minimal toolset for basic operations',
    tools: ['read_file', 'edit_file', 'bash'],
    groups: [],
  },
  {
    name: 'coding',
    description: 'Tools for software development',
    tools: [],
    groups: ['group:fs', 'group:runtime', 'group:git'],
  },
  {
    name: 'messaging',
    description: 'Tools for communication and web access',
    tools: [],
    groups: ['group:messaging', 'group:web'],
  },
  {
    name: 'full',
    description: 'All available tools',
    tools: [],
    groups: BUILTIN_GROUPS.map(g => g.name),
  },
];

// ============================================================================
// ToolProfileManager
// ============================================================================

export class ToolProfileManager {
  private static instance: ToolProfileManager | null = null;

  private customProfiles: Map<string, ToolProfile> = new Map();
  private customGroups: Map<string, ToolGroup> = new Map();
  private activeProfileName: string | null = null;

  private constructor() {}

  static getInstance(): ToolProfileManager {
    if (!ToolProfileManager.instance) {
      ToolProfileManager.instance = new ToolProfileManager();
    }
    return ToolProfileManager.instance;
  }

  static resetInstance(): void {
    ToolProfileManager.instance = null;
  }

  getProfile(name: string): ToolProfile | undefined {
    // Check built-in first
    const builtin = BUILTIN_PROFILES.find(p => p.name === name);
    if (builtin) return { ...builtin };

    const custom = this.customProfiles.get(name);
    return custom ? { ...custom } : undefined;
  }

  setActiveProfile(name: string): void {
    const profile = this.getProfile(name);
    if (!profile) {
      throw new Error(`Profile '${name}' not found`);
    }
    this.activeProfileName = name;
    logger.debug('Active profile set', { name });
  }

  getActiveProfile(): ToolProfile | null {
    if (!this.activeProfileName) return null;
    return this.getProfile(this.activeProfileName) || null;
  }

  getToolsForProfile(name: string): string[] {
    const profile = this.getProfile(name);
    if (!profile) {
      throw new Error(`Profile '${name}' not found`);
    }

    const tools = new Set<string>(profile.tools);

    for (const groupName of profile.groups) {
      const group = this.getGroup(groupName);
      if (group) {
        for (const tool of group.tools) {
          tools.add(tool);
        }
      }
    }

    return Array.from(tools);
  }

  addCustomProfile(profile: ToolProfile): void {
    this.customProfiles.set(profile.name, { ...profile });
    logger.debug('Custom profile added', { name: profile.name });
  }

  removeCustomProfile(name: string): void {
    if (!this.customProfiles.has(name)) {
      throw new Error(`Custom profile '${name}' not found`);
    }
    this.customProfiles.delete(name);
    if (this.activeProfileName === name) {
      this.activeProfileName = null;
    }
    logger.debug('Custom profile removed', { name });
  }

  listProfiles(): ToolProfile[] {
    const all: ToolProfile[] = BUILTIN_PROFILES.map(p => ({ ...p }));
    for (const p of this.customProfiles.values()) {
      all.push({ ...p });
    }
    return all;
  }

  getGroup(name: string): ToolGroup | undefined {
    const builtin = BUILTIN_GROUPS.find(g => g.name === name);
    if (builtin) return { ...builtin };

    const custom = this.customGroups.get(name);
    return custom ? { ...custom } : undefined;
  }

  listGroups(): ToolGroup[] {
    const all: ToolGroup[] = BUILTIN_GROUPS.map(g => ({ ...g }));
    for (const g of this.customGroups.values()) {
      all.push({ ...g });
    }
    return all;
  }

  addCustomGroup(group: ToolGroup): void {
    this.customGroups.set(group.name, { ...group });
    logger.debug('Custom group added', { name: group.name });
  }

  isToolInActiveProfile(toolName: string): boolean {
    if (!this.activeProfileName) return true; // No profile = all allowed
    const tools = this.getToolsForProfile(this.activeProfileName);
    return tools.includes(toolName);
  }
}
