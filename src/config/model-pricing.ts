/**
 * Model Pricing — Single pricing source
 *
 * Sprint 2 of the Model Architecture refactor.
 *
 * Replaces 6+ duplicate pricing tables scattered across the codebase.
 * All modules should import from this file instead of defining their own
 * pricing maps.
 */

import { getModelRegistry, type ModelPricing } from './model-registry.js';

// ============================================================================
// Primary API — per 1M tokens
// ============================================================================

/**
 * Get model pricing in "per 1M tokens" format.
 */
export function getModelPricing(model: string): ModelPricing {
  return getModelRegistry().getPricing(model);
}

// ============================================================================
// Adapters for different unit formats used across the codebase
// ============================================================================

/**
 * Get pricing in "per 1K tokens" format (used by CostTracker, CostPredictor).
 */
export function getPricingPer1k(model: string): { inputPer1k: number; outputPer1k: number } {
  const p = getModelPricing(model);
  return {
    inputPer1k: p.inputPerMillion / 1000,
    outputPer1k: p.outputPerMillion / 1000,
  };
}

/**
 * Get pricing in "per 1M tokens" format with `input`/`output` keys
 * (used by AnalyticsDashboard, PersistentAnalytics, interpreter types).
 */
export function getPricingPer1M(model: string): { input: number; output: number } {
  const p = getModelPricing(model);
  return {
    input: p.inputPerMillion,
    output: p.outputPerMillion,
  };
}

/**
 * Get pricing in the TokenPricing array format (used by cost-indicator.ts).
 */
export function getPricingForIndicator(model: string): {
  model: string;
  inputPer1M: number;
  outputPer1M: number;
} {
  const p = getModelPricing(model);
  return {
    model,
    inputPer1M: p.inputPerMillion,
    outputPer1M: p.outputPerMillion,
  };
}
