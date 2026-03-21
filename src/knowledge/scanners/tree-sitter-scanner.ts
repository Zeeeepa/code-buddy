/**
 * Tree-sitter Scanner — Generic AST-based code scanner
 *
 * Provides precise symbol/call extraction using tree-sitter AST parsing.
 * Follows the pattern from src/security/bash-parser.ts: async load + sync API + fallback.
 *
 * tree-sitter is an optionalDependency — if unavailable, callers fall back to regex scanners.
 */

import type { ScanResult, SymbolDef, CallSite, InheritanceInfo } from './types.js';
import { COMMON_CALL_BLACKLIST } from './types.js';

// ============================================================================
// Configuration
// ============================================================================

export interface TreeSitterLanguageConfig {
  /** Human-readable language name */
  language: string;
  /** npm module for the grammar (e.g. 'tree-sitter-typescript') */
  grammarModule: string;
  /** Subpath export within the grammar module (e.g. 'typescript') */
  grammarSubpath?: string;

  /** AST node types for class declarations */
  classNodeTypes: string[];
  /** AST node types for function/method declarations */
  functionNodeTypes: string[];
  /** AST node types for call expressions */
  callNodeTypes: string[];
  /** AST node types for import statements */
  importNodeTypes: string[];
  /** AST node types for inheritance clauses */
  inheritanceNodeTypes: string[];
}

// ============================================================================
// Tree-sitter Scanner
// ============================================================================

export class TreeSitterScanner {
  private parser: any = null;
  private ready = false;

  constructor(private config: TreeSitterLanguageConfig) {}

