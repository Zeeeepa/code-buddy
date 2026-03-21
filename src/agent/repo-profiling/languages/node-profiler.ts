/**
 * Node.js / TypeScript profiler.
 */

import fs from 'fs';
import path from 'path';
import type { LanguageProfiler } from './language-profiler.js';
import type { ProfilingContext } from '../types.js';
import type { FsHelpers } from '../fs-helpers.js';

export const nodeProfiler: LanguageProfiler = {
  id: 'node',

  detect(ctx: ProfilingContext, fsh: FsHelpers): boolean {
    const pkgJsonPath = path.join(ctx.cwd, 'package.json');
    if (!fsh.exists(pkgJsonPath)) return false;

    ctx.configMtime = fsh.mtime(pkgJsonPath);
    ctx.languages.push('TypeScript', 'JavaScript');

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      ctx.parsedPkg = pkg;

      // Package manager
      if (fsh.exists(path.join(ctx.cwd, 'pnpm-lock.yaml'))) {
        ctx.packageManager = 'pnpm';
      } else if (fsh.exists(path.join(ctx.cwd, 'yarn.lock'))) {
        ctx.packageManager = 'yarn';
      } else {
        ctx.packageManager = 'npm';
      }

      const pm = ctx.packageManager;
      const run = pm === 'npm' ? 'npm run' : pm;

      // Scripts
      const scripts: Record<string, string> = pkg.scripts || {};
      if (scripts.test) ctx.commands.test = `${run} test`;
      if (scripts.lint) ctx.commands.lint = `${run} lint`;
      if (scripts.format) ctx.commands.format = `${run} format`;
      if (scripts.build) ctx.commands.build = `${run} build`;

      // Framework detection from dependencies
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies,
      };
      ctx.allNodeDeps = allDeps;

      // Framework detection -- more specific matches first
      if (allDeps['ink']) ctx.framework = 'Ink (terminal UI)';
      else if (allDeps['next']) ctx.framework = 'Next.js';
      else if (allDeps['expo']) ctx.framework = 'Expo (React Native)';
      else if (allDeps['react-native']) ctx.framework = 'React Native';
      else if (allDeps['@angular/core']) ctx.framework = 'Angular';
      else if (allDeps['vue']) ctx.framework = 'Vue';
      else if (allDeps['react'] || allDeps['react-dom']) ctx.framework = 'React';
      else if (allDeps['express']) ctx.framework = 'Express';
      else if (allDeps['fastify']) ctx.framework = 'Fastify';

      // Naming convention hint
      if (allDeps['eslint'] || pkg.eslintConfig) {
        ctx.conventions.naming = 'camelCase (JS/TS)';
        ctx.conventions.lintRules = ['eslint'];
      }
    } catch {
      // Malformed package.json -- ignore
    }

    return true;
  },

  profile(ctx: ProfilingContext, fsh: FsHelpers): void {
    const pkgJsonPath = path.join(ctx.cwd, 'package.json');
    if (!fsh.exists(pkgJsonPath)) return;

    try {
      const pkg = ctx.parsedPkg || JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      ctx.projectName = ctx.projectName || pkg.name;
      ctx.projectDescription = ctx.projectDescription || pkg.description;
      ctx.moduleType = pkg.type === 'module' ? 'esm' : 'cjs';
      ctx.scripts = pkg.scripts || {};

      // Entry points (deduplicated)
      const epSet = new Set<string>();
      if (pkg.main) epSet.add(pkg.main);
      if (pkg.module) epSet.add(pkg.module);
      if (pkg.bin) {
        if (typeof pkg.bin === 'string') epSet.add(pkg.bin);
        else if (typeof pkg.bin === 'object') {
          for (const v of Object.values(pkg.bin as Record<string, string>)) epSet.add(v);
        }
      }
      ctx.entryPoints.push(...epSet);

      // Monorepo
      if (pkg.workspaces) ctx.monorepo = true;

      // Key dependencies -- filter through notable packages
      const allDeps = ctx.allNodeDeps || { ...pkg.dependencies, ...pkg.devDependencies };
      const notable = new Set([
        'react', 'react-dom', 'react-native', 'expo', 'vue', 'svelte', 'next', 'nuxt', 'angular',
        'express', 'fastify', 'hono', 'koa', 'nestjs', '@nestjs/core',
        'ink', 'commander', 'yargs', 'chalk', 'zod', 'trpc',
        'prisma', '@prisma/client', 'drizzle-orm', 'typeorm', 'sequelize', 'mongoose',
        'vitest', 'jest', 'mocha', 'playwright', 'cypress',
        'typescript', 'esbuild', 'vite', 'webpack', 'rollup', 'turbo',
        'tailwindcss', 'openai', '@anthropic-ai/sdk',
        'electron', 'tauri', 'socket.io', 'ws',
      ]);
      ctx.keyDependencies.push(...Object.keys(allDeps).filter(d => notable.has(d)).slice(0, 15));

      // Test framework
      if (allDeps['vitest']) ctx.testFramework = 'vitest';
      else if (allDeps['jest'] || allDeps['@jest/core']) ctx.testFramework = 'jest';
      else if (allDeps['mocha']) ctx.testFramework = 'mocha';
      else if (allDeps['ava']) ctx.testFramework = 'ava';

      // Linter
      if (allDeps['eslint'] || pkg.eslintConfig) ctx.linter = 'eslint';
      else if (allDeps['biome'] || allDeps['@biomejs/biome']) ctx.linter = 'biome';

      // Formatter
      if (allDeps['prettier']) ctx.formatter = 'prettier';
      else if (allDeps['biome'] || allDeps['@biomejs/biome']) ctx.formatter = ctx.formatter || 'biome';

      // Build tool
      if (allDeps['vite']) ctx.buildTool = 'vite';
      else if (allDeps['esbuild']) ctx.buildTool = 'esbuild';
      else if (allDeps['webpack']) ctx.buildTool = 'webpack';
      else if (allDeps['rollup']) ctx.buildTool = 'rollup';
      else if (allDeps['typescript']) ctx.buildTool = 'tsc';
    } catch {
      // Malformed package.json
    }

    // Monorepo indicators
    if (!ctx.monorepo) {
      for (const f of ['lerna.json', 'nx.json', 'turbo.json', 'pnpm-workspace.yaml']) {
        if (fsh.exists(path.join(ctx.cwd, f))) { ctx.monorepo = true; break; }
      }
    }

    // Bun detection -- must update command prefixes too
    if (fsh.exists(path.join(ctx.cwd, 'bun.lockb')) || fsh.exists(path.join(ctx.cwd, 'bun.lock'))) {
      ctx.packageManager = 'bun';
      for (const key of Object.keys(ctx.commands) as Array<keyof typeof ctx.commands>) {
        if (ctx.commands[key]) {
          ctx.commands[key] = ctx.commands[key]!.replace(/^(npm run|pnpm|yarn)\s/, 'bun ');
        }
      }
    }
  },
};
