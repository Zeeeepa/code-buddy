import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const permissionDialogPath = path.resolve(
  process.cwd(),
  'src/renderer/components/PermissionDialog.tsx'
);

describe('PermissionDialog computer use UX', () => {
  it('enriches computer-use permission prompts with related gui action context', () => {
    const source = fs.readFileSync(permissionDialogPath, 'utf8');
    expect(source).toContain('relatedGuiAction');
    expect(source).toContain('setShowComputerUseOverlay');
    expect(source).toContain("t('permission.computerUseTitle'");
    expect(source).toContain("t('permission.openComputerUseOverlay'");
    expect(source).toContain('computer-use-preview');
    expect(source).toContain('derivedScopedRule');
    expect(source).toContain("window.electronAPI.rules.add(");
    expect(source).toContain("t('permission.alwaysAllowTarget'");
  });
});
