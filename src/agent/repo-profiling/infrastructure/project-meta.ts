/**
 * Project metadata detection: CI, docs, container, DB, scale, config, etc.
 */

import fs from 'fs';
import path from 'path';
import type { ProfilingContext, RepoProfile } from '../types.js';
import type { FsHelpers } from '../fs-helpers.js';

export function detectCI(ctx: ProfilingContext, fsh: FsHelpers): void {
  if (fsh.exists(path.join(ctx.cwd, '.github', 'workflows'))) ctx.ciProvider = 'GitHub Actions';
  else if (fsh.exists(path.join(ctx.cwd, '.gitlab-ci.yml'))) ctx.ciProvider = 'GitLab CI';
  else if (fsh.exists(path.join(ctx.cwd, '.circleci'))) ctx.ciProvider = 'CircleCI';
  else if (fsh.exists(path.join(ctx.cwd, 'Jenkinsfile'))) ctx.ciProvider = 'Jenkins';
}

export function detectDocs(ctx: ProfilingContext, fsh: FsHelpers): void {
  const readmePath = path.join(ctx.cwd, 'README.md');
  if (fsh.exists(readmePath)) {
    try {
      const content = fs.readFileSync(readmePath, 'utf-8');
      let excerpt = content.slice(0, 500);
      const lastDot = excerpt.lastIndexOf('.');
      if (lastDot > 100) excerpt = excerpt.slice(0, lastDot + 1);
      ctx.existingDocs.readme = excerpt.trim();
    } catch { /* ignore */ }
  }
  const claudeMdPath = path.join(ctx.cwd, 'CLAUDE.md');
  if (fsh.exists(claudeMdPath)) {
    try {
      ctx.existingDocs.claudeMd = fs.readFileSync(claudeMdPath, 'utf-8').slice(0, 1000).trim();
    } catch { /* ignore */ }
  }
}

export function detectContainer(ctx: ProfilingContext, fsh: FsHelpers): void {
  for (const f of ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml', '.dockerignore']) {
    if (fsh.exists(path.join(ctx.cwd, f))) { ctx.containerized = true; break; }
  }
}

export function detectJsDatabases(ctx: ProfilingContext, fsh: FsHelpers): void {
  const pkgJsonPath = path.join(ctx.cwd, 'package.json');
  if (!fsh.exists(pkgJsonPath)) return;

  try {
    const pkg = ctx.parsedPkg || JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const allDeps = { ...(pkg as Record<string, unknown>).dependencies as Record<string, string>, ...(pkg as Record<string, unknown>).devDependencies as Record<string, string> };
    const dbMap: Record<string, string> = {
      'pg': 'PostgreSQL', 'postgres': 'PostgreSQL', '@prisma/client': 'Prisma',
      'mysql2': 'MySQL', 'mysql': 'MySQL',
      'better-sqlite3': 'SQLite', 'sqlite3': 'SQLite',
      'mongodb': 'MongoDB', 'mongoose': 'MongoDB',
      'redis': 'Redis', 'ioredis': 'Redis',
      'drizzle-orm': 'Drizzle ORM', 'typeorm': 'TypeORM', 'sequelize': 'Sequelize',
    };
    const seen = new Set<string>();
    for (const [dep, label] of Object.entries(dbMap)) {
      if (allDeps[dep] && !seen.has(label)) { ctx.databases.push(label); seen.add(label); }
    }
  } catch { /* ignore */ }
}

