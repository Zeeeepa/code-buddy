/**
 * Quota Handler
 *
 * /quota — Show remaining API rate limit capacity per provider.
 */

import type { CommandHandlerResult } from './branch-handlers.js';

export async function handleQuota(): Promise<CommandHandlerResult> {
  const { formatAllRateLimits } = await import('../../utils/rate-limit-display.js');
  const output = formatAllRateLimits();

  return {
    handled: true,
    entry: { type: 'assistant', content: output, timestamp: new Date() },
  };
}
