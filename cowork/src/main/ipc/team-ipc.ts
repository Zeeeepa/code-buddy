import { ipcMain } from 'electron';
import type { TeamBridge } from '../agent/team-bridge';

export function registerTeamIpcHandlers(teamBridge: TeamBridge | null) {
  ipcMain.handle('team.getStatus', async () => {
    if (!teamBridge) return { error: 'TeamBridge not initialized' };
    return teamBridge.getSnapshot();
  });

  ipcMain.handle('team.start', async (_event, goal?: string) => {
    if (!teamBridge) return { success: false, message: 'TeamBridge not initialized' };
    return teamBridge.start(goal);
  });

  ipcMain.handle('team.stop', async () => {
    if (!teamBridge) return { success: false, message: 'TeamBridge not initialized' };
    return teamBridge.stop();
  });

  ipcMain.handle(
    'team.addMember',
    async (_event, params: { role: string; label?: string }) => {
      if (!teamBridge) return { success: false, message: 'TeamBridge not initialized' };
      return teamBridge.addMember(params.role, params.label);
    }
  );

  ipcMain.handle('team.removeMember', async (_event, memberId: string) => {
    if (!teamBridge) return { success: false, message: 'TeamBridge not initialized' };
    return teamBridge.removeMember(memberId);
  });

  ipcMain.handle(
    'team.addTask',
    async (
      _event,
      input: {
        title: string;
        description: string;
        priority?: string;
        assignedRole?: string;
        dependencies?: string[];
      }
    ) => {
      if (!teamBridge) return { error: 'TeamBridge not initialized' };
      return teamBridge.addTask(input);
    }
  );

  ipcMain.handle(
    'team.updateTask',
    async (
      _event,
      params: {
        taskId: string;
        updates: { status?: string; assignedTo?: string; result?: string; error?: string };
      }
    ) => {
      if (!teamBridge) return { success: false, message: 'TeamBridge not initialized' };
      return teamBridge.updateTask(params.taskId, params.updates);
    }
  );

  ipcMain.handle(
    'team.assignTask',
    async (_event, params: { taskId: string; memberId: string }) => {
      if (!teamBridge) return { success: false, message: 'TeamBridge not initialized' };
      return teamBridge.assignTask(params.taskId, params.memberId);
    }
  );

  ipcMain.handle(
    'team.sendMessage',
    async (_event, params: { from: string; to: string; content: string }) => {
      if (!teamBridge) return { error: 'TeamBridge not initialized' };
      return teamBridge.sendMessage(params.from, params.to, params.content);
    }
  );

  ipcMain.handle(
    'team.getInbox',
    async (_event, params: { memberId: string; limit?: number }) => {
      if (!teamBridge) return [];
      return teamBridge.getInbox(params.memberId, params.limit);
    }
  );
}
