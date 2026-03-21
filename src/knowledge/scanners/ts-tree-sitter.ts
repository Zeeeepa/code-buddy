/**
 * TypeScript Tree-sitter Scanner
 *
 * Wraps TreeSitterScanner for TypeScript/JavaScript with automatic
 * fallback to the regex-based TypeScriptScanner.
 */

import type { LanguageScanner, ScanResult } from './types.js';
import { TreeSitterScanner } from './tree-sitter-scanner.js';
import { TypeScriptScanner } from './typescript.js';

export class TypeScriptTreeSitterScanner implements LanguageScanner {
  readonly extensions = ['.ts', '.tsx', '.js', '.jsx'];
  readonly language = 'TypeScript/JavaScript';

  readonly treeSitter = new TreeSitterScanner({
    language: 'TypeScript',
    grammarModule: 'tree-sitter-typescript',
    grammarSubpath: 'typescript',
    classNodeTypes: ['class_declaration'],
    functionNodeTypes: ['function_declaration', 'method_definition', 'arrow_function'],
    callNodeTypes: ['call_expression'],
    importNodeTypes: ['import_statement'],
    inheritanceNodeTypes: ['class_heritage'],
  });

  private regexFallback = new TypeScriptScanner();

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
