#!/usr/bin/env node
/**
 * Conditional Electron native module rebuild.
 *
 * Only runs if Electron is installed. Skips silently otherwise.
 * Used as a postinstall hook to auto-rebuild better-sqlite3, bufferutil,
 * and utf-8-validate for Electron's Node ABI.
 *
 * Usage:
 *   node scripts/optional-electron-rebuild.js
 *   node scripts/optional-electron-rebuild.js --force
 */

import { execFileSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const force = process.argv.includes('--force');

function main() {
  const electronPkgPath = resolve(projectRoot, 'node_modules', 'electron', 'package.json');

  if (!existsSync(electronPkgPath)) {
    // Electron not installed — nothing to do
    if (force) {
      console.log('  [electron-rebuild] Electron not installed. Skipping.');
    }
    return;
  }

  // Read Electron version
  let electronVersion;
  try {
    const pkg = JSON.parse(readFileSync(electronPkgPath, 'utf-8'));
    electronVersion = pkg.version;
  } catch {
    console.warn('  [electron-rebuild] Could not read Electron version. Skipping.');
    return;
  }

  console.log(`  [electron-rebuild] Rebuilding native modules for Electron ${electronVersion}...`);

  const isWin = process.platform === 'win32';
  const npx = isWin ? 'npx.cmd' : 'npx';

  try {
    execFileSync(npx, [
      'electron-rebuild',
      '--version', electronVersion,
      '--module-dir', '.',
    ], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    console.log('  [electron-rebuild] Done.');
  } catch (err) {
    console.warn(`  [electron-rebuild] Warning: ${err instanceof Error ? err.message : String(err)}`);
    console.warn('  Native modules may not work in the Electron GUI.');
  }
}

main();
