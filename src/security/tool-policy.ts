/**
 * OpenClaw-inspired Tool Policy System
 *
 * Implements allow/deny pattern matching with hierarchy:
 * 1. Agent-level settings (highest priority)
 * 2. Global configuration
 * 3. Default constants (lowest priority)
 *
 * Features:
 * - Exact match, wildcard patterns, and "all" wildcard
 * - Essential tools auto-inclusion (e.g., image for multimodal)
 * - Pattern compilation and caching for performance
 */

import { EventEmitter } from 'events';

export interface ToolPolicyConfig {
  /** Tools explicitly allowed (supports wildcards) */
  allow?: string[];
  /** Tools explicitly denied (supports wildcards) */
  deny?: string[];
  /** Essential tools that are always included unless explicitly denied */
  essential?: string[];
  /** Whether to log policy decisions */
  verbose?: boolean;
}

export interface PolicyHierarchy {
  agent?: ToolPolicyConfig;
  global?: ToolPolicyConfig;
  defaults?: ToolPolicyConfig;
}

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  matchedPattern?: string;
  source: 'agent' | 'global' | 'defaults' | 'essential' | 'no-allowlist';
}

interface CompiledPattern {
  original: string;
  type: 'exact' | 'wildcard' | 'all';
  regex?: RegExp;
}

/**
 * Default essential tools that should always be available
 * unless explicitly denied
 */
const DEFAULT_ESSENTIAL_TOOLS = [
  'image',      // Essential for multimodal workflows
  'view_file',  // Basic file reading
  'bash',       // Command execution
];

/**
 * Default tool policy configuration
 */
const DEFAULT_POLICY: ToolPolicyConfig = {
  allow: ['*'],  // Allow all by default
  deny: [],
  essential: DEFAULT_ESSENTIAL_TOOLS,
  verbose: false,
};

export class ToolPolicyEngine extends EventEmitter {
  private compiledPatterns: Map<string, CompiledPattern[]> = new Map();
  private hierarchy: PolicyHierarchy;
  private resolvedConfig: ToolPolicyConfig;

  constructor(hierarchy: PolicyHierarchy = {}) {
    super();
    this.hierarchy = hierarchy;
    this.resolvedConfig = this.resolveConfig();
    this.compilePatterns();
  }

  /**
   * Resolve configuration following hierarchy:
   * Agent > Global > Defaults
   */
  private resolveConfig(): ToolPolicyConfig {
    const { agent, global, defaults } = this.hierarchy;

    return {
      allow: agent?.allow ?? global?.allow ?? defaults?.allow ?? DEFAULT_POLICY.allow,
      deny: agent?.deny ?? global?.deny ?? defaults?.deny ?? DEFAULT_POLICY.deny,
      essential: agent?.essential ?? global?.essential ?? defaults?.essential ?? DEFAULT_POLICY.essential,
      verbose: agent?.verbose ?? global?.verbose ?? defaults?.verbose ?? DEFAULT_POLICY.verbose,
    };
  }

  /**
   * Compile patterns for efficient matching
   */
  private compilePatterns(): void {
    this.compiledPatterns.clear();

    // Compile allow patterns
    if (this.resolvedConfig.allow) {
      this.compiledPatterns.set('allow', this.compilePatternList(this.resolvedConfig.allow));
    }

    // Compile deny patterns
    if (this.resolvedConfig.deny) {
      this.compiledPatterns.set('deny', this.compilePatternList(this.resolvedConfig.deny));
    }
  }

  /**
   * Compile a list of patterns into optimized matchers
   */
  private compilePatternList(patterns: string[]): CompiledPattern[] {
    return patterns.map(pattern => {
      const normalized = pattern.trim().toLowerCase();

      // All wildcard
      if (normalized === '*') {
        return { original: pattern, type: 'all' as const };
      }

      // Wildcard pattern (contains *)
      if (normalized.includes('*')) {
        // Escape special regex characters except *
        const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        // Convert * to .*
        const regexStr = escaped.replace(/\*/g, '.*');
        return {
          original: pattern,
          type: 'wildcard' as const,
          regex: new RegExp(`^${regexStr}$`, 'i'),
        };
      }

      // Exact match
      return { original: pattern, type: 'exact' as const };
    });
  }

