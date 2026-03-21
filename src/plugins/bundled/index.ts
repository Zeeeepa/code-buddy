/**
 * Bundled Provider Plugins Index
 *
 * Auto-discovery and registration of bundled provider plugins.
 * OpenClaw v2026.3.14 — providers as plugins.
 * OpenClaw v2026.3.19 — Ollama + vLLM providers with onboarding hooks.
 * OpenClaw v2026.3.19 — AWS Bedrock + Azure OpenAI providers.
 * OpenClaw v2026.3.19 — Groq, Together AI, Fireworks AI providers.
 */

import { createOpenRouterProvider } from './openrouter-provider.js';
import { createCopilotProvider } from './copilot-provider.js';
import { createOllamaProvider } from './ollama-provider.js';
import { createVllmProvider } from './vllm-provider.js';
import { createBedrockProvider } from './bedrock-provider.js';
import { createAzureProvider } from './azure-provider.js';
import { createGroqProvider } from './groq-provider.js';
import { createTogetherProvider } from './together-provider.js';
import { createFireworksProvider } from './fireworks-provider.js';
import type { PluginProvider } from '../types.js';

/**
 * Get all bundled provider plugins that are currently enabled
 * (i.e., have their required API keys / env vars set).
 */
export function getBundledProviders(): PluginProvider[] {
  const providers: PluginProvider[] = [];

  const openrouter = createOpenRouterProvider();
  if (openrouter) providers.push(openrouter);

  const copilot = createCopilotProvider();
  if (copilot) providers.push(copilot);

  const ollama = createOllamaProvider();
  if (ollama) providers.push(ollama);

  const vllm = createVllmProvider();
  if (vllm) providers.push(vllm);

  const bedrock = createBedrockProvider();
  if (bedrock) providers.push(bedrock);

  const azure = createAzureProvider();
  if (azure) providers.push(azure);

  const groq = createGroqProvider();
  if (groq) providers.push(groq);

  const together = createTogetherProvider();
  if (together) providers.push(together);

  const fireworks = createFireworksProvider();
  if (fireworks) providers.push(fireworks);

  return providers;
}
