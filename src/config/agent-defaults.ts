/**
 * Agent Defaults Configuration Helper
 *
 * Provides typed access to agent default settings.
 * Native Engine v2026.3.14 alignment.
 */

import { getConfigManager } from './toml-config.js';
import type { AgentParamsOverride } from './toml-config.js';

/**
 * Get the configured image generation model, if any.
 */
export function getImageGenerationModel(): string | undefined {
  try {
    const config = getConfigManager().getConfig();
    return config.agent_defaults?.imageGenerationModel;
  } catch {
    return undefined;
  }
}

/**
 * Get per-agent parameter overrides for a given agent ID.
 * Returns undefined if no overrides are configured.
 */
export function getAgentParams(agentId: string): AgentParamsOverride | undefined {
  try {
    const config = getConfigManager().getConfig();
    return config.agent_defaults?.agents?.[agentId];
  } catch {
    return undefined;
  }
}
