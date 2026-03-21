/**
 * Filesystem helpers for repo profiling.
 */

import fs from 'fs';
import path from 'path';

export interface FsHelpers {
  exists(p: string): boolean;
  mtime(p: string): number;
  glob(cwd: string, pattern: string): string[];
  countFilesRecursive(dir: string, pattern: RegExp): number;
}

export function createFsHelpers(): FsHelpers {
  return {
    exists(p: string): boolean {
      return fs.existsSync(p);
    },

    mtime(p: string): number {
      try {
        return fs.statSync(p).mtimeMs;
      } catch {
        return 0;
      }
    },

    glob(cwd: string, pattern: string): string[] {
      try {
        // Simple glob: look for files matching *.ext in cwd
        const ext = pattern.replace('*', '');
        return fs.readdirSync(cwd).filter((f) => f.endsWith(ext));
      } catch {
        return [];
      }
    },

    countFilesRecursive(dir: string, pattern: RegExp): number {
      let count = 0;
      const walk = (d: string) => {
        try {
          for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (pattern.test(entry.name)) count++;
          }
        } catch { /* permission error etc */ }
      };
      walk(dir);
      return count;
    },
  };
}
