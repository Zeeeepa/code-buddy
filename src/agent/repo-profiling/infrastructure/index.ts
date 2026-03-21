/**
 * Infrastructure profiling: directories + project metadata.
 */

import type { ProfilingContext } from '../types.js';
import type { FsHelpers } from '../fs-helpers.js';
import { profileCommonDirs, profileTopLevelDirs, profileSrcSubdirs, profileDotnetSolutionDirs } from './directory-profiler.js';
import {
  detectCI, detectDocs, detectContainer,
  detectJsDatabases, detectDotnetDatabases,
  detectEnvExample, detectScale, detectWorkspaces,
  detectConfigFiles, detectValidateScript, detectTsConfig,
  detectRuntimeVersions, detectGitHooks, detectLicense,
  detectTestSetupFiles,
} from './project-meta.js';

/**
 * Run all infrastructure profiling (directories + metadata).
 */
export function profileInfrastructure(ctx: ProfilingContext, fsh: FsHelpers): void {
  // Directories
  profileTopLevelDirs(ctx);
  profileSrcSubdirs(ctx);
  profileDotnetSolutionDirs(ctx, fsh);

  // Project metadata
  detectCI(ctx, fsh);
  detectDocs(ctx, fsh);
  detectContainer(ctx, fsh);
  detectJsDatabases(ctx, fsh);
  detectDotnetDatabases(ctx, fsh);
  detectEnvExample(ctx, fsh);
  detectScale(ctx, fsh);
  detectWorkspaces(ctx, fsh);
  detectConfigFiles(ctx, fsh);
  detectValidateScript(ctx);
  detectTsConfig(ctx, fsh);
  detectRuntimeVersions(ctx, fsh);
  detectGitHooks(ctx, fsh);
  detectLicense(ctx, fsh);
  detectTestSetupFiles(ctx, fsh);
}

export { profileCommonDirs } from './directory-profiler.js';