  /**
   * Check if a tool name matches a pattern
   */
  private matchesPattern(toolName: string, pattern: CompiledPattern): boolean {
    const normalizedName = toolName.toLowerCase();

    switch (pattern.type) {
      case 'all':
        return true;
      case 'wildcard':
        return pattern.regex?.test(normalizedName) ?? false;
      case 'exact':
        return normalizedName === pattern.original.toLowerCase();
      default:
        return false;
    }
  }

  /**
   * Check if a tool name matches any pattern in a list
   */
  private matchesAnyPattern(toolName: string, patterns: CompiledPattern[]): CompiledPattern | null {
    for (const pattern of patterns) {
      if (this.matchesPattern(toolName, pattern)) {
        return pattern;
      }
    }
    return null;
  }

  /**
   * Check if a tool is allowed by the policy
   */
  isToolAllowed(toolName: string): PolicyDecision {
    const denyPatterns = this.compiledPatterns.get('deny') || [];
    const allowPatterns = this.compiledPatterns.get('allow') || [];
    const essential = this.resolvedConfig.essential || [];

    // 1. Check deny list first (highest priority for blocking)
    const denyMatch = this.matchesAnyPattern(toolName, denyPatterns);
    if (denyMatch) {
      const decision: PolicyDecision = {
        allowed: false,
        reason: `Tool "${toolName}" is denied by pattern "${denyMatch.original}"`,
        matchedPattern: denyMatch.original,
        source: this.getPatternSource('deny'),
      };
      this.logDecision(toolName, decision);
      return decision;
    }

    // 2. Check if tool is essential (auto-include unless denied)
    if (essential.includes(toolName.toLowerCase())) {
      const decision: PolicyDecision = {
        allowed: true,
        reason: `Tool "${toolName}" is essential for workflows`,
        source: 'essential',
      };
      this.logDecision(toolName, decision);
      return decision;
    }

    // 3. Check allow list
    if (allowPatterns.length > 0) {
      const allowMatch = this.matchesAnyPattern(toolName, allowPatterns);
      if (allowMatch) {
        const decision: PolicyDecision = {
          allowed: true,
          reason: `Tool "${toolName}" matches allow pattern "${allowMatch.original}"`,
          matchedPattern: allowMatch.original,
          source: this.getPatternSource('allow'),
        };
        this.logDecision(toolName, decision);
        return decision;
      }

      // Has allow list but tool doesn't match
      const decision: PolicyDecision = {
        allowed: false,
        reason: `Tool "${toolName}" is not in the allow list`,
        source: this.getPatternSource('allow'),
      };
      this.logDecision(toolName, decision);
      return decision;
    }

    // 4. No allow list defined - permit by default
    const decision: PolicyDecision = {
      allowed: true,
      reason: `No allow list defined, tool "${toolName}" permitted by default`,
      source: 'no-allowlist',
    };
    this.logDecision(toolName, decision);
    return decision;
  }

  /**
   * Filter a list of tools by policy
   */
  filterTools<T extends { name: string }>(tools: T[]): T[] {
    return tools.filter(tool => this.isToolAllowed(tool.name).allowed);
  }

  /**
   * Get the source level for a pattern type
   */
  private getPatternSource(type: 'allow' | 'deny'): 'agent' | 'global' | 'defaults' {
    const { agent, global } = this.hierarchy;

    if (type === 'allow') {
      if (agent?.allow) return 'agent';
      if (global?.allow) return 'global';
      return 'defaults';
    } else {
      if (agent?.deny) return 'agent';
      if (global?.deny) return 'global';
      return 'defaults';
    }
  }

