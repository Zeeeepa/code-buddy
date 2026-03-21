/**
 * Built-in Browser Profiles
 *
 * OpenClaw v2026.3.13 alignment: predefined browser profiles for agent use.
 * - `user`: Connect to running Chrome via CDP (port 9222)
 * - `chrome-relay`: Launch Chromium with persistent user data directory
 */

import { join } from 'path';
import { homedir } from 'os';

export interface BrowserProfile {
  name: string;
  type: 'managed' | 'remote';
  description: string;
  cdpUrl?: string;
  userDataDir?: string;
  headless?: boolean;
}

/**
 * Built-in browser profiles
 */
export const BUILTIN_PROFILES: Record<string, BrowserProfile> = {
  user: {
    name: 'user',
    type: 'remote',
    description: 'Connect to your running Chrome instance via CDP (port 9222)',
    cdpUrl: 'http://127.0.0.1:9222',
  },
  'chrome-relay': {
    name: 'chrome-relay',
    type: 'managed',
    description: 'Launch Chromium with persistent profile data',
    userDataDir: join(homedir(), '.codebuddy', 'browser-data'),
    headless: false,
  },
};

/**
 * Get a built-in profile by name
 */
export function getBuiltinProfile(name: string): BrowserProfile | undefined {
  return BUILTIN_PROFILES[name];
}

/**
 * List all available built-in profiles
 */
export function listBuiltinProfiles(): BrowserProfile[] {
  return Object.values(BUILTIN_PROFILES);
}
