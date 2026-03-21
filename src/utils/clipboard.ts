/**
 * Cross-platform Clipboard Utility
 *
 * Provides clipboard read/write operations for macOS, Windows, and Linux.
 * Gracefully handles missing clipboard tools without crashing.
 */

import { execSync } from 'child_process';
import { platform } from 'os';
import { logger } from './logger.js';

/**
 * Copy text to the system clipboard.
 *
 * @param text - The text to copy
 * @returns true if successful, false otherwise
 */
export function copyToClipboard(text: string): boolean {
  try {
    const plat = platform();
    if (plat === 'darwin') {
      execSync('pbcopy', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else if (plat === 'win32') {
      execSync('clip', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else {
      // Linux: try xclip, then xsel, then wl-copy (Wayland)
      const linuxCommands = [
        'xclip -selection clipboard',
        'xsel --clipboard --input',
        'wl-copy',
      ];
      let copied = false;
      for (const cmd of linuxCommands) {
        try {
          execSync(cmd, { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
          copied = true;
          break;
        } catch {
          // Try next command
        }
      }
      if (!copied) {
        logger.debug('No clipboard tool available on Linux (tried xclip, xsel, wl-copy)');
        return false;
      }
    }
    return true;
  } catch (err) {
    logger.debug(`Clipboard copy failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Read text from the system clipboard.
 *
 * @returns The clipboard content, or null if unavailable
 */
export function readFromClipboard(): string | null {
  try {
    const plat = platform();
    if (plat === 'darwin') {
      return execSync('pbpaste', { encoding: 'utf-8' });
    }
    if (plat === 'win32') {
      return execSync('powershell -command Get-Clipboard', { encoding: 'utf-8' }).trim();
    }
    // Linux
    const linuxCommands = [
      'xclip -selection clipboard -o',
      'xsel --clipboard --output',
      'wl-paste',
    ];
    for (const cmd of linuxCommands) {
      try {
        return execSync(cmd, { encoding: 'utf-8' });
      } catch {
        // Try next command
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if clipboard operations are available on the current platform.
 *
 * @returns true if clipboard copy/paste should work
 */
export function isClipboardAvailable(): boolean {
  try {
    const plat = platform();
    if (plat === 'darwin' || plat === 'win32') {
      // macOS and Windows always have clipboard tools
      return true;
    }
    // Linux: check for any clipboard tool
    const linuxCommands = ['xclip', 'xsel', 'wl-copy'];
    for (const cmd of linuxCommands) {
      try {
        execSync(`which ${cmd}`, { stdio: ['ignore', 'ignore', 'ignore'] });
        return true;
      } catch {
        // Try next
      }
    }
    return false;
  } catch {
    return false;
  }
}