  /**
   * Log a policy decision if verbose mode is enabled
   */
  private logDecision(toolName: string, decision: PolicyDecision): void {
    if (this.resolvedConfig.verbose) {
      this.emit('policy:decision', { toolName, decision });
    }
  }

  /**
   * Update the policy hierarchy
   */
  updatePolicy(hierarchy: Partial<PolicyHierarchy>): void {
    this.hierarchy = { ...this.hierarchy, ...hierarchy };
    this.resolvedConfig = this.resolveConfig();
    this.compilePatterns();
    this.emit('policy:updated', this.resolvedConfig);
  }

  /**
   * Update agent-level policy
   */
  setAgentPolicy(config: ToolPolicyConfig): void {
    this.updatePolicy({ agent: config });
  }

  /**
   * Update global policy
   */
  setGlobalPolicy(config: ToolPolicyConfig): void {
    this.updatePolicy({ global: config });
  }

  /**
   * Get the resolved configuration
   */
  getConfig(): ToolPolicyConfig {
    return { ...this.resolvedConfig };
  }

  /**
   * Get policy statistics
   */
  getStats(): {
    allowPatterns: number;
    denyPatterns: number;
    essentialTools: number;
  } {
    return {
      allowPatterns: this.compiledPatterns.get('allow')?.length || 0,
      denyPatterns: this.compiledPatterns.get('deny')?.length || 0,
      essentialTools: this.resolvedConfig.essential?.length || 0,
    };
  }

  /**
   * Check multiple tools at once
   */
  checkTools(toolNames: string[]): Map<string, PolicyDecision> {
    const results = new Map<string, PolicyDecision>();
    for (const name of toolNames) {
      results.set(name, this.isToolAllowed(name));
    }
    return results;
  }

  /**
   * Create a policy report
   */
  generateReport(toolNames: string[]): string {
    const results = this.checkTools(toolNames);
    const lines: string[] = ['Tool Policy Report', '==================', ''];

    const allowed: string[] = [];
    const denied: string[] = [];

    for (const [name, decision] of results) {
      if (decision.allowed) {
        allowed.push(`  ✅ ${name} (${decision.source})`);
      } else {
        denied.push(`  ❌ ${name} - ${decision.reason}`);
      }
    }

    if (allowed.length > 0) {
      lines.push('Allowed:', ...allowed, '');
    }

    if (denied.length > 0) {
      lines.push('Denied:', ...denied, '');
    }

    const stats = this.getStats();
    lines.push(
      'Statistics:',
      `  Allow patterns: ${stats.allowPatterns}`,
      `  Deny patterns: ${stats.denyPatterns}`,
      `  Essential tools: ${stats.essentialTools}`
    );

    return lines.join('\n');
  }
}

// Singleton instance
let policyEngineInstance: ToolPolicyEngine | null = null;

export function getToolPolicyEngine(hierarchy?: PolicyHierarchy): ToolPolicyEngine {
  if (!policyEngineInstance) {
    policyEngineInstance = new ToolPolicyEngine(hierarchy);
  } else if (hierarchy) {
    policyEngineInstance.updatePolicy(hierarchy);
  }
  return policyEngineInstance;
}

export function resetToolPolicyEngine(): void {
  policyEngineInstance = null;
}

/**
 * Convenience function to check if a tool is allowed
 */
export function isToolAllowed(toolName: string, hierarchy?: PolicyHierarchy): boolean {
  return getToolPolicyEngine(hierarchy).isToolAllowed(toolName).allowed;
}

/**
 * Convenience function to filter tools
 */
export function filterToolsByPolicy<T extends { name: string }>(
  tools: T[],
  hierarchy?: PolicyHierarchy
): T[] {
  return getToolPolicyEngine(hierarchy).filterTools(tools);
}
