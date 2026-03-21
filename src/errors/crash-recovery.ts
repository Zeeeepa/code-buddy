/**
 * Crash Recovery — detect and offer recovery from unclean shutdowns.
 *
 * Works alongside the existing CrashHandler (crash-handler.ts) which saves
 * crash context to ~/.codebuddy/recovery/. This module reads that data at
 * startup and offers the user a chance to resume.
 */

import { readFile, readdir, rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { logger } from '../utils/logger.js';

export interface RecoveryInfo {
  sessionId: string;
  timestamp: string;
  messageCount: number;
  lastUserMessage: string;
  crashReason?: string;
}

/** The crash handler writes to ~/.codebuddy/recovery/ */
const RECOVERY_DIR = join(homedir(), '.codebuddy', 'recovery');

/**
 * Check if there's a pending crash recovery.
 * Returns recovery info if found, null otherwise.
 */
export async function checkCrashRecovery(cwd: string = process.cwd()): Promise<RecoveryInfo | null> {
  // Check the global recovery dir (where CrashHandler writes)
  const recoveryDir = RECOVERY_DIR;
  if (!existsSync(recoveryDir)) return null;

  try {
    // First try the "latest.json" quick-check file written by CrashHandler
    const latestFile = join(recoveryDir, 'latest.json');
    if (existsSync(latestFile)) {
      const latestContent = await readFile(latestFile, 'utf-8');
      const latestData = JSON.parse(latestContent);

      // Only offer recovery for crashes within the last hour
      const age = Date.now() - new Date(latestData.timestamp).getTime();
      if (age > 3600000) {
        return null;
      }

      // Try to load the full crash context for more detail
      let messageCount = 0;
      let lastUserMessage = '';

      if (latestData.recoveryFilePath && existsSync(latestData.recoveryFilePath)) {
        try {
          const crashContent = await readFile(latestData.recoveryFilePath, 'utf-8');
          const crashData = JSON.parse(crashContent);
          const messages = crashData.lastMessages || [];
          messageCount = messages.length;

          // Find the last user message
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'user') {
              lastUserMessage = messages[i].content || '';
              break;
            }
          }
        } catch {
          // Crash context file may be corrupted; use what we have
        }
      }

      return {
        sessionId: latestData.sessionId || 'unknown',
        timestamp: latestData.timestamp || new Date().toISOString(),
        messageCount,
        lastUserMessage: lastUserMessage.substring(0, 500),
        crashReason: latestData.reason || undefined,
      };
    }

    // Fallback: scan for crash_*.json files
    const files = await readdir(recoveryDir);
    const recoveryFiles = files
      .filter(f => f.startsWith('crash_') && f.endsWith('.json'))
      .sort();
    if (recoveryFiles.length === 0) return null;

    // Get the most recent recovery file
    const latest = recoveryFiles.pop()!;
    const content = await readFile(join(recoveryDir, latest), 'utf-8');
    const data = JSON.parse(content);

    // Only offer recovery for crashes within the last hour
    const age = Date.now() - new Date(data.timestamp).getTime();
    if (age > 3600000) {
      return null;
    }

    const messages = data.lastMessages || [];
    let lastUserMessage = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserMessage = messages[i].content || '';
        break;
      }
    }

    return {
      sessionId: data.sessionId || 'unknown',
      timestamp: data.timestamp || new Date().toISOString(),
      messageCount: messages.length,
      lastUserMessage: lastUserMessage.substring(0, 500),
      crashReason: data.error?.message || undefined,
    };
  } catch (err) {
    logger.debug(`Failed to read recovery info: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Clear recovery files after successful resume or user decline.
 */
export async function clearRecoveryFiles(): Promise<void> {
  const recoveryDir = RECOVERY_DIR;
  if (!existsSync(recoveryDir)) return;

  try {
    // Only remove latest.json — let CrashHandler.cleanupOldCrashes() manage the crash files
    const latestFile = join(recoveryDir, 'latest.json');
    if (existsSync(latestFile)) {
      const { unlink } = await import('fs/promises');
      await unlink(latestFile);
    }
    logger.debug('Recovery files cleared');
  } catch (err) {
    logger.debug(`Failed to clear recovery files: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Save a recovery checkpoint (call periodically during session).
 * This supplements the CrashHandler by keeping a lightweight checkpoint
 * that includes the session ID and message count.
 */
export async function saveRecoveryCheckpoint(
  cwd: string,
  sessionId: string,
  messageCount: number,
  lastUserMessage: string,
): Promise<void> {
  const recoveryDir = RECOVERY_DIR;
  try {
    const { mkdir, writeFile } = await import('fs/promises');
    if (!existsSync(recoveryDir)) {
      await mkdir(recoveryDir, { recursive: true });
    }

    const data = {
      sessionId,
      timestamp: new Date().toISOString(),
      messageCount,
      lastUserMessage: lastUserMessage.substring(0, 500),
    };

    await writeFile(
      join(recoveryDir, `recovery-${sessionId}.json`),
      JSON.stringify(data, null, 2),
      'utf-8',
    );
  } catch (err) {
    logger.debug(`Failed to save recovery checkpoint: ${err instanceof Error ? err.message : String(err)}`);
  }
}
