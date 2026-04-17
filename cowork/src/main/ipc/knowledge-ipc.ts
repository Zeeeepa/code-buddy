import { ipcMain } from 'electron';
import type { KnowledgeService, KnowledgeCreateInput } from '../knowledge/knowledge-service';
import type { ProjectManager } from '../project/project-manager';

export function registerKnowledgeIpcHandlers(
  knowledgeService: KnowledgeService | null,
  projectManager: ProjectManager | null
) {
  function resolveKnowledgeWorkspace(projectId?: string): string | null {
    if (!projectManager) return null;
    const project = projectId ? projectManager.get(projectId) : projectManager.getActive();
    return project?.workspacePath ?? null;
  }

  ipcMain.handle('knowledge.list', async (_event, projectId?: string) => {
    if (!knowledgeService) return [];
    const workspace = resolveKnowledgeWorkspace(projectId);
    if (!workspace) return [];
    return knowledgeService.list(workspace);
  });

  ipcMain.handle('knowledge.get', async (_event, id: string, projectId?: string) => {
    if (!knowledgeService) return null;
    const workspace = resolveKnowledgeWorkspace(projectId);
    if (!workspace) return null;
    return knowledgeService.get(workspace, id);
  });

  ipcMain.handle(
    'knowledge.create',
    async (_event, input: KnowledgeCreateInput, projectId?: string) => {
      if (!knowledgeService) throw new Error('KnowledgeService not initialized');
      const workspace = resolveKnowledgeWorkspace(projectId);
      if (!workspace) throw new Error('No active project workspace');
      return knowledgeService.create(workspace, input);
    }
  );

  ipcMain.handle(
    'knowledge.update',
    async (_event, id: string, updates: Partial<KnowledgeCreateInput>, projectId?: string) => {
      if (!knowledgeService) return null;
      const workspace = resolveKnowledgeWorkspace(projectId);
      if (!workspace) return null;
      return knowledgeService.update(workspace, id, updates);
    }
  );

  ipcMain.handle('knowledge.delete', async (_event, id: string, projectId?: string) => {
    if (!knowledgeService) return false;
    const workspace = resolveKnowledgeWorkspace(projectId);
    if (!workspace) return false;
    return knowledgeService.delete(workspace, id);
  });

  ipcMain.handle(
    'knowledge.search',
    async (_event, query: string, projectId?: string, limit?: number) => {
      if (!knowledgeService) return [];
      const workspace = resolveKnowledgeWorkspace(projectId);
      if (!workspace) return [];
      return knowledgeService.search(workspace, query, limit);
    }
  );
}