export function detectDotnetDatabases(ctx: ProfilingContext, fsh: FsHelpers): void {
  const allCsproj = ctx.allCsproj || [];
  if (!ctx.languages.includes('C#')) return;

  const dotnetDbMap: Record<string, string> = {
    'Npgsql': 'PostgreSQL', 'Npgsql.EntityFrameworkCore.PostgreSQL': 'PostgreSQL',
    'Microsoft.EntityFrameworkCore.SqlServer': 'SQL Server',
    'Microsoft.EntityFrameworkCore.Sqlite': 'SQLite',
    'Pomelo.EntityFrameworkCore.MySql': 'MySQL',
    'MongoDB.Driver': 'MongoDB',
    'StackExchange.Redis': 'Redis',
    'Microsoft.EntityFrameworkCore.Cosmos': 'CosmosDB',
  };
  const seen = new Set(ctx.databases);
  for (const csproj of allCsproj) {
    try {
      const xml = fs.readFileSync(path.join(ctx.cwd, csproj), 'utf-8');
      for (const [pkg, label] of Object.entries(dotnetDbMap)) {
        if (xml.includes(`Include="${pkg}"`) && !seen.has(label)) {
          ctx.databases.push(label); seen.add(label);
        }
      }
    } catch { /* ignore */ }
  }
}

export function detectEnvExample(ctx: ProfilingContext, fsh: FsHelpers): void {
  for (const f of ['.env.example', '.env.template', '.env.sample', '.env.local.example']) {
    if (fsh.exists(path.join(ctx.cwd, f))) { ctx.envExample = true; break; }
  }
}

export function detectScale(ctx: ProfilingContext, fsh: FsHelpers): void {
  try {
    const srcDir = path.join(ctx.cwd, ctx.directories.src || 'src');
    const testDir = path.join(ctx.cwd, ctx.directories.tests || 'tests');
    const sourceFiles = fsh.exists(srcDir) ? fsh.countFilesRecursive(srcDir, /\.(ts|tsx|js|jsx|py|rs|go|java|cs|rb|php|swift|kt)$/) : 0;
    const testFiles = (fsh.exists(testDir) ? fsh.countFilesRecursive(testDir, /\.(test|spec)\.(ts|tsx|js|jsx)$/) : 0)
      + (fsh.exists(srcDir) ? fsh.countFilesRecursive(srcDir, /\.(test|spec)\.(ts|tsx|js|jsx)$/) : 0);
    let totalDirs = 0;
    try {
      for (const entry of fs.readdirSync(ctx.cwd, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
          totalDirs++;
        }
      }
    } catch { /* ignore */ }
    ctx.scale = { sourceFiles, testFiles, totalDirs };
  } catch { /* ignore */ }
}

