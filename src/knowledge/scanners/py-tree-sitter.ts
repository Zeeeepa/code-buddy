/**
 * Python Tree-sitter Scanner
 *
 * Wraps TreeSitterScanner for Python with automatic
 * fallback to the regex-based PythonScanner.
 */

import type { LanguageScanner, ScanResult } from './types.js';
import { TreeSitterScanner } from './tree-sitter-scanner.js';
import { PythonScanner } from './python.js';

export class PythonTreeSitterScanner implements LanguageScanner {
  readonly extensions = ['.py', '.pyi'];
  readonly language = 'Python';

  readonly treeSitter = new TreeSitterScanner({
    language: 'Python',
    grammarModule: 'tree-sitter-python',
    classNodeTypes: ['class_definition'],
    functionNodeTypes: ['function_definition'],
    callNodeTypes: ['call'],
    importNodeTypes: ['import_statement', 'import_from_statement'],
    inheritanceNodeTypes: ['argument_list'], // Python: class Foo(Base, Mixin)
  });

  private regexFallback = new PythonScanner();

  scanFile(content: string, moduleId: string): ScanResult {
    if (this.treeSitter.isReady()) {
      try {
        return this.treeSitter.scanFile(content, moduleId);
      } catch {
        // Fall through to regex
      }
    }
    return this.regexFallback.scanFile(content, moduleId);
  }
}
