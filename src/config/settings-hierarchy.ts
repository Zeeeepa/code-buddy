/**
 * Settings Hierarchy
 *
 * Implements a multi-level settings system with clear priority ordering:
 * 1. ManagedPolicy (highest) - /etc/codebuddy/managed-settings.json
 * 2. CliFlags - command-line arguments
 * 3. ProjectLocal - .codebuddy/settings.local.json
 * 4. Project - .codebuddy/settings.json
 * 5. User - ~/.codebuddy/settings.json
 * 6. Default (lowest) - built-in defaults
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export enum SettingsLevel {
  ManagedPolicy = 0,
  CliFlags = 1,
  ProjectLocal = 2,
  Project = 3,
  User = 4,
  Default = 5,
}

export interface SettingsWithSource {
  value: unknown;
  source: SettingsLevel;
}

interface LevelData {
  level: SettingsLevel;
  settings: Record<string, unknown>;
}

// ============================================================================
// Constants
// ============================================================================

const LEVEL_NAMES: Record<SettingsLevel, string> = {
  [SettingsLevel.ManagedPolicy]: 'ManagedPolicy',
  [SettingsLevel.CliFlags]: 'CliFlags',
  [SettingsLevel.ProjectLocal]: 'ProjectLocal',
  [SettingsLevel.Project]: 'Project',
  [SettingsLevel.User]: 'User',
  [SettingsLevel.Default]: 'Default',
};

const DEFAULT_SETTINGS: Record<string, unknown> = {
  securityMode: 'suggest',
  maxToolRounds: 50,
  maxCost: 10,
  theme: 'dark',
  autoCompact: true,
};

// ============================================================================
// SettingsHierarchy
// ============================================================================

export class SettingsHierarchy {
  private levels: LevelData[] = [];
  private projectDir: string;

  constructor(projectDir: string = process.cwd()) {
    this.projectDir = projectDir;
  }

  /**
   * Load settings from all levels
   */
  loadAllLevels(cliFlags?: Record<string, unknown>, projectDir?: string): void {
    if (projectDir) {
      this.projectDir = projectDir;
    }

    this.levels = [];

    // Level 0: Managed Policy (highest priority)
    const managedSettings = this.loadJsonFile(this.getManagedPath());
    this.levels.push({ level: SettingsLevel.ManagedPolicy, settings: managedSettings });

    // Level 1: CLI Flags
    this.levels.push({ level: SettingsLevel.CliFlags, settings: cliFlags || {} });

    // Level 2: Project Local
    const projectLocalSettings = this.loadJsonFile(this.getProjectLocalPath());
    this.levels.push({ level: SettingsLevel.ProjectLocal, settings: projectLocalSettings });

    // Level 3: Project
    const projectSettings = this.loadJsonFile(this.getProjectPath());
    this.levels.push({ level: SettingsLevel.Project, settings: projectSettings });

    // Level 4: User
    const userSettings = this.loadJsonFile(this.getUserPath());
    this.levels.push({ level: SettingsLevel.User, settings: userSettings });

    // Level 5: Default (lowest priority)
    this.levels.push({ level: SettingsLevel.Default, settings: { ...DEFAULT_SETTINGS } });

    logger.debug('Settings hierarchy loaded', { source: 'SettingsHierarchy' });
  }

  /**
   * Get the effective value for a key (highest-priority level wins)
   */
  get(key: string): unknown {
    for (const levelData of this.levels) {
      if (key in levelData.settings) {
        return levelData.settings[key];
      }
    }
    return undefined;
  }

  /**
   * Get the value and its source level
   */
  getWithSource(key: string): SettingsWithSource | undefined {
    for (const levelData of this.levels) {
      if (key in levelData.settings) {
        return {
          value: levelData.settings[key],
          source: levelData.level,
        };
      }
    }
    return undefined;
  }

  /**
   * Check if a key at a given level is overridden by a higher-priority level
   */
  isOverridden(key: string, level: SettingsLevel): boolean {
    for (const levelData of this.levels) {
      if (levelData.level === level) {
        // Reached the target level without finding an override
        return false;
      }
      if (key in levelData.settings) {
        // A higher-priority level has this key
        return true;
      }
    }
    return false;
  }

  /**
   * Get all settings merged (highest priority wins)
   */
  getAllSettings(): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    // Merge in reverse order (lowest priority first)
    for (let i = this.levels.length - 1; i >= 0; i--) {
      Object.assign(merged, this.levels[i].settings);
    }

    return merged;
  }

  /**
   * Get the level name for display
   */
  getLevelName(level: SettingsLevel): string {
    return LEVEL_NAMES[level] || 'Unknown';
  }

  // ============================================================================
  // Path helpers
  // ============================================================================

  private getManagedPath(): string {
    return '/etc/codebuddy/managed-settings.json';
  }

  private getUserPath(): string {
    return path.join(os.homedir(), '.codebuddy', 'settings.json');
  }

  private getProjectPath(): string {
    return path.join(this.projectDir, '.codebuddy', 'settings.json');
  }

  private getProjectLocalPath(): string {
    return path.join(this.projectDir, '.codebuddy', 'settings.local.json');
  }

  // ============================================================================
  // File loading
  // ============================================================================

  private loadJsonFile(filePath: string): Record<string, unknown> {
    try {
      if (!fs.existsSync(filePath)) {
        return {};
      }
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch (error) {
      logger.debug(`Failed to load settings from ${filePath}: ${error}`, { source: 'SettingsHierarchy' });
      return {};
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: SettingsHierarchy | null = null;

export function getSettingsHierarchy(projectDir?: string): SettingsHierarchy {
  if (!instance || projectDir) {
    instance = new SettingsHierarchy(projectDir);
  }
  return instance;
}

export function resetSettingsHierarchy(): void {
  instance = null;
}