export function detectWorkspaces(ctx: ProfilingContext, fsh: FsHelpers): void {
  if (!ctx.monorepo) return;

  const pkgJsonPath = path.join(ctx.cwd, 'package.json');
  // Try package.json workspaces first
  if (fsh.exists(pkgJsonPath)) {
    try {
      const pkg = ctx.parsedPkg || JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      const ws: string[] | { packages?: string[] } = (pkg as Record<string, unknown>).workspaces as string[] | { packages?: string[] };
      if (Array.isArray(ws)) {
        ctx.workspaces = ws;
      } else if (ws?.packages && Array.isArray(ws.packages)) {
        ctx.workspaces = ws.packages;
      }
    } catch { /* ignore */ }
  }
  // Try pnpm-workspace.yaml
  if (!ctx.workspaces) {
    const pnpmWs = path.join(ctx.cwd, 'pnpm-workspace.yaml');
    if (fsh.exists(pnpmWs)) {
      try {
        const content = fs.readFileSync(pnpmWs, 'utf-8');
        const matches = content.match(/^\s*-\s+'([^']+)'|^\s*-\s+"([^"]+)"|^\s*-\s+(\S+)/gm);
        if (matches) {
          ctx.workspaces = matches.map(m => m.replace(/^\s*-\s+['"]?/, '').replace(/['"]$/, '').trim());
        }
      } catch { /* ignore */ }
    }
  }
}

export function detectConfigFiles(ctx: ProfilingContext, fsh: FsHelpers): void {
  const configCandidates = [
    'tsconfig.json', '.eslintrc.json', '.eslintrc.js', 'eslint.config.js', 'eslint.config.mjs',
    '.prettierrc', '.prettierrc.json', 'prettier.config.js',
    '.editorconfig', '.nvmrc', '.node-version',
    'vitest.config.ts', 'vitest.config.js', 'jest.config.ts', 'jest.config.js',
    'tailwind.config.js', 'tailwind.config.ts',
    'vite.config.ts', 'vite.config.js',
    'webpack.config.js', 'rollup.config.js',
    'turbo.json', 'nx.json', 'lerna.json',
    'global.json', 'Directory.Build.props', 'nuget.config',
    'Cargo.toml', 'rust-toolchain.toml',
    'pyproject.toml', 'setup.cfg', '.flake8', 'ruff.toml',
  ];
  for (const f of configCandidates) {
    if (fsh.exists(path.join(ctx.cwd, f))) ctx.configFiles.push(f);
  }
}

export function detectValidateScript(ctx: ProfilingContext): void {
  const pm = ctx.packageManager;
  const run = pm === 'npm' ? 'npm run' : (pm || 'npm run');
  if (ctx.scripts['validate']) ctx.validateScript = `${run} validate`;
  else if (ctx.scripts['check']) ctx.validateScript = `${run} check`;
  else if (ctx.scripts['verify']) ctx.validateScript = `${run} verify`;
}

export function detectTsConfig(ctx: ProfilingContext, fsh: FsHelpers): void {
  const tsconfigPath = path.join(ctx.cwd, 'tsconfig.json');
  if (!fsh.exists(tsconfigPath)) return;

  try {
    // Strip JSON-with-comments
    const raw = fs.readFileSync(tsconfigPath, 'utf-8')
      .split('\n')
      .map(line => {
        let inStr = false;
        let strChar = '';
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inStr) {
            if (ch === '\\') { i++; continue; }
            if (ch === strChar) inStr = false;
          } else {
            if (ch === '"' || ch === "'") { inStr = true; strChar = ch; }
            else if (ch === '/' && line[i + 1] === '/') return line.slice(0, i);
          }
        }
        return line;
      })
      .join('\n')
      .replace(/,(\s*[}\]])/g, '$1');
    const tc = JSON.parse(raw);
    const co = tc.compilerOptions || {};
    ctx.tsConfig = {
      strict: co.strict === true,
      target: co.target,
      paths: !!(co.paths && Object.keys(co.paths).length > 0),
    };
  } catch { /* malformed tsconfig */ }
}

export function detectRuntimeVersions(ctx: ProfilingContext, fsh: FsHelpers): void {
  const pkgJsonPath = path.join(ctx.cwd, 'package.json');

  // Node.js
  for (const f of ['.nvmrc', '.node-version']) {
    const p = path.join(ctx.cwd, f);
    if (fsh.exists(p)) {
      try {
        ctx.nodeVersion = fs.readFileSync(p, 'utf-8').trim().replace(/^v/, '');
        break;
      } catch { /* ignore */ }
    }
  }
  if (!ctx.nodeVersion && fsh.exists(pkgJsonPath)) {
    try {
      const pkg = ctx.parsedPkg || JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if ((pkg as Record<string, unknown>).engines) {
        const engines = (pkg as Record<string, unknown>).engines as Record<string, string>;
        if (engines.node) ctx.nodeVersion = engines.node;
      }
    } catch { /* ignore */ }
  }

  // Python version
  if (!ctx.nodeVersion && ctx.hasPython && ctx.pyprojectPath && fsh.exists(ctx.pyprojectPath)) {
    try {
      const pyContent = fs.readFileSync(ctx.pyprojectPath, 'utf-8');
      const pyReq = pyContent.match(/requires-python\s*=\s*"([^"]+)"/);
      if (pyReq) ctx.nodeVersion = `Python ${pyReq[1]}`;
    } catch { /* ignore */ }
    if (!ctx.nodeVersion) {
      const pvFile = path.join(ctx.cwd, '.python-version');
      if (fsh.exists(pvFile)) {
        try {
          ctx.nodeVersion = `Python ${fs.readFileSync(pvFile, 'utf-8').trim()}`;
        } catch { /* ignore */ }
      }
    }
  }

  // Rust version
  if (!ctx.nodeVersion && ctx.languages.includes('Rust')) {
    const rtFile = path.join(ctx.cwd, 'rust-toolchain.toml');
    if (fsh.exists(rtFile)) {
      try {
        const rt = fs.readFileSync(rtFile, 'utf-8');
        const ch = rt.match(/channel\s*=\s*"([^"]+)"/);
        if (ch) ctx.nodeVersion = `Rust ${ch[1]}`;
      } catch { /* ignore */ }
    }
    if (!ctx.nodeVersion && ctx.cargoPath && fsh.exists(ctx.cargoPath)) {
      try {
        const cargo = fs.readFileSync(ctx.cargoPath, 'utf-8');
        const msrv = cargo.match(/rust-version\s*=\s*"([^"]+)"/);
        if (msrv) ctx.nodeVersion = `Rust >= ${msrv[1]}`;
      } catch { /* ignore */ }
    }
  }
}

