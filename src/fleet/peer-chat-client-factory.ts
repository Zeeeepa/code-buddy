/**
 * Peer chat client factory (Phase (d).16a V0.4.1).
 *
 * Builds a `CodeBuddyClient` for the `peer.chat` bridge by auto-detecting
 * which provider keys are present in the environment. The fleet can host
 * any one of: Ollama (local), Grok (xAI), Claude (Anthropic), Gemini
 * (Google), or GPT (OpenAI).
 *
 * Priority order (local first to spare cloud quotas):
 *   1. CODEBUDDY_PEER_PROVIDER explicit override
 *   2. OLLAMA_HOST set        → ollama (local, no cap)
 *   3. GROK_API_KEY           → grok
 *   4. ANTHROPIC_API_KEY      → anthropic
 *   5. GOOGLE_API_KEY|GEMINI_API_KEY → gemini
 *   6. OPENAI_API_KEY         → openai
 *   7. nothing                → null (peer.chat → CLIENT_UNAVAILABLE)
 *
 * Override the model with CODEBUDDY_PEER_MODEL.
 */

import { CodeBuddyClient } from '../codebuddy/client.js';
import { logger } from '../utils/logger.js';

export type PeerChatProviderId = 'ollama' | 'grok' | 'anthropic' | 'gemini' | 'openai';

export interface PeerChatProviderInfo {
  provider: PeerChatProviderId;
  model: string;
  isLocal: boolean;
}

interface ProviderSpec {
  id: PeerChatProviderId;
  defaultModel: string;
  defaultBaseUrl: string;
  isLocal: boolean;
  /** Returns the apiKey + baseUrl actually used, or null if required env is missing. */
  resolve(): { apiKey: string; baseUrl: string } | null;
}

/**
 * Per-provider specs. Order in this array doubles as the auto-detect
 * priority (caller iterates left-to-right looking for the first whose
 * `resolve()` returns non-null).
 */
const SPECS: Record<PeerChatProviderId, ProviderSpec> = {
  ollama: {
    id: 'ollama',
    defaultModel: 'qwen2.5-coder:7b',
    defaultBaseUrl: 'http://localhost:11434/v1',
    isLocal: true,
    resolve: () => {
      const host = process.env.OLLAMA_HOST;
      if (!host) return null;
      // Normalize: accept "localhost:11434" or "http://host:port" or
      // "http://host:port/v1".
      let baseUrl = host;
      if (!/^https?:\/\//i.test(baseUrl)) baseUrl = `http://${baseUrl}`;
      if (!baseUrl.endsWith('/v1')) baseUrl = baseUrl.replace(/\/+$/, '') + '/v1';
      return { apiKey: 'ollama', baseUrl };
    },
  },
  grok: {
    id: 'grok',
    defaultModel: 'grok-3',
    defaultBaseUrl: 'https://api.x.ai/v1',
    isLocal: false,
    resolve: () => {
      const apiKey = process.env.GROK_API_KEY;
      if (!apiKey) return null;
      return { apiKey, baseUrl: process.env.GROK_BASE_URL || SPECS.grok.defaultBaseUrl };
    },
  },
  anthropic: {
    id: 'anthropic',
    defaultModel: 'claude-sonnet-4-6',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    isLocal: false,
    resolve: () => {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return null;
      return { apiKey, baseUrl: SPECS.anthropic.defaultBaseUrl };
    },
  },
  gemini: {
    id: 'gemini',
    defaultModel: 'gemini-2.5-flash',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    isLocal: false,
    resolve: () => {
      const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) return null;
      return { apiKey, baseUrl: SPECS.gemini.defaultBaseUrl };
    },
  },
  openai: {
    id: 'openai',
    defaultModel: 'gpt-4o',
    defaultBaseUrl: 'https://api.openai.com/v1',
    isLocal: false,
    resolve: () => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return null;
      return { apiKey, baseUrl: SPECS.openai.defaultBaseUrl };
    },
  },
};

