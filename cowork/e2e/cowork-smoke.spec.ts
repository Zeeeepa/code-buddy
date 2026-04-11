import { expect, test } from './fixtures';
import {
  createAndActivateProject,
  expectSavedRule,
  injectPermissionRequest,
} from './permission-helpers';

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

test('switches the renderer language to French from Settings', async ({ appPage }) => {
  await appPage.getByTestId('sidebar-settings-button').click();
  await expect(appPage.getByTestId('settings-panel')).toBeVisible({ timeout: 20000 });
  await appPage.getByTestId('settings-tab-general').click();
  await appPage.getByRole('button', { name: 'Français' }).click();

  await expect(appPage.getByRole('heading', { name: 'Apparence' })).toBeVisible();
  await expect(appPage.getByRole('heading', { name: 'Langue' })).toBeVisible();
  await expect
    .poll(() => appPage.evaluate(() => window.localStorage.getItem('i18nextLng')))
    .toBe('fr');
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

test('denies a permission request and opens permission rules prefilled for review', async ({
  appPage,
}) => {
  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-tool-use',
    toolName: 'mcp__Chrome__navigate_page',
    input: { url: 'https://example.com/settings' },
    action: 'chrome.navigate',
    details: {
      url: 'https://example.com/settings',
      app: 'Chrome',
      target: 'Settings page',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage.getByTestId('permission-deny-review-button').click();

  await expect(appPage.getByTestId('settings-panel')).toBeVisible();
  await expect(appPage.getByTestId('settings-tab-rules')).toBeVisible();
  await expect(appPage.getByTestId('settings-permission-rules')).toBeVisible();
  await expect(appPage.getByTestId('settings-rules-test-tool-input')).toHaveValue(
    'mcp__Chrome__navigate_page'
  );
  await expect(appPage.getByTestId('settings-rules-test-arg-input')).toHaveValue(
    'https://example.com/settings'
  );
  await expect(appPage.getByTestId('settings-rules-deny-input')).toHaveValue(
    'mcp__Chrome__navigate_page(https://example.com/*)'
  );
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
});

test('allows a permission request and opens permission rules with the edited allow draft', async ({
  appPage,
}) => {
  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-tool-use-allow',
    toolName: 'mcp__Chrome__navigate_page',
    input: { url: 'https://example.com/account/profile' },
    action: 'chrome.navigate',
    details: {
      url: 'https://example.com/account/profile',
      app: 'Chrome',
      target: 'Profile page',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage
    .getByTestId('permission-scoped-rule-draft-input')
    .fill('mcp__Chrome__navigate_page(https://example.com/account/*)');
  await appPage.getByTestId('permission-allow-review-button').click();

  await expect(appPage.getByTestId('settings-panel')).toBeVisible();
  await expect(appPage.getByTestId('settings-permission-rules')).toBeVisible();
  await expect(appPage.getByTestId('settings-rules-test-tool-input')).toHaveValue(
    'mcp__Chrome__navigate_page'
  );
  await expect(appPage.getByTestId('settings-rules-test-arg-input')).toHaveValue(
    'https://example.com/account/profile'
  );
  await expect(appPage.getByTestId('settings-rules-allow-input')).toHaveValue(
    'mcp__Chrome__navigate_page(https://example.com/account/*)'
  );
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
});

test('saves a deny target rule and the next matching permission is pre-blocked by that rule', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-save-workspace',
    'E2E Rules Save'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-rule-1',
    toolName: 'mcp__Chrome__navigate_page',
    input: { url: 'https://example.com/admin/panel' },
    projectId,
    action: 'chrome.navigate',
    details: {
      url: 'https://example.com/admin/panel',
      app: 'Chrome',
      target: 'Admin panel',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage.getByTestId('permission-always-deny-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'mcp__Chrome__navigate_page(https://example.com/*)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-rule-2',
    toolName: 'mcp__Chrome__navigate_page',
    input: { url: 'https://example.com/admin/users' },
    projectId,
    action: 'chrome.navigate',
    details: {
      url: 'https://example.com/admin/users',
      app: 'Chrome',
      target: 'Admin users',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-rule-preview')).toContainText(
    'A saved deny rule would block this request.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-covered-note')).toContainText(
    'This request is already covered by a saved deny rule.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-matched-rule')).toContainText(
    'mcp__Chrome__navigate_page(https://example.com/*)'
  );
  await expect(appPage.getByTestId('permission-allow-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-deny-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
});

test('saves an allow target rule and the next matching permission is pre-approved by that rule', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-save-workspace-allow',
    'E2E Rules Save Allow'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-allow-rule-1',
    toolName: 'mcp__Chrome__navigate_page',
    input: { url: 'https://example.com/docs/getting-started' },
    projectId,
    action: 'chrome.navigate',
    details: {
      url: 'https://example.com/docs/getting-started',
      app: 'Chrome',
      target: 'Docs getting started',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage.getByTestId('permission-always-allow-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'mcp__Chrome__navigate_page(https://example.com/*)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-allow-rule-2',
    toolName: 'mcp__Chrome__navigate_page',
    input: { url: 'https://example.com/docs/reference' },
    projectId,
    action: 'chrome.navigate',
    details: {
      url: 'https://example.com/docs/reference',
      app: 'Chrome',
      target: 'Docs reference',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-rule-preview')).toContainText(
    'A saved allow rule would auto-approve this request.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-covered-note')).toContainText(
    'This request is already covered by a saved allow rule.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-matched-rule')).toContainText(
    'mcp__Chrome__navigate_page(https://example.com/*)'
  );
  await expect(appPage.getByTestId('permission-allow-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-deny-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
});

test('saves a target-based gui deny rule and matches the next non-url permission by target', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-save-workspace-target',
    'E2E Rules Save Target'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-target-rule-1',
    toolName: 'mcp__Computer__click',
    input: { target: 'Save button' },
    projectId,
    action: 'computer.click',
    details: {
      app: 'Desktop App',
      target: 'Save button',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage.getByTestId('permission-always-deny-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'mcp__Computer__click(Save button*)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-target-rule-2',
    toolName: 'mcp__Computer__click',
    input: { target: 'Save button primary' },
    projectId,
    action: 'computer.click',
    details: {
      app: 'Desktop App',
      target: 'Save button primary',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-rule-preview')).toContainText(
    'A saved deny rule would block this request.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-covered-note')).toContainText(
    'This request is already covered by a saved deny rule.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-matched-rule')).toContainText(
    'mcp__Computer__click(Save button*)'
  );
  await expect(appPage.getByTestId('permission-covered-suggestion-note')).toContainText(
    'mcp__Computer__click(Save button primary*)'
  );
  await expect(appPage.getByTestId('permission-review-covered-rule-button')).toContainText(
    'Review a more specific deny rule'
  );
  await expect(appPage.getByTestId('permission-allow-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-deny-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
});

test('reviews a more specific deny rule from a covered target-based permission', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-review-workspace-target-deny',
    'E2E Rules Review Target Deny'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-review-target-deny-1',
    toolName: 'mcp__Computer__click',
    input: { target: 'Save button' },
    projectId,
    action: 'computer.click',
    details: {
      app: 'Desktop App',
      target: 'Save button',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage.getByTestId('permission-always-deny-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'mcp__Computer__click(Save button*)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-review-target-deny-2',
    toolName: 'mcp__Computer__click',
    input: { target: 'Save button primary' },
    projectId,
    action: 'computer.click',
    details: {
      app: 'Desktop App',
      target: 'Save button primary',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-review-covered-rule-button')).toContainText(
    'Review a more specific deny rule'
  );
  await appPage.getByTestId('permission-review-covered-rule-button').click();

  await expect(appPage.getByTestId('settings-panel')).toBeVisible();
  await expect(appPage.getByTestId('settings-permission-rules')).toBeVisible();
  await expect(appPage.getByTestId('settings-rules-test-tool-input')).toHaveValue(
    'mcp__Computer__click'
  );
  await expect(appPage.getByTestId('settings-rules-test-arg-input')).toHaveValue(
    'Save button primary'
  );
  await expect(appPage.getByTestId('settings-rules-deny-input')).toHaveValue(
    'mcp__Computer__click(Save button primary*)'
  );
});

test('saves a target-based gui allow rule and matches the next non-url permission by target', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-save-workspace-target-allow',
    'E2E Rules Save Target Allow'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-target-allow-rule-1',
    toolName: 'mcp__Computer__click',
    input: { target: 'Confirm button' },
    projectId,
    action: 'computer.click',
    details: {
      app: 'Desktop App',
      target: 'Confirm button',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage.getByTestId('permission-always-allow-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'mcp__Computer__click(Confirm button*)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-target-allow-rule-2',
    toolName: 'mcp__Computer__click',
    input: { target: 'Confirm button primary' },
    projectId,
    action: 'computer.click',
    details: {
      app: 'Desktop App',
      target: 'Confirm button primary',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-rule-preview')).toContainText(
    'A saved allow rule would auto-approve this request.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-covered-note')).toContainText(
    'This request is already covered by a saved allow rule.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-matched-rule')).toContainText(
    'mcp__Computer__click(Confirm button*)'
  );
  await expect(appPage.getByTestId('permission-covered-suggestion-note')).toContainText(
    'mcp__Computer__click(Confirm button primary*)'
  );
  await expect(appPage.getByTestId('permission-review-covered-rule-button')).toContainText(
    'Review a more specific allow rule'
  );
  await expect(appPage.getByTestId('permission-allow-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-deny-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
});

test('saves a bash deny rule and the next matching command is pre-blocked', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-save-workspace-bash-deny',
    'E2E Rules Save Bash Deny'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-bash-deny-1',
    toolName: 'Bash',
    input: { command: 'npm test && npm run lint' },
    projectId,
    action: 'bash.exec',
    details: {
      command: 'npm test && npm run lint',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-scoped-rule-draft-input')).toHaveValue('Bash(npm *)');
  await appPage.getByTestId('permission-always-deny-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'Bash(npm *)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-bash-deny-2',
    toolName: 'Bash',
    input: { command: 'npm run build' },
    projectId,
    action: 'bash.exec',
    details: {
      command: 'npm run build',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-rule-preview')).toContainText(
    'A saved deny rule would block this request.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-covered-note')).toContainText(
    'This request is already covered by a saved deny rule.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-matched-rule')).toContainText(
    'Bash(npm *)'
  );
  await expect(appPage.getByTestId('permission-covered-suggestion-note')).toContainText(
    'Bash(npm run build)'
  );
  await expect(appPage.getByTestId('permission-review-covered-rule-button')).toContainText(
    'Review a more specific deny rule'
  );
  await expect(appPage.getByTestId('permission-allow-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-deny-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
});

test('saves a bash allow rule and the next matching command is pre-approved', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-save-workspace-bash-allow',
    'E2E Rules Save Bash Allow'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-bash-allow-1',
    toolName: 'Bash',
    input: { command: 'git status && git diff' },
    projectId,
    action: 'bash.exec',
    details: {
      command: 'git status && git diff',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-scoped-rule-draft-input')).toHaveValue('Bash(git *)');
  await appPage.getByTestId('permission-always-allow-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'Bash(git *)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-bash-allow-2',
    toolName: 'Bash',
    input: { command: 'git log --oneline' },
    projectId,
    action: 'bash.exec',
    details: {
      command: 'git log --oneline',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-rule-preview')).toContainText(
    'A saved allow rule would auto-approve this request.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-covered-note')).toContainText(
    'This request is already covered by a saved allow rule.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-matched-rule')).toContainText(
    'Bash(git *)'
  );
  await expect(appPage.getByTestId('permission-covered-suggestion-note')).toContainText(
    'Bash(git log --oneline)'
  );
  await expect(appPage.getByTestId('permission-review-covered-rule-button')).toContainText(
    'Review a more specific allow rule'
  );
  await expect(appPage.getByTestId('permission-allow-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-deny-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
});

test('reviews a more specific bash deny rule from a covered command', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-review-workspace-bash-deny',
    'E2E Rules Review Bash Deny'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-review-bash-deny-1',
    toolName: 'Bash',
    input: { command: 'npm test && npm run lint' },
    projectId,
    action: 'bash.exec',
    details: {
      command: 'npm test && npm run lint',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage.getByTestId('permission-always-deny-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'Bash(npm *)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-review-bash-deny-2',
    toolName: 'Bash',
    input: { command: 'npm run build' },
    projectId,
    action: 'bash.exec',
    details: {
      command: 'npm run build',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-review-covered-rule-button')).toContainText(
    'Review a more specific deny rule'
  );
  await appPage.getByTestId('permission-review-covered-rule-button').click();

  await expect(appPage.getByTestId('settings-panel')).toBeVisible();
  await expect(appPage.getByTestId('settings-permission-rules')).toBeVisible();
  await expect(appPage.getByTestId('settings-rules-test-tool-input')).toHaveValue('Bash');
  await expect(appPage.getByTestId('settings-rules-test-arg-input')).toHaveValue('npm run build');
  await expect(appPage.getByTestId('settings-rules-deny-input')).toHaveValue(
    'Bash(npm run build)'
  );
});

test('reviews a more specific bash allow rule from a covered command', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-review-workspace-bash-allow',
    'E2E Rules Review Bash Allow'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-review-bash-allow-1',
    toolName: 'Bash',
    input: { command: 'git status && git diff' },
    projectId,
    action: 'bash.exec',
    details: {
      command: 'git status && git diff',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage.getByTestId('permission-always-allow-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'Bash(git *)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-review-bash-allow-2',
    toolName: 'Bash',
    input: { command: 'git log --oneline' },
    projectId,
    action: 'bash.exec',
    details: {
      command: 'git log --oneline',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-review-covered-rule-button')).toContainText(
    'Review a more specific allow rule'
  );
  await appPage.getByTestId('permission-review-covered-rule-button').click();

  await expect(appPage.getByTestId('settings-panel')).toBeVisible();
  await expect(appPage.getByTestId('settings-permission-rules')).toBeVisible();
  await expect(appPage.getByTestId('settings-rules-test-tool-input')).toHaveValue('Bash');
  await expect(appPage.getByTestId('settings-rules-test-arg-input')).toHaveValue(
    'git log --oneline'
  );
  await expect(appPage.getByTestId('settings-rules-allow-input')).toHaveValue(
    'Bash(git log --oneline)'
  );
});

test('saves an edit deny rule and the next matching file permission is pre-blocked', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-save-workspace-edit-deny',
    'E2E Rules Save Edit Deny'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-edit-deny-1',
    toolName: 'Edit',
    input: { file_path: 'src\\components\\Button.tsx' },
    projectId,
    action: 'edit.file',
    details: {
      file_path: 'src\\components\\Button.tsx',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-scoped-rule-draft-input')).toHaveValue(
    'Edit(src/components/Button.tsx)'
  );
  await appPage.getByTestId('permission-always-deny-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'Edit(src/components/Button.tsx)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-edit-deny-2',
    toolName: 'Edit',
    input: { file_path: 'src\\components\\Button.tsx' },
    projectId,
    action: 'edit.file',
    details: {
      file_path: 'src\\components\\Button.tsx',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-rule-preview')).toContainText(
    'A saved deny rule would block this request.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-matched-rule')).toContainText(
    'Edit(src/components/Button.tsx)'
  );
  await expect(appPage.getByTestId('permission-allow-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-deny-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
});

test('saves a write allow rule and the next matching file permission is pre-approved', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-save-workspace-write-allow',
    'E2E Rules Save Write Allow'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-write-allow-1',
    toolName: 'Write',
    input: { file_path: 'docs\\guide.md' },
    projectId,
    action: 'write.file',
    details: {
      file_path: 'docs\\guide.md',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-scoped-rule-draft-input')).toHaveValue(
    'Write(docs/guide.md)'
  );
  await appPage.getByTestId('permission-always-allow-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'Write(docs/guide.md)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-write-allow-2',
    toolName: 'Write',
    input: { file_path: 'docs\\guide.md' },
    projectId,
    action: 'write.file',
    details: {
      file_path: 'docs\\guide.md',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-rule-preview')).toContainText(
    'A saved allow rule would auto-approve this request.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-matched-rule')).toContainText(
    'Write(docs/guide.md)'
  );
  await expect(appPage.getByTestId('permission-allow-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-deny-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
});

test('uses a folder-scoped file rule so a sibling file in the same directory also matches', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-save-workspace-folder-allow',
    'E2E Rules Save Folder Allow'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-folder-allow-1',
    toolName: 'Write',
    input: { file_path: 'docs\\guide.md' },
    projectId,
    action: 'write.file',
    details: {
      file_path: 'docs\\guide.md',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-scoped-rule-draft-input')).toHaveValue(
    'Write(docs/guide.md)'
  );
  await appPage.getByTestId('permission-use-folder-rule-button').click();
  await expect(appPage.getByTestId('permission-scoped-rule-draft-input')).toHaveValue(
    'Write(docs/*)'
  );
  await appPage.getByTestId('permission-always-allow-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'Write(docs/*)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-save-folder-allow-2',
    toolName: 'Write',
    input: { file_path: 'docs\\reference.md' },
    projectId,
    action: 'write.file',
    details: {
      file_path: 'docs\\reference.md',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-rule-preview')).toContainText(
    'A saved allow rule would auto-approve this request.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-covered-note')).toContainText(
    'This request is already covered by a saved allow rule.'
  );
  await expect(appPage.getByTestId('permission-rule-preview-matched-rule')).toContainText(
    'Write(docs/*)'
  );
  await expect(appPage.getByTestId('permission-covered-suggestion-note')).toContainText(
    'Write(docs/reference.md)'
  );
  await expect(appPage.getByTestId('permission-review-covered-rule-button')).toContainText(
    'Review a more specific allow rule'
  );
  await expect(appPage.getByTestId('permission-allow-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-deny-review-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-allow-target-button')).toHaveCount(0);
  await expect(appPage.getByTestId('permission-always-deny-target-button')).toHaveCount(0);
});

test('reviews a more specific allow rule from a covered folder-scoped file permission', async ({
  appPage,
  userDataDir,
}) => {
  const { projectId, settingsPath } = await createAndActivateProject(
    appPage,
    userDataDir,
    'rules-review-workspace-folder-allow',
    'E2E Rules Review Folder Allow'
  );

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-review-folder-allow-1',
    toolName: 'Write',
    input: { file_path: 'docs\\guide.md' },
    projectId,
    action: 'write.file',
    details: {
      file_path: 'docs\\guide.md',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await appPage.getByTestId('permission-use-folder-rule-button').click();
  await appPage.getByTestId('permission-always-allow-target-button').click();
  await expect(appPage.getByTestId('permission-dialog')).toBeHidden();

  await expectSavedRule(settingsPath, 'Write(docs/*)');

  await injectPermissionRequest(appPage, {
    toolUseId: 'e2e-permission-review-folder-allow-2',
    toolName: 'Write',
    input: { file_path: 'docs\\reference.md' },
    projectId,
    action: 'write.file',
    details: {
      file_path: 'docs\\reference.md',
    },
  });

  await expect(appPage.getByTestId('permission-dialog')).toBeVisible();
  await expect(appPage.getByTestId('permission-review-covered-rule-button')).toContainText(
    'Review a more specific allow rule'
  );
  await appPage.getByTestId('permission-review-covered-rule-button').click();

  await expect(appPage.getByTestId('settings-panel')).toBeVisible();
  await expect(appPage.getByTestId('settings-permission-rules')).toBeVisible();
  await expect(appPage.getByTestId('settings-rules-test-tool-input')).toHaveValue('Write');
  await expect(appPage.getByTestId('settings-rules-test-arg-input')).toHaveValue(
    'docs\\reference.md'
  );
  await expect(appPage.getByTestId('settings-rules-allow-input')).toHaveValue(
    'Write(docs/reference.md)'
  );
});
