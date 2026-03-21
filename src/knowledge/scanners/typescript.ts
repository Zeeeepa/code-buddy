/**
 * TypeScript / JavaScript Scanner
 */

import type { LanguageScanner, ScanResult, SymbolDef, CallSite, InheritanceInfo } from './types.js';
import { COMMON_CALL_BLACKLIST, createScopeTracker, updateBraceDepth, extractMultiLineParams, extractReturnTypeAfterParams } from './types.js';

const TS_BLACKLIST = new Set([
  ...COMMON_CALL_BLACKLIST,
  'console', 'Math', 'JSON', 'Object', 'Array', 'String', 'Number',
  'Boolean', 'Date', 'Promise', 'Map', 'Set', 'RegExp', 'Error',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI',
  'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach',
  'beforeAll', 'afterAll', 'vi', 'jest',
]);

const RE_THIS_CALL = /this\.(\w+)\s*\(/g;
const RE_STATIC_CALL = /([A-Z]\w+)\.(\w+)\s*\(/g;
const RE_CALL = /(?:^|[^.\w])(\w+)\s*\(/g;

export class TypeScriptScanner implements LanguageScanner {
  readonly extensions = ['.ts', '.tsx', '.js', '.jsx'];
  readonly language = 'TypeScript/JavaScript';

  scanFile(content: string, moduleId: string): ScanResult {
    const symbols: SymbolDef[] = [];
    const calls: CallSite[] = [];
    const inheritance: InheritanceInfo[] = [];

    const tracker = createScopeTracker();
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      updateBraceDepth(line, tracker);

      // Class declaration
      const classMatch = line.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+(\w+)(?:<[^>]*>)?)?(?:\s+implements\s+([\w,\s<>]+))?/);
      if (classMatch && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')) {
        tracker.currentClassName = classMatch[1];
        tracker.classStartDepth = tracker.braceDepth - 1;
        symbols.push({
          fqn: `cls:${classMatch[1]}`,
          name: classMatch[1],
          kind: 'class',
          module: moduleId,
          line: lineNum,
        });
        // Inheritance
        const info: InheritanceInfo = { className: classMatch[1] };
        if (classMatch[2]) info.extends = classMatch[2];
        if (classMatch[3]) {
          info.implements = classMatch[3].split(',').map(s => s.trim().replace(/<.*>$/, '')).filter(s => s && /^[A-Z]/.test(s));
        }
        if (info.extends || info.implements?.length) inheritance.push(info);
      }

      // Method inside class
      if (tracker.currentClassName) {
        const methodMatch = line.match(/^\s+(?:(?:public|private|protected|static|async|override|readonly|abstract|get|set)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+?))?(?:\s*\{|;)/);
        if (methodMatch && !TS_BLACKLIST.has(methodMatch[1]) && methodMatch[1] !== 'constructor') {
          const methodName = methodMatch[1];
          const fqn = `fn:${tracker.currentClassName}.${methodName}`;
          const rawParams = methodMatch[2]?.trim() || '';
          const rawReturn = methodMatch[3]?.trim() || '';
          symbols.push({
            fqn,
            name: methodName,
            kind: 'method',
            module: moduleId,
            className: tracker.currentClassName,
            line: lineNum,
            params: rawParams ? `(${rawParams})` : '()',
            returnType: rawReturn || undefined,
          });
          tracker.currentFunctionFqn = fqn;
          tracker.funcStartDepth = tracker.braceDepth - 1;
        }
        // Fallback: multi-line params
        if (!methodMatch) {
          const simpleMethodMatch = line.match(/^\s+(?:(?:public|private|protected|static|async|override|readonly|abstract|get|set)\s+)*(\w+)\s*(?:<[^>]*>)?\s*\(/);
          if (simpleMethodMatch && !TS_BLACKLIST.has(simpleMethodMatch[1]) && simpleMethodMatch[1] !== 'constructor') {
            const methodName = simpleMethodMatch[1];
            const fqn = `fn:${tracker.currentClassName}.${methodName}`;
            const multiParams = extractMultiLineParams(lines, i);
            symbols.push({
              fqn,
              name: methodName,
              kind: 'method',
              module: moduleId,
              className: tracker.currentClassName,
              line: lineNum,
              params: multiParams || '(...)',
              returnType: extractReturnTypeAfterParams(lines, i),
            });
            tracker.currentFunctionFqn = fqn;
            tracker.funcStartDepth = tracker.braceDepth - 1;
          }
        }
      }

      // Top-level function
      if (!tracker.currentClassName) {
        const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+?))?(?:\s*\{)/);
        if (funcMatch) {
          const funcName = funcMatch[1];
          const fqn = `fn:${funcName}`;
          const rawParams = funcMatch[2]?.trim() || '';
          const rawReturn = funcMatch[3]?.trim() || '';
          symbols.push({
            fqn,
            name: funcName,
            kind: 'function',
            module: moduleId,
            line: lineNum,
            params: rawParams ? `(${rawParams})` : '()',
            returnType: rawReturn || undefined,
          });
          tracker.currentFunctionFqn = fqn;
          tracker.funcStartDepth = tracker.braceDepth - 1;
        }
        // Fallback for multi-line function params
        if (!funcMatch) {
          const simpleFuncMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(/);
          if (simpleFuncMatch) {
            const funcName = simpleFuncMatch[1];
            const fqn = `fn:${funcName}`;
            const multiParams = extractMultiLineParams(lines, i);
            symbols.push({
              fqn,
              name: funcName,
              kind: 'function',
              module: moduleId,
              line: lineNum,
              params: multiParams || '(...)',
              returnType: extractReturnTypeAfterParams(lines, i),
            });
            tracker.currentFunctionFqn = fqn;
            tracker.funcStartDepth = tracker.braceDepth - 1;
          }
        }

        // Arrow function export
        const arrowMatch = line.match(/export\s+(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)(?:\s*:\s*([^=>{]+?))?(?:\s*=>)/);
        if (arrowMatch) {
          const funcName = arrowMatch[1];
          const rawParams = arrowMatch[2]?.trim() || '';
          const rawReturn = arrowMatch[3]?.trim() || '';
          symbols.push({
            fqn: `fn:${funcName}`,
            name: funcName,
            kind: 'function',
            module: moduleId,
            line: lineNum,
            params: rawParams ? `(${rawParams})` : '()',
            returnType: rawReturn || undefined,
          });
        }
        // Fallback arrow: multi-line
        if (!arrowMatch) {
          const simpleArrowMatch = line.match(/export\s+(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
          if (simpleArrowMatch) {
            const funcName = simpleArrowMatch[1];
            const multiParams = extractMultiLineParams(lines, i);
            symbols.push({
              fqn: `fn:${funcName}`,
              name: funcName,
              kind: 'function',
              module: moduleId,
              line: lineNum,
              params: multiParams || '(...)',
              returnType: extractReturnTypeAfterParams(lines, i),
            });
          }
        }
      }

      // Call sites
      if (tracker.currentFunctionFqn && tracker.braceDepth > (tracker.funcStartDepth >= 0 ? tracker.funcStartDepth : 0)) {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

        RE_THIS_CALL.lastIndex = 0;
        let cm: RegExpExecArray | null;
        while ((cm = RE_THIS_CALL.exec(line)) !== null) {
          if (!TS_BLACKLIST.has(cm[1])) {
            calls.push({
              callerFqn: tracker.currentFunctionFqn,
              calleeName: cm[1],
              isMethodCall: true,
              receiverClass: tracker.currentClassName ?? undefined,
            });
          }
        }

        RE_STATIC_CALL.lastIndex = 0;
        while ((cm = RE_STATIC_CALL.exec(line)) !== null) {
          if (!TS_BLACKLIST.has(cm[2]) && !TS_BLACKLIST.has(cm[1])) {
            calls.push({
              callerFqn: tracker.currentFunctionFqn,
              calleeName: cm[2],
              isMethodCall: true,
              receiverClass: cm[1],
            });
          }
        }

        RE_CALL.lastIndex = 0;
        while ((cm = RE_CALL.exec(line)) !== null) {
          const name = cm[1];
          if (!TS_BLACKLIST.has(name) && /^[a-z]/.test(name) && name.length > 2) {
            calls.push({
              callerFqn: tracker.currentFunctionFqn,
              calleeName: name,
              isMethodCall: false,
            });
          }
        }
      }
    }

    return { symbols, calls, inheritance };
  }
}
