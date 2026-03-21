/**
 * Python Scanner — indent-based scoping
 */

import type { LanguageScanner, ScanResult, SymbolDef, CallSite, InheritanceInfo } from './types.js';
import { COMMON_CALL_BLACKLIST, extractMultiLineParams } from './types.js';

const PY_BLACKLIST = new Set([
  ...COMMON_CALL_BLACKLIST,
  'print', 'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted',
  'reversed', 'list', 'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool',
  'type', 'isinstance', 'issubclass', 'hasattr', 'getattr', 'setattr', 'delattr',
  'open', 'super', 'property', 'staticmethod', 'classmethod', 'abs', 'all', 'any',
  'min', 'max', 'sum', 'round', 'repr', 'hash', 'id', 'input', 'iter', 'next',
  'format', 'vars', 'dir', 'globals', 'locals', 'callable', 'chr', 'ord',
  'pytest', 'unittest',
]);

const RE_PY_SELF_CALL = /self\.(\w+)\s*\(/g;
const RE_PY_CLS_CALL = /([A-Z]\w+)\.(\w+)\s*\(/g;
const RE_PY_CALL = /(?:^|[^.\w])(\w+)\s*\(/g;

function indentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  // Normalize: tab = 4 spaces
  return match[1].replace(/\t/g, '    ').length;
}

export class PythonScanner implements LanguageScanner {
  readonly extensions = ['.py', '.pyw'];
  readonly language = 'Python';

  scanFile(content: string, moduleId: string): ScanResult {
    const symbols: SymbolDef[] = [];
    const calls: CallSite[] = [];
    const inheritance: InheritanceInfo[] = [];

    const lines = content.split('\n');

    let currentClassName: string | null = null;
    let classIndent = -1;
    let currentFunctionFqn: string | null = null;
    let funcIndent = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trimStart();

      // Skip blank lines and comments for scope detection
      if (trimmed === '' || trimmed.startsWith('#')) {
        // Still extract calls if inside a function
        if (currentFunctionFqn && trimmed.startsWith('#')) continue;
        if (trimmed === '') continue;
      }

      const indent = indentLevel(line);

      // Exit class scope
      if (currentClassName && indent <= classIndent && trimmed !== '' && !trimmed.startsWith('#') && !trimmed.startsWith('"""') && !trimmed.startsWith("'''")) {
        currentClassName = null;
        classIndent = -1;
        // Also exit function scope if it was inside the class
        if (currentFunctionFqn) {
          currentFunctionFqn = null;
          funcIndent = -1;
        }
      }

      // Exit function scope
      if (currentFunctionFqn && indent <= funcIndent && trimmed !== '' && !trimmed.startsWith('#') && !trimmed.startsWith('"""') && !trimmed.startsWith("'''")) {
        currentFunctionFqn = null;
        funcIndent = -1;
      }

      // Class declaration: class Foo(Bar, Baz):
      const classMatch = trimmed.match(/^class\s+(\w+)(?:\(([^)]*)\))?\s*:/);
      if (classMatch) {
        currentClassName = classMatch[1];
        classIndent = indent;
        symbols.push({
          fqn: `cls:${classMatch[1]}`,
          name: classMatch[1],
          kind: 'class',
          module: moduleId,
          line: lineNum,
        });

        // Inheritance
        if (classMatch[2]) {
          const bases = classMatch[2].split(',').map(s => s.trim().replace(/\[.*\]$/, '')).filter(s => s && /^[A-Z]/.test(s));
          if (bases.length > 0) {
            const info: InheritanceInfo = { className: classMatch[1] };
            // First non-protocol base is extends, rest are implements
            const protocols = new Set(['Protocol', 'ABC', 'ABCMeta', 'Generic', 'TypedDict']);
            const realBases = bases.filter(b => !protocols.has(b));
            const ifaceBases = bases.filter(b => protocols.has(b));
            if (realBases.length > 0) info.extends = realBases[0];
            if (realBases.length > 1 || ifaceBases.length > 0) {
              info.implements = [...realBases.slice(1), ...ifaceBases];
            }
            inheritance.push(info);
          }
        }
        continue;
      }

      // Function/method: def foo(args) -> ReturnType:  or  async def foo(...):
      const funcMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        const rawParams = funcMatch[2]?.trim() || '';
        const rawReturn = funcMatch[3]?.trim() || '';

        // Strip 'self' and 'cls' from params for cleaner display
        const cleanParams = rawParams
          .split(',')
          .map(p => p.trim())
          .filter(p => p !== 'self' && p !== 'cls')
          .join(', ');

        if (currentClassName && indent > classIndent) {
          // Method
          if (funcName === '__init__' || funcName.startsWith('__')) {
            // Still register __init__ as a method but skip dunder as call targets
            if (funcName === '__init__') {
              const fqn = `fn:${currentClassName}.__init__`;
              symbols.push({
                fqn,
                name: '__init__',
                kind: 'method',
                module: moduleId,
                className: currentClassName,
                line: lineNum,
                params: cleanParams ? `(${cleanParams})` : '()',
                returnType: rawReturn || undefined,
              });
              currentFunctionFqn = fqn;
              funcIndent = indent;
            }
          } else {
            const fqn = `fn:${currentClassName}.${funcName}`;
            symbols.push({
              fqn,
              name: funcName,
              kind: 'method',
              module: moduleId,
              className: currentClassName,
              line: lineNum,
              params: cleanParams ? `(${cleanParams})` : '()',
              returnType: rawReturn || undefined,
            });
            currentFunctionFqn = fqn;
            funcIndent = indent;
          }
        } else {
          // Top-level function
          const fqn = `fn:${funcName}`;
          symbols.push({
            fqn,
            name: funcName,
            kind: 'function',
            module: moduleId,
            line: lineNum,
            params: cleanParams ? `(${cleanParams})` : '()',
            returnType: rawReturn || undefined,
          });
          currentFunctionFqn = fqn;
          funcIndent = indent;
        }
        continue;
      }

      // Multi-line function def (params don't close on same line)
      const simpleFuncMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
      if (simpleFuncMatch) {
        const funcName = simpleFuncMatch[1];
        const multiParams = extractMultiLineParams(lines, i);
        // Look for return type after closing paren
        let rawReturn: string | undefined;
        for (let j = i; j < Math.min(i + 15, lines.length); j++) {
          const retMatch = lines[j].match(/\)\s*->\s*([^:]+):/);
          if (retMatch) { rawReturn = retMatch[1].trim(); break; }
        }

        const cleanParams = multiParams
          ? multiParams.slice(1, -1).split(',').map(p => p.trim()).filter(p => p !== 'self' && p !== 'cls').join(', ')
          : '';

        if (currentClassName && indent > classIndent) {
          if (funcName !== '__init__' && !funcName.startsWith('__')) {
            const fqn = `fn:${currentClassName}.${funcName}`;
            symbols.push({
              fqn, name: funcName, kind: 'method', module: moduleId,
              className: currentClassName, line: lineNum,
              params: cleanParams ? `(${cleanParams})` : '()',
              returnType: rawReturn,
            });
            currentFunctionFqn = fqn;
            funcIndent = indent;
          } else if (funcName === '__init__') {
            const fqn = `fn:${currentClassName}.__init__`;
            symbols.push({
              fqn, name: '__init__', kind: 'method', module: moduleId,
              className: currentClassName, line: lineNum,
              params: cleanParams ? `(${cleanParams})` : '()',
              returnType: rawReturn,
            });
            currentFunctionFqn = fqn;
            funcIndent = indent;
          }
        } else {
          const fqn = `fn:${funcName}`;
          symbols.push({
            fqn, name: funcName, kind: 'function', module: moduleId, line: lineNum,
            params: cleanParams ? `(${cleanParams})` : '()',
            returnType: rawReturn,
          });
          currentFunctionFqn = fqn;
          funcIndent = indent;
        }
        continue;
      }

      // Call sites (inside function body)
      if (currentFunctionFqn && indent > funcIndent) {
        if (trimmed.startsWith('#')) continue;

        RE_PY_SELF_CALL.lastIndex = 0;
        let cm: RegExpExecArray | null;
        while ((cm = RE_PY_SELF_CALL.exec(line)) !== null) {
          if (!PY_BLACKLIST.has(cm[1]) && !cm[1].startsWith('_')) {
            calls.push({
              callerFqn: currentFunctionFqn,
              calleeName: cm[1],
              isMethodCall: true,
              receiverClass: currentClassName ?? undefined,
            });
          }
        }

        RE_PY_CLS_CALL.lastIndex = 0;
        while ((cm = RE_PY_CLS_CALL.exec(line)) !== null) {
          if (!PY_BLACKLIST.has(cm[2]) && !PY_BLACKLIST.has(cm[1])) {
            calls.push({
              callerFqn: currentFunctionFqn,
              calleeName: cm[2],
              isMethodCall: true,
              receiverClass: cm[1],
            });
          }
        }

        RE_PY_CALL.lastIndex = 0;
        while ((cm = RE_PY_CALL.exec(line)) !== null) {
          const name = cm[1];
          if (!PY_BLACKLIST.has(name) && /^[a-z]/.test(name) && name.length > 2) {
            calls.push({
              callerFqn: currentFunctionFqn,
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