export function detectGitHooks(ctx: ProfilingContext, fsh: FsHelpers): void {
  const pkgJsonPath = path.join(ctx.cwd, 'package.json');
  if (!fsh.exists(pkgJsonPath)) return;

  try {
    const pkg = ctx.parsedPkg || JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
    const allDeps = { ...(pkg as Record<string, unknown>).dependencies as Record<string, string>, ...(pkg as Record<string, unknown>).devDependencies as Record<string, string> };
    if (allDeps['husky'] || fsh.exists(path.join(ctx.cwd, '.husky'))) ctx.gitHooks.push('husky');
    if (allDeps['lint-staged'] || (pkg as Record<string, unknown>)['lint-staged']) ctx.gitHooks.push('lint-staged');
    if (allDeps['@commitlint/cli'] || fsh.exists(path.join(ctx.cwd, 'commitlint.config.js')) || fsh.exists(path.join(ctx.cwd, '.commitlintrc.json'))) ctx.gitHooks.push('commitlint');
    if (allDeps['simple-git-hooks'] || (pkg as Record<string, unknown>)['simple-git-hooks']) ctx.gitHooks.push('simple-git-hooks');
    if (allDeps['lefthook'] || fsh.exists(path.join(ctx.cwd, 'lefthook.yml'))) ctx.gitHooks.push('lefthook');
  } catch { /* ignore */ }
}

export function detectLicense(ctx: ProfilingContext, fsh: FsHelpers): void {
  const pkgJsonPath = path.join(ctx.cwd, 'package.json');
  if (fsh.exists(pkgJsonPath)) {
    try {
      const pkg = ctx.parsedPkg || JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (typeof (pkg as Record<string, unknown>).license === 'string') ctx.license = (pkg as Record<string, unknown>).license as string;
    } catch { /* ignore */ }
  }
  if (!ctx.license) {
    for (const f of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md']) {
      const p = path.join(ctx.cwd, f);
      if (fsh.exists(p)) {
        try {
          const content = fs.readFileSync(p, 'utf-8').slice(0, 200).toLowerCase();
          if (content.includes('mit license') || content.includes('permission is hereby granted')) ctx.license = 'MIT';
          else if (content.includes('apache license')) ctx.license = 'Apache-2.0';
          else if (content.includes('gnu general public license')) ctx.license = 'GPL';
          else if (content.includes('bsd')) ctx.license = 'BSD';
          else if (content.includes('isc license')) ctx.license = 'ISC';
          else ctx.license = 'Custom';
        } catch { /* ignore */ }
        break;
      }
    }
  }
}

export function detectTestSetupFiles(ctx: ProfilingContext, fsh: FsHelpers): void {
  for (const f of ['vitest.setup.ts', 'vitest.setup.js', 'vitest.config.ts', 'vitest.config.js',
    'jest.setup.ts', 'jest.setup.js', 'jest.config.ts', 'jest.config.js',
    'setupTests.ts', 'setupTests.js']) {
    if (fsh.exists(path.join(ctx.cwd, f))) ctx.testSetupFiles.push(f);
  }
}
