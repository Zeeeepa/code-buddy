/**
 * Networking module exports
 *
 * Advanced networking utilities for Code Buddy:
 * - Health checking for endpoint monitoring
 * - Retry utilities (from utils/retry.ts)
 * - Rate limiting (from utils/rate-limiter.ts)
 *
 * Note: Circuit breaker lives at src/providers/circuit-breaker.ts — it is the
 * single source of truth used by CodeBuddyClient. The previous duplicate at
 * src/networking/circuit-breaker.ts was removed as dead code.
 */

export * from './health-check.js';

// Re-export related utilities
export { retry, retryWithResult, withRetry, Retry, RetryPredicates, RetryStrategies } from '../utils/retry.js';
export { RateLimiter, getRateLimiter, rateLimited } from '../utils/rate-limiter.js';