  /**
   * Attempt to load tree-sitter and the language grammar.
   * Returns true if successfully initialized.
   */
  async initialize(): Promise<boolean> {
    try {
      const Parser = (await import('tree-sitter')).default;
      const langModule = await import(this.config.grammarModule);

      this.parser = new Parser();

      // Grammar may be a default export or a named subpath
      const grammar = this.config.grammarSubpath
        ? (langModule[this.config.grammarSubpath] ?? langModule.default?.[this.config.grammarSubpath] ?? langModule.default)
        : (langModule.default ?? langModule);

      this.parser.setLanguage(grammar);
      this.ready = true;
      return true;
    } catch {
      this.ready = false;
      return false;
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  /**
   * Parse file content and extract symbols, calls, and inheritance.
   * Returns the same ScanResult as regex scanners for drop-in compatibility.
   */
  scanFile(content: string, moduleId: string): ScanResult {
    if (!this.ready || !this.parser) {
      throw new Error('TreeSitterScanner not initialized');
    }

    const tree = this.parser.parse(content);
    const symbols: SymbolDef[] = [];
    const calls: CallSite[] = [];
    const inheritance: InheritanceInfo[] = [];

    // Track current scope for call attribution
    let currentClassName: string | null = null;
    let currentFunctionFqn: string | null = null;

    const walk = (node: any) => {
      const type = node.type;

      // --- Class declarations ---
      if (this.config.classNodeTypes.includes(type)) {
        const nameNode = node.childForFieldName('name') ?? this.findChildByType(node, 'type_identifier');
        if (nameNode) {
          const className = nameNode.text;
          const prevClass = currentClassName;
          currentClassName = className;

          symbols.push({
            fqn: `cls:${className}`,
            name: className,
            kind: 'class',
            module: moduleId,
            line: node.startPosition.row + 1,
          });

          // Inheritance
          const info: InheritanceInfo = { className };
          const heritage = this.findChildByType(node, 'class_heritage');
          if (heritage) {
            const extendsClause = this.findChildByType(heritage, 'extends_clause');
            if (extendsClause) {
              const extendsName = this.findChildByType(extendsClause, 'identifier')
                ?? this.findChildByType(extendsClause, 'type_identifier');
              if (extendsName) info.extends = extendsName.text;
            }
            const implementsClauses = this.findChildrenByType(heritage, 'implements_clause');
            if (implementsClauses.length > 0) {
              const impls: string[] = [];
              for (const impl of implementsClauses) {
                for (const child of impl.namedChildren) {
                  if (child.type === 'type_identifier' || child.type === 'identifier') {
                    impls.push(child.text);
                  } else if (child.type === 'generic_type') {
                    const name = this.findChildByType(child, 'type_identifier');
                    if (name) impls.push(name.text);
                  }
                }
              }
              if (impls.length > 0) info.implements = impls;
            }
          }
          if (info.extends || info.implements?.length) inheritance.push(info);

          // Walk children for methods
          if (node.namedChildren) {
            for (const child of node.namedChildren) {
              walk(child);
            }
          }
          currentClassName = prevClass;
          return; // Already walked children
        }
      }

      // --- Function / Method declarations ---
      if (this.config.functionNodeTypes.includes(type)) {
        const nameNode = node.childForFieldName('name')
          ?? this.findChildByType(node, 'property_identifier');

        if (nameNode) {
          const funcName = nameNode.text;
          if (!COMMON_CALL_BLACKLIST.has(funcName) && funcName !== 'constructor') {
            const kind = currentClassName ? 'method' : 'function';
            const fqn = currentClassName ? `fn:${currentClassName}.${funcName}` : `fn:${funcName}`;
            const params = this.extractParams(node);
            const returnType = this.extractReturnType(node);

            symbols.push({
              fqn,
              name: funcName,
              kind,
              module: moduleId,
              className: currentClassName ?? undefined,
              line: node.startPosition.row + 1,
              params,
              returnType,
            });

            const prevFqn = currentFunctionFqn;
            currentFunctionFqn = fqn;

            for (const child of node.namedChildren) {
              walk(child);
            }

            currentFunctionFqn = prevFqn;
            return;
          }
        }

        // Arrow function via variable_declarator
        if (type === 'arrow_function' && node.parent?.type === 'variable_declarator') {
          const varNameNode = node.parent.childForFieldName('name');
          if (varNameNode) {
            const funcName = varNameNode.text;
            const fqn = currentClassName ? `fn:${currentClassName}.${funcName}` : `fn:${funcName}`;
            const params = this.extractParams(node);
            const returnType = this.extractReturnType(node);

            symbols.push({
              fqn,
              name: funcName,
              kind: currentClassName ? 'method' : 'function',
              module: moduleId,
              className: currentClassName ?? undefined,
              line: node.startPosition.row + 1,
              params,
              returnType,
            });

            const prevFqn = currentFunctionFqn;
            currentFunctionFqn = fqn;

            for (const child of node.namedChildren) {
              walk(child);
            }

            currentFunctionFqn = prevFqn;
            return;
          }
        }
      }

      // --- Call expressions ---
      if (this.config.callNodeTypes.includes(type) && currentFunctionFqn) {
        const funcChild = node.childForFieldName('function');
        if (funcChild) {
          if (funcChild.type === 'member_expression') {
            const prop = funcChild.childForFieldName('property');
            const obj = funcChild.childForFieldName('object');
            if (prop && !COMMON_CALL_BLACKLIST.has(prop.text)) {
              const receiverClass = obj?.type === 'identifier' && /^[A-Z]/.test(obj.text) ? obj.text
                : obj?.type === 'this_expression' ? (currentClassName ?? undefined)
                : undefined;
              calls.push({
                callerFqn: currentFunctionFqn,
                calleeName: prop.text,
                isMethodCall: true,
                receiverClass,
              });
            }
          } else if (funcChild.type === 'identifier') {
            const name = funcChild.text;
            if (!COMMON_CALL_BLACKLIST.has(name) && name.length > 2) {
              calls.push({
                callerFqn: currentFunctionFqn,
                calleeName: name,
                isMethodCall: false,
              });
            }
          }
        }
      }

      // Walk children
      if (node.namedChildren) {
        for (const child of node.namedChildren) {
          walk(child);
        }
      }
    };

    walk(tree.rootNode);

    return { symbols, calls, inheritance };
  }

  // --- Helpers ---

  private findChildByType(node: any, type: string): any | null {
    if (!node.namedChildren) return null;
    for (const child of node.namedChildren) {
      if (child.type === type) return child;
    }
    return null;
  }

  private findChildrenByType(node: any, type: string): any[] {
    if (!node.namedChildren) return [];
    const results: any[] = [];
    for (const child of node.namedChildren) {
      if (child.type === type) results.push(child);
    }
    return results;
  }

  private extractParams(node: any): string {
    const paramsNode = node.childForFieldName('parameters')
      ?? this.findChildByType(node, 'formal_parameters');
    if (paramsNode) {
      return paramsNode.text;
    }
    return '()';
  }

  private extractReturnType(node: any): string | undefined {
    const retNode = node.childForFieldName('return_type')
      ?? this.findChildByType(node, 'type_annotation');
    if (retNode) {
      return retNode.text.replace(/^:\s*/, '').trim() || undefined;
    }
    return undefined;
  }
}
