/**
 * User Settings Extensions
 *
 * Extends the settings system with customizable spinner verbs, accessibility,
 * tool deny-lists, plan directories, temperature overrides, and themes.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type ThemeOption = 'default' | 'minimal' | 'colorful';

export interface UserSettings {
  spinnerVerbs?: string[];
  reduceMotion?: boolean;
  disallowedTools?: string[];
  plansDirectory?: string;
  showTurnDuration?: boolean;
  temperatureOverride?: number;
  theme?: ThemeOption;
}

const DEFAULT_SPINNER_VERBS = [
  'Thinking',
  'Analyzing',
  'Processing',
  'Generating',
  'Computing',
];

const DEFAULT_PLANS_DIRECTORY = '.codebuddy/plans';

// ============================================================================
// UserSettingsManager
// ============================================================================

export class UserSettingsManager {
  private static instance: UserSettingsManager | null = null;
  private settings: UserSettings;

  constructor(initial?: Partial<UserSettings>) {
    this.settings = { ...initial };
    logger.debug('UserSettingsManager initialized');
  }

  static getInstance(initial?: Partial<UserSettings>): UserSettingsManager {
    if (!UserSettingsManager.instance) {
      UserSettingsManager.instance = new UserSettingsManager(initial);
    }
    return UserSettingsManager.instance;
  }

  static resetInstance(): void {
    UserSettingsManager.instance = null;
  }

  get<K extends keyof UserSettings>(key: K): UserSettings[K] {
    return this.settings[key];
  }

  set<K extends keyof UserSettings>(key: K, value: UserSettings[K]): void {
    this.settings[key] = value;
    logger.debug(`Setting updated: ${key}`);
  }

  isToolDisallowed(toolName: string): boolean {
    const list = this.settings.disallowedTools;
    if (!list || list.length === 0) return false;
    return list.includes(toolName);
  }

  getSpinnerVerbs(): string[] {
    return this.settings.spinnerVerbs && this.settings.spinnerVerbs.length > 0
      ? this.settings.spinnerVerbs
      : DEFAULT_SPINNER_VERBS;
  }

  getTemperature(): number | undefined {
    return this.settings.temperatureOverride;
  }

  shouldReduceMotion(): boolean {
    return this.settings.reduceMotion === true;
  }

  shouldShowTurnDuration(): boolean {
    return this.settings.showTurnDuration !== false;
  }

  getPlansDirectory(): string {
    return this.settings.plansDirectory || DEFAULT_PLANS_DIRECTORY;
  }
}
