/**
 * ModelCapabilityBridge — Phase 3 step 3
 *
 * Exposes model capability flags (vision, reasoning, tool calls)
 * to the renderer so UIs like ChatView can warn when a pasted
 * image is about to be sent to a non-vision model.
 *
 * Lazy-loads `src/config/model-tools.ts` via the core-loader so
 * the heavy engine deps are not pulled in at Electron startup.
 *
 * @module main/config/model-capability-bridge
 */

import { loadCoreModule } from '../utils/core-loader';

interface ModelToolsModule {
  getModelToolConfig: (model: string) => {
    supportsVision?: boolean;
    supportsReasoning?: boolean;
    supportsToolCalls?: boolean;
    contextWindow?: number;
    maxOutputTokens?: number;
  };
}

export interface ModelCapabilities {
  model: string;
  supportsVision: boolean;
  supportsReasoning: boolean;
  supportsToolCalls: boolean;
  contextWindow: number;
  maxOutputTokens: number;
}

const FALLBACK: ModelCapabilities = {
  model: '',
  supportsVision: false,
  supportsReasoning: false,
  supportsToolCalls: true,
  contextWindow: 128000,
  maxOutputTokens: 8192,
};

let cachedModule: ModelToolsModule | null = null;

async function loadModule(): Promise<ModelToolsModule | null> {
  if (cachedModule) return cachedModule;
  try {
    cachedModule = await loadCoreModule<ModelToolsModule>('config/model-tools.js');
    return cachedModule;
  } catch {
    return null;
  }
}

export async function getModelCapabilities(model: string): Promise<ModelCapabilities> {
  if (!model) return { ...FALLBACK };
  const mod = await loadModule();
  if (!mod?.getModelToolConfig) {
    return { ...FALLBACK, model };
  }
  try {
    const cfg = mod.getModelToolConfig(model);
    return {
      model,
      supportsVision: cfg.supportsVision ?? false,
      supportsReasoning: cfg.supportsReasoning ?? false,
      supportsToolCalls: cfg.supportsToolCalls ?? true,
      contextWindow: cfg.contextWindow ?? FALLBACK.contextWindow,
      maxOutputTokens: cfg.maxOutputTokens ?? FALLBACK.maxOutputTokens,
    };
  } catch {
    return { ...FALLBACK, model };
  }
}
