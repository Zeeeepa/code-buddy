/**
 * A2ABridge — Claude Cowork parity Phase 3 step 19
 *
 * Local registry for remote A2A (Agent-to-Agent) agents. Resolves a
 * remote AgentCard by fetching `<url>/.well-known/agent.json`, persists
 * the card in `<userData>/a2a-registry.json`, and exposes a basic
 * `invoke()` that POSTs a task payload to `<url>/tasks/send`.
 *
 * The bridge does not depend on the core `A2AAgentClient` so Cowork
 * can manage its own remote-agent list without pulling the runtime
 * HTTP server into the Electron main process.
 *
 * @module main/a2a/a2a-bridge
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import os from 'os';
import { app } from 'electron';
import { log, logWarn } from '../utils/logger';

export interface AgentSkill {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  skills: AgentSkill[];
  authentication?: { schemes: string[] };
  capabilities?: { streaming?: boolean; pushNotifications?: boolean };
}

export interface RegisteredAgent {
  id: string;
  url: string;
  addedAt: number;
  lastPingAt?: number;
  lastStatus?: 'ok' | 'error' | 'unknown';
  lastError?: string;
  card: AgentCard;
}

interface RegistryFile {
  agents: RegisteredAgent[];
}

function sanitizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 64);
}

export class A2ABridge {
  private readonly registryPath: string;
  private agents: Map<string, RegisteredAgent> = new Map();
  private loaded = false;

  constructor() {
    const userData = app.isReady()
      ? app.getPath('userData')
      : path.join(os.homedir(), '.codebuddy-cowork');
    this.registryPath = path.join(userData, 'a2a-registry.json');
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.registryPath, 'utf-8');
      const parsed = JSON.parse(raw) as RegistryFile;
      for (const agent of parsed.agents ?? []) {
        this.agents.set(agent.id, agent);
      }
    } catch {
      // First launch
    }
    this.loaded = true;
  }

  private async save(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
      const file: RegistryFile = { agents: Array.from(this.agents.values()) };
      await fs.writeFile(this.registryPath, JSON.stringify(file, null, 2), 'utf-8');
    } catch (err) {
      logWarn('[A2ABridge] save failed:', err);
    }
  }

  async list(): Promise<RegisteredAgent[]> {
    await this.load();
    return Array.from(this.agents.values()).sort((a, b) => b.addedAt - a.addedAt);
  }

  async discover(url: string): Promise<{ success: boolean; card?: AgentCard; error?: string }> {
    try {
      const base = url.replace(/\/$/, '');
      const cardUrl = `${base}/.well-known/agent.json`;
      const res = await fetch(cardUrl, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status} ${res.statusText}` };
      }
      const card = (await res.json()) as AgentCard;
      if (!card.name || !card.url) {
        return { success: false, error: 'Invalid AgentCard (missing name or url)' };
      }
      return { success: true, card };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async add(
    url: string
  ): Promise<{ success: boolean; agent?: RegisteredAgent; error?: string }> {
    await this.load();
    const discovery = await this.discover(url);
    if (!discovery.success || !discovery.card) {
      return { success: false, error: discovery.error ?? 'Discovery failed' };
    }
    const id = sanitizeId(discovery.card.name);
    const registered: RegisteredAgent = {
      id,
      url,
      addedAt: Date.now(),
      lastPingAt: Date.now(),
      lastStatus: 'ok',
      card: discovery.card,
    };
    this.agents.set(id, registered);
    await this.save();
    log(`[A2ABridge] Registered agent ${id} from ${url}`);
    return { success: true, agent: registered };
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.load();
    if (!this.agents.has(id)) {
      return { success: false };
    }
    this.agents.delete(id);
    await this.save();
    return { success: true };
  }

  async ping(id: string): Promise<{ success: boolean; status?: string; error?: string }> {
    await this.load();
    const agent = this.agents.get(id);
    if (!agent) return { success: false, error: 'Agent not found' };
    const discovery = await this.discover(agent.url);
    agent.lastPingAt = Date.now();
    agent.lastStatus = discovery.success ? 'ok' : 'error';
    agent.lastError = discovery.error;
    if (discovery.card) {
      agent.card = discovery.card;
    }
    await this.save();
    return {
      success: discovery.success,
      status: agent.lastStatus,
      error: discovery.error,
    };
  }

  async invoke(
    id: string,
    message: string
  ): Promise<{ success: boolean; taskId?: string; result?: string; error?: string }> {
    await this.load();
    const agent = this.agents.get(id);
    if (!agent) return { success: false, error: 'Agent not found' };
    try {
      const base = agent.url.replace(/\/$/, '');
      const res = await fetch(`${base}/tasks/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            role: 'user',
            parts: [{ type: 'text', text: message }],
          },
        }),
      });
      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status} ${res.statusText}` };
      }
      const task = (await res.json()) as {
        id?: string;
        messages?: Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }>;
      };
      const agentReply = task.messages?.find((m) => m.role === 'agent');
      const resultText = agentReply?.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n');
      return { success: true, taskId: task.id, result: resultText };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

let singleton: A2ABridge | null = null;

export function getA2ABridge(): A2ABridge {
  if (!singleton) {
    singleton = new A2ABridge();
  }
  return singleton;
}
