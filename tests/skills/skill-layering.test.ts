/**
 * Tests for Skill Source Layering
 *
 * Validates that project skills override global skills and that
 * the SkillLoader respects source priority ordering.
 */

import { SkillLoader, DEFAULT_SKILL_LOADER_CONFIG } from '../../src/skills/skill-loader.js';
import type { SkillTier } from '../../src/skills/types.js';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// ── Helpers ────────────────────────────────────────────────────────

const tmpDir = path.join(os.tmpdir(), `skill-layering-test-${Date.now()}`);
const globalDir = path.join(tmpDir, 'global-skills');
const projectDir = path.join(tmpDir, 'project-skills');

function createSkillMd(dir: string, name: string, description: string): void {
  const skillDir = path.join(dir, name);
  fs.ensureDirSync(skillDir);
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---
name: ${name}
description: ${description}
triggers: test-trigger
---

${description} instructions`
  );
}

// ── Setup / Teardown ──────────────────────────────────────────────

beforeAll(() => {
  fs.ensureDirSync(globalDir);
  fs.ensureDirSync(projectDir);
});

afterAll(() => {
  fs.removeSync(tmpDir);
});

// ── Tests ──────────────────────────────────────────────────────────

describe('Skill Source Layering', () => {
  describe('SkillTier', () => {
    it('includes valid tiers', () => {
      const validTiers: SkillTier[] = ['workspace', 'managed', 'bundled'];
      expect(validTiers).toContain('bundled');
    });
  });

  describe('SkillLoader with project/global skills', () => {
    it('config includes globalDir', () => {
      expect(DEFAULT_SKILL_LOADER_CONFIG.globalDir).toContain('skills');
    });

    it('config includes loadProject flag', () => {
      expect(DEFAULT_SKILL_LOADER_CONFIG.loadProject).toBe(true);
    });

    it('loads project skills from project directory', async () => {
      createSkillMd(projectDir, 'project-skill', 'Project skill');

      const loader = new SkillLoader({
        globalDir,
        projectDir,
        loadGlobal: false,
        loadProject: true,
        checkEligibility: false,
      });

      const skills = await loader.loadAll();
      const projectSkill = skills.find(s => s.name === 'project-skill');
      expect(projectSkill).toBeDefined();
      expect(projectSkill!.source).toBe('project');
    });

    it('project skills override global skills', async () => {
      createSkillMd(globalDir, 'shared-skill', 'Global version');
      createSkillMd(projectDir, 'shared-skill', 'Project version');

      const loader = new SkillLoader({
        globalDir,
        projectDir,
        loadGlobal: true,
        loadProject: true,
        checkEligibility: false,
      });

      await loader.loadAll();
      const skill = loader.getSkill('shared-skill');
      expect(skill).toBeDefined();
      expect(skill!.source).toBe('project');
      expect(skill!.description).toBe('Project version');
    });

    it('getStats includes project count', async () => {
      createSkillMd(projectDir, 'stat-skill', 'For stats');

      const loader = new SkillLoader({
        globalDir,
        projectDir,
        loadGlobal: false,
        loadProject: true,
        checkEligibility: false,
      });

      await loader.loadAll();
      const stats = loader.getStats();
      expect(stats.bySource).toHaveProperty('project');
      expect(stats.bySource.project).toBeGreaterThanOrEqual(1);
    });
  });
});
