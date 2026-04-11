import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const configPath = path.resolve(process.cwd(), 'src/renderer/i18n/config.ts');
const settingsGeneralPath = path.resolve(
  process.cwd(),
  'src/renderer/components/settings/SettingsGeneral.tsx'
);
const i18nFormatPath = path.resolve(process.cwd(), 'src/renderer/utils/i18n-format.ts');
const voiceButtonPath = path.resolve(process.cwd(), 'src/renderer/components/VoiceButton.tsx');
const exportSessionPath = path.resolve(process.cwd(), 'src/renderer/utils/export-session.ts');
const remoteControlPanelPath = path.resolve(
  process.cwd(),
  'src/renderer/components/RemoteControlPanel.tsx'
);
const enLocalePath = path.resolve(process.cwd(), 'src/renderer/i18n/locales/en.json');
const frLocalePath = path.resolve(process.cwd(), 'src/renderer/i18n/locales/fr.json');
const localeAwareRendererSurfaces = [
  path.resolve(process.cwd(), 'src/renderer/components/ActivityFeed.tsx'),
  path.resolve(process.cwd(), 'src/renderer/components/AuditLogViewer.tsx'),
  path.resolve(process.cwd(), 'src/renderer/components/BookmarksPanel.tsx'),
  path.resolve(process.cwd(), 'src/renderer/components/CheckpointPanel.tsx'),
  path.resolve(process.cwd(), 'src/renderer/components/MemoryBrowser.tsx'),
  path.resolve(process.cwd(), 'src/renderer/components/NotificationCenter.tsx'),
  path.resolve(process.cwd(), 'src/renderer/components/ReasoningTraceViewer.tsx'),
  path.resolve(process.cwd(), 'src/renderer/components/SessionInsightsPanel.tsx'),
];
const translatedChromeSurfaces: Array<[string, string[]]> = [
  [
    path.resolve(process.cwd(), 'src/renderer/components/CommandPalette.tsx'),
    ['commandPalette.searchPlaceholder', 'commandPalette.empty', 'shortcutsDialog.title'],
  ],
  [
    path.resolve(process.cwd(), 'src/renderer/components/FileTree.tsx'),
    ['fileTree.filterPlaceholder', 'fileTree.empty'],
  ],
  [
    path.resolve(process.cwd(), 'src/renderer/components/KeyboardShortcutsDialog.tsx'),
    ['shortcutsDialog.title', 'shortcutsDialog.openCommandPalette'],
  ],
  [
    path.resolve(process.cwd(), 'src/renderer/components/SessionSearch.tsx'),
    ['sessionSearch.placeholder', 'sessionSearch.previous', 'sessionSearch.close'],
  ],
  [
    path.resolve(process.cwd(), 'src/renderer/components/Titlebar.tsx'),
    ['bookmarks.title', 'activity.title', 'notifications.title'],
  ],
  [
    path.resolve(process.cwd(), 'src/renderer/components/UpdateNotification.tsx'),
    ['updateNotification.downloaded', 'updateNotification.download'],
  ],
  [
    path.resolve(process.cwd(), 'src/renderer/components/ContextPanel.tsx'),
    ['git.noWorkingDir'],
  ],
  [
    path.resolve(process.cwd(), 'src/renderer/components/FileAttachmentChip.tsx'),
    ['common.remove'],
  ],
];

function collectPaths(value: unknown, base = ''): string[] {
  if (typeof value === 'string' || value === null || typeof value !== 'object') {
    return [base];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectPaths(item, `${base}[${index}]`));
  }
  return Object.entries(value).flatMap(([key, child]) =>
    collectPaths(child, base ? `${base}.${key}` : key)
  );
}

describe('French renderer i18n support', () => {
  it('registers fr in the renderer i18n config', () => {
    const source = fs.readFileSync(configPath, 'utf8');
    expect(source).toContain("import frTranslations from './locales/fr.json'");
    expect(source).toContain('fr: {');
    expect(source).toContain("supportedLngs: ['en', 'fr', 'zh']");
    expect(source).toContain("load: 'languageOnly'");
  });

  it('exposes Français as a selectable language in SettingsGeneral', () => {
    const source = fs.readFileSync(settingsGeneralPath, 'utf8');
    expect(source).toContain("i18n.language.startsWith('fr')");
    expect(source).toContain("{ code: 'fr', nativeName: 'Français' }");
  });

  it('formats app locale using fr-FR when French is active', () => {
    const source = fs.readFileSync(i18nFormatPath, 'utf8');
    expect(source).toContain("if (normalizedLanguage.startsWith('fr'))");
    expect(source).toContain("return 'fr-FR'");
    expect(source).toContain('export function formatAppTime');
    expect(source).toContain('export function formatAppNumber');
    expect(source).toContain('export function getAppListSeparator');
  });

  it('routes voice, export, and list formatting through the app locale', () => {
    const voiceSource = fs.readFileSync(voiceButtonPath, 'utf8');
    const exportSource = fs.readFileSync(exportSessionPath, 'utf8');
    const remoteSource = fs.readFileSync(remoteControlPanelPath, 'utf8');

    expect(voiceSource).toContain("language = getAppLocale()");
    expect(exportSource).toContain("formatAppDateTime(new Date())");
    expect(exportSource).toContain("exportSession.exportedOn");
    expect(remoteSource).toContain('getAppListSeparator(i18n.language)');
  });

  it('uses locale-aware date and time helpers on visible renderer surfaces', () => {
    for (const filePath of localeAwareRendererSurfaces) {
      const source = fs.readFileSync(filePath, 'utf8');
      expect(source).toMatch(/formatApp(Date|DateTime|Time|Number)/);
      expect(source).not.toMatch(/toLocale(Date|Time|String)\(/);
    }
  });

  it('localizes visible shell components instead of hardcoding English chrome strings', () => {
    for (const [filePath, expectedKeys] of translatedChromeSurfaces) {
      const source = fs.readFileSync(filePath, 'utf8');
      expect(source).toContain('t(');
      for (const key of expectedKeys) {
        expect(source).toContain(key);
      }
    }
  });

  it('keeps fr locale structure aligned with en locale', () => {
    const enLocale = JSON.parse(fs.readFileSync(enLocalePath, 'utf8'));
    const frLocale = JSON.parse(fs.readFileSync(frLocalePath, 'utf8'));
    expect(collectPaths(frLocale)).toEqual(collectPaths(enLocale));
  });
});
