/**
 * Tests for Auto-Import Management Tool
 *
 * Validates import parsing, unused detection, organization, and missing import addition.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  fixImports,
  addMissingImport,
  organizeImports,
  executeOrganizeImports,
  parseTSImports,
  parsePythonImports,
  detectUnusedTSImports,
  sortImports,
} from '../../src/tools/auto-import-tool.js';

const TEST_DIR = path.join(process.cwd(), '.test-auto-import');

function writeTestFile(name: string, content: string): string {
  const filePath = path.join(TEST_DIR, name);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

describe('Auto-Import — parseTSImports', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('parses named imports', () => {
    const lines = ["import { foo, bar } from './module.js';"];
    const imports = parseTSImports(lines);
    expect(imports).toHaveLength(1);
    expect(imports[0].symbols).toContain('foo');
    expect(imports[0].symbols).toContain('bar');
    expect(imports[0].source).toBe('./module.js');
  });

  it('parses default imports', () => {
    const lines = ["import React from 'react';"];
    const imports = parseTSImports(lines);
    expect(imports).toHaveLength(1);
    expect(imports[0].symbols).toContain('React');
    expect(imports[0].isDefault).toBe(true);
  });

  it('parses namespace imports', () => {
    const lines = ["import * as path from 'path';"];
    const imports = parseTSImports(lines);
    expect(imports).toHaveLength(1);
    expect(imports[0].symbols).toContain('path');
    expect(imports[0].isNamespace).toBe(true);
  });

  it('parses type imports', () => {
    const lines = ["import type { MyType } from './types.js';"];
    const imports = parseTSImports(lines);
    expect(imports).toHaveLength(1);
    expect(imports[0].isType).toBe(true);
  });

  it('parses side-effect imports', () => {
    const lines = ["import 'reflect-metadata';"];
    const imports = parseTSImports(lines);
    expect(imports).toHaveLength(1);
    expect(imports[0].symbols).toHaveLength(0);
    expect(imports[0].source).toBe('reflect-metadata');
  });
});

describe('Auto-Import — detectUnusedTSImports', () => {
  it('detects unused named imports', () => {
    const lines = [
      "import { foo, bar } from './module.js';",
      '',
      'console.log(foo);',
    ];
    const unused = detectUnusedTSImports(lines);
    // bar is unused but foo is used — the whole import is still "used"
    // since foo is referenced
    expect(unused).toHaveLength(0);
  });

  it('detects completely unused import', () => {
    const lines = [
      "import { zzzNeverReferenced } from './module.js';",
      '',
      'console.log("hello world");',
    ];
    const unused = detectUnusedTSImports(lines);
    expect(unused).toHaveLength(1);
    expect(unused[0].symbols).toContain('zzzNeverReferenced');
  });

  it('does not flag side-effect imports as unused', () => {
    const lines = [
      "import 'reflect-metadata';",
      '',
      'const x = 1;',
    ];
    const unused = detectUnusedTSImports(lines);
    expect(unused).toHaveLength(0);
  });
});

describe('Auto-Import — sortImports', () => {
  it('sorts imports alphabetically by source', () => {
    const imports = parseTSImports([
      "import { z } from 'z-module';",
      "import { a } from 'a-module';",
    ]);
    const sorted = sortImports(imports);
    expect(sorted[0].source).toBe('a-module');
    expect(sorted[1].source).toBe('z-module');
  });

  it('places type imports after value imports', () => {
    const imports = parseTSImports([
      "import type { MyType } from './types.js';",
      "import { foo } from './foo.js';",
    ]);
    const sorted = sortImports(imports);
    expect(sorted[0].isType).toBe(false);
    expect(sorted[1].isType).toBe(true);
  });
});

describe('Auto-Import — parsePythonImports', () => {
  it('parses from...import statements', () => {
    const lines = ['from pathlib import Path'];
    const imports = parsePythonImports(lines);
    expect(imports).toHaveLength(1);
    expect(imports[0].symbols).toContain('Path');
    expect(imports[0].source).toBe('pathlib');
  });

  it('parses plain import statements', () => {
    const lines = ['import os'];
    const imports = parsePythonImports(lines);
    expect(imports).toHaveLength(1);
    expect(imports[0].symbols).toContain('os');
  });
});

describe('Auto-Import — fixImports', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns empty for unsupported file types', async () => {
    const file = writeTestFile('test.txt', 'import foo from "bar";');
    const fixes = await fixImports(file);
    expect(fixes).toHaveLength(0);
  });

  it('detects unused imports in TypeScript', async () => {
    const file = writeTestFile('test.ts', [
      "import { used } from './a.js';",
      "import { notUsed } from './b.js';",
      '',
      'console.log(used);',
    ].join('\n'));
    const fixes = await fixImports(file, { organize: false, removeDead: true });
    expect(fixes.some(f => f.action === 'remove' && f.importStatement.includes('notUsed'))).toBe(true);
  });
});

describe('Auto-Import — addMissingImport', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('suggests Python standard library import', async () => {
    const file = writeTestFile('test.py', 'x = Path("/tmp")');
    const fix = await addMissingImport(file, 'Path');
    expect(fix).not.toBeNull();
    expect(fix!.importStatement).toBe('from pathlib import Path');
  });

  it('returns null for unknown symbols in unsupported files', async () => {
    const file = writeTestFile('test.txt', 'x = 1');
    const fix = await addMissingImport(file, 'Unknown');
    expect(fix).toBeNull();
  });
});

describe('Auto-Import — executeOrganizeImports', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('returns success for organized file', async () => {
    const file = writeTestFile('organized.ts', "import { a } from './a.js';\n\nconsole.log(a);\n");
    const result = await executeOrganizeImports({ file_path: file });
    expect(result.success).toBe(true);
  });

  it('returns error for add_missing with unknown symbol', async () => {
    const file = writeTestFile('missing.ts', 'const x = 1;');
    const result = await executeOrganizeImports({ file_path: file, action: 'add_missing', symbol: 'CompletelyUnknownXYZ123' });
    // Symbol not found anywhere, should fail
    expect(result.success).toBe(false);
  });
});
