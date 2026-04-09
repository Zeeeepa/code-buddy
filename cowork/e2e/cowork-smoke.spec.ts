import { expect, test } from './fixtures';

const modKey = process.platform === 'darwin' ? 'Meta' : 'Control';

test('shows the welcome view on a fresh profile', async ({ appPage }) => {
  await expect(appPage.getByTestId('welcome-view')).toBeVisible();
  await expect(appPage.getByTestId('welcome-api-settings-cta')).toBeVisible();
});

test('opens Settings and renders the A2A registry tab', async ({ appPage }) => {
  await appPage.getByTestId('sidebar-settings-button').click();

  await expect(appPage.getByTestId('settings-panel')).toBeVisible({ timeout: 20000 });
  await appPage.getByTestId('settings-tab-a2a').click();
  await expect(appPage.getByTestId('settings-a2a-agents')).toBeVisible();
  await expect(appPage.getByTestId('a2a-add-url-input')).toBeVisible();
  await expect(appPage.getByTestId('a2a-empty-state')).toBeVisible();
});

test('opens the global search dialog from the keyboard shortcut', async ({ appPage }) => {
  await appPage.keyboard.press(`${modKey}+Shift+K`);

  await expect(appPage.getByTestId('global-search-dialog')).toBeVisible();
  await expect(appPage.getByTestId('global-search-input')).toBeFocused();
  await expect(appPage.getByTestId('global-search-empty-state')).toBeVisible();
});

test('opens the reasoning trace viewer from the keyboard shortcut', async ({ appPage }) => {
  await appPage.keyboard.press(`${modKey}+Shift+R`);

  await expect(appPage.getByTestId('reasoning-trace-viewer')).toBeVisible();
  await expect(appPage.getByTestId('reasoning-empty-state')).toBeVisible();
});

test('opens the session insights panel from the titlebar', async ({ appPage }) => {
  await appPage.getByTestId('session-insights-button').click();

  await expect(appPage.getByTestId('session-insights-panel')).toBeVisible();
  await expect(appPage.getByTestId('session-insights-empty')).toBeVisible();
});

test('opens the session resume dialog from the welcome view', async ({ appPage }) => {
  await appPage.getByTestId('welcome-resume-session').click();

  await expect(appPage.getByTestId('session-resume-dialog')).toBeVisible();
  await expect(appPage.getByTestId('session-resume-empty')).toBeVisible();
});

test('opens the focus view from the titlebar', async ({ appPage }) => {
  await appPage.getByTestId('focus-view-button').click();

  await expect(appPage.getByTestId('focus-view')).toBeVisible();
  await expect(appPage.getByTestId('focus-view-empty')).toBeVisible();
});
