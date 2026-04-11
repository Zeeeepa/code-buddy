/**
 * Tests for model-pricing.ts — Sprint 2 of Model Architecture refactor.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getModelPricing, getPricingPer1k, getPricingPer1M, getPricingForIndicator } from '../../src/config/model-pricing.js';
import { resetModelRegistry } from '../../src/config/model-registry.js';

describe('model-pricing', () => {
  afterEach(() => {
    resetModelRegistry();
  });

  describe('getModelPricing', () => {
    it('should return pricing with inputPerMillion and outputPerMillion', () => {
      const p = getModelPricing('grok-3');
      expect(p).toHaveProperty('inputPerMillion');
      expect(p).toHaveProperty('outputPerMillion');
      expect(typeof p.inputPerMillion).toBe('number');
      expect(typeof p.outputPerMillion).toBe('number');
    });

    it('should return non-zero pricing for known models', () => {
      const p = getModelPricing('gpt-4o');
      expect(p.inputPerMillion).toBeGreaterThan(0);
      expect(p.outputPerMillion).toBeGreaterThan(0);
    });
  });

  describe('getPricingPer1k', () => {
    it('should convert pricing to per-1K format', () => {
      const p = getPricingPer1k('grok-3');
      expect(p).toHaveProperty('inputPer1k');
      expect(p).toHaveProperty('outputPer1k');
      // per-1k should be per-1M / 1000
      const p1M = getModelPricing('grok-3');
      expect(p.inputPer1k).toBeCloseTo(p1M.inputPerMillion / 1000, 8);
      expect(p.outputPer1k).toBeCloseTo(p1M.outputPerMillion / 1000, 8);
    });
  });

  describe('getPricingPer1M', () => {
    it('should return pricing with input/output keys', () => {
      const p = getPricingPer1M('claude-3-opus');
      expect(p).toHaveProperty('input');
      expect(p).toHaveProperty('output');
      expect(p.input).toBe(15.0);
      expect(p.output).toBe(75.0);
    });
  });

  describe('getPricingForIndicator', () => {
    it('should return pricing in indicator format with model name', () => {
      const p = getPricingForIndicator('grok-3-mini');
      expect(p.model).toBe('grok-3-mini');
      expect(p.inputPer1M).toBe(0.3);
      expect(p.outputPer1M).toBe(0.5);
    });
  });

  describe('consistency', () => {
    it('should return consistent pricing across all adapters', () => {
      const model = 'gpt-4o';
      const raw = getModelPricing(model);
      const per1k = getPricingPer1k(model);
      const per1M = getPricingPer1M(model);
      const indicator = getPricingForIndicator(model);

      expect(per1k.inputPer1k).toBeCloseTo(raw.inputPerMillion / 1000, 8);
      expect(per1M.input).toBe(raw.inputPerMillion);
      expect(indicator.inputPer1M).toBe(raw.inputPerMillion);
    });
  });
});
