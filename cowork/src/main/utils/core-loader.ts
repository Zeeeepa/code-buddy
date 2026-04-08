/**
 * core-loader — Safely load Code Buddy core modules from the main process
 *
 * Main process code is bundled by vite-plugin-electron into
 * `dist-electron/main/*.js`. Relative paths to the Code Buddy core
 * (`grok-cli/src/...`) change between dev and production, and vite can
 * accidentally try to bundle a string-literal dynamic import.
 *
 * This helper centralizes the resolution:
 *
 *   1. If `CODEBUDDY_ENGINE_PATH` is set, use that as the base
 *   2. Otherwise, derive from `app.getAppPath()` (Electron)
 *   3. Fall back to walking up from `import.meta.url`
 *
 * Callers pass the relative path from the Code Buddy `dist/` root
 * (e.g. `agent/multi-agent/agent-tools.js`).
 *
 * @module main/utils/core-loader
 */

import { app } from 'electron';
import { resolve, join, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { log, logWarn } from './logger';

const moduleCache = new Map<string, unknown>();

function candidateRoots(): string[] {
  const roots: string[] = [];

  // Env override
  if (process.env.CODEBUDDY_ENGINE_PATH) {
    roots.push(process.env.CODEBUDDY_ENGINE_PATH);
  }

  // Electron app path — in dev = `cowork/`, in production = `resources/app/`.
  // From there, `../dist` is the Code Buddy core dist folder.
  try {
    const appPath = app?.getAppPath?.();
    if (appPath) {
      roots.push(resolve(appPath, '..', 'dist'));
      roots.push(resolve(appPath, 'dist'));
    }
  } catch {
    /* not in Electron context yet */
  }

  // Walk up from this file — works when running TS via tsx or when vite
  // inlines source maps.
  try {
    const here = fileURLToPath(import.meta.url);
    // dist-electron/main/utils/core-loader.js → up 4 = cowork/ → up 1 → grok-cli/dist/
    const candidate1 = resolve(dirname(here), '..', '..', '..', '..', 'dist');
    roots.push(candidate1);
    // src path (tsx dev mode)
    const candidate2 = resolve(dirname(here), '..', '..', '..', '..', 'src');
    roots.push(candidate2);
  } catch {
    /* no import.meta.url (CJS) */
  }

  // Current working directory + dist (last resort)
  roots.push(resolve(process.cwd(), 'dist'));
  roots.push(resolve(process.cwd(), 'src'));

  // Deduplicate
  return Array.from(new Set(roots));
}

/**
 * Dynamically import a Code Buddy core module by its relative path.
 *
 * @param relativePath Path from Code Buddy core root (e.g. `agent/multi-agent/agent-tools.js`)
 * @returns The loaded module, or null if all candidates failed.
 */
export async function loadCoreModule<T = unknown>(relativePath: string): Promise<T | null> {
  if (moduleCache.has(relativePath)) {
    return moduleCache.get(relativePath) as T;
  }

  const roots = candidateRoots();
  const errors: string[] = [];

  for (const root of roots) {
    const fullPath = join(root, relativePath);
    if (!existsSync(fullPath)) continue;

    try {
      // /* @vite-ignore */ tells vite not to try to bundle this import
      const mod = (await import(/* @vite-ignore */ fullPath)) as T;
      moduleCache.set(relativePath, mod);
      log('[core-loader] Loaded', relativePath, 'from', root);
      return mod;
    } catch (err) {
      errors.push(`${fullPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  logWarn('[core-loader] Failed to load', relativePath, 'from any candidate', errors);
  return null;
}

/** Reset the cache (primarily for tests) */
export function resetCoreLoaderCache(): void {
  moduleCache.clear();
}
