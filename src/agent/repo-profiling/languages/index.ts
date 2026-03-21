/**
 * Language profiler registry.
 * Order matters: first detected language wins for packageManager.
 */

import type { LanguageProfiler } from './language-profiler.js';
import { nodeProfiler } from './node-profiler.js';
import { pythonProfiler } from './python-profiler.js';
import { rustProfiler } from './rust-profiler.js';
import { goProfiler } from './go-profiler.js';
import { dotnetProfiler } from './dotnet-profiler.js';
import { flutterProfiler } from './flutter-profiler.js';
import { swiftProfiler } from './swift-profiler.js';
import { kotlinProfiler } from './kotlin-profiler.js';

export { type LanguageProfiler } from './language-profiler.js';

/** Ordered list of language profilers. Priority = packageManager precedence. */
export const LANGUAGE_PROFILERS: readonly LanguageProfiler[] = [
  nodeProfiler,
  pythonProfiler,
  rustProfiler,
  goProfiler,
  dotnetProfiler,
  flutterProfiler,
  swiftProfiler,
  kotlinProfiler,
];
