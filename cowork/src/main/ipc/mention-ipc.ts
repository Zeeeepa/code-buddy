import { ipcMain } from 'electron';
import type { MentionProcessor } from '../input/mention-processor';

export function registerMentionIpcHandlers(mentionProcessor: MentionProcessor | null) {
  ipcMain.handle('mention.process', async (_event, text: string, cwd?: string) => {
    if (!mentionProcessor) return { cleanedText: text, contextBlocks: [] };
    return mentionProcessor.process(text, cwd);
  });

  ipcMain.handle(
    'mention.autocomplete',
    async (_event, prefix: string, cwd?: string, limit?: number) => {
      if (!mentionProcessor) return [];
      return mentionProcessor.autocomplete(prefix, cwd, limit);
    }
  );
}
