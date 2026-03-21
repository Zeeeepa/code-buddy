/**
 * Java Scanner — brace-based scoping, return-type-before-name methods
 */

import type { LanguageScanner, ScanResult, SymbolDef, CallSite, InheritanceInfo } from './types.js';
import { COMMON_CALL_BLACKLIST, createScopeTracker, updateBraceDepth, extractMultiLineParams } from './types.js';

const JAVA_BLACKLIST = new Set([
  ...COMMON_CALL_BLACKLIST,
  'System', 'Math', 'Integer', 'Long', 'Double', 'Float', 'Boolean',
  'Character', 'Byte', 'Short', 'Arrays', 'Collections', 'Objects',
  'Optional', 'String', 'Thread', 'Class', 'Enum',
  'Override', 'Deprecated', 'SuppressWarnings',
  'assertEquals', 'assertTrue', 'assertFalse', 'assertNotNull',
  'assertNull', 'assertThrows', 'assertThat',
]);

const RE_JAVA_THIS_CALL = /this\.(\w+)\s*\(/g;
const RE_JAVA_STATIC_CALL = /([A-Z]\w+)\.(\w+)\s*\(/g;
const RE_JAVA_CALL = /(?:^|[^.\w])(\w+)\s*\(/g;

export class JavaScanner implements LanguageScanner {
  readonly extensions = ['.java'];
  readonly language = 'Java';

  scanFile(content: string, moduleId: string): ScanResult {
    const symbols: SymbolDef[] = [];
    const calls: CallSite[] = [];
    const inheritance: InheritanceInfo[] = [];

    const tracker = createScopeTracker();
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trimStart();

      updateBraceDepth(line, tracker);

      // Skip annotations
      if (trimmed.startsWith('@')) continue;

      // Class: public class Foo extends Bar implements Baz, Qux {
      const classMatch = trimmed.match(/^(?:(?:public|private|protected|abstract|final|static)\s+)*class\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+(\w+)(?:<[^>]*>)?)?(?:\s+implements\s+([\w,\s<>]+))?\s*\{/);
      if (classMatch) {
        const className = classMatch[1];
        tracker.currentClassName = className;
        tracker.classStartDepth = tracker.braceDepth - 1;
        symbols.push({
          fqn: `cls:${className}`,
          name: className,
          kind: 'class',
          module: moduleId,
          line: lineNum,
        });
        const info: InheritanceInfo = { className };
        if (classMatch[2]) info.extends = classMatch[2];
        if (classMatch[3]) {
          info.implements = classMatch[3].split(',').map(s => s.trim().replace(/<.*>$/, '')).filter(s => s && /^[A-Z]/.test(s));
        }
        if (info.extends || info.implements?.length) inheritance.push(info);
        continue;
      }

      // Interface: public interface Foo extends Bar, Baz {
      const ifaceMatch = trimmed.match(/^(?:(?:public|private|protected)\s+)?interface\s+(\w+)(?:<[^>]*>)?(?:\s+extends\s+([\w,\s<>]+))?\s*\{/);
      if (ifaceMatch) {
        const ifaceName = ifaceMatch[1];
        tracker.currentClassName = ifaceName;
        tracker.classStartDepth = tracker.braceDepth - 1;
        symbols.push({
          fqn: `iface:${ifaceName}`,
          name: ifaceName,
          kind: 'class',
          module: moduleId,
          line: lineNum,
        });
        if (ifaceMatch[2]) {
          const parents = ifaceMatch[2].split(',').map(s => s.trim().replace(/<.*>$/, '')).filter(s => s);
          for (const p of parents) {
            inheritance.push({ className: ifaceName, extends: p });
          }
        }
        continue;
      }

      // Enum: public enum Foo implements Bar {
      const enumMatch = trimmed.match(/^(?:(?:public|private|protected)\s+)?enum\s+(\w+)(?:\s+implements\s+([\w,\s<>]+))?\s*\{/);
      if (enumMatch) {
        symbols.push({
          fqn: `cls:${enumMatch[1]}`,
          name: enumMatch[1],
          kind: 'class',
          module: moduleId,
          line: lineNum,
        });
        if (enumMatch[2]) {
          const ifaces = enumMatch[2].split(',').map(s => s.trim().replace(/<.*>$/, '')).filter(s => s);
          inheritance.push({ className: enumMatch[1], implements: ifaces });
        }
        continue;
      }

      // Method: modifiers ReturnType methodName(params) throws ... {
      if (tracker.currentClassName) {
        // Java: return type comes before method name
        const methodMatch = trimmed.match(/^(?:(?:public|private|protected|static|final|abstract|synchronized|native|default)\s+)*(?:<[^>]*>\s+)?(\w+(?:<[^>]*>)?(?:\[\])?)\s+(\w+)\s*\(([^)]*)\)(?:\s*throws\s+[\w,\s]+)?\s*[{;]/);
        if (methodMatch && !JAVA_BLACKLIST.has(methodMatch[2]) && methodMatch[2] !== tracker.currentClassName) {
          const returnType = methodMatch[1];
          const methodName = methodMatch[2];
          const rawParams = methodMatch[3]?.trim() || '';
          const fqn = `fn:${tracker.currentClassName}.${methodName}`;
          symbols.push({
            fqn,
            name: methodName,
            kind: 'method',
            module: moduleId,
            className: tracker.currentClassName,
            line: lineNum,
            params: rawParams ? `(${rawParams})` : '()',
            returnType: returnType,
          });
          tracker.currentFunctionFqn = fqn;
          tracker.funcStartDepth = tracker.braceDepth - 1;
          continue;
        }

        // Constructor: public ClassName(params) {
        const ctorMatch = trimmed.match(/^(?:(?:public|private|protected)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*throws\s+[\w,\s]+)?\s*\{/);
        if (ctorMatch && ctorMatch[1] === tracker.currentClassName) {
          const rawParams = ctorMatch[2]?.trim() || '';
          const fqn = `fn:${tracker.currentClassName}.__init__`;
          symbols.push({
            fqn,
            name: '__init__',
            kind: 'method',
            module: moduleId,
            className: tracker.currentClassName,
            line: lineNum,
            params: rawParams ? `(${rawParams})` : '()',
          });
          tracker.currentFunctionFqn = fqn;
          tracker.funcStartDepth = tracker.braceDepth - 1;
          continue;
        }

        // Multi-line method params
        const simpleMethodMatch = trimmed.match(/^(?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*(?:<[^>]*>\s+)?(\w+(?:<[^>]*>)?(?:\[\])?)\s+(\w+)\s*\(/);
        if (simpleMethodMatch && !methodMatch && !JAVA_BLACKLIST.has(simpleMethodMatch[2]) && simpleMethodMatch[2] !== tracker.currentClassName) {
          const returnType = simpleMethodMatch[1];
          const methodName = simpleMethodMatch[2];
          const multiParams = extractMultiLineParams(lines, i);
          const fqn = `fn:${tracker.currentClassName}.${methodName}`;
          symbols.push({
            fqn, name: methodName, kind: 'method', module: moduleId,
            className: tracker.currentClassName, line: lineNum,
            params: multiParams || '(...)', returnType,
          });
          tracker.currentFunctionFqn = fqn;
          tracker.funcStartDepth = tracker.braceDepth - 1;
          continue;
        }
      }

      // Call sites
      if (tracker.currentFunctionFqn && tracker.braceDepth > (tracker.funcStartDepth >= 0 ? tracker.funcStartDepth : 0)) {
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

        RE_JAVA_THIS_CALL.lastIndex = 0;
        let cm: RegExpExecArray | null;
        while ((cm = RE_JAVA_THIS_CALL.exec(line)) !== null) {
          if (!JAVA_BLACKLIST.has(cm[1])) {
            calls.push({
              callerFqn: tracker.currentFunctionFqn,
              calleeName: cm[1],
              isMethodCall: true,
              receiverClass: tracker.currentClassName ?? undefined,
            });
          }
        }

        RE_JAVA_STATIC_CALL.lastIndex = 0;
        while ((cm = RE_JAVA_STATIC_CALL.exec(line)) !== null) {
          if (!JAVA_BLACKLIST.has(cm[2]) && !JAVA_BLACKLIST.has(cm[1])) {
            calls.push({
              callerFqn: tracker.currentFunctionFqn,
              calleeName: cm[2],
              isMethodCall: true,
              receiverClass: cm[1],
            });
          }
        }

        RE_JAVA_CALL.lastIndex = 0;
        while ((cm = RE_JAVA_CALL.exec(line)) !== null) {
          const name = cm[1];
          if (!JAVA_BLACKLIST.has(name) && /^[a-z]/.test(name) && name.length > 2) {
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
