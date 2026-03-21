/**
 * Rate Limit / Quota Display
 *
 * Parses standard rate limit headers from API responses,
 * stores last known limits per provider, and provides formatted display.
 */

export interface RateLimitInfo {
  provider: string;
  remainingRequests?: number;
  remainingTokens?: number;
  resetAt?: Date;
  limitRequests?: number;
  limitTokens?: number;
}

/** In-memory store of last known rate limit info per provider */
const rateLimitStore = new Map<string, RateLimitInfo>();

/**
 * Parse standard rate limit headers from an API response.
 *
 * Recognizes:
 *   x-ratelimit-remaining-requests
 *   x-ratelimit-remaining-tokens
 *   x-ratelimit-limit-requests
 *   x-ratelimit-limit-tokens
 *   x-ratelimit-reset-requests  (seconds or ISO timestamp)
 *   x-ratelimit-reset-tokens    (fallback if reset-requests absent)
 */
export function parseRateLimitHeaders(
  headers: Record<string, string>,
  provider = 'unknown'
): RateLimitInfo {
  const info: RateLimitInfo = { provider };

  const norm: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    norm[key.toLowerCase()] = value;
  }

  const remainReq = norm['x-ratelimit-remaining-requests'];
  if (remainReq !== undefined) {
    const n = Number(remainReq);
    if (Number.isFinite(n)) info.remainingRequests = n;
  }

  const remainTok = norm['x-ratelimit-remaining-tokens'];
  if (remainTok !== undefined) {
    const n = Number(remainTok);
    if (Number.isFinite(n)) info.remainingTokens = n;
  }

  const limitReq = norm['x-ratelimit-limit-requests'];
  if (limitReq !== undefined) {
    const n = Number(limitReq);
    if (Number.isFinite(n)) info.limitRequests = n;
  }

  const limitTok = norm['x-ratelimit-limit-tokens'];
  if (limitTok !== undefined) {
    const n = Number(limitTok);
    if (Number.isFinite(n)) info.limitTokens = n;
  }

  // Parse reset time (try seconds first, then ISO date, then duration string like "6m0s")
  const resetReq = norm['x-ratelimit-reset-requests'] ?? norm['x-ratelimit-reset-tokens'];
  if (resetReq !== undefined) {
    info.resetAt = parseResetValue(resetReq);
  }

  return info;
}

/**
 * Parse a reset value that can be seconds, an ISO timestamp, or a duration string like "6m0s".
 */
function parseResetValue(value: string): Date | undefined {
  // Try as number of seconds
  const numVal = Number(value);
  if (Number.isFinite(numVal) && numVal > 0) {
    // If it looks like a Unix epoch (> 1e9), treat as epoch seconds
    if (numVal > 1e9) {
      return new Date(numVal * 1000);
    }
    // Otherwise treat as seconds from now
    return new Date(Date.now() + numVal * 1000);
  }

  // Try as ISO 8601 date
  const dateVal = new Date(value);
  if (!isNaN(dateVal.getTime())) {
    return dateVal;
  }

  // Try as duration string like "6m0s" or "30s" or "1h2m3s"
  const durationMatch = value.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (durationMatch) {
    const hours = Number(durationMatch[1] || 0);
    const minutes = Number(durationMatch[2] || 0);
    const seconds = Number(durationMatch[3] || 0);
    const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;
    if (totalMs > 0) {
      return new Date(Date.now() + totalMs);
    }
  }

  return undefined;
}

/**
 * Store rate limit info for a provider.
 */
export function storeRateLimitInfo(info: RateLimitInfo): void {
  rateLimitStore.set(info.provider, info);
}

/**
 * Format a single provider's rate limit info for display.
 */
export function formatRateLimitInfo(info: RateLimitInfo): string {
  const parts: string[] = [`Provider: ${info.provider}`];

  if (info.remainingRequests !== undefined && info.limitRequests !== undefined) {
    parts.push(`  Requests: ${info.remainingRequests}/${info.limitRequests} remaining`);
  } else if (info.remainingRequests !== undefined) {
    parts.push(`  Requests: ${info.remainingRequests} remaining`);
  }

  if (info.remainingTokens !== undefined && info.limitTokens !== undefined) {
    parts.push(`  Tokens: ${info.remainingTokens}/${info.limitTokens} remaining`);
  } else if (info.remainingTokens !== undefined) {
    parts.push(`  Tokens: ${info.remainingTokens} remaining`);
  }

  if (info.resetAt) {
    const now = Date.now();
    const resetMs = info.resetAt.getTime() - now;
    if (resetMs > 0) {
      const resetMin = Math.ceil(resetMs / 60000);
      parts.push(`  Resets in: ${resetMin}m`);
    } else {
      parts.push(`  Reset: already elapsed`);
    }
  }

  if (parts.length === 1) {
    parts.push('  No rate limit data available');
  }

  return parts.join('\n');
}

/**
 * Get all known rate limit statuses.
 */
export function getRateLimitStatus(): RateLimitInfo[] {
  return Array.from(rateLimitStore.values());
}

/**
 * Clear all stored rate limit info (for testing).
 */
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

/**
 * Format all known rate limits for the /quota command.
 */
export function formatAllRateLimits(): string {
  const infos = getRateLimitStatus();
  if (infos.length === 0) {
    return 'No rate limit data available yet. Make an API call first.';
  }
  return infos.map(formatRateLimitInfo).join('\n\n');
}
