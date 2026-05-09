/**
 * Recent-features smoke — covers the user-facing surface area shipped
 * across Phases 1, 2, 6, 7, 8, 9 of the multi-session sprint.
 *
 * The most valuable test in this file is the IPC liveness check at the
 * bottom — it spawns the app, fires a renderer→main→renderer roundtrip
 * via `voice.status`, and fails if the response never arrives. That's
 * the regression net for the dual-`mainWindow` bug we hunted with CDP.
 */
import { expect, test } from './fixtures';

const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';

test('titlebar help button is rendered with the right test id (Phase 1)', async ({ appPage }) => {
  const helpBtn = appPage.getByTestId('shortcuts-help-button');
  await expect(helpBtn).toBeVisible();
  // Click-to-open is exercised via the keyboard shortcut test below; here
  // we only assert the button surface so that a future regression
  // removing the help icon trips the suite.
});

test('shortcuts dialog opens via Ctrl+/ keyboard shortcut (Phase 1)', async ({ appPage }) => {
  await appPage.keyboard.press(`${modKey}+/`);
  await expect(appPage.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await appPage.keyboard.press('Escape');
});

test('server power toggle is rendered in the titlebar (Phase 9)', async ({ appPage }) => {
  await expect(appPage.getByTestId('server-toggle-button')).toBeVisible();
});

test('voice IPC bridge is exposed to the renderer (Phase 8)', async ({ appPage }) => {
  // The MicButton is rendered conditionally inside ChatView. On a fresh
  // profile the welcome view is visible instead, so the button isn't in
  // the DOM yet. Asserting the IPC surface is the next-best smoke
  // signal: if voice.transcribe/voice.status are missing from preload,
  // the mic UI can't possibly work.
  const exposed = await appPage.evaluate(() => {
    const api = (window as unknown as {
      electronAPI?: { voice?: { transcribe?: unknown; status?: unknown } };
    }).electronAPI;
    return {
      hasVoice: typeof api?.voice === 'object',
      hasTranscribe: typeof api?.voice?.transcribe === 'function',
      hasStatus: typeof api?.voice?.status === 'function',
    };
  });
  expect(exposed.hasVoice).toBe(true);
  expect(exposed.hasTranscribe).toBe(true);
  expect(exposed.hasStatus).toBe(true);
});

test('IPC liveness — voice.status round-trips successfully (mainWindow regression)', async ({
  electronApp,
  appPage,
}) => {
  // This is the regression net for the dual-`mainWindow` bug. If the
  // renderer's `electronAPI.voice.status()` never resolves, the IPC
  // wiring is broken (which is exactly what happened in 2026-04-29).
  await appPage.waitForFunction(() => Boolean((window as { electronAPI?: unknown }).electronAPI), {
    timeout: 10000,
  });
  const result = await appPage.evaluate(async () => {
    const api = (window as unknown as {
      electronAPI?: { voice?: { status?: () => Promise<unknown> } };
    }).electronAPI;
    if (!api?.voice?.status) return { ok: false, reason: 'voice.status missing' };
    try {
      const r = await api.voice.status();
      return { ok: true, response: r };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  });
  expect(result.ok).toBe(true);
  // Bonus: the response should match the documented shape.
  if (result.ok && 'response' in result) {
    expect(result.response).toHaveProperty('available');
  }
  // Sanity: the electron app is alive throughout the round-trip.
  expect(electronApp.windows().length).toBeGreaterThan(0);
});

test('Cmd+K (or Ctrl+K) opens global search and a query types into the input', async ({
  appPage,
}) => {
  await appPage.keyboard.press(`${modKey}+Shift+K`);
  const dialog = appPage.getByTestId('global-search-dialog');
  await expect(dialog).toBeVisible();
  const input = appPage.getByTestId('global-search-input');
  await expect(input).toBeFocused();
  // Phase 3 — typing a substring should debounce the search; we only
  // assert the input value, not the result list (no fixture data).
  await input.fill('hello');
  await expect(input).toHaveValue('hello');
  await appPage.keyboard.press('Escape');
});
