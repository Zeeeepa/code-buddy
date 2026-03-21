/**
 * Public API for repo profiling.
 */

export { RepoProfile } from './types.js';
export { RepoProfiler } from './repo-profiler.js';

import { RepoProfiler } from './repo-profiler.js';

/** Singleton instance */
let _instance: RepoProfiler | null = null;

export function getRepoProfiler(cwd?: string): RepoProfiler {
  if (!_instance || cwd) {
    _instance = new RepoProfiler(cwd);
  }
  return _instance;
}
