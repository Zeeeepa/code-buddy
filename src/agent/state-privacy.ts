/**
 * Private State Manager
 *
 * Manages which state attributes should be filtered out when
 * exposing state to the LLM or to output (error messages, logs).
 *
 * Pre-configured with internal agent orchestration keys that should
 * never leak into LLM context or user-visible error messages.
 *
 * DeepAgents Sprint 3 — Private State Attributes.
 */

import { logger } from '../utils/logger.js';

// ── Pre-configured private keys ────────────────────────────────────

/**
 * Default private keys — internal agent orchestration state that
 * should not be exposed to the LLM or shown in error messages.
 */
const DEFAULT_PRIVATE_KEYS = new Set<string>([
  'nicknameIdx',
  'nicknameGeneration',
  'nextId',
  'waitCallbacks',
  'messageQueues',
  'internalSessionToken',
  'apiKeyHash',
  'passwordHash',
  'authToken',
]);

// ── Manager ────────────────────────────────────────────────────────

export class PrivateStateManager {
  private privateKeys: Set<string>;

  constructor(additionalKeys?: string[]) {
    this.privateKeys = new Set(DEFAULT_PRIVATE_KEYS);
    if (additionalKeys) {
      for (const key of additionalKeys) {
        this.privateKeys.add(key);
      }
    }
  }

  /**
   * Mark a key as private — it will be filtered from LLM and output.
   */
  markPrivate(key: string): void {
    this.privateKeys.add(key);
    logger.debug('PrivateStateManager: marked key as private', { key });
  }

  /**
   * Unmark a key as private.
   */
  unmarkPrivate(key: string): void {
    this.privateKeys.delete(key);
  }

  /**
   * Check if a key is private.
   */
  isPrivate(key: string): boolean {
    return this.privateKeys.has(key);
  }

  /**
   * Filter an object for user-visible output (error messages, logs).
   * Removes all private keys.
   */
  filterForOutput(obj: Record<string, unknown>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!this.privateKeys.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  /**
   * Filter an object for LLM context injection.
   * Removes all private keys — same behavior as filterForOutput
   * but separated for future divergence (e.g., redaction vs omission).
   */
  filterForLLM(obj: Record<string, unknown>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!this.privateKeys.has(key)) {
        filtered[key] = value;
      }
    }
    return filtered;
  }

  /**
   * Filter a Map for output, returning a new Map without private keys.
   */
  filterMapForOutput<V>(map: Map<string, V>): Map<string, V> {
    const filtered = new Map<string, V>();
    for (const [key, value] of map) {
      if (!this.privateKeys.has(key)) {
        filtered.set(key, value);
      }
    }
    return filtered;
  }

  /**
   * Get the list of all private keys (for debugging).
   */
  getPrivateKeys(): string[] {
    return Array.from(this.privateKeys);
  }

  /**
   * Get count of private keys.
   */
  getPrivateKeyCount(): number {
    return this.privateKeys.size;
  }
}

// ── Singleton ────────────────────────────────────────────────────────

let _instance: PrivateStateManager | null = null;

/**
 * Get or create the singleton PrivateStateManager.
 */
export function getPrivateStateManager(): PrivateStateManager {
  if (!_instance) {
    _instance = new PrivateStateManager();
  }
  return _instance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetPrivateStateManager(): void {
  _instance = null;
}
