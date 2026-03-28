/**
 * Unit tests for built-in themes
 *
 * Validates that all themes follow the required interface,
 * have no duplicate IDs, and that light themes are properly identifiable.
 */

import { describe, it, expect } from 'vitest';
import { BUILTIN_THEMES } from '../../src/themes/default-themes.js';
import type { ThemeColors, Theme } from '../../src/themes/theme.js';

/**
 * All required color keys in a ThemeColors object.
 */
const REQUIRED_COLOR_KEYS: (keyof ThemeColors)[] = [
  'primary',
  'secondary',
  'accent',
  'text',
  'textMuted',
  'textDim',
  'success',
  'error',
  'warning',
  'info',
  'border',
  'borderActive',
  'borderBusy',
  'userMessage',
  'assistantMessage',
  'toolCall',
  'toolResult',
  'code',
  'spinner',
];

/**
 * Known light themes (by ID) based on their background colors.
 * Note: Currently no light themes are bundled.
 */
const LIGHT_THEME_IDS: string[] = [];

describe('Built-in Themes', () => {
  it('should have at least 15 built-in themes', () => {
    expect(BUILTIN_THEMES.length).toBeGreaterThanOrEqual(15);
  });

  it('should have unique IDs across all themes', () => {
    const ids = BUILTIN_THEMES.map(t => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have unique names across all themes', () => {
    const names = BUILTIN_THEMES.map(t => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it.each(BUILTIN_THEMES.map(t => [t.id, t]))('theme "%s" has all required top-level fields', (_id, theme) => {
    const t = theme as Theme;
    expect(t.id).toBeTruthy();
    expect(t.name).toBeTruthy();
    expect(t.description).toBeTruthy();
    expect(t.colors).toBeDefined();
    expect(t.avatars).toBeDefined();
    expect(typeof t.isBuiltin).toBe('boolean');
    expect(t.isBuiltin).toBe(true);
  });

  it.each(BUILTIN_THEMES.map(t => [t.id, t]))('theme "%s" has all required color fields', (_id, theme) => {
    const t = theme as Theme;
    for (const key of REQUIRED_COLOR_KEYS) {
      expect(t.colors[key], `Missing color key "${key}" in theme "${t.id}"`).toBeTruthy();
    }
  });

  it.each(BUILTIN_THEMES.map(t => [t.id, t]))('theme "%s" has valid avatar config', (_id, theme) => {
    const t = theme as Theme;
    expect(t.avatars.user).toBeTruthy();
    expect(t.avatars.assistant).toBeTruthy();
    expect(t.avatars.tool).toBeTruthy();
    expect(t.avatars.system).toBeTruthy();
  });

  it.each(BUILTIN_THEMES.map(t => [t.id, t]))('theme "%s" colors are valid color strings', (_id, theme) => {
    const t = theme as Theme;
    for (const key of REQUIRED_COLOR_KEYS) {
      const color = t.colors[key];
      expect(typeof color).toBe('string');
      // Color should be a named color, or hex (starting with #)
      const isNamed = /^[a-zA-Z]+$/.test(color as string);
      const isHex = /^#[0-9a-fA-F]{3,8}/.test(color as string);
      expect(
        isNamed || isHex,
        `Invalid color "${color}" for key "${key}" in theme "${t.id}"`
      ).toBe(true);
    }
  });

  it('should contain all classic dark themes', () => {
    const themeIds = BUILTIN_THEMES.map(t => t.id);
    // Verify some known dark themes exist
    expect(themeIds).toContain('dark');
    expect(themeIds).toContain('neon');
    expect(themeIds).toContain('matrix');
  });

  it('should contain all the classic themes', () => {
    const themeIds = BUILTIN_THEMES.map(t => t.id);
    const classicIds = ['default', 'dark', 'neon', 'matrix', 'ocean', 'catppuccin', 'dracula', 'nord'];
    for (const id of classicIds) {
      expect(themeIds).toContain(id);
    }
  });

  it('should contain popular editor-inspired themes', () => {
    const themeIds = BUILTIN_THEMES.map(t => t.id);
    // Verify well-known editor themes that are actually bundled
    const expectedThemes = ['catppuccin', 'dracula', 'nord', 'tokyo-night', 'one-dark', 'gruvbox', 'monokai'];
    for (const id of expectedThemes) {
      expect(themeIds, `Missing theme: ${id}`).toContain(id);
    }
  });
});
