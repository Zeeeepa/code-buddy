import { ipcMain } from 'electron';
import type { OrchestratorBridge, OrchestratorOptions } from '../agent/orchestrator-bridge';

export function registerOrchestratorIpcHandlers(orchestratorBridge: OrchestratorBridge | null) {
  ipcMain.handle(
    'orchestrator.run',
    async (_event, sessionId: string, goal: string, options?: OrchestratorOptions) => {
      if (!orchestratorBridge)
        return {
          success: false,
          summary: 'Orchestrator not initialized',
          artifacts: {},
          agentResults: [],
          duration: 0,
          errors: ['not initialized'],
        };
      return orchestratorBridge.run(sessionId, goal, options);
    }
  );

  ipcMain.handle('orchestrator.isComplex', async (_event, goal: string) => {
    if (!orchestratorBridge) return false;
    return orchestratorBridge.isComplexGoal(goal);
  });
}
