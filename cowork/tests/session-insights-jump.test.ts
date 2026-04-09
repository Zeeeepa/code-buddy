import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const sessionInsightsPath = path.resolve(
  process.cwd(),
  'src/renderer/components/SessionInsightsPanel.tsx'
);
const chatViewPath = path.resolve(process.cwd(), 'src/renderer/components/ChatView.tsx');

describe('Session insights jump to message', () => {
  it('sets a focused message target when opening a session message from insights', () => {
    const source = fs.readFileSync(sessionInsightsPath, 'utf8');
    expect(source).toContain('setFocusedMessageTarget');
    expect(source).toContain('openSessionAtMessage');
    expect(source).toContain("title={t('sessionInsights.jumpToMessage'");
  });

  it('exposes transcript audit controls in SessionInsightsPanel', () => {
    const source = fs.readFileSync(sessionInsightsPath, 'utf8');
    expect(source).toContain('loadAudit');
    expect(source).toContain("t('sessionInsights.auditTranscript'");
    expect(source).toContain("t('sessionInsights.auditTitle'");
    expect(source).toContain("t('sessionInsights.repairTranscript'");
  });

  it('ChatView scrolls to a focused message target after switching sessions', () => {
    const source = fs.readFileSync(chatViewPath, 'utf8');
    expect(source).toContain('focusedMessageTarget');
    expect(source).toContain('clearFocusedMessageTarget');
    expect(source).toContain('element.scrollIntoView({ behavior: \'smooth\', block: \'center\' })');
  });
});
