import { ipcMain } from 'electron';
import type { SkillMdBridge } from '../skills/skill-md-bridge';

export function registerSkillMdIpcHandlers(skillMdBridge: SkillMdBridge | null) {
  ipcMain.handle('skillMd.list', async () => {
    if (!skillMdBridge) return [];
    return skillMdBridge.list();
  });

  ipcMain.handle('skillMd.search', async (_event, query: string, limit?: number) => {
    if (!skillMdBridge) return [];
    return skillMdBridge.search(query, limit);
  });

  ipcMain.handle('skillMd.findBest', async (_event, request: string) => {
    if (!skillMdBridge) return null;
    return skillMdBridge.findBest(request);
  });

  ipcMain.handle(
    'skillMd.execute',
    async (
      _event,
      skillName: string,
      context: { userInput?: string; workspaceRoot?: string; sessionId?: string }
    ) => {
      if (!skillMdBridge) {
        return { success: false, error: 'Skill bridge unavailable' };
      }
      return skillMdBridge.execute(skillName, context);
    }
  );
}
