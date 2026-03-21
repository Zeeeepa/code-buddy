/**
 * Circuit Breaker for API Providers
 *
 * Standard circuit breaker with 3 states:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, reject calls immediately
 * - HALF_OPEN: Recovery testing, allow limited test calls
 *
 * Tracks consecutive failures. After `failureThreshold` failures,
 * the circuit opens. After `resetTimeoutMs`, it transitions to
 * HALF_OPEN and allows `halfOpenMaxAttempts` test calls.
 * If test calls succeed, circuit closes; if they fail, it reopens.
 *
 * OpenClaw v2026.3.19 — Circuit breaker for provider resilience.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. Default: 5 */
  failureThreshold: number;
  /** Time in ms before transitioning from OPEN to HALF_OPEN. Default: 30000 */
  resetTimeoutMs: number;
  /** Number of test calls allowed in HALF_OPEN state. Default: 3 */
  halfOpenMaxAttempts: number;
  /** Optional name for logging/identification */
  name?: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  consecutiveFailures: number;
  totalSuccesses: number;
  totalFailures: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  halfOpenAttempts: number;
}

export interface CircuitBreakerEvents {
  /** Emitted when circuit transitions to OPEN */
  'open': (info: { name: string; consecutiveFailures: number }) => void;
  /** Emitted when circuit transitions to CLOSED */
  'close': (info: { name: string }) => void;
  /** Emitted when circuit transitions to HALF_OPEN */
  'half-open': (info: { name: string }) => void;
}

// ============================================================================
// Error
// ============================================================================

/**
 * Error thrown when the circuit is OPEN and calls are rejected.
 */
export class CircuitOpenError extends Error {
  public readonly circuitName: string;
  public readonly nextAttemptMs: number;

  constructor(circuitName: string, nextAttemptMs: number) {
    super(
      `Circuit breaker "${circuitName}" is OPEN. ` +
      `Next attempt allowed in ${Math.ceil(nextAttemptMs / 1000)}s.`
    );
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.nextAttemptMs = nextAttemptMs;
  }
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxAttempts: 3,
  name: 'default',
};

// ============================================================================
// CircuitBreaker Class
// ============================================================================

export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures: number = 0;
  private totalSuccesses: number = 0;
  private totalFailures: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private halfOpenAttempts: number = 0;
  private openedAt: number | null = null;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function through the circuit breaker.
   * - CLOSED: Execute normally, track failures
   * - OPEN: Reject immediately with CircuitOpenError (unless timeout elapsed)
   * - HALF_OPEN: Allow limited test calls, track results
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we should transition OPEN -> HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      const elapsed = now - (this.openedAt ?? now);

      if (elapsed >= this.config.resetTimeoutMs) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        const remaining = this.config.resetTimeoutMs - elapsed;
        throw new CircuitOpenError(this.config.name ?? 'default', remaining);
      }
    }

    // In HALF_OPEN, check if we've exceeded max attempts
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
        // All attempts used without full success threshold, reopen
        this.transitionTo(CircuitState.OPEN);
        throw new CircuitOpenError(this.config.name ?? 'default', this.config.resetTimeoutMs);
      }
      this.halfOpenAttempts++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Get the current circuit state.
   */
  getState(): CircuitState {
    // Check for lazy transition
    if (this.state === CircuitState.OPEN && this.openedAt !== null) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.config.resetTimeoutMs) {
        return CircuitState.HALF_OPEN;
      }
    }
    return this.state;
  }

  /**
   * Get circuit breaker statistics.
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      halfOpenAttempts: this.halfOpenAttempts,
    };
  }

  /**
   * Manually reset the circuit breaker to CLOSED state.
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.totalSuccesses = 0;
    this.totalFailures = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.halfOpenAttempts = 0;
    this.openedAt = null;
  }

  /**
   * Dispose the circuit breaker.
   */
  dispose(): void {
    this.reset();
    this.removeAllListeners();
  }

  // ==========================================================================
  // Internal State Transitions
  // ==========================================================================

  private onSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccessTime = Date.now();
    this.consecutiveFailures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      // Success in HALF_OPEN -> close the circuit
      this.transitionTo(CircuitState.CLOSED);
    }
  }

  private onFailure(): void {
    this.totalFailures++;
    this.lastFailureTime = Date.now();
    this.consecutiveFailures++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Failure in HALF_OPEN -> reopen
      this.transitionTo(CircuitState.OPEN);
    } else if (
      this.state === CircuitState.CLOSED &&
      this.consecutiveFailures >= this.config.failureThreshold
    ) {
      // Too many consecutive failures in CLOSED -> open
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    if (oldState === newState) return;

    this.state = newState;
    const name = this.config.name ?? 'default';

    switch (newState) {
      case CircuitState.OPEN:
        this.openedAt = Date.now();
        this.halfOpenAttempts = 0;
        logger.warn(`Circuit breaker "${name}" opened after ${this.consecutiveFailures} failures`);
        this.emit('open', { name, consecutiveFailures: this.consecutiveFailures });
        break;

      case CircuitState.HALF_OPEN:
        this.halfOpenAttempts = 0;
        logger.info(`Circuit breaker "${name}" entering half-open state`);
        this.emit('half-open', { name });
        break;

      case CircuitState.CLOSED:
        this.consecutiveFailures = 0;
        this.openedAt = null;
        this.halfOpenAttempts = 0;
        logger.info(`Circuit breaker "${name}" closed (recovered)`);
        this.emit('close', { name });
        break;
    }
  }
}

// ============================================================================
// Per-Provider Circuit Breaker Registry
// ============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a specific provider key.
 * The key can be a provider name, base URL, or any unique identifier.
 */
export function getCircuitBreaker(
  key: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  let cb = circuitBreakers.get(key);
  if (!cb) {
    cb = new CircuitBreaker({ ...config, name: key });
    circuitBreakers.set(key, cb);
  }
  return cb;
}

/**
 * Reset a specific circuit breaker by key.
 */
export function resetCircuitBreaker(key: string): void {
  const cb = circuitBreakers.get(key);
  if (cb) {
    cb.dispose();
    circuitBreakers.delete(key);
  }
}

/**
 * Reset all circuit breakers.
 */
export function resetAllCircuitBreakers(): void {
  for (const cb of circuitBreakers.values()) {
    cb.dispose();
  }
  circuitBreakers.clear();
}

/**
 * Get stats for all active circuit breakers.
 */
export function getAllCircuitBreakerStats(): Record<string, CircuitBreakerStats> {
  const stats: Record<string, CircuitBreakerStats> = {};
  for (const [key, cb] of circuitBreakers) {
    stats[key] = cb.getStats();
  }
  return stats;
}
