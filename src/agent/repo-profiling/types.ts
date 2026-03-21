/**
 * Types for the repo profiling system.
 */

export interface RepoProfile {
  detectedAt: string;
  languages: string[];
  framework?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'poetry' | 'pip' | 'uv' | 'pdm' | 'pipenv' | 'hatch' | 'cargo' | 'dotnet' | 'go' | 'flutter' | 'dart' | 'swift' | 'cocoapods' | 'gradle';
  commands: {
    test?: string;
    lint?: string;
    format?: string;
    build?: string;
  };
  directories: {
    src?: string;
    tests?: string;
    docs?: string;
  };
  conventions: {
    naming?: string;
    lintRules?: string[];
  };
  /** Compact string injected into agent system prompt */
  contextPack: string;
  /** mtime of the primary config file used for cache invalidation */
  _configMtime?: number;

  // -- Extended fields for smart /init --
  /** Project name from package.json / Cargo.toml / go.mod */
  projectName?: string;
  /** Project description from package.json */
  projectDescription?: string;
  /** ESM or CJS module system */
  moduleType?: 'esm' | 'cjs';
  /** Detected test framework */
  testFramework?: string;
  /** Test setup/config files found */
  testSetupFiles?: string[];
  /** Entry points (main, bin, etc.) */
  entryPoints?: string[];
  /** Notable dependencies (frameworks, ORMs, tools) */
  keyDependencies?: string[];
  /** Linter tool */
  linter?: string;
  /** Code formatter */
  formatter?: string;
  /** Build tool */
  buildTool?: string;
  /** Monorepo detected */
  monorepo?: boolean;
  /** Top-level directories with roles */
  topLevelDirs?: Array<{ name: string; role: string }>;
  /** CI provider */
  ciProvider?: string;
  /** Existing docs (truncated) */
  existingDocs?: {
    readme?: string;
    claudeMd?: string;
  };
  /** Raw npm scripts */
  scripts?: Record<string, string>;
  /** Key subdirectories inside src/ with roles */
  srcSubdirs?: Array<{ name: string; role: string }>;
  /** Docker/container detected */
  containerized?: boolean;
  /** Database providers detected from dependencies */
  databases?: string[];
  /** .env.example or similar template exists */
  envExample?: boolean;
  /** Project scale: file counts */
  scale?: {
    sourceFiles: number;
    testFiles: number;
    totalDirs: number;
  };
  /** Monorepo workspace packages */
  workspaces?: string[];
  /** Notable config files detected (tsconfig, eslint, prettier, etc.) */
  configFiles?: string[];
  /** Has a validate/check script (pre-commit recommended) */
  validateScript?: string;
  /** TypeScript configuration details */
  tsConfig?: {
    strict?: boolean;
    target?: string;
    paths?: boolean;
  };
  /** Required Node.js version */
  nodeVersion?: string;
  /** Git hooks setup (husky, lint-staged, commitlint) */
  gitHooks?: string[];
  /** License type */
  license?: string;
}

/**
 * Mutable context object passed through all profiling phases.
 * Accumulated by language profilers and infrastructure detectors.
 */
export interface ProfilingContext {
  cwd: string;
  // Accumulated by profilers
  languages: string[];
  framework?: string;
  packageManager?: RepoProfile['packageManager'];
  commands: RepoProfile['commands'];
  directories: RepoProfile['directories'];
  conventions: RepoProfile['conventions'];
  configMtime?: number;
  projectName?: string;
  projectDescription?: string;
  moduleType?: 'esm' | 'cjs';
  testFramework?: string;
  testSetupFiles: string[];
  entryPoints: string[];
  keyDependencies: string[];
  linter?: string;
  formatter?: string;
  buildTool?: string;
  monorepo: boolean;
  scripts: Record<string, string>;
  databases: string[];
  topLevelDirs: Array<{ name: string; role: string }>;
  srcSubdirs: Array<{ name: string; role: string }>;
  // Infra results
  ciProvider?: string;
  existingDocs: { readme?: string; claudeMd?: string };
  containerized: boolean;
  envExample: boolean;
  scale?: RepoProfile['scale'];
  workspaces?: string[];
  configFiles: string[];
  validateScript?: string;
  tsConfig?: RepoProfile['tsConfig'];
  nodeVersion?: string;
  gitHooks: string[];
  license?: string;
  // Intermediate cached data (avoid re-reading package.json 4+ times)
  parsedPkg?: Record<string, unknown>;
  allNodeDeps?: Record<string, string>;
  allCsproj?: string[];
  slnFiles?: string[];
  hasPython?: boolean;
  pyprojectPath?: string;
  requirementsPath?: string;
  cargoPath?: string;
  goModPath?: string;
}

export function createProfilingContext(cwd: string): ProfilingContext {
  return {
    cwd,
    languages: [],
    commands: {},
    directories: {},
    conventions: {},
    testSetupFiles: [],
    entryPoints: [],
    keyDependencies: [],
    monorepo: false,
    scripts: {},
    databases: [],
    topLevelDirs: [],
    srcSubdirs: [],
    existingDocs: {},
    containerized: false,
    envExample: false,
    configFiles: [],
    gitHooks: [],
  };
}
