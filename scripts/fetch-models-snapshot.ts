/**
 * Fetch Models Snapshot
 *
 * Downloads the LiteLLM model pricing/context window database and extracts
 * relevant fields for Code Buddy's model configuration system.
 *
 * Source: https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json
 *
 * Extracts per model:
 *   - max_tokens (context window total)
 *   - max_input_tokens
 *   - max_output_tokens
 *   - supports_vision
 *   - supports_function_calling
 *
 * Output: src/config/models-snapshot.json
 *
 * Graceful fallback: if fetch fails, keeps existing file (if any).
 * Used as prebuild step: `tsx scripts/fetch-models-snapshot.ts || true`
 */

import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const OUTPUT_PATH = join(__dirname, '..', 'src', 'config', 'models-snapshot.json');

interface LiteLLMModelEntry {
  max_tokens?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  supports_tool_choice?: boolean;
  litellm_provider?: string;
  mode?: string;
  [key: string]: unknown;
}

interface SnapshotEntry {
  maxTokens?: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  supportsVision?: boolean;
  supportsFunctionCalling?: boolean;
}

async function fetchModelsSnapshot(): Promise<void> {
  console.log('[fetch-models-snapshot] Fetching LiteLLM model database...');

  let response: Response;
  try {
    response = await fetch(LITELLM_URL, {
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[fetch-models-snapshot] Network error: ${msg}`);
    if (existsSync(OUTPUT_PATH)) {
      console.log('[fetch-models-snapshot] Keeping existing snapshot file.');
    } else {
      console.log('[fetch-models-snapshot] No existing snapshot. Writing empty file.');
      writeFileSync(OUTPUT_PATH, JSON.stringify({}, null, 2), 'utf-8');
    }
    return;
  }

  if (!response.ok) {
    console.warn(`[fetch-models-snapshot] HTTP ${response.status}: ${response.statusText}`);
    if (existsSync(OUTPUT_PATH)) {
      console.log('[fetch-models-snapshot] Keeping existing snapshot file.');
    }
    return;
  }

  const raw = await response.json() as Record<string, LiteLLMModelEntry>;
  const snapshot: Record<string, SnapshotEntry> = {};

  let count = 0;
  for (const [modelName, entry] of Object.entries(raw)) {
    // Skip non-chat models (embeddings, image generation, audio, etc.)
    if (entry.mode && entry.mode !== 'chat' && entry.mode !== 'completion') {
      continue;
    }

    // Skip the sample_spec entry
    if (modelName === 'sample_spec') continue;

    const snapshotEntry: SnapshotEntry = {};
    let hasData = false;

    if (typeof entry.max_tokens === 'number' && entry.max_tokens > 0) {
      snapshotEntry.maxTokens = entry.max_tokens;
      hasData = true;
    }
    if (typeof entry.max_input_tokens === 'number' && entry.max_input_tokens > 0) {
      snapshotEntry.maxInputTokens = entry.max_input_tokens;
      hasData = true;
    }
    if (typeof entry.max_output_tokens === 'number' && entry.max_output_tokens > 0) {
      snapshotEntry.maxOutputTokens = entry.max_output_tokens;
      hasData = true;
    }
    if (typeof entry.supports_vision === 'boolean') {
      snapshotEntry.supportsVision = entry.supports_vision;
      hasData = true;
    }
    if (typeof entry.supports_function_calling === 'boolean') {
      snapshotEntry.supportsFunctionCalling = entry.supports_function_calling;
      hasData = true;
    }

    if (hasData) {
      snapshot[modelName] = snapshotEntry;
      count++;
    }
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`[fetch-models-snapshot] Wrote ${count} models to ${OUTPUT_PATH}`);
}

fetchModelsSnapshot().catch(err => {
  console.warn('[fetch-models-snapshot] Fatal error:', err instanceof Error ? err.message : err);
  process.exit(0); // Don't fail the build
});
