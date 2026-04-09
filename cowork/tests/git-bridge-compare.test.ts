import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GitBridge } from '../src/main/git/git-bridge';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

const tmpDirs: string[] = [];

describe('GitBridge.compareCommits', () => {
  afterEach(() => {
    while (tmpDirs.length > 0) {
      const dir = tmpDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports create, modify, and delete changes between two commits', () => {
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'cowork-git-compare-'));
    tmpDirs.push(cwd);

    git(cwd, ['init']);
    git(cwd, ['config', 'user.name', 'Cowork Tests']);
    git(cwd, ['config', 'user.email', 'cowork-tests@example.com']);

    writeFileSync(path.join(cwd, 'alpha.txt'), 'one\ntwo\n', 'utf8');
    writeFileSync(path.join(cwd, 'gamma.txt'), 'legacy\n', 'utf8');
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'initial']);
    const firstCommit = git(cwd, ['rev-parse', 'HEAD']);

    writeFileSync(path.join(cwd, 'alpha.txt'), 'one\nchanged\nthree\n', 'utf8');
    writeFileSync(path.join(cwd, 'beta.txt'), 'new file\n', 'utf8');
    git(cwd, ['rm', 'gamma.txt']);
    git(cwd, ['add', '.']);
    git(cwd, ['commit', '-m', 'second']);
    const secondCommit = git(cwd, ['rev-parse', 'HEAD']);

    const bridge = new GitBridge();
    const diffs = bridge.compareCommits(cwd, firstCommit, secondCommit);

    expect(diffs).toHaveLength(3);
    expect(diffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'alpha.txt',
          action: 'modify',
          linesAdded: 2,
          linesRemoved: 1,
        }),
        expect.objectContaining({
          path: 'beta.txt',
          action: 'create',
          linesAdded: 1,
        }),
        expect.objectContaining({
          path: 'gamma.txt',
          action: 'delete',
          linesRemoved: 1,
        }),
      ])
    );

    const alphaDiff = diffs.find((diff) => diff.path === 'alpha.txt');
    expect(alphaDiff?.excerpt).toContain('@@');
  });
});
