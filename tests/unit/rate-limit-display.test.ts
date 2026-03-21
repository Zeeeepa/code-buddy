/**
 * Unit tests for Rate Limit / Quota Display
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseRateLimitHeaders,
  formatRateLimitInfo,
  getRateLimitStatus,
  storeRateLimitInfo,
  clearRateLimitStore,
  formatAllRateLimits,
} from '../../src/utils/rate-limit-display';

describe('Rate Limit Display', () => {
  beforeEach(() => {
    clearRateLimitStore();
  });

  it('should parse standard rate limit headers', () => {
    const headers: Record<string, string> = {
      'x-ratelimit-remaining-requests': '95',
      'x-ratelimit-remaining-tokens': '150000',
      'x-ratelimit-limit-requests': '100',
      'x-ratelimit-limit-tokens': '200000',
    };

    const info = parseRateLimitHeaders(headers, 'OpenAI');

    expect(info.provider).toBe('OpenAI');
    expect(info.remainingRequests).toBe(95);
    expect(info.remainingTokens).toBe(150000);
    expect(info.limitRequests).toBe(100);
    expect(info.limitTokens).toBe(200000);
  });

  it('should handle case-insensitive headers', () => {
    const headers: Record<string, string> = {
      'X-RateLimit-Remaining-Requests': '42',
      'X-RATELIMIT-LIMIT-REQUESTS': '100',
    };

    const info = parseRateLimitHeaders(headers, 'xAI');

    expect(info.remainingRequests).toBe(42);
    expect(info.limitRequests).toBe(100);
  });

  it('should parse reset time as seconds from now', () => {
    const headers: Record<string, string> = {
      'x-ratelimit-reset-requests': '300',
    };

    const before = Date.now();
    const info = parseRateLimitHeaders(headers, 'test');
    const after = Date.now();

    expect(info.resetAt).toBeDefined();
    const resetMs = info.resetAt!.getTime();
    // Should be approximately 300 seconds from now
    expect(resetMs).toBeGreaterThanOrEqual(before + 300000 - 100);
    expect(resetMs).toBeLessThanOrEqual(after + 300000 + 100);
  });

  it('should parse reset time as duration string', () => {
    const headers: Record<string, string> = {
      'x-ratelimit-reset-requests': '6m0s',
    };

    const before = Date.now();
    const info = parseRateLimitHeaders(headers, 'test');

    expect(info.resetAt).toBeDefined();
    const expectedMs = before + 360000;
    expect(Math.abs(info.resetAt!.getTime() - expectedMs)).toBeLessThan(500);
  });

  it('should return empty info for headers without rate limit data', () => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'date': 'Thu, 01 Jan 2026 00:00:00 GMT',
    };

    const info = parseRateLimitHeaders(headers, 'test');

    expect(info.provider).toBe('test');
    expect(info.remainingRequests).toBeUndefined();
    expect(info.remainingTokens).toBeUndefined();
  });

  it('should format rate limit info with requests and tokens', () => {
    const info = {
      provider: 'OpenAI',
      remainingRequests: 85,
      limitRequests: 100,
      remainingTokens: 150000,
      limitTokens: 200000,
    };

    const formatted = formatRateLimitInfo(info);

    expect(formatted).toContain('OpenAI');
    expect(formatted).toContain('85/100');
    expect(formatted).toContain('150000/200000');
  });

  it('should store and retrieve rate limit info per provider', () => {
    storeRateLimitInfo({ provider: 'OpenAI', remainingRequests: 90, limitRequests: 100 });
    storeRateLimitInfo({ provider: 'xAI', remainingRequests: 45, limitRequests: 60 });

    const statuses = getRateLimitStatus();

    expect(statuses).toHaveLength(2);
    expect(statuses.find(s => s.provider === 'OpenAI')?.remainingRequests).toBe(90);
    expect(statuses.find(s => s.provider === 'xAI')?.remainingRequests).toBe(45);
  });

  it('should format all rate limits for /quota display', () => {
    storeRateLimitInfo({ provider: 'OpenAI', remainingRequests: 90, limitRequests: 100 });

    const output = formatAllRateLimits();

    expect(output).toContain('OpenAI');
    expect(output).toContain('90/100');

    // Empty store
    clearRateLimitStore();
    const empty = formatAllRateLimits();
    expect(empty).toContain('No rate limit data available');
  });
});
