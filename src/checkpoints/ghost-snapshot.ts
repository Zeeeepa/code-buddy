/**
 * Ghost Snapshots — Git-based automatic workspace undo
 *
 * Before each agent turn, creates an automatic Git commit capturing
 * the workspace state. Enables single-command undo to any previous turn.
 *
 * Uses a shadow branch (.codebuddy/ghost) to avoid polluting the user's
 * git history. Ghost commits are lightweight stash-like references.
 *
 * Inspired by OpenAI Codex CLI's ghost_snapshot.rs
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

/** Git ref namespace for ghost snapshots */
const GHOST_REF_PREFIX = 'refs/codebuddy/ghost/';

/** Maximum time for a ghost snapshot operation (ms) */
const SNAPSHOT_TIMEOUT_MS = 240_000;

/** Maximum number of ghost snapshots to keep */
const MAX_GHOST_SNAPSHOTS = 50;

// ============================================================================
// Types
// ============================================================================

export interface GhostSnapshot {
  /** Unique snapshot ID (ISO timestamp) */
  id: string;
  /** Git commit hash */
  commitHash: string;
  /** Human-readable description */
  description: string;
  /** Timestamp */
  timestamp: Date;
  /** Turn number */
  turn: number;
}

// ============================================================================
// Ghost Snapshot Manager
// ============================================================================

export class GhostSnapshotManager {
  private cwd: string;
  private turnCounter = 0;
  private snapshots: GhostSnapshot[] = [];
  private isGitRepo = false;
  private initialized = false;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  /**
   * Initialize — check if we're in a git repo.
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return this.isGitRepo;
    this.initialized = true;

    try {
      await this.git(['rev-parse', '--git-dir']);
      this.isGitRepo = true;
      return true;
    } catch {
      this.isGitRepo = false;
      return false;
    }
  }

  /**
   * Create a ghost snapshot before a turn.
   * Returns the snapshot info, or null if not in a git repo.
   */
  async createSnapshot(description?: string): Promise<GhostSnapshot | null> {
    if (!await this.initialize()) return null;

    this.turnCounter++;
    const id = new Date().toISOString().replace(/[:.]/g, '-');
    const desc = description ?? `Turn ${this.turnCounter}`;

    try {
      // Stage all changes (including untracked, excluding .gitignored)
      await this.git(['add', '-A']);

      // Check if there are changes to commit
      const status = await this.git(['status', '--porcelain']);
      if (!status.trim()) {
        // No changes — create a reference to HEAD
        const headHash = (await this.git(['rev-parse', 'HEAD'])).trim();
        const snapshot: GhostSnapshot = {
          id, commitHash: headHash, description: desc,
          timestamp: new Date(), turn: this.turnCounter,
        };
        this.snapshots.push(snapshot);
        return snapshot;
      }

      // Create a ghost commit (won't appear in regular git log)
      const commitHash = (await this.git([
        'commit', '--allow-empty', '-m', `[ghost] ${desc}`,
        '--no-verify', '--no-gpg-sign',
      ])).trim();

      // Extract the actual hash from the commit output
      const hashMatch = commitHash.match(/\[.*\s+([a-f0-9]+)\]/);
      const hash = hashMatch ? hashMatch[1] : (await this.git(['rev-parse', 'HEAD'])).trim();

      // Store as a named ref (not on any branch)
      const refName = `${GHOST_REF_PREFIX}${id}`;
      await this.git(['update-ref', refName, hash]);

      // Soft-reset to unstage (keep changes in working tree for the user)
      await this.git(['reset', '--soft', 'HEAD~1']);

      const snapshot: GhostSnapshot = {
        id, commitHash: hash, description: desc,
        timestamp: new Date(), turn: this.turnCounter,
      };
      this.snapshots.push(snapshot);

      // Prune old snapshots
      if (this.snapshots.length > MAX_GHOST_SNAPSHOTS) {
        const toRemove = this.snapshots.splice(0, this.snapshots.length - MAX_GHOST_SNAPSHOTS);
        for (const old of toRemove) {
          try {
            await this.git(['update-ref', '-d', `${GHOST_REF_PREFIX}${old.id}`]);
          } catch { /* best effort */ }
        }
      }

      logger.debug(`Ghost snapshot created: ${id} (${hash.substring(0, 8)})`);
      return snapshot;
    } catch (err) {
      logger.debug(`Ghost snapshot failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * Restore workspace to a ghost snapshot.
   */
  async restoreSnapshot(snapshotId: string): Promise<boolean> {
    if (!this.isGitRepo) return false;

    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      logger.debug(`Ghost snapshot not found: ${snapshotId}`);
      return false;
    }

    try {
      // Checkout the ghost commit's tree onto the working directory
      await this.git(['checkout', snapshot.commitHash, '--', '.']);
      logger.info(`Restored ghost snapshot: ${snapshotId} (turn ${snapshot.turn})`);
      return true;
    } catch (err) {
      logger.debug(`Ghost restore failed: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /**
   * Undo to the last ghost snapshot (most recent before current turn).
   */
  async undoLastTurn(): Promise<GhostSnapshot | null> {
    if (this.snapshots.length === 0) return null;

    const latest = this.snapshots[this.snapshots.length - 1];
    const restored = await this.restoreSnapshot(latest.id);
    return restored ? latest : null;
  }

  /**
   * List all ghost snapshots.
   */
  listSnapshots(): GhostSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Helper: run a git command.
   */
  private async git(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: this.cwd,
      timeout: SNAPSHOT_TIMEOUT_MS,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    });
    return stdout;
  }
}

/** Singleton */
let _instance: GhostSnapshotManager | null = null;

export function getGhostSnapshotManager(cwd?: string): GhostSnapshotManager {
  if (!_instance) {
    _instance = new GhostSnapshotManager(cwd);
  }
  return _instance;
}

export function resetGhostSnapshotManager(): void {
  _instance = null;
}
