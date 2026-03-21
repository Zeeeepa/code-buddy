/**
 * Go profiler.
 */

import fs from 'fs';
import path from 'path';
import type { LanguageProfiler } from './language-profiler.js';
import type { ProfilingContext } from '../types.js';
import type { FsHelpers } from '../fs-helpers.js';

export const goProfiler: LanguageProfiler = {
  id: 'go',

  detect(ctx: ProfilingContext, fsh: FsHelpers): boolean {
    const goModPath = path.join(ctx.cwd, 'go.mod');
    if (!fsh.exists(goModPath)) return false;

    ctx.goModPath = goModPath;
    ctx.languages.push('Go');
    ctx.packageManager = 'go';
    ctx.configMtime = ctx.configMtime || fsh.mtime(goModPath);
    ctx.commands.test = ctx.commands.test || 'go test ./...';
    ctx.commands.build = ctx.commands.build || 'go build ./...';
    ctx.commands.lint = ctx.commands.lint || 'golangci-lint run';
    ctx.commands.format = ctx.commands.format || 'gofmt -w .';

    return true;
  },

  profile(ctx: ProfilingContext, _fsh: FsHelpers): void {
    if (!ctx.languages.includes('Go')) return;
    if (ctx.projectName) return;

    try {
      const goModContent = fs.readFileSync(ctx.goModPath || path.join(ctx.cwd, 'go.mod'), 'utf-8');
      const modMatch = goModContent.match(/^module\s+(\S+)/m);
      if (modMatch) ctx.projectName = modMatch[1];
    } catch { /* ignore */ }
  },
};
