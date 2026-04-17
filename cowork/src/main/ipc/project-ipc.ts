import { ipcMain } from 'electron';
import type { ProjectManager, ProjectCreateInput, ProjectUpdateInput } from '../project/project-manager';
import type { ActivityFeed } from '../activity/activity-feed';
import { sendToRenderer } from '../ipc-main-bridge';

export function registerProjectIpcHandlers(
  projectManager: ProjectManager | null,
  activityFeed: ActivityFeed | null
) {
  ipcMain.handle('project.list', async () => {
    if (!projectManager) return { projects: [] };
    return { projects: projectManager.list() };
  });

  ipcMain.handle('project.get', async (_event, id: string) => {
    if (!projectManager) return null;
    return projectManager.get(id);
  });

  ipcMain.handle('project.create', async (_event, input: ProjectCreateInput) => {
    if (!projectManager) throw new Error('ProjectManager not initialized');
    const project = projectManager.create(input);
    sendToRenderer({ type: 'project.created', payload: { project } });
    activityFeed?.record({
      type: 'project.created',
      title: `Project created: ${project.name}`,
      description: project.description,
      projectId: project.id,
    });
    return project;
  });

  ipcMain.handle('project.update', async (_event, id: string, updates: ProjectUpdateInput) => {
    if (!projectManager) return null;
    const project = projectManager.update(id, updates);
    if (project) {
      sendToRenderer({ type: 'project.updated', payload: { project } });
    }
    return project;
  });

  ipcMain.handle('project.delete', async (_event, id: string) => {
    if (!projectManager) return false;
    const ok = projectManager.delete(id);
    if (ok) {
      sendToRenderer({ type: 'project.deleted', payload: { projectId: id } });
      activityFeed?.record({
        type: 'project.deleted',
        title: `Project deleted`,
        projectId: id,
      });
    }
    return ok;
  });

  ipcMain.handle('project.setActive', async (_event, id: string | null) => {
    if (!projectManager) return null;
    return projectManager.setActive(id);
  });

  ipcMain.handle('project.getActive', async () => {
    if (!projectManager) return null;
    return projectManager.getActive();
  });
}
