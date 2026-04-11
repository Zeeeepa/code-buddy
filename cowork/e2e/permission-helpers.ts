import { expect as pwExpect, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

type InjectPermissionArgs = {
  toolUseId: string;
  toolName: string;
  input: Record<string, unknown>;
  sessionId?: string;
  projectId?: string;
  action?: string;
  details?: Record<string, unknown>;
};

export async function injectPermissionRequest(
  appPage: Page,
  args: InjectPermissionArgs
): Promise<void> {
  await appPage.evaluate((request) => {
    const injected = (
      window as typeof window & {
        __injectPermissionRequest?: (
          permission: {
            toolUseId: string;
            toolName: string;
            input: Record<string, unknown>;
            sessionId: string;
          },
          guiAction?: {
            projectId?: string;
            details?: Record<string, unknown>;
            action?: string;
          }
        ) => boolean;
      }
    ).__injectPermissionRequest?.(
      {
        toolUseId: request.toolUseId,
        toolName: request.toolName,
        input: request.input,
        sessionId: request.sessionId ?? 'e2e-session',
      },
      {
        action: request.action ?? 'test.permission',
        projectId: request.projectId,
        details: request.details,
      }
    );

    if (!injected) {
      throw new Error('permission injection hook unavailable');
    }
  }, args);
}

export async function createAndActivateProject(
  appPage: Page,
  userDataDir: string,
  folderName: string,
  name: string
): Promise<{ projectId: string; workspacePath: string; settingsPath: string }> {
  const workspacePath = path.join(userDataDir, folderName);
  mkdirSync(workspacePath, { recursive: true });

  const projectId = await appPage.evaluate(async ({ workspacePath: wsPath, name: projectName }) => {
    const project = await window.electronAPI.project.create({
      name: projectName,
      workspacePath: wsPath,
    });
    await window.electronAPI.project.setActive(project.id);
    return project.id;
  }, { workspacePath, name });

  await appPage.waitForFunction((expectedProjectId) => {
    const status = (
      window as typeof window & {
        __getNavStatus?: () => { activeProjectId?: string | null };
      }
    ).__getNavStatus?.();
    return status?.activeProjectId === expectedProjectId;
  }, projectId);

  return {
    projectId,
    workspacePath,
    settingsPath: path.join(workspacePath, '.codebuddy', 'settings.json'),
  };
}

export async function expectSavedRule(settingsPath: string, rule: string): Promise<void> {
  await pwExpect
    .poll(() => {
      if (!existsSync(settingsPath)) {
        return '';
      }
      return readFileSync(settingsPath, 'utf8');
    })
    .toContain(rule);
}
