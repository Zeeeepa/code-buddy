/**
 * GUI Installer
 *
 * Installs Electron and rebuilds native modules for the desktop GUI.
 * Used by the `buddy install-gui` CLI command.
 *
 * @module desktop/installer
 */

import { execFileSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Install Electron and related dependencies for the desktop GUI.
 */
export async function installGUI(): Promise<void> {
  const projectRoot = resolve(__dirname, '..', '..');

  console.log('\n  Installing Code Buddy Desktop GUI...\n');

  // Step 1: Install Electron
  console.log('  [1/3] Installing Electron...');
  try {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    execFileSync(npmCmd, [
      'install', 'electron', 'electron-store', 'electron-updater',
      '--save-optional',
    ], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('  Failed to install Electron:', (error as Error).message);
    process.exit(1);
  }

  // Step 2: Rebuild native modules for Electron
  console.log('\n  [2/3] Rebuilding native modules for Electron...');
  try {
    const electronVersion = getElectronVersion(projectRoot);
    if (electronVersion) {
      const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      execFileSync(npxCmd, [
        'electron-rebuild',
        '--version', electronVersion,
        '--module-dir', '.',
      ], {
        cwd: projectRoot,
        stdio: 'inherit',
      });
    } else {
      console.log('  Skipping electron-rebuild (version not detected)');
    }
  } catch (error) {
    console.warn('  Warning: electron-rebuild failed:', (error as Error).message);
    console.warn('  Native modules may not work correctly in the GUI.');
  }

  // Step 3: Build Cowork if not already built
  console.log('\n  [3/3] Checking Cowork build...');
  const coworkDist = resolve(projectRoot, 'cowork', 'dist-electron');
  if (!existsSync(coworkDist)) {
    console.log('  Building Cowork desktop app...');
    try {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      execFileSync(npmCmd, ['run', 'build:gui'], {
        cwd: projectRoot,
        stdio: 'inherit',
      });
    } catch {
      console.warn('  Warning: Cowork build skipped (run npm run build:gui manually)');
    }
  } else {
    console.log('  Cowork already built.');
  }

  console.log('\n  Desktop GUI installed successfully!');
  console.log('  Run: buddy gui\n');
}

/**
 * Get the installed Electron version.
 */
function getElectronVersion(projectRoot: string): string | null {
  try {
    const packageJsonPath = resolve(projectRoot, 'node_modules', 'electron', 'package.json');
    if (existsSync(packageJsonPath)) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { version: string };
      return pkg.version;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Check if the GUI is installed and ready to use.
 */
export function isGUIInstalled(): boolean {
  try {
    const projectRoot = resolve(__dirname, '..', '..');
    const electronPath = resolve(projectRoot, 'node_modules', 'electron');
    return existsSync(electronPath);
  } catch {
    return false;
  }
}
