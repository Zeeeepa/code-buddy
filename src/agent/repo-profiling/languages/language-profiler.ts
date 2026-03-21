/**
 * Interface for language-specific profilers.
 */

import type { FsHelpers } from '../fs-helpers.js';
import type { ProfilingContext } from '../types.js';

export interface LanguageProfiler {
  readonly id: string;
  /** Phase 1: fast detection. Modifies ctx.languages, packageManager, commands. */
  detect(ctx: ProfilingContext, fs: FsHelpers): boolean;
  /** Phase 2: extended profiling. Framework, deps, entry points, etc. */
  profile(ctx: ProfilingContext, fs: FsHelpers): void;
}
