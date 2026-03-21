/**
 * Language Scanner Registry
 *
 * Maps file extensions to the appropriate language scanner.
 * Tree-sitter scanners are loaded async in the background and swap in when ready.
 */

import { TypeScriptScanner } from './typescript.js';
import { PythonScanner } from './python.js';
import { GoScanner } from './go.js';
import { RustScanner } from './rust.js';
import { JavaScanner } from './java.js';
import type { LanguageScanner } from './types.js';

const scanners: LanguageScanner[] = [
  new TypeScriptScanner(),
  new PythonScanner(),
  new GoScanner(),
  new RustScanner(),
  new JavaScanner(),
];

const extToScanner = new Map<string, LanguageScanner>();
for (const scanner of scanners) {
  for (const ext of scanner.extensions) {
    extToScanner.set(ext, scanner);
  }
}

// Async swap: load tree-sitter scanners in background, replace when ready
// Zero breaking change — getScannerForExt() always returns a valid scanner
let treeSitterInitialized = false;

(async () => {
  // Load tree-sitter scanners in background for each supported language.
  // If a grammar module is unavailable, the regex scanner remains active.
  const loaders: Array<() => Promise<void>> = [
    // TypeScript/JavaScript
    async () => {
      const { TypeScriptTreeSitterScanner } = await import('./ts-tree-sitter.js');
      const scanner = new TypeScriptTreeSitterScanner();
      const ok = await scanner.treeSitter.initialize();
      if (ok && scanner.treeSitter.isReady()) {
        for (const ext of scanner.extensions) extToScanner.set(ext, scanner);
        treeSitterInitialized = true;
      }
    },
    // Python
    async () => {
      const { PythonTreeSitterScanner } = await import('./py-tree-sitter.js');
      const scanner = new PythonTreeSitterScanner();
      const ok = await scanner.treeSitter.initialize();
      if (ok && scanner.treeSitter.isReady()) {
        for (const ext of scanner.extensions) extToScanner.set(ext, scanner);
        treeSitterInitialized = true;
      }
    },
  ];

  await Promise.allSettled(loaders.map(fn => fn()));
})();

/**
 * Get the appropriate scanner for a file extension.
 * Returns null if the language is not supported.
 */
export function getScannerForExt(ext: string): LanguageScanner | null {
  return extToScanner.get(ext.toLowerCase()) ?? null;
}

/**
 * Get all supported file extensions.
 */
export function getSupportedExtensions(): Set<string> {
  return new Set(extToScanner.keys());
}

/**
 * Get all registered scanners.
 */
export function getAllScanners(): LanguageScanner[] {
  return [...scanners];
}

/**
 * Whether tree-sitter scanners have been loaded.
 */
export function isTreeSitterReady(): boolean {
  return treeSitterInitialized;
}

// Re-export types
export type { LanguageScanner, SymbolDef, CallSite, ScanResult, InheritanceInfo } from './types.js';