/** Detection priority: local first to spare cloud quotas. */
const AUTO_DETECT_ORDER: PeerChatProviderId[] = [
  'ollama',
  'grok',
  'anthropic',
  'gemini',
  'openai',
];

/**
 * Build a peer.chat client + provider info from env, or null when no
 * provider can be resolved. Returns the FIRST match in the priority
 * order (overridable via CODEBUDDY_PEER_PROVIDER).
 *
 * Pure function — no side effects beyond logging. Safe to call at boot
 * and re-call (e.g. after env reload).
 */
export function createPeerChatClientFromEnv():
  | { client: CodeBuddyClient; info: PeerChatProviderInfo }
  | null {
  const override = process.env.CODEBUDDY_PEER_PROVIDER as PeerChatProviderId | undefined;
  if (override) {
    if (!(override in SPECS)) {
      logger.warn(`[peer-chat-factory] Unknown CODEBUDDY_PEER_PROVIDER: "${override}" — ignored`);
      return null;
    }
    return buildOne(override);
  }
  for (const id of AUTO_DETECT_ORDER) {
    const built = buildOne(id);
    if (built) return built;
  }
  return null;
}

/** Try to build a client for one specific provider. Returns null when env is incomplete. */
function buildOne(id: PeerChatProviderId): { client: CodeBuddyClient; info: PeerChatProviderInfo } | null {
  const spec = SPECS[id];
  const resolved = spec.resolve();
  if (!resolved) return null;
  const model = process.env.CODEBUDDY_PEER_MODEL || spec.defaultModel;
  try {
    const client = new CodeBuddyClient(resolved.apiKey, model, resolved.baseUrl);
    return {
      client,
      info: { provider: id, model, isLocal: spec.isLocal },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[peer-chat-factory] Failed to build ${id} client: ${msg}`);
    return null;
  }
}

/**
 * Resolved provider tuple — Phase (d).20.
 * Returned by `resolveProviderFromEnv()` for callers that want to
 * construct something other than a `CodeBuddyClient` (e.g. the
 * autonomous fleet tick which constructs a `CodeBuddyAgent`).
 */
export interface ResolvedProvider {
  provider: PeerChatProviderId;
  apiKey: string;
  baseUrl: string;
  model: string;
  isLocal: boolean;
}

/**
 * Resolve provider env without constructing a client. Useful for
 * non-`peer.chat` consumers that need the same auto-detection logic
 * (e.g. autonomous fleet tick → `CodeBuddyAgent`).
 *
 * `preferred`:
 *   - undefined / 'auto' → use `CODEBUDDY_PEER_PROVIDER` override or
 *     auto-detect order (same as `createPeerChatClientFromEnv`)
 *   - explicit provider id → resolve only that provider, return null
 *     if its env is incomplete
 *
 * Pure function. Returns null when no provider is resolvable.
 */
export function resolveProviderFromEnv(
  preferred?: PeerChatProviderId | 'auto',
): ResolvedProvider | null {
  // Explicit provider id — resolve only that one
  if (preferred && preferred !== 'auto') {
    const spec = SPECS[preferred];
    if (!spec) return null;
    const resolved = spec.resolve();
    if (!resolved) return null;
    return {
      provider: preferred,
      apiKey: resolved.apiKey,
      baseUrl: resolved.baseUrl,
      model: process.env.CODEBUDDY_PEER_MODEL || spec.defaultModel,
      isLocal: spec.isLocal,
    };
  }
  // Auto-detect with override fallthrough
  const override = process.env.CODEBUDDY_PEER_PROVIDER as PeerChatProviderId | undefined;
  if (override && override in SPECS) {
    const r = resolveProviderFromEnv(override);
    if (r) return r;
  }
  for (const id of AUTO_DETECT_ORDER) {
    const r = resolveProviderFromEnv(id);
    if (r) return r;
  }
  return null;
}

/** Test-only helper: list provider IDs in detection priority order. */
export function _getDetectionOrderForTests(): PeerChatProviderId[] {
  return [...AUTO_DETECT_ORDER];
}
