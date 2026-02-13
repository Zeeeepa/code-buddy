/**
 * Agent Teams
 *
 * Coordinates multiple agent instances working together on tasks.
 * Supports auto, in-process, and tmux teammate modes.
 */

import { logger } from '../../utils/logger.js';

export type TeammateMode = 'auto' | 'in-process' | 'tmux';

export interface TeamConfig {
  mode: TeammateMode;
  maxTeammates: number;
  sharedTaskList: boolean;
}

export type TeammateStatus = 'idle' | 'busy' | 'offline';

export interface TeammateConfig {
  mode?: TeammateMode;
  capabilities?: string[];
}

export interface TeammateInfo {
  name: string;
  config: TeammateConfig;
  status: TeammateStatus;
  assignedTasks: string[];
}

export interface TeamMessage {
  from: string;
  to: string | 'all';
  content: string;
  timestamp: number;
}

export interface SharedContext {
  tasks: Map<string, { assignedTo: string; status: string }>;
  teammates: string[];
  messages: TeamMessage[];
}

const DEFAULT_TEAM_CONFIG: TeamConfig = {
  mode: 'auto',
  maxTeammates: 5,
  sharedTaskList: true,
};

export class AgentTeam {
  private teammates: Map<string, TeammateInfo> = new Map();
  private messageQueue: TeamMessage[] = [];
  private config: TeamConfig;

  constructor(config?: Partial<TeamConfig>) {
    this.config = { ...DEFAULT_TEAM_CONFIG, ...config };
  }

  addTeammate(name: string, config: TeammateConfig = {}): boolean {
    if (this.teammates.has(name)) {
      logger.warn(`Teammate "${name}" already exists`);
      return false;
    }

    if (this.teammates.size >= this.config.maxTeammates) {
      logger.warn(`Max teammates (${this.config.maxTeammates}) reached`);
      return false;
    }

    this.teammates.set(name, {
      name,
      config,
      status: 'idle',
      assignedTasks: [],
    });

    logger.info(`Teammate "${name}" added to team`);
    return true;
  }

  removeTeammate(name: string): boolean {
    if (!this.teammates.has(name)) {
      logger.warn(`Teammate "${name}" not found`);
      return false;
    }

    this.teammates.delete(name);
    logger.info(`Teammate "${name}" removed from team`);
    return true;
  }

  getTeammates(): TeammateInfo[] {
    return Array.from(this.teammates.values());
  }

  delegateTask(taskId: string, teammateName: string): boolean {
    const teammate = this.teammates.get(teammateName);
    if (!teammate) {
      logger.warn(`Teammate "${teammateName}" not found for task delegation`);
      return false;
    }

    teammate.assignedTasks.push(taskId);
    teammate.status = 'busy';

    logger.info(`Task "${taskId}" delegated to "${teammateName}"`);
    return true;
  }

  broadcastMessage(message: string, from: string = 'system'): void {
    const teamMessage: TeamMessage = {
      from,
      to: 'all',
      content: message,
      timestamp: Date.now(),
    };

    this.messageQueue.push(teamMessage);
    logger.info(`Broadcast message from "${from}" to all teammates`);
  }

  sendMessage(from: string, to: string, content: string): void {
    const teamMessage: TeamMessage = {
      from,
      to,
      content,
      timestamp: Date.now(),
    };

    this.messageQueue.push(teamMessage);
    logger.debug(`Message from "${from}" to "${to}"`);
  }

  getMessages(forTeammate: string): TeamMessage[] {
    return this.messageQueue.filter(
      (msg) => msg.to === forTeammate || msg.to === 'all'
    );
  }

  getSharedContext(): SharedContext {
    const tasks = new Map<string, { assignedTo: string; status: string }>();

    for (const teammate of this.teammates.values()) {
      for (const taskId of teammate.assignedTasks) {
        tasks.set(taskId, {
          assignedTo: teammate.name,
          status: teammate.status,
        });
      }
    }

    return {
      tasks,
      teammates: Array.from(this.teammates.keys()),
      messages: [...this.messageQueue],
    };
  }

  getConfig(): TeamConfig {
    return { ...this.config };
  }
}

let agentTeamInstance: AgentTeam | null = null;

export function getAgentTeam(config?: Partial<TeamConfig>): AgentTeam {
  if (!agentTeamInstance) {
    agentTeamInstance = new AgentTeam(config);
  }
  return agentTeamInstance;
}

export function resetAgentTeam(): void {
  agentTeamInstance = null;
}
