/**
 * Tests for Tree-sitter Scanner
 * Tree-sitter modules are mocked to test the wrapper logic.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock tree-sitter and tree-sitter-typescript
const mockParse = vi.fn();
const mockSetLanguage = vi.fn();

vi.mock('tree-sitter', () => ({
  default: class MockParser {
    parse = mockParse;
    setLanguage = mockSetLanguage;
  },
}));

vi.mock('tree-sitter-typescript', () => ({
  typescript: { name: 'TypeScript' },
  default: { typescript: { name: 'TypeScript' } },
}));

describe('TreeSitterScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes successfully with mocked tree-sitter', async () => {
    const { TreeSitterScanner } = await import('@/knowledge/scanners/tree-sitter-scanner.js');
    const scanner = new TreeSitterScanner({
      language: 'TypeScript',
      grammarModule: 'tree-sitter-typescript',
      grammarSubpath: 'typescript',
      classNodeTypes: ['class_declaration'],
      functionNodeTypes: ['function_declaration', 'method_definition', 'arrow_function'],
      callNodeTypes: ['call_expression'],
      importNodeTypes: ['import_statement'],
      inheritanceNodeTypes: ['class_heritage'],
    });

    const ok = await scanner.initialize();
    expect(ok).toBe(true);
    expect(scanner.isReady()).toBe(true);
    expect(mockSetLanguage).toHaveBeenCalled();
  });

  it('isReady() returns false before initialize', async () => {
    const { TreeSitterScanner } = await import('@/knowledge/scanners/tree-sitter-scanner.js');
    const scanner = new TreeSitterScanner({
      language: 'TypeScript',
      grammarModule: 'tree-sitter-typescript',
      grammarSubpath: 'typescript',
      classNodeTypes: [],
      functionNodeTypes: [],
      callNodeTypes: [],
      importNodeTypes: [],
      inheritanceNodeTypes: [],
    });

    expect(scanner.isReady()).toBe(false);
  });

  it('scanFile throws when not initialized', async () => {
    const { TreeSitterScanner } = await import('@/knowledge/scanners/tree-sitter-scanner.js');
    const scanner = new TreeSitterScanner({
      language: 'TypeScript',
      grammarModule: 'tree-sitter-typescript',
      grammarSubpath: 'typescript',
      classNodeTypes: [],
      functionNodeTypes: [],
      callNodeTypes: [],
      importNodeTypes: [],
      inheritanceNodeTypes: [],
    });

    expect(() => scanner.scanFile('const x = 1;', 'test')).toThrow('not initialized');
  });

  it('scanFile extracts from AST', async () => {
    // Create a mock AST
    const mockTree = {
      rootNode: {
        type: 'program',
        namedChildren: [
          {
            type: 'function_declaration',
            startPosition: { row: 0, column: 0 },
            namedChildren: [],
            childForFieldName: (name: string) => {
              if (name === 'name') return { text: 'myFunction', type: 'identifier' };
              if (name === 'parameters') return { text: '(x: number)' };
              if (name === 'return_type') return { text: ': string', type: 'type_annotation' };
              return null;
            },
          },
        ],
      },
    };
    mockParse.mockReturnValue(mockTree);

    const { TreeSitterScanner } = await import('@/knowledge/scanners/tree-sitter-scanner.js');
    const scanner = new TreeSitterScanner({
      language: 'TypeScript',
      grammarModule: 'tree-sitter-typescript',
      grammarSubpath: 'typescript',
      classNodeTypes: ['class_declaration'],
      functionNodeTypes: ['function_declaration', 'method_definition', 'arrow_function'],
      callNodeTypes: ['call_expression'],
      importNodeTypes: ['import_statement'],
      inheritanceNodeTypes: ['class_heritage'],
    });

    await scanner.initialize();
    const result = scanner.scanFile('function myFunction(x: number): string {}', 'test-module');

    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe('myFunction');
    expect(result.symbols[0].fqn).toBe('fn:myFunction');
    expect(result.symbols[0].kind).toBe('function');
    expect(result.symbols[0].params).toBe('(x: number)');
  });

  it('scanFile extracts classes with inheritance', async () => {
    const mockExtendsClause = {
      type: 'extends_clause',
      namedChildren: [
        { type: 'identifier', text: 'BaseClass', namedChildren: [] },
      ],
    };

    const mockHeritage = {
      type: 'class_heritage',
      namedChildren: [mockExtendsClause],
    };

    const mockTree = {
      rootNode: {
        type: 'program',
        namedChildren: [
          {
            type: 'class_declaration',
            startPosition: { row: 0, column: 0 },
            namedChildren: [mockHeritage],
            childForFieldName: (name: string) => {
              if (name === 'name') return { text: 'MyClass', type: 'type_identifier', namedChildren: [] };
              return null;
            },
          },
        ],
      },
    };
    mockParse.mockReturnValue(mockTree);

    const { TreeSitterScanner } = await import('@/knowledge/scanners/tree-sitter-scanner.js');
    const scanner = new TreeSitterScanner({
      language: 'TypeScript',
      grammarModule: 'tree-sitter-typescript',
      grammarSubpath: 'typescript',
      classNodeTypes: ['class_declaration'],
      functionNodeTypes: ['function_declaration', 'method_definition', 'arrow_function'],
      callNodeTypes: ['call_expression'],
      importNodeTypes: ['import_statement'],
      inheritanceNodeTypes: ['class_heritage'],
    });

    await scanner.initialize();
    const result = scanner.scanFile('class MyClass extends BaseClass {}', 'test-module');

    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].fqn).toBe('cls:MyClass');
    expect(result.symbols[0].kind).toBe('class');
    expect(result.inheritance).toHaveLength(1);
    expect(result.inheritance[0].extends).toBe('BaseClass');
  });

  it('scanFile extracts call sites', async () => {
    const mockCallExpr = {
      type: 'call_expression',
      namedChildren: [],
      childForFieldName: (name: string) => {
        if (name === 'function') return { type: 'identifier', text: 'helperFn' };
        return null;
      },
    };

    const mockFunc = {
      type: 'function_declaration',
      startPosition: { row: 0, column: 0 },
      namedChildren: [mockCallExpr],
      childForFieldName: (name: string) => {
        if (name === 'name') return { text: 'caller', type: 'identifier' };
        if (name === 'parameters') return { text: '()' };
        return null;
      },
    };

    mockParse.mockReturnValue({
      rootNode: {
        type: 'program',
        namedChildren: [mockFunc],
      },
    });

    const { TreeSitterScanner } = await import('@/knowledge/scanners/tree-sitter-scanner.js');
    const scanner = new TreeSitterScanner({
      language: 'TypeScript',
      grammarModule: 'tree-sitter-typescript',
      grammarSubpath: 'typescript',
      classNodeTypes: ['class_declaration'],
      functionNodeTypes: ['function_declaration', 'method_definition', 'arrow_function'],
      callNodeTypes: ['call_expression'],
      importNodeTypes: ['import_statement'],
      inheritanceNodeTypes: ['class_heritage'],
    });

    await scanner.initialize();
    const result = scanner.scanFile('function caller() { helperFn(); }', 'test-module');

    expect(result.calls.length).toBeGreaterThanOrEqual(1);
    expect(result.calls[0].callerFqn).toBe('fn:caller');
    expect(result.calls[0].calleeName).toBe('helperFn');
  });

  it('scanFile extracts member expression calls', async () => {
    const mockMemberCall = {
      type: 'call_expression',
      namedChildren: [],
      childForFieldName: (name: string) => {
        if (name === 'function') return {
          type: 'member_expression',
          childForFieldName: (n: string) => {
            if (n === 'property') return { text: 'doWork', type: 'property_identifier' };
            if (n === 'object') return { text: 'Service', type: 'identifier' };
            return null;
          },
        };
        return null;
      },
    };

    const mockFunc = {
      type: 'function_declaration',
      startPosition: { row: 0, column: 0 },
      namedChildren: [mockMemberCall],
      childForFieldName: (name: string) => {
        if (name === 'name') return { text: 'main', type: 'identifier' };
        if (name === 'parameters') return { text: '()' };
        return null;
      },
    };

    mockParse.mockReturnValue({
      rootNode: { type: 'program', namedChildren: [mockFunc] },
    });

    const { TreeSitterScanner } = await import('@/knowledge/scanners/tree-sitter-scanner.js');
    const scanner = new TreeSitterScanner({
      language: 'TypeScript',
      grammarModule: 'tree-sitter-typescript',
      grammarSubpath: 'typescript',
      classNodeTypes: ['class_declaration'],
      functionNodeTypes: ['function_declaration', 'method_definition', 'arrow_function'],
      callNodeTypes: ['call_expression'],
      importNodeTypes: ['import_statement'],
      inheritanceNodeTypes: ['class_heritage'],
    });

    await scanner.initialize();
    const result = scanner.scanFile('function main() { Service.doWork(); }', 'test-module');

    expect(result.calls).toHaveLength(1);
    expect(result.calls[0].calleeName).toBe('doWork');
    expect(result.calls[0].isMethodCall).toBe(true);
    expect(result.calls[0].receiverClass).toBe('Service');
  });

  it('scanFile ignores blacklisted calls', async () => {
    const mockCallExpr = {
      type: 'call_expression',
      namedChildren: [],
      childForFieldName: (name: string) => {
        if (name === 'function') return { type: 'identifier', text: 'if' };
        return null;
      },
    };

    const mockFunc = {
      type: 'function_declaration',
      startPosition: { row: 0, column: 0 },
      namedChildren: [mockCallExpr],
      childForFieldName: (name: string) => {
        if (name === 'name') return { text: 'test', type: 'identifier' };
        if (name === 'parameters') return { text: '()' };
        return null;
      },
    };

    mockParse.mockReturnValue({
      rootNode: { type: 'program', namedChildren: [mockFunc] },
    });

    const { TreeSitterScanner } = await import('@/knowledge/scanners/tree-sitter-scanner.js');
    const scanner = new TreeSitterScanner({
      language: 'TypeScript',
      grammarModule: 'tree-sitter-typescript',
      grammarSubpath: 'typescript',
      classNodeTypes: ['class_declaration'],
      functionNodeTypes: ['function_declaration', 'method_definition', 'arrow_function'],
      callNodeTypes: ['call_expression'],
      importNodeTypes: ['import_statement'],
      inheritanceNodeTypes: ['class_heritage'],
    });

    await scanner.initialize();
    const result = scanner.scanFile('function test() { if(true) {} }', 'test-module');

    // 'if' should be filtered by blacklist
    expect(result.calls).toHaveLength(0);
  });
});

describe('TypeScriptTreeSitterScanner', () => {
  it('falls back to regex when tree-sitter not ready', async () => {
    // Reset mocks to simulate failure
    mockParse.mockImplementation(() => { throw new Error('parse failed'); });

    const { TypeScriptTreeSitterScanner } = await import('@/knowledge/scanners/ts-tree-sitter.js');
    const scanner = new TypeScriptTreeSitterScanner();
    // treeSitter is not initialized → uses regex fallback

    const result = scanner.scanFile(
      'export function hello(name: string): string {\n  return name;\n}',
      'test-module',
    );

    // Should still get results from regex fallback
    expect(result.symbols.length).toBeGreaterThanOrEqual(1);
    expect(result.symbols[0].name).toBe('hello');
  });

  it('has correct extensions', async () => {
    const { TypeScriptTreeSitterScanner } = await import('@/knowledge/scanners/ts-tree-sitter.js');
    const scanner = new TypeScriptTreeSitterScanner();
    expect(scanner.extensions).toContain('.ts');
    expect(scanner.extensions).toContain('.tsx');
    expect(scanner.extensions).toContain('.js');
    expect(scanner.extensions).toContain('.jsx');
  });

  it('has correct language name', async () => {
    const { TypeScriptTreeSitterScanner } = await import('@/knowledge/scanners/ts-tree-sitter.js');
    const scanner = new TypeScriptTreeSitterScanner();
    expect(scanner.language).toBe('TypeScript/JavaScript');
  });

  it('scanFile returns valid ScanResult shape', async () => {
    const { TypeScriptTreeSitterScanner } = await import('@/knowledge/scanners/ts-tree-sitter.js');
    const scanner = new TypeScriptTreeSitterScanner();

    const result = scanner.scanFile('const x = 1;', 'test-module');
    expect(result).toHaveProperty('symbols');
    expect(result).toHaveProperty('calls');
    expect(result).toHaveProperty('inheritance');
    expect(Array.isArray(result.symbols)).toBe(true);
    expect(Array.isArray(result.calls)).toBe(true);
    expect(Array.isArray(result.inheritance)).toBe(true);
  });
});

describe('TreeSitterScanner initialization failure', () => {
  it('returns false when grammar module not found', async () => {
    const { TreeSitterScanner } = await import('@/knowledge/scanners/tree-sitter-scanner.js');
    const scanner = new TreeSitterScanner({
      language: 'NonExistent',
      grammarModule: 'tree-sitter-nonexistent-language',
      classNodeTypes: [],
      functionNodeTypes: [],
      callNodeTypes: [],
      importNodeTypes: [],
      inheritanceNodeTypes: [],
    });

    const ok = await scanner.initialize();
    expect(ok).toBe(false);
    expect(scanner.isReady()).toBe(false);
  });
});
