/**
 * Per-Sender Policies & Agents List
 * Tool access control per sender identity and agent registry.
 */

import { logger } from '../utils/logger.js';

export interface SenderIdentity {
  username?: string;
  userId?: string;
  phone?: string;
  displayName?: string;
}

export interface SenderPolicy {
  identity: SenderIdentity;
  allowedTools: string[];
  deniedTools: string[];
  maxTurns?: number;
}

export class SenderPolicyManager {
  private static instance: SenderPolicyManager | null = null;
  private policies: SenderPolicy[] = [];

  static getInstance(): SenderPolicyManager {
    if (!SenderPolicyManager.instance) {
      SenderPolicyManager.instance = new SenderPolicyManager();
    }
    return SenderPolicyManager.instance;
  }

  static resetInstance(): void {
    SenderPolicyManager.instance = null;
  }

  addPolicy(policy: SenderPolicy): void {
    // Remove existing policy for same identity
    this.policies = this.policies.filter(p => !this.matchIdentity(policy.identity, p));
    this.policies.push(policy);
    logger.debug(`Added policy for sender: ${JSON.stringify(policy.identity)}`);
  }

  removePolicy(identity: SenderIdentity): boolean {
    const before = this.policies.length;
    this.policies = this.policies.filter(p => !this.matchIdentity(identity, p));
    return this.policies.length < before;
  }

  getPolicy(identity: SenderIdentity): SenderPolicy | undefined {
    return this.policies.find(p => this.matchIdentity(identity, p));
  }

  isToolAllowed(identity: SenderIdentity, tool: string): boolean {
    const policy = this.getPolicy(identity);
    if (!policy) return true; // No policy means no restrictions

    if (policy.deniedTools.includes(tool)) return false;
    if (policy.allowedTools.length > 0 && !policy.allowedTools.includes(tool)) return false;
    return true;
  }

  matchIdentity(sender: SenderIdentity, policy: SenderPolicy): boolean {
    const pi = policy.identity;
    if (sender.username && pi.username && sender.username === pi.username) return true;
    if (sender.userId && pi.userId && sender.userId === pi.userId) return true;
    if (sender.phone && pi.phone && sender.phone === pi.phone) return true;
    if (sender.displayName && pi.displayName && sender.displayName === pi.displayName) return true;
    return false;
  }

  listPolicies(): SenderPolicy[] {
    return [...this.policies];
  }

  clearPolicies(): void {
    this.policies = [];
  }
}

interface AgentInfo {
  name: string;
  description: string;
  status: 'active' | 'inactive';
}

export class AgentListTool {
  private static instance: AgentListTool | null = null;
  private agents: Map<string, AgentInfo> = new Map();

  static getInstance(): AgentListTool {
    if (!AgentListTool.instance) {
      AgentListTool.instance = new AgentListTool();
    }
    return AgentListTool.instance;
  }

  static resetInstance(): void {
    AgentListTool.instance = null;
  }

  listAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  addAgent(name: string, description: string): void {
    this.agents.set(name, { name, description, status: 'active' });
    logger.debug(`Registered agent: ${name}`);
  }

  removeAgent(name: string): boolean {
    return this.agents.delete(name);
  }

  getAgent(name: string): AgentInfo | undefined {
    return this.agents.get(name);
  }

  getAgentCount(): number {
    return this.agents.size;
  }
}
