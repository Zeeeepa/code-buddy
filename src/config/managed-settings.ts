/**
 * Managed Enterprise Settings
 *
 * Reads managed policies from platform-specific system paths.
 * These settings are deployed by IT administrators and take
 * highest priority in the configuration hierarchy:
 *   managed > user > project > defaults
 *
 * Settings locations:
 *   Windows:  %PROGRAMDATA%\CodeBuddy\managed-settings.json
 *   macOS:    /Library/Application Support/CodeBuddy/managed-settings.json
 *   Linux:    /etc/codebuddy/managed-settings.json
 *
 * Advanced enterprise architecture for managed enterprise settings.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface ManagedSettings {
  /** Restrict available models to this list */
  availableModels?: string[];
  /** Prevent users from bypassing permission checks */
  disableBypassPermissions?: boolean;
  /** Only allow permission rules from managed settings */
  allowManagedPermissionRulesOnly?: boolean;
  /** Only allow hooks defined in managed settings */
  allowManagedHooksOnly?: boolean;
  /** Default model to use */
  defaultModel?: string;
  /** Maximum session cost limit (USD) */
  maxCostLimit?: number;
  /** Disable YOLO mode entirely */
  disableYoloMode?: boolean;
  /** Declarative permission rules (same format as .codebuddy/settings.json) */
  permissions?: {
    allow?: string[];
    deny?: string[];
  };
  /** Required hooks that cannot be disabled */
  requiredHooks?: Array<{
    event: string;
    handler: { type: string; command?: string; url?: string };
  }>;
  /** Disable specific tools */
  disabledTools?: string[];
  /** Custom branding/identity */
  organizationName?: string;
}

// ============================================================================
// Platform Path Resolution
// ============================================================================

/**
 * Get the managed settings file path for the current platform.
 */
export function getManagedSettingsPath(): string {
  switch (process.platform) {
    case 'win32': {
      const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
      return path.join(programData, 'CodeBuddy', 'managed-settings.json');
    }
    case 'darwin':
      return '/Library/Application Support/CodeBuddy/managed-settings.json';
    default:
      // Linux and other Unix-like
      return '/etc/codebuddy/managed-settings.json';
  }
}

// ============================================================================
// Settings Loader
// ============================================================================

/** Cached managed settings */
let _managedCache: ManagedSettings | null = null;
let _managedCacheLoaded = false;

/**
 * Clear the managed settings cache (for testing).
 */
export function clearManagedSettingsCache(): void {
  _managedCache = null;
  _managedCacheLoaded = false;
}

/**
 * Load managed settings from the system path.
 * Returns null if no managed settings file exists.
 */
export function loadManagedSettings(): ManagedSettings | null {
  if (_managedCacheLoaded) return _managedCache;

  _managedCacheLoaded = true;
  const settingsPath = getManagedSettingsPath();

  if (!fs.existsSync(settingsPath)) {
    logger.debug('No managed settings found', { path: settingsPath });
    _managedCache = null;
    return null;
  }

  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const settings = JSON.parse(raw) as ManagedSettings;

    // Validate basic structure
    if (typeof settings !== 'object' || settings === null) {
      logger.warn('Invalid managed settings format', { path: settingsPath });
      _managedCache = null;
      return null;
    }

    logger.info('Loaded managed enterprise settings', {
      path: settingsPath,
      hasModels: !!settings.availableModels,
      hasPermissions: !!settings.permissions,
      disableYolo: !!settings.disableYoloMode,
    });

    _managedCache = settings;
    return settings;
  } catch (err) {
    logger.warn(`Failed to load managed settings: ${err}`, { path: settingsPath });
    _managedCache = null;
    return null;
  }
}

/**
 * Check if managed settings are active.
 */
export function hasManagedSettings(): boolean {
  return loadManagedSettings() !== null;
}

// ============================================================================
// Enforcement Helpers
// ============================================================================

/**
 * Check if a model is allowed by managed settings.
 * If no managed settings or no model restrictions, all models are allowed.
 */
export function isModelAllowed(modelId: string): boolean {
  const managed = loadManagedSettings();
  if (!managed?.availableModels) return true;
  return managed.availableModels.some(m =>
    m === modelId || (m.includes('*') && new RegExp('^' + m.replace(/\*/g, '.*') + '$').test(modelId))
  );
}

/**
 * Get the list of allowed models, or null if unrestricted.
 */
export function getAllowedModels(): string[] | null {
  const managed = loadManagedSettings();
  return managed?.availableModels ?? null;
}

/**
 * Check if permission bypass is disabled.
 */
export function isPermissionBypassDisabled(): boolean {
  const managed = loadManagedSettings();
  return managed?.disableBypassPermissions === true;
}

/**
 * Check if YOLO mode is disabled by enterprise policy.
 */
export function isYoloModeDisabled(): boolean {
  const managed = loadManagedSettings();
  return managed?.disableYoloMode === true;
}

/**
 * Get the maximum cost limit from managed settings.
 * Returns null if not set (use default).
 */
export function getManagedCostLimit(): number | null {
  const managed = loadManagedSettings();
  return managed?.maxCostLimit ?? null;
}

/**
 * Get the default model from managed settings.
 */
export function getManagedDefaultModel(): string | null {
  const managed = loadManagedSettings();
  return managed?.defaultModel ?? null;
}

/**
 * Check if a tool is disabled by managed settings.
 */
export function isToolDisabled(toolName: string): boolean {
  const managed = loadManagedSettings();
  if (!managed?.disabledTools) return false;
  return managed.disabledTools.some(t => t.toLowerCase() === toolName.toLowerCase());
}

/**
 * Get managed permission rules (merged with project-level rules,
 * managed rules taking precedence).
 */
export function getManagedPermissions(): { allow?: string[]; deny?: string[] } | null {
  const managed = loadManagedSettings();
  return managed?.permissions ?? null;
}

/**
 * Apply managed settings to a configuration object.
 * Enforces managed overrides on top of user/project config.
 */
export function applyManagedOverrides<T extends Record<string, unknown>>(config: T): T {
  const managed = loadManagedSettings();
  if (!managed) return config;

  const result = { ...config };

  // Override default model
  if (managed.defaultModel && !result['_modelOverriddenByUser']) {
    (result as Record<string, unknown>)['model'] = managed.defaultModel;
  }

  // Override cost limit
  if (managed.maxCostLimit !== undefined) {
    const currentCost = (result['maxCost'] as number) ?? Infinity;
    (result as Record<string, unknown>)['maxCost'] = Math.min(currentCost, managed.maxCostLimit);
  }

  return result;
}
