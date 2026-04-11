/**
 * GitNexus Manager
 *
 * Handles GitNexus indexing, stats retrieval, and MCP server lifecycle.
 * GitNexus provides code graph analysis (symbols, relations, processes, clusters)
 * and exposes them via an MCP server for agent consumption.
 *
 * Usage:
 *   const mgr = getGitNexusManager('/path/to/repo');
 *   if (mgr.isInstalled() && !mgr.isRepoIndexed()) {
 *     await mgr.analyze();
 *   }
 *   await mgr.startMCPServer();
 */

import { execSync, spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../../utils/logger.js';

export interface GitNexusStats {
  symbols: number;
  relations: number;
  processes: number;
  clusters: number;
  indexed: boolean;
  stale: boolean;
}

const DEFAULT_STATS: GitNexusStats = {
  symbols: 0,
  relations: 0,
  processes: 0,
  clusters: 0,
  indexed: false,
  stale: false,
};

/** Singleton cache keyed by resolved repo path */
const instances = new Map<string, GitNexusManager>();

export class GitNexusManager {
  private repoPath: string;
  private mcpProcess: ChildProcess | null = null;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = path.resolve(repoPath);
  }

  /** Check whether the `gitnexus` CLI is available via npx. */
  isInstalled(): boolean {
    try {
      execSync('npx gitnexus --version', {
        stdio: 'pipe',
        timeout: 10_000,
        cwd: this.repoPath,
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Check whether the repo has been indexed (`.gitnexus/` directory exists). */
  isRepoIndexed(): boolean {
    return fs.existsSync(path.join(this.repoPath, '.gitnexus'));
  }

  /**
   * Run `npx gitnexus analyze` to index the repository.
   *
   * @param options.force  - Re-index even if `.gitnexus/` already exists.
   * @param options.withSkills - Also generate skill annotations.
   */
  async analyze(options: { force?: boolean; withSkills?: boolean } = {}): Promise<void> {
    const args = ['gitnexus', 'analyze'];
    if (options.force) args.push('--force');
    if (options.withSkills) args.push('--with-skills');

    logger.info(`GitNexus: analyzing repo at ${this.repoPath}`, { args });

    return new Promise<void>((resolve, reject) => {
      const child = spawn('npx', args, {
        cwd: this.repoPath,
        stdio: 'pipe',
        shell: true,
      });

      let stderr = '';

      child.stdout?.on('data', (chunk: Buffer) => {
        const line = chunk.toString().trim();
        if (line) logger.debug(`GitNexus analyze: ${line}`);
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        logger.error('GitNexus analyze failed to start', { error: err.message });
        reject(new Error(`GitNexus analyze failed to start: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          logger.info('GitNexus: analysis complete');
          resolve();
        } else {
          const msg = `GitNexus analyze exited with code ${code}: ${stderr.trim()}`;
          logger.error(msg);
          reject(new Error(msg));
        }
      });
    });
  }

  /**
   * Read stats from `.gitnexus/meta.json`.
   * Returns defaults if the index does not exist.
   */
  getStats(): GitNexusStats {
    const metaPath = path.join(this.repoPath, '.gitnexus', 'meta.json');
    if (!fs.existsSync(metaPath)) {
      return { ...DEFAULT_STATS };
    }

    try {
      const raw = fs.readFileSync(metaPath, 'utf-8');
      const meta = JSON.parse(raw) as Record<string, unknown>;

      return {
        symbols: typeof meta.symbols === 'number' ? meta.symbols : 0,
        relations: typeof meta.relations === 'number' ? meta.relations : 0,
        processes: typeof meta.processes === 'number' ? meta.processes : 0,
        clusters: typeof meta.clusters === 'number' ? meta.clusters : 0,
        indexed: true,
        stale: meta.stale === true,
      };
    } catch (err) {
      logger.warn('GitNexus: failed to read meta.json', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { ...DEFAULT_STATS };
    }
  }

  /**
   * Start the GitNexus MCP server as a child process (stdio transport).
   * Only one server is kept alive per manager instance.
   */
  async startMCPServer(): Promise<void> {
    if (this.mcpProcess) {
      logger.debug('GitNexus MCP server already running');
      return;
    }

    logger.info('GitNexus: starting MCP server');

    this.mcpProcess = spawn('npx', ['-y', 'gitnexus@latest', 'mcp'], {
      cwd: this.repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    this.mcpProcess.on('error', (err) => {
      logger.error('GitNexus MCP server error', { error: err.message });
      this.mcpProcess = null;
    });

    this.mcpProcess.on('close', (code) => {
      logger.debug(`GitNexus MCP server exited with code ${code}`);
      this.mcpProcess = null;
    });

    // Give the server a moment to start
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    logger.info('GitNexus MCP server started');
  }

  /** Stop the MCP server if running. */
  stopMCPServer(): void {
    if (this.mcpProcess) {
      logger.debug('GitNexus: stopping MCP server');
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
  }

  /** Get the repo path this manager is bound to. */
  getRepoPath(): string {
    return this.repoPath;
  }

  /** Whether the MCP server process is currently alive. */
  isMCPRunning(): boolean {
    return this.mcpProcess !== null && !this.mcpProcess.killed;
  }

  /** Clean up resources. */
  dispose(): void {
    this.stopMCPServer();
  }
}

/**
 * Get or create a singleton GitNexusManager for the given repo path.
 * Defaults to `process.cwd()` if no path is provided.
 */
export function getGitNexusManager(repoPath?: string): GitNexusManager {
  const resolved = path.resolve(repoPath || process.cwd());
  let manager = instances.get(resolved);
  if (!manager) {
    manager = new GitNexusManager(resolved);
    instances.set(resolved, manager);
  }
  return manager;
}

/** Clear the singleton cache (for testing). */
export function clearGitNexusManagerCache(): void {
  instances.forEach((mgr) => mgr.dispose());
  instances.clear();
}
