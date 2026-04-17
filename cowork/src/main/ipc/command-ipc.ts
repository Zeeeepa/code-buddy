import { ipcMain } from 'electron';
import type { SlashCommandBridge } from '../commands/slash-command-bridge';

export function registerCommandIpcHandlers(slashCommandBridge: SlashCommandBridge | null) {
  ipcMain.handle('command.list', async () => {
    if (!slashCommandBridge) return [];
    return slashCommandBridge.listCommands();
  });

  ipcMain.handle('command.autocomplete', async (_event, prefix: string, limit?: number) => {
    if (!slashCommandBridge) return [];
    return slashCommandBridge.autocomplete(prefix, limit);
  });

  ipcMain.handle(
    'command.execute',
    async (_event, name: string, args: string[], sessionId?: string) => {
      if (!slashCommandBridge) {
        return { success: false, error: 'Slash command bridge unavailable' };
      }
      return slashCommandBridge.execute(name, args, sessionId);
    }
  );
}
