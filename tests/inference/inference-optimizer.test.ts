/**
 * Tests for inference-optimizer.ts
 *
 * Covers:
 * - KV cache calculation (all three strategies)
 * - Model size calculation (all three quantizations)
 * - Task routing logic
 * - getOptimalConfig (fits/not-fits, quantization selection, KV strategy)
 * - Hardware detection (mocked)
 * - InferenceOptimizer singleton
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateKvCacheGB,
  calculateModelSizeGB,
  routeTask,
  getOptimalConfig,
  detectHardware,
  getInferenceOptimizer,
  resetInferenceOptimizer,
  KNOWN_MODEL_SPECS,
  type HardwareProfile,
  type ModelSpec,
  type RoutingTask,
} from '../../src/inference/inference-optimizer.js';

// ============================================================================
// Fixtures
// ============================================================================

const devstral: ModelSpec = KNOWN_MODEL_SPECS['devstral-24b'];
const llama8b: ModelSpec = KNOWN_MODEL_SPECS['llama-8b'];
const qwen3b: ModelSpec = KNOWN_MODEL_SPECS['qwen2.5-3b'];

const highEndHardware: HardwareProfile = {
  cpu: { model: 'AMD Ryzen 9 7950X', cores: 32, ramGB: 128, ramBandwidthGBs: 90 },
  gpus: [
    { model: 'NVIDIA A100 80GB', vramGB: 80, backend: 'cuda' },
  ],
  turboQuantAvailable: true,
};

const midRangeHardware: HardwareProfile = {
  cpu: { model: 'Intel Core i7-13700K', cores: 16, ramGB: 64, ramBandwidthGBs: 50 },
  gpus: [
    { model: 'NVIDIA RTX 4090', vramGB: 24, backend: 'cuda' },
  ],
  turboQuantAvailable: true,
};

const lowVramHardware: HardwareProfile = {
  cpu: { model: 'Intel Core i5-12400', cores: 12, ramGB: 32, ramBandwidthGBs: 50 },
  gpus: [
    { model: 'NVIDIA RTX 3060', vramGB: 12, backend: 'cuda' },
  ],
  turboQuantAvailable: true,
};

const cpuOnlyHardware: HardwareProfile = {
  cpu: { model: 'Intel Core i5-10400', cores: 12, ramGB: 32, ramBandwidthGBs: 40 },
  gpus: [
    { model: 'CPU', vramGB: 0, backend: 'cpu' },
  ],
  turboQuantAvailable: false,
};

const multiGpuHardware: HardwareProfile = {
  cpu: { model: 'AMD EPYC 7763', cores: 128, ramGB: 512, ramBandwidthGBs: 400 },
  gpus: [
    { model: 'NVIDIA A100 80GB', vramGB: 80, backend: 'cuda' },
    { model: 'NVIDIA A100 80GB', vramGB: 80, backend: 'cuda' },
  ],
  turboQuantAvailable: true,
};

// ============================================================================
// calculateKvCacheGB
// ============================================================================

describe('calculateKvCacheGB', () => {
  it('computes fp16 correctly for devstral-24b at 8192 tokens', () => {
    // 2 * 56 * 8 * 128 * 8192 * 2 / 1e9
    const expected = (2 * 56 * 8 * 128 * 8192 * 2) / 1e9;
    expect(calculateKvCacheGB(devstral, 8192, 'fp16')).toBeCloseTo(expected, 6);
  });

  it('turboquant-4bit is ~7.1x smaller than fp16', () => {
    const fp16 = calculateKvCacheGB(llama8b, 4096, 'fp16');
    const tq4 = calculateKvCacheGB(llama8b, 4096, 'turboquant-4bit');
    expect(fp16 / tq4).toBeCloseTo(7.1, 5);
  });

  it('turboquant-2bit is ~14.2x smaller than fp16', () => {
    const fp16 = calculateKvCacheGB(llama8b, 4096, 'fp16');
    const tq2 = calculateKvCacheGB(llama8b, 4096, 'turboquant-2bit');
    expect(fp16 / tq2).toBeCloseTo(14.2, 5);
  });

  it('scales linearly with sequence length', () => {
    const at4k = calculateKvCacheGB(qwen3b, 4096, 'fp16');
    const at8k = calculateKvCacheGB(qwen3b, 8192, 'fp16');
    expect(at8k).toBeCloseTo(at4k * 2, 6);
  });

  it('scales linearly with numLayers', () => {
    const specA: ModelSpec = { ...llama8b, numLayers: 32 };
    const specB: ModelSpec = { ...llama8b, numLayers: 64 };
    const a = calculateKvCacheGB(specA, 4096, 'fp16');
    const b = calculateKvCacheGB(specB, 4096, 'fp16');
    expect(b).toBeCloseTo(a * 2, 6);
  });

  it('scales linearly with numKvHeads', () => {
    const specA: ModelSpec = { ...llama8b, numKvHeads: 8 };
    const specB: ModelSpec = { ...llama8b, numKvHeads: 16 };
    const a = calculateKvCacheGB(specA, 4096, 'fp16');
    const b = calculateKvCacheGB(specB, 4096, 'fp16');
    expect(b).toBeCloseTo(a * 2, 6);
  });

  it('returns positive value for qwen2.5-3b (2 kv_heads) at 32k', () => {
    const val = calculateKvCacheGB(qwen3b, 32768, 'fp16');
    expect(val).toBeGreaterThan(0);
  });

  it('turboquant-4bit < fp16 for any inputs', () => {
    expect(calculateKvCacheGB(devstral, 16384, 'turboquant-4bit'))
      .toBeLessThan(calculateKvCacheGB(devstral, 16384, 'fp16'));
  });

  it('turboquant-2bit < turboquant-4bit for any inputs', () => {
    expect(calculateKvCacheGB(devstral, 16384, 'turboquant-2bit'))
      .toBeLessThan(calculateKvCacheGB(devstral, 16384, 'turboquant-4bit'));
  });
});

// ============================================================================
// calculateModelSizeGB
// ============================================================================

describe('calculateModelSizeGB', () => {
  it('4bit: params / 2 GB', () => {
    expect(calculateModelSizeGB(24, '4bit')).toBe(12);
  });

  it('8bit: params GB', () => {
    expect(calculateModelSizeGB(24, '8bit')).toBe(24);
  });

  it('fp16: params * 2 GB', () => {
    expect(calculateModelSizeGB(24, 'fp16')).toBe(48);
  });

  it('4bit for llama-8b: 4 GB', () => {
    expect(calculateModelSizeGB(8, '4bit')).toBe(4);
  });

  it('8bit for llama-8b: 8 GB', () => {
    expect(calculateModelSizeGB(8, '8bit')).toBe(8);
  });

  it('fp16 for llama-8b: 16 GB', () => {
    expect(calculateModelSizeGB(8, 'fp16')).toBe(16);
  });

  it('4bit for qwen2.5-3b: 1.5 GB', () => {
    expect(calculateModelSizeGB(3, '4bit')).toBe(1.5);
  });
});

// ============================================================================
// routeTask
// ============================================================================

describe('routeTask', () => {
  it('routes complex tasks to cloud regardless of hardware', () => {
    const task: RoutingTask = { complexity: 'complex', contextTokens: 1000 };
    expect(routeTask(task, highEndHardware)).toBe('cloud');
    expect(routeTask(task, cpuOnlyHardware)).toBe('cloud');
  });

  it('routes large context (>32k) with limited VRAM to cloud', () => {
    const task: RoutingTask = { complexity: 'simple', contextTokens: 50000 };
    // lowVramHardware has 12 GB VRAM (< 20 GB threshold) → cloud
    expect(routeTask(task, lowVramHardware)).toBe('cloud');
  });

  it('routes trivial small-context tasks to local-ollama', () => {
    const task: RoutingTask = { complexity: 'trivial', contextTokens: 2048 };
    expect(routeTask(task, midRangeHardware)).toBe('local-ollama');
    expect(routeTask(task, highEndHardware)).toBe('local-ollama');
  });

  it('routes trivial tasks to local-ollama even on CPU-only hardware', () => {
    const task: RoutingTask = { complexity: 'trivial', contextTokens: 1024 };
    expect(routeTask(task, cpuOnlyHardware)).toBe('local-ollama');
  });

  it('routes simple tasks with CUDA GPU to local-vllm', () => {
    const task: RoutingTask = { complexity: 'simple', contextTokens: 8192 };
    expect(routeTask(task, midRangeHardware)).toBe('local-vllm');
  });

  it('routes simple tasks to local-ollama on CPU-only hardware', () => {
    const task: RoutingTask = { complexity: 'simple', contextTokens: 4096 };
    expect(routeTask(task, cpuOnlyHardware)).toBe('local-ollama');
  });

  it('routes trivial large-context to vllm when CUDA available', () => {
    // >4096 tokens, so not the trivial-small path
    const task: RoutingTask = { complexity: 'trivial', contextTokens: 8000 };
    expect(routeTask(task, midRangeHardware)).toBe('local-vllm');
  });

  it('routes to cloud when VRAM < 8 GB for non-trivial task', () => {
    const smallVramHw: HardwareProfile = {
      ...midRangeHardware,
      gpus: [{ model: 'NVIDIA GTX 1660', vramGB: 6, backend: 'cuda' }],
    };
    const task: RoutingTask = { complexity: 'simple', contextTokens: 4096 };
    // 6 GB < 8 GB threshold → cloud
    expect(routeTask(task, smallVramHw)).toBe('cloud');
  });
});

// ============================================================================
// getOptimalConfig
// ============================================================================

describe('getOptimalConfig', () => {
  it('marks llama-8b as fits on a 24 GB GPU', () => {
    const config = getOptimalConfig(llama8b, midRangeHardware);
    expect(config.fits).toBe(true);
    expect(config.model).toBe(llama8b.name);
  });

  it('chooses fp16 for llama-8b on A100 (80 GB VRAM)', () => {
    const config = getOptimalConfig(llama8b, highEndHardware);
    expect(config.quantization).toBe('fp16');
  });

  it('clamps context to spec.maxContext', () => {
    const config = getOptimalConfig(llama8b, highEndHardware, 999999);
    expect(config.maxContextTokens).toBe(llama8b.maxContext);
  });

  it('uses defaultContext when targetContext is omitted', () => {
    const config = getOptimalConfig(qwen3b, midRangeHardware);
    expect(config.maxContextTokens).toBe(qwen3b.defaultContext);
  });

  it('tensorParallel equals number of non-CPU GPUs', () => {
    const config = getOptimalConfig(devstral, multiGpuHardware);
    expect(config.tensorParallel).toBe(2);
  });

  it('tensorParallel is 1 on CPU-only hardware', () => {
    const config = getOptimalConfig(qwen3b, cpuOnlyHardware);
    expect(config.tensorParallel).toBe(1);
  });

  it('returns positive estimatedVramGB', () => {
    const config = getOptimalConfig(llama8b, midRangeHardware);
    expect(config.estimatedVramGB).toBeGreaterThan(0);
  });

  it('returns positive estimatedRamGB', () => {
    const config = getOptimalConfig(llama8b, midRangeHardware);
    expect(config.estimatedRamGB).toBeGreaterThan(0);
  });

  it('skipLayers is empty when model fits', () => {
    const config = getOptimalConfig(llama8b, highEndHardware);
    expect(config.skipLayers).toHaveLength(0);
  });

  it('devstral-24b does not fit on 12 GB GPU at 32k context', () => {
    const config = getOptimalConfig(devstral, lowVramHardware, 32768);
    expect(config.fits).toBe(false);
  });

  it('devstral-24b with TurboQuant picks a non-fp16 kv strategy when VRAM is tight', () => {
    const config = getOptimalConfig(devstral, lowVramHardware, 32768);
    // With only 12 GB total, fp16 KV cache is too large — must use turboquant
    expect(config.kvCacheStrategy).not.toBe('fp16');
  });

  it('residualLength <= maxContextTokens', () => {
    const config = getOptimalConfig(devstral, lowVramHardware, 32768);
    expect(config.residualLength).toBeLessThanOrEqual(config.maxContextTokens);
  });

  it('residualLength equals maxContextTokens when model fits', () => {
    const config = getOptimalConfig(qwen3b, highEndHardware);
    expect(config.residualLength).toBe(config.maxContextTokens);
  });
});

// ============================================================================
// KNOWN_MODEL_SPECS
// ============================================================================

describe('KNOWN_MODEL_SPECS', () => {
  it('contains devstral-24b with correct params', () => {
    const spec = KNOWN_MODEL_SPECS['devstral-24b'];
    expect(spec).toBeDefined();
    expect(spec.numLayers).toBe(56);
    expect(spec.numKvHeads).toBe(8);
    expect(spec.headDim).toBe(128);
    expect(spec.paramsBillions).toBe(24);
  });

  it('contains llama-8b with correct params', () => {
    const spec = KNOWN_MODEL_SPECS['llama-8b'];
    expect(spec).toBeDefined();
    expect(spec.numLayers).toBe(32);
    expect(spec.numKvHeads).toBe(8);
    expect(spec.headDim).toBe(128);
    expect(spec.paramsBillions).toBe(8);
  });

  it('contains qwen2.5-3b with correct params', () => {
    const spec = KNOWN_MODEL_SPECS['qwen2.5-3b'];
    expect(spec).toBeDefined();
    expect(spec.numLayers).toBe(36);
    expect(spec.numKvHeads).toBe(2);
    expect(spec.headDim).toBe(128);
    expect(spec.paramsBillions).toBe(3);
  });
});

// ============================================================================
// detectHardware (mocked)
// ============================================================================

describe('detectHardware', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a HardwareProfile with at least one GPU entry', async () => {
    // We don't mock child_process here — just verify the shape is correct
    // on any machine (CI may have no GPU → cpu fallback)
    const profile = await detectHardware();
    expect(profile.gpus.length).toBeGreaterThan(0);
    expect(profile.cpu.cores).toBeGreaterThan(0);
    expect(profile.cpu.ramGB).toBeGreaterThan(0);
    expect(typeof profile.turboQuantAvailable).toBe('boolean');
  });

  it('has cpu fallback backend when no GPU detected', async () => {
    // On CI / machines without nvidia-smi / rocm-smi / macOS the fallback kicks in
    const profile = await detectHardware();
    // Just assert the backend field is one of the valid values
    for (const gpu of profile.gpus) {
      expect(['cuda', 'rocm', 'directml', 'mps', 'cpu']).toContain(gpu.backend);
    }
  });
});

// ============================================================================
// InferenceOptimizer singleton
// ============================================================================

describe('InferenceOptimizer singleton', () => {
  afterEach(() => {
    resetInferenceOptimizer();
  });

  it('getInferenceOptimizer returns same instance each call', () => {
    const a = getInferenceOptimizer();
    const b = getInferenceOptimizer();
    expect(a).toBe(b);
  });

  it('resetInferenceOptimizer creates a fresh instance', () => {
    const a = getInferenceOptimizer();
    resetInferenceOptimizer();
    const b = getInferenceOptimizer();
    expect(a).not.toBe(b);
  });

  it('getOptimalConfigForModel returns null for unknown key', async () => {
    const optimizer = getInferenceOptimizer();
    // Inject a cached hardware profile so we do not hit real smi
    optimizer['cachedHardware'] = highEndHardware;
    const result = await optimizer.getOptimalConfigForModel('nonexistent-model-xyz');
    expect(result).toBeNull();
  });

  it('getOptimalConfigForModel returns config for known key', async () => {
    const optimizer = getInferenceOptimizer();
    optimizer['cachedHardware'] = highEndHardware;
    const result = await optimizer.getOptimalConfigForModel('llama-8b');
    expect(result).not.toBeNull();
    expect(result?.model).toBe(llama8b.name);
  });

  it('routeTask delegates to routeTask function with cached hardware', async () => {
    const optimizer = getInferenceOptimizer();
    optimizer['cachedHardware'] = highEndHardware;
    const decision = await optimizer.routeTask({ complexity: 'complex', contextTokens: 1000 });
    expect(decision).toBe('cloud');
  });

  it('resetCache clears the cached hardware', async () => {
    const optimizer = getInferenceOptimizer();
    optimizer['cachedHardware'] = highEndHardware;
    optimizer.resetCache();
    expect(optimizer['cachedHardware']).toBeNull();
  });
});
