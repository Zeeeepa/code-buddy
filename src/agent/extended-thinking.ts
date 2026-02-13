/**
 * Extended Thinking Mode
 *
 * Manages extended thinking configuration for LLM requests.
 * When enabled, the API request includes a thinking budget that allows
 * the model to reason through complex problems before responding.
 *
 * @module agent/extended-thinking
 */

import { logger } from '../utils/logger.js';

/**
 * Configuration returned by getThinkingConfig() when thinking is enabled
 */
export interface ThinkingConfig {
  thinking?: {
    type: 'enabled';
    budget_tokens: number;
  };
}

/**
 * Default maximum thinking tokens
 */
const DEFAULT_MAX_THINKING_TOKENS = 31999;

/**
 * Manages extended thinking mode for LLM API requests.
 *
 * When enabled, getThinkingConfig() returns a config object that should
 * be merged into the API request parameters.
 */
export class ExtendedThinkingManager {
  private enabled: boolean;
  private maxThinkingTokens: number;
  private alwaysEnabled: boolean;

  constructor() {
    const envTokens = process.env.MAX_THINKING_TOKENS;
    this.maxThinkingTokens = envTokens
      ? parseInt(envTokens, 10) || DEFAULT_MAX_THINKING_TOKENS
      : DEFAULT_MAX_THINKING_TOKENS;
    this.alwaysEnabled = false;
    this.enabled = false;
  }

  /**
   * Toggle extended thinking on/off
   * @returns The new enabled state
   */
  toggle(): boolean {
    this.enabled = !this.enabled;
    logger.info(`Extended thinking ${this.enabled ? 'enabled' : 'disabled'} (budget: ${this.maxThinkingTokens} tokens)`);
    return this.enabled;
  }

  /**
   * Check if extended thinking is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled || this.alwaysEnabled;
  }

  /**
   * Get the current token budget
   */
  getTokenBudget(): number {
    return this.maxThinkingTokens;
  }

  /**
   * Set the token budget for extended thinking
   */
  setTokenBudget(n: number): void {
    if (n > 0) {
      this.maxThinkingTokens = n;
      logger.info(`Extended thinking budget set to ${n} tokens`);
    }
  }

  /**
   * Set whether extended thinking is always enabled
   */
  setAlwaysEnabled(value: boolean): void {
    this.alwaysEnabled = value;
    logger.info(`Extended thinking always-enabled: ${value}`);
  }

  /**
   * Get the thinking configuration to merge into API request parameters.
   * Returns an object with a `thinking` key when enabled, or an empty object when disabled.
   */
  getThinkingConfig(): ThinkingConfig {
    if (this.isEnabled()) {
      return {
        thinking: {
          type: 'enabled',
          budget_tokens: this.maxThinkingTokens,
        },
      };
    }
    return {};
  }
}

// Singleton instance
let instance: ExtendedThinkingManager | null = null;

/**
 * Get the singleton ExtendedThinkingManager instance
 */
export function getExtendedThinking(): ExtendedThinkingManager {
  if (!instance) {
    instance = new ExtendedThinkingManager();
  }
  return instance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetExtendedThinking(): void {
  instance = null;
}
