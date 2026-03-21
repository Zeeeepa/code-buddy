/**
 * HTTP Proxy Support
 *
 * Configures HTTP/HTTPS proxy for all outbound requests.
 * Reads standard environment variables: HTTP_PROXY, HTTPS_PROXY, NO_PROXY.
 *
 * For the OpenAI SDK: it respects HTTP_PROXY natively via undici.
 * For raw fetch() calls: this module sets the global dispatcher with a ProxyAgent.
 */

import { logger } from './logger.js';

// ============================================================================
// Types
// ============================================================================

interface ProxyConfig {
  httpProxy?: string;
  httpsProxy?: string;
  noProxy: string[];
}

// ============================================================================
// State
// ============================================================================

let proxyConfigured = false;
let currentConfig: ProxyConfig = { noProxy: [] };

// ============================================================================
// Public API
// ============================================================================

/**
 * Configure global HTTP proxy from environment variables.
 * Should be called early in the application lifecycle (e.g., in src/index.ts).
 *
 * Supported env vars:
 * - HTTP_PROXY / http_proxy
 * - HTTPS_PROXY / https_proxy
 * - NO_PROXY / no_proxy (comma-separated hostnames/domains)
 */
export function configureProxy(): void {
  if (proxyConfigured) return;
  proxyConfigured = true;

  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const noProxyRaw = process.env.NO_PROXY || process.env.no_proxy || '';

  const noProxy = noProxyRaw
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(h => h.length > 0);

  currentConfig = { httpProxy, httpsProxy, noProxy };

  if (!httpProxy && !httpsProxy) {
    return;
  }

  const proxyUrl = httpsProxy || httpProxy;

  // Try to set global dispatcher with undici ProxyAgent
  // This enables proxy support for globalThis.fetch (Node 18+)
  try {
    // Dynamic import to avoid hard dependency
    setGlobalProxyAgent(proxyUrl!);
  } catch {
    // If undici is not available, the OpenAI SDK will still pick up
    // the env vars directly. Log for awareness.
    logger.debug('Could not set global proxy agent (undici unavailable). OpenAI SDK will use env vars directly.');
  }

  logger.info(`Proxy configured: ${proxyUrl}`, { source: 'Proxy' });
  if (noProxy.length > 0) {
    logger.debug(`NO_PROXY: ${noProxy.join(', ')}`, { source: 'Proxy' });
  }
}

/**
 * Get the currently configured proxy URL (HTTPS preferred over HTTP).
 * Returns undefined if no proxy is configured.
 */
export function getProxyUrl(): string | undefined {
  return currentConfig.httpsProxy || currentConfig.httpProxy;
}

/**
 * Check whether a hostname should bypass the proxy.
 * Matches against NO_PROXY entries. Supports:
 * - Exact hostname match: "api.example.com"
 * - Domain suffix match: ".example.com" matches "sub.example.com"
 * - Wildcard: "*" bypasses all
 * - localhost/127.0.0.1 always bypass
 */
export function shouldBypassProxy(hostname: string): boolean {
  const lower = hostname.toLowerCase();

  // Always bypass localhost
  if (lower === 'localhost' || lower === '127.0.0.1' || lower === '::1') {
    return true;
  }

  for (const entry of currentConfig.noProxy) {
    if (entry === '*') {
      return true;
    }
    if (entry === lower) {
      return true;
    }
    // Domain suffix match: ".example.com" matches "sub.example.com"
    if (entry.startsWith('.') && lower.endsWith(entry)) {
      return true;
    }
    // Also match without leading dot: "example.com" matches "sub.example.com"
    if (!entry.startsWith('.') && (lower === entry || lower.endsWith('.' + entry))) {
      return true;
    }
  }

  return false;
}

/**
 * Get the full proxy configuration.
 */
export function getProxyConfig(): ProxyConfig {
  return { ...currentConfig };
}

// ============================================================================
// Internal
// ============================================================================

/**
 * Set the global undici dispatcher to a ProxyAgent.
 * This makes globalThis.fetch() use the proxy.
 */
async function setGlobalProxyAgent(proxyUrl: string): Promise<void> {
  try {
    // undici is a transitive dependency of Node.js 18+ and the OpenAI SDK
    // Use dynamic require-style import to avoid TS module resolution errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const undici = await (Function('return import("undici")')() as Promise<any>);
    if (undici.ProxyAgent && undici.setGlobalDispatcher) {
      const agent = new undici.ProxyAgent(proxyUrl);
      undici.setGlobalDispatcher(agent);
      logger.debug('Global undici ProxyAgent set successfully', { source: 'Proxy' });
    }
  } catch {
    // undici may not be available in all environments
    logger.debug('undici not available for proxy agent setup', { source: 'Proxy' });
  }
}
