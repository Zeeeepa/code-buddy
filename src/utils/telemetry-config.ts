/**
 * Telemetry Opt-In/Out Toggle
 *
 * Controls whether telemetry data (Sentry, OpenTelemetry) is collected.
 * Settings are persisted in .codebuddy/settings.json.
 *
 * When telemetry is disabled:
 * - Sentry DSN is not initialized
 * - OTEL exporter is not started
 * - No error reports or traces are sent
 */

import fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logger.js';

export interface TelemetryConfig {
  enabled: boolean;
  level: 'full' | 'errors-only' | 'none';
}

const DEFAULT_TELEMETRY_CONFIG: TelemetryConfig = {
  enabled: true,
  level: 'full',
};

/** In-memory cache of the telemetry config */
let cachedConfig: TelemetryConfig | null = null;

/**
 * Get the path to the settings.json file.
 */
function getSettingsPath(): string {
  return path.join(process.cwd(), '.codebuddy', 'settings.json');
}

/**
 * Read the telemetry config from .codebuddy/settings.json.
 */
export function getTelemetryConfig(): TelemetryConfig {
  if (cachedConfig) return { ...cachedConfig };

  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const data = fs.readJsonSync(settingsPath);
      if (data.telemetry && typeof data.telemetry === 'object') {
        cachedConfig = {
          enabled: typeof data.telemetry.enabled === 'boolean' ? data.telemetry.enabled : DEFAULT_TELEMETRY_CONFIG.enabled,
          level: ['full', 'errors-only', 'none'].includes(data.telemetry.level) ? data.telemetry.level : DEFAULT_TELEMETRY_CONFIG.level,
        };
        return { ...cachedConfig };
      }
    }
  } catch {
    // Settings file doesn't exist or is invalid
  }

  cachedConfig = { ...DEFAULT_TELEMETRY_CONFIG };
  return { ...cachedConfig };
}

/**
 * Set whether telemetry is enabled.
 */
export function setTelemetryEnabled(enabled: boolean): void {
  const config = getTelemetryConfig();
  config.enabled = enabled;
  if (!enabled) {
    config.level = 'none';
  } else if (config.level === 'none') {
    config.level = 'full';
  }
  saveTelemetryConfig(config);
}

/**
 * Set the telemetry level.
 */
export function setTelemetryLevel(level: 'full' | 'errors-only' | 'none'): void {
  const config = getTelemetryConfig();
  config.level = level;
  config.enabled = level !== 'none';
  saveTelemetryConfig(config);
}

/**
 * Check if telemetry is currently enabled.
 */
export function isTelemetryEnabled(): boolean {
  const config = getTelemetryConfig();
  return config.enabled && config.level !== 'none';
}

/**
 * Save telemetry config to .codebuddy/settings.json.
 */
function saveTelemetryConfig(config: TelemetryConfig): void {
  try {
    const settingsPath = getSettingsPath();
    let data: Record<string, unknown> = {};

    if (fs.existsSync(settingsPath)) {
      data = fs.readJsonSync(settingsPath);
    }

    data.telemetry = {
      enabled: config.enabled,
      level: config.level,
    };

    fs.ensureDirSync(path.dirname(settingsPath));
    fs.writeJsonSync(settingsPath, data, { spaces: 2 });

    // Update cache
    cachedConfig = { ...config };

    logger.debug('Telemetry config saved', { config });
  } catch (err) {
    logger.error('Failed to save telemetry config', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Reset the cached config (useful for testing).
 */
export function resetTelemetryCache(): void {
  cachedConfig = null;
}
