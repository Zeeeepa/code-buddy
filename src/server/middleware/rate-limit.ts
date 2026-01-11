/**
 * Rate Limiting Middleware
 *
 * Implements sliding window rate limiting with support for:
 * - Global rate limits
 * - Per-key rate limits
 * - Per-endpoint rate limits
 */

import type { Request, Response, NextFunction } from 'express';
import type { ServerConfig } from '../types.js';
import { API_ERRORS } from '../types.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  requests: number[];
}

// In-memory store for rate limits
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Get rate limit key for request
 */
function getRateLimitKey(req: Request): string {
  // Use API key ID if authenticated
  if (req.auth?.keyId) {
    return `key:${req.auth.keyId}`;
  }
  // Use user ID if authenticated
  if (req.auth?.userId) {
    return `user:${req.auth.userId}`;
  }
  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limiting middleware
 */
export function createRateLimitMiddleware(config: ServerConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if rate limiting disabled
    if (!config.rateLimit) {
      return next();
    }

    const key = getRateLimitKey(req);
    const now = Date.now();
    const windowStart = now - config.rateLimitWindow;

    let entry = rateLimitStore.get(key);

    if (!entry) {
      entry = {
        count: 0,
        resetAt: now + config.rateLimitWindow,
        requests: [],
      };
      rateLimitStore.set(key, entry);
    }

    // Remove requests outside the window (sliding window)
    entry.requests = entry.requests.filter((t) => t > windowStart);
    entry.count = entry.requests.length;

    // Check if limit exceeded
    if (entry.count >= config.rateLimitMax) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

      res.setHeader('X-RateLimit-Limit', config.rateLimitMax.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', entry.resetAt.toString());
      res.setHeader('Retry-After', retryAfter.toString());

      return res.status(429).json({
        ...API_ERRORS.RATE_LIMITED,
        details: {
          limit: config.rateLimitMax,
          windowMs: config.rateLimitWindow,
          retryAfter,
        },
      });
    }

    // Add current request
    entry.requests.push(now);
    entry.count++;

    // Update reset time
    if (entry.resetAt < now) {
      entry.resetAt = now + config.rateLimitWindow;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.rateLimitMax.toString());
    res.setHeader('X-RateLimit-Remaining', (config.rateLimitMax - entry.count).toString());
    res.setHeader('X-RateLimit-Reset', entry.resetAt.toString());

    return next();
  };
}

/**
 * Create endpoint-specific rate limit middleware
 */
export function endpointRateLimit(maxRequests: number, windowMs: number) {
  const store = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${getRateLimitKey(req)}:${req.path}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let entry = store.get(key);

    if (!entry) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
        requests: [],
      };
      store.set(key, entry);
    }

    // Sliding window
    entry.requests = entry.requests.filter((t) => t > windowStart);
    entry.count = entry.requests.length;

    if (entry.count >= maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

      return res.status(429).json({
        ...API_ERRORS.RATE_LIMITED,
        message: `Endpoint rate limit exceeded. Try again in ${retryAfter}s`,
      });
    }

    entry.requests.push(now);
    entry.count++;

    return next();
  };
}

/**
 * Get current rate limit stats for a key
 */
export function getRateLimitStats(keyId: string): {
  used: number;
  remaining: number;
  resetAt: number;
} | null {
  const entry = rateLimitStore.get(`key:${keyId}`);
  if (!entry) {
    return null;
  }

  const now = Date.now();
  const windowStart = now - 60000; // Assume 1 minute window
  const validRequests = entry.requests.filter((t) => t > windowStart);

  return {
    used: validRequests.length,
    remaining: Math.max(0, 60 - validRequests.length), // Assume 60 req/min
    resetAt: entry.resetAt,
  };
}

/**
 * Reset rate limit for a key (admin function)
 */
export function resetRateLimit(keyId: string): boolean {
  return rateLimitStore.delete(`key:${keyId}`);
}

/**
 * Get all rate limit entries (admin function)
 */
export function getAllRateLimits(): Map<string, RateLimitEntry> {
  return new Map(rateLimitStore);
}
