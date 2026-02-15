/**
 * Safety & Misc Utilities
 *
 * NestedLaunchGuard: prevents recursive CLI launches
 * ConfigBackupManager: timestamped config file backups with pruning
 * FeedbackCommand: pre-filled GitHub issue URL generation
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

// ============================================================================
// NestedLaunchGuard
// ============================================================================

export class NestedLaunchGuard {
  private envKey = 'CODEBUDDY_SESSION_ID';

  isNestedLaunch(): boolean {
    return !!process.env[this.envKey];
  }

  setSessionMarker(sessionId: string): void {
    process.env[this.envKey] = sessionId;
    logger.debug(`Session marker set: ${sessionId}`);
  }

  getWarning(): string {
    return 'Warning: You are launching Code Buddy inside an existing session. This may cause unexpected behavior. Use a separate terminal instead.';
  }
}

// ============================================================================
// ConfigBackupManager
// ============================================================================

export class ConfigBackupManager {
  createBackup(filePath: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.${timestamp}.bak`;
    fs.copyFileSync(filePath, backupPath);
    logger.info(`Backup created: ${backupPath}`);
    return backupPath;
  }

  listBackups(filePath: string): string[] {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath);
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir);
    return files
      .filter(f => f.startsWith(base + '.') && f.endsWith('.bak'))
      .map(f => path.join(dir, f))
      .sort();
  }

  pruneBackups(filePath: string, keep = 5): string[] {
    const backups = this.listBackups(filePath);
    const toRemove = backups.slice(0, Math.max(0, backups.length - keep));
    for (const bp of toRemove) {
      fs.unlinkSync(bp);
      logger.debug(`Pruned backup: ${bp}`);
    }
    return toRemove;
  }

  restoreBackup(backupPath: string, targetPath: string): void {
    fs.copyFileSync(backupPath, targetPath);
    logger.info(`Restored ${backupPath} -> ${targetPath}`);
  }
}

// ============================================================================
// FeedbackCommand
// ============================================================================

export class FeedbackCommand {
  getRepoUrl(): string {
    return 'https://github.com/phuetz/code-buddy/issues/new';
  }

  generateIssueUrl(title?: string, body?: string): string {
    const base = this.getRepoUrl();
    const params = new URLSearchParams();
    if (title) params.set('title', title);
    if (body) params.set('body', body);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  formatFeedbackMessage(): string {
    return [
      'We appreciate your feedback!',
      '',
      'To report a bug or request a feature, open a GitHub issue:',
      `  ${this.getRepoUrl()}`,
      '',
      'Please include steps to reproduce and your environment details.',
    ].join('\n');
  }
}
