/**
 * Tests for starter pack helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the registry before importing starter-packs
const mockSkills = new Map<string, any>();

vi.mock('../../src/skills/registry.js', () => ({
  getSkillRegistry: () => ({
    list: (options?: { tags?: string[] }) => {
      const skills = Array.from(mockSkills.values());
      if (options?.tags?.length) {
        return skills.filter(s =>
          s.metadata.tags?.some((t: string) => options.tags!.includes(t))
        );
      }
      return skills;
    },
    search: (options: { query: string; tags?: string[]; minConfidence?: number; limit?: number }) => {
      const skills = Array.from(mockSkills.values());
      const filtered = options.tags?.length
        ? skills.filter(s => s.metadata.tags?.some((t: string) => options.tags!.includes(t)))
        : skills;
      const matches = filtered
        .filter(s => s.metadata.name.includes(options.query.toLowerCase()))
        .map(s => ({
          skill: s,
          confidence: 0.8,
          reason: 'name match',
        }));
      return options.limit ? matches.slice(0, options.limit) : matches;
    },
    get: (name: string) => mockSkills.get(name),
  }),
}));

import {
  isStarterPack,
  getStarterPacks,
  findStarterPack,
  findStarterByKeyword,
  resolveStarterAlias,
} from '../../src/skills/starter-packs.js';

function makeSkill(name: string, tags: string[], description = 'A starter pack') {
  return {
    metadata: { name, description, tags },
    content: { description, rawMarkdown: `# ${name}` },
    sourcePath: `/bundled/${name}/SKILL.md`,
    tier: 'bundled' as const,
    loadedAt: new Date(),
    enabled: true,
  };
}

describe('starter-packs', () => {
  beforeEach(() => {
    mockSkills.clear();
  });

  describe('isStarterPack', () => {
    it('returns true for skills tagged "starter"', () => {
      const skill = makeSkill('typescript-react', ['typescript', 'react', 'starter']);
      expect(isStarterPack(skill)).toBe(true);
    });

    it('returns true for skills tagged "scaffold"', () => {
      const skill = makeSkill('python', ['python', 'scaffold']);
      expect(isStarterPack(skill)).toBe(true);
    });

    it('returns false for skills without starter/scaffold tag', () => {
      const skill = makeSkill('coding-agent', ['agent', 'coding']);
      expect(isStarterPack(skill)).toBe(false);
    });

    it('returns false for skills with no tags', () => {
      const skill = makeSkill('no-tags', []);
      skill.metadata.tags = undefined;
      expect(isStarterPack(skill)).toBe(false);
    });
  });

  describe('getStarterPacks', () => {
    it('returns only skills tagged "starter"', () => {
      mockSkills.set('typescript-react', makeSkill('typescript-react', ['typescript', 'react', 'starter']));
      mockSkills.set('python', makeSkill('python', ['python', 'starter']));
      mockSkills.set('coding-agent', makeSkill('coding-agent', ['agent']));

      const starters = getStarterPacks();
      expect(starters).toHaveLength(2);
      expect(starters.map(s => s.metadata.name)).toContain('python');
      expect(starters.map(s => s.metadata.name)).toContain('typescript-react');
    });

    it('filters by language when provided', () => {
      mockSkills.set('typescript-react', makeSkill('typescript-react', ['typescript', 'react', 'starter']));
      mockSkills.set('python', makeSkill('python', ['python', 'starter']));

      const starters = getStarterPacks('python');
      expect(starters).toHaveLength(1);
      expect(starters[0].metadata.name).toBe('python');
    });

    it('returns sorted results', () => {
      mockSkills.set('rust', makeSkill('rust', ['rust', 'starter']));
      mockSkills.set('go', makeSkill('go', ['go', 'starter']));
      mockSkills.set('python', makeSkill('python', ['python', 'starter']));

      const starters = getStarterPacks();
      expect(starters.map(s => s.metadata.name)).toEqual(['go', 'python', 'rust']);
    });

    it('returns empty array when no starters', () => {
      mockSkills.set('coding-agent', makeSkill('coding-agent', ['agent']));
      expect(getStarterPacks()).toHaveLength(0);
    });
  });

  describe('findStarterPack', () => {
    it('finds a matching starter by query', () => {
      mockSkills.set('typescript-react', makeSkill('typescript-react', ['typescript', 'react', 'starter']));
      const match = findStarterPack('typescript-react');
      expect(match).not.toBeNull();
      expect(match!.skill.metadata.name).toBe('typescript-react');
    });

    it('returns null when no match', () => {
      mockSkills.set('typescript-react', makeSkill('typescript-react', ['typescript', 'react', 'starter']));
      const match = findStarterPack('nonexistent');
      expect(match).toBeNull();
    });
  });

  describe('resolveStarterAlias', () => {
    it('resolves common aliases', () => {
      expect(resolveStarterAlias('react')).toBe('typescript-react');
      expect(resolveStarterAlias('next')).toBe('typescript-nextjs');
      expect(resolveStarterAlias('django')).toBe('python-django');
      expect(resolveStarterAlias('rails')).toBe('ruby-rails');
      expect(resolveStarterAlias('axum')).toBe('rust-axum');
      expect(resolveStarterAlias('spring')).toBe('java-spring');
    });

    it('resolves new aliases', () => {
      expect(resolveStarterAlias('nextjs')).toBe('typescript-nextjs');
      expect(resolveStarterAlias('c#')).toBe('csharp-dotnet');
      expect(resolveStarterAlias('csharp')).toBe('csharp-dotnet');
      expect(resolveStarterAlias('.net')).toBe('csharp-dotnet');
      expect(resolveStarterAlias('go')).toBe('go');
      expect(resolveStarterAlias('reactnative')).toBe('typescript-react-native');
      expect(resolveStarterAlias('react-native')).toBe('typescript-react-native');
      expect(resolveStarterAlias('python')).toBe('python');
      expect(resolveStarterAlias('rust')).toBe('rust');
      expect(resolveStarterAlias('swift')).toBe('swift');
      expect(resolveStarterAlias('elixir')).toBe('elixir');
      expect(resolveStarterAlias('zig')).toBe('zig');
      expect(resolveStarterAlias('java')).toBe('java');
      expect(resolveStarterAlias('kotlin')).toBe('kotlin');
      expect(resolveStarterAlias('php')).toBe('php');
      expect(resolveStarterAlias('ruby')).toBe('ruby');
    });

    it('is case-insensitive', () => {
      expect(resolveStarterAlias('React')).toBe('typescript-react');
      expect(resolveStarterAlias('DJANGO')).toBe('python-django');
    });

    it('passes through unknown names', () => {
      expect(resolveStarterAlias('custom-starter')).toBe('custom-starter');
    });

    it('resolves short aliases', () => {
      expect(resolveStarterAlias('js')).toBe('typescript');
      expect(resolveStarterAlias('ts')).toBe('typescript');
      expect(resolveStarterAlias('py')).toBe('python');
      expect(resolveStarterAlias('rs')).toBe('rust');
      expect(resolveStarterAlias('rb')).toBe('ruby');
    });
  });

  describe('findStarterByKeyword', () => {
    beforeEach(() => {
      // Register starter packs that keywords should resolve to
      mockSkills.set('typescript-react', makeSkill('typescript-react', ['typescript', 'react', 'starter']));
      mockSkills.set('typescript-react-native', makeSkill('typescript-react-native', ['typescript', 'react-native', 'starter']));
      mockSkills.set('go', makeSkill('go', ['go', 'starter']));
      mockSkills.set('python', makeSkill('python', ['python', 'starter']));
      mockSkills.set('typescript-nextjs', makeSkill('typescript-nextjs', ['typescript', 'nextjs', 'starter']));
      mockSkills.set('csharp-dotnet', makeSkill('csharp-dotnet', ['csharp', 'dotnet', 'starter']));
      mockSkills.set('rust', makeSkill('rust', ['rust', 'starter']));
    });

    it('finds a starter via keyword when BM25 would miss', () => {
      const match = findStarterByKeyword('help me set up a new web project with react');
      expect(match).not.toBeNull();
      expect(match!.skill.metadata.name).toBe('typescript-react');
      expect(match!.confidence).toBe(0.5);
    });

    it('uses word boundary for short keywords (go ≠ google)', () => {
      const noMatch = findStarterByKeyword('I want to google something');
      expect(noMatch).toBeNull();

      const match = findStarterByKeyword('build a web server in go');
      expect(match).not.toBeNull();
      expect(match!.skill.metadata.name).toBe('go');
    });

    it('prioritizes longer keywords (react native > react)', () => {
      const match = findStarterByKeyword('create a react native app');
      expect(match).not.toBeNull();
      expect(match!.skill.metadata.name).toBe('typescript-react-native');
    });

    it('matches nextjs alias', () => {
      const match = findStarterByKeyword('create a nextjs app');
      expect(match).not.toBeNull();
      expect(match!.skill.metadata.name).toBe('typescript-nextjs');
    });

    it('matches c# alias', () => {
      const match = findStarterByKeyword('build a c# application');
      expect(match).not.toBeNull();
      expect(match!.skill.metadata.name).toBe('csharp-dotnet');
    });

    it('returns null when no keyword matches', () => {
      const match = findStarterByKeyword('refactor the database queries');
      expect(match).toBeNull();
    });
  });

  describe('findStarterPack with keyword fallback', () => {
    it('falls back to keyword search when BM25 returns no match', () => {
      // BM25 mock returns nothing (query doesn't match skill names)
      // but keyword fallback should find "react" in the query
      mockSkills.set('typescript-react', makeSkill('typescript-react', ['typescript', 'react', 'starter']));

      const match = findStarterPack('help me set up a new web project with react');
      expect(match).not.toBeNull();
      expect(match!.skill.metadata.name).toBe('typescript-react');
      expect(match!.confidence).toBe(0.5);
    });

    it('prefers BM25 match over keyword fallback', () => {
      mockSkills.set('typescript-react', makeSkill('typescript-react', ['typescript', 'react', 'starter']));

      // BM25 mock does match because query contains skill name
      const match = findStarterPack('typescript-react');
      expect(match).not.toBeNull();
      expect(match!.confidence).toBe(0.8); // BM25 mock confidence, not 0.5
    });
  });
});
