/**
 * Model Defaults — Single Source of Truth
 *
 * This module defines the canonical default model for every provider and
 * the resolution helpers that replace 124+ hardcoded model-name strings
 * scattered across the codebase.
 *
 * IMPORTANT: This file must have ZERO imports from the rest of the project
 * to prevent circular dependency chains.
 */

// ============================================================================
// Provider Keys
// ============================================================================

/**
 * Canonical provider identifiers used for model resolution.
 * These map to the upstream API provider, NOT the UI-facing config names.
 */
export type ProviderKey =
  | 'xai'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'lmstudio'
  | 'deepseek'
  | 'mistral';

// ============================================================================
// Default Models
// ============================================================================

/**
 * The single canonical default model for each provider.
 * Every fallback chain in the codebase must resolve through this map.
 */
export const MODEL_DEFAULTS: Record<ProviderKey, string> = {
  xai: 'grok-code-fast-1',
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.5-flash',
  ollama: 'llama3.2',
  lmstudio: 'local-model',
  deepseek: 'deepseek-chat',
  mistral: 'devstral-latest',
};

/** The ultimate fallback when no provider can be determined. */
export const FALLBACK_MODEL: string = MODEL_DEFAULTS.xai;

/** The provider used when nothing else is configured. */
export const FALLBACK_PROVIDER: ProviderKey = 'xai';

// ============================================================================
// Environment Variable Resolution
// ============================================================================

/**
 * Maps each provider to the env var that can override its default model.
 */
const ENV_VAR_MAP: Partial<Record<ProviderKey, string>> = {
  xai: 'GROK_MODEL',
  openai: 'OPENAI_MODEL',
  anthropic: 'ANTHROPIC_MODEL',
  google: 'GEMINI_MODEL',
};

/**
 * Return the default model for a provider, respecting env-var overrides.
 *
 * Resolution: env var > MODEL_DEFAULTS[provider] > FALLBACK_MODEL
 */
export function getProviderDefaultModel(provider: ProviderKey): string {
  const envVar = ENV_VAR_MAP[provider];
  if (envVar && process.env[envVar]) {
    return process.env[envVar]!;
  }
  return MODEL_DEFAULTS[provider] ?? FALLBACK_MODEL;
}

// ============================================================================
// Model Roles
// ============================================================================

/**
 * Suggested models for different use-case roles.
 * Callers may override via config; these are sensible defaults.
 */
export const MODEL_ROLES = {
  /** Fast models for quick operations (tab completion, summaries) */
  fast: {
    xai: 'grok-code-fast-1',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-haiku-4-5-20251001',
    google: 'gemini-2.5-flash-lite',
  } as Partial<Record<ProviderKey, string>>,

  /** Reasoning models for complex tasks */
  reasoning: {
    xai: 'grok-4-latest',
    openai: 'o4-mini',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-2.5-pro',
  } as Partial<Record<ProviderKey, string>>,

  /** Architect models for planning / code review */
  architect: {
    xai: 'grok-4-latest',
    openai: 'gpt-4o',
    anthropic: 'claude-opus-4-20250514',
    google: 'gemini-2.5-pro',
  } as Partial<Record<ProviderKey, string>>,
} as const;

// ============================================================================
// Gemini Fallback Chain
// ============================================================================

/**
 * Ordered fallback chain for Gemini models.
 * Used when the primary Gemini model returns 404/400 "Model not found".
 */
export const GEMINI_FALLBACK_CHAIN: string[] = [
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];
