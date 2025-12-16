/**
 * Research-Based Feature Handlers
 *
 * Implements command handlers for TDD mode, CI/CD workflows,
 * lifecycle hooks, and prompt caching.
 *
 * Based on 2024-2025 research findings:
 * - TDD: 45% accuracy improvement (ICSE 2024)
 * - Prompt Caching: Up to 90% cost reduction
 * - Hooks: 73.8% AI review comments resolved (industrial study)
 */

import type { CommandHandlerResult } from './branch-handlers.js';
import type { ChatEntry } from '../../agent/codebuddy-agent.js';
import { getTDDManager } from '../../testing/tdd-mode.js';
import { getCICDManager } from '../../integrations/cicd-integration.js';
import { getHooksManager } from '../../hooks/lifecycle-hooks.js';
import { getPromptCacheManager } from '../../optimization/prompt-cache.js';
import { getModelRouter, getCostComparison, GROK_MODELS } from '../../optimization/model-routing.js';

/**
 * Helper to create a response entry
 */
function createEntry(content: string): ChatEntry {
  return {
    type: 'assistant',
    content,
    timestamp: new Date(),
  };
}

/**
 * Handle /tdd command - TDD mode management
 */
export function handleTDD(args: string[]): CommandHandlerResult {
  const action = args[0]?.toLowerCase();
  const manager = getTDDManager(process.cwd());

  if (!action || action === 'status') {
    return {
      handled: true,
      entry: createEntry(manager.formatStatus()),
    };
  }

  switch (action) {
    case 'start': {
      const requirements = args.slice(1).join(' ');
      if (!requirements) {
        return {
          handled: true,
          entry: createEntry('❌ Please provide requirements: /tdd start <requirements>'),
        };
      }
      try {
        manager.startCycle(requirements);
        return {
          handled: true,
          entry: createEntry(`🧪 TDD Mode Started\n\nRequirements: ${requirements}\n\nNext step: Generate tests for these requirements.`),
        };
      } catch (error) {
        return {
          handled: true,
          entry: createEntry(`❌ ${error instanceof Error ? error.message : 'Failed to start TDD cycle'}`),
        };
      }
    }

    case 'approve': {
      try {
        manager.approveTests();
        return {
          handled: true,
          entry: createEntry('✅ Tests approved! Now implementing code to make tests pass.'),
        };
      } catch (error) {
        return {
          handled: true,
          entry: createEntry(`❌ ${error instanceof Error ? error.message : 'Failed to approve tests'}`),
        };
      }
    }

    case 'cancel': {
      manager.cancelCycle();
      return {
        handled: true,
        entry: createEntry('🛑 TDD cycle cancelled.'),
      };
    }

    case 'reset': {
      manager.reset();
      return {
        handled: true,
        entry: createEntry('🔄 TDD mode reset to idle state.'),
      };
    }

    default:
      return {
        handled: true,
        entry: createEntry(`📚 TDD Mode Commands:
  /tdd                  - Show current TDD status
  /tdd start <req>      - Start TDD cycle with requirements
  /tdd approve          - Approve generated tests
  /tdd cancel           - Cancel current cycle
  /tdd reset            - Reset to idle state

TDD improves code accuracy by 45% (ICSE 2024 research).`),
      };
  }
}

/**
 * Handle /workflow command - CI/CD workflow management
 */
export function handleWorkflow(args: string[]): CommandHandlerResult {
  const action = args[0]?.toLowerCase();
  const manager = getCICDManager(process.cwd());

  if (!action || action === 'status') {
    return {
      handled: true,
      entry: createEntry(manager.formatStatus()),
    };
  }

  switch (action) {
    case 'list': {
      const workflows = manager.getWorkflows();
      if (workflows.length === 0) {
        return {
          handled: true,
          entry: createEntry('📋 No workflows detected in this project.'),
        };
      }
      const lines = ['📋 CI/CD Workflows:', ''];
      for (const wf of workflows) {
        lines.push(`  • ${wf.name} (${wf.provider})`);
        lines.push(`    Path: ${wf.path}`);
        lines.push(`    Triggers: ${wf.triggers.join(', ')}`);
        lines.push('');
      }
      return {
        handled: true,
        entry: createEntry(lines.join('\n')),
      };
    }

    case 'templates': {
      const templates = manager.getTemplates();
      return {
        handled: true,
        entry: createEntry(`📚 Available Workflow Templates:\n\n${templates.map(t => `  • ${t}`).join('\n')}\n\nUsage: /workflow create <template>`),
      };
    }

    case 'create': {
      const template = args[1];
      if (!template) {
        const templates = manager.getTemplates();
        return {
          handled: true,
          entry: createEntry(`Please specify a template:\n\n${templates.map(t => `  • ${t}`).join('\n')}\n\nUsage: /workflow create <template>`),
        };
      }
      // Return pass-to-ai to let AI create the workflow
      return {
        handled: false,
        passToAI: true,
        prompt: `Create a CI/CD workflow using the "${template}" template. Use the workflow manager to generate the appropriate YAML.`,
      };
    }

    case 'validate': {
      const file = args[1];
      if (!file) {
        return {
          handled: true,
          entry: createEntry('❌ Please specify a workflow file: /workflow validate <file>'),
        };
      }
      // Return pass-to-ai to let AI validate the workflow
      return {
        handled: false,
        passToAI: true,
        prompt: `Validate the CI/CD workflow file at "${file}". Read the file and check for syntax errors, missing required fields, and best practices.`,
      };
    }

    case 'suggest': {
      const suggestion = manager.suggestWorkflow();
      if (suggestion) {
        return {
          handled: true,
          entry: createEntry(`💡 Suggested workflow template: ${suggestion}\n\nRun /workflow create ${suggestion} to create it.`),
        };
      }
      return {
        handled: true,
        entry: createEntry('🤔 No specific workflow suggestion for this project type.'),
      };
    }

    default:
      return {
        handled: true,
        entry: createEntry(`📚 CI/CD Workflow Commands:
  /workflow             - Show workflow status
  /workflow list        - List detected workflows
  /workflow templates   - Show available templates
  /workflow create <t>  - Create workflow from template
  /workflow validate <f>- Validate workflow file
  /workflow suggest     - Suggest a workflow template

Supported: GitHub Actions, GitLab CI, CircleCI, Jenkins, Azure Pipelines`),
      };
  }
}

/**
 * Handle /hooks command - Lifecycle hooks management
 */
export function handleHooks(args: string[]): CommandHandlerResult {
  const action = args[0]?.toLowerCase();
  const manager = getHooksManager(process.cwd());

  if (!action || action === 'status') {
    return {
      handled: true,
      entry: createEntry(manager.formatStatus()),
    };
  }

  switch (action) {
    case 'list': {
      const hooksMap = manager.getHooks();
      const lines = ['🪝 Registered Hooks:', ''];

      for (const [type, hooks] of hooksMap) {
        if (hooks.length > 0) {
          lines.push(`  ${type}:`);
          for (const hook of hooks) {
            const status = hook.enabled ? '✅' : '❌';
            lines.push(`    ${status} ${hook.name}`);
          }
          lines.push('');
        }
      }

      if (lines.length === 2) {
        lines.push('  No hooks registered.');
      }

      return {
        handled: true,
        entry: createEntry(lines.join('\n')),
      };
    }

    case 'enable': {
      const name = args[1];
      if (!name) {
        return {
          handled: true,
          entry: createEntry('❌ Please specify a hook name: /hooks enable <name>'),
        };
      }
      const success = manager.setHookEnabled(name, true);
      if (success) {
        return {
          handled: true,
          entry: createEntry(`✅ Hook "${name}" enabled.`),
        };
      }
      return {
        handled: true,
        entry: createEntry(`❌ Hook "${name}" not found.`),
      };
    }

    case 'disable': {
      const name = args[1];
      if (!name) {
        return {
          handled: true,
          entry: createEntry('❌ Please specify a hook name: /hooks disable <name>'),
        };
      }
      const success = manager.setHookEnabled(name, false);
      if (success) {
        return {
          handled: true,
          entry: createEntry(`✅ Hook "${name}" disabled.`),
        };
      }
      return {
        handled: true,
        entry: createEntry(`❌ Hook "${name}" not found.`),
      };
    }

    case 'add': {
      // Pass to AI to help create a custom hook
      return {
        handled: false,
        passToAI: true,
        prompt: `Help me create a custom lifecycle hook. Ask about:
1. Hook type (pre-edit, post-edit, pre-bash, post-bash, pre-commit, post-commit)
2. What command or script to run
3. File patterns to match (optional)
4. Whether it should fail on error

Then create the hook configuration and save it.`,
      };
    }

    default:
      return {
        handled: true,
        entry: createEntry(`📚 Lifecycle Hooks Commands:
  /hooks              - Show hooks status
  /hooks list         - List all registered hooks
  /hooks enable <n>   - Enable a hook
  /hooks disable <n>  - Disable a hook
  /hooks add          - Create a custom hook (AI-assisted)

Hook Types:
  • pre-edit / post-edit     - Before/after file edits
  • pre-bash / post-bash     - Before/after bash commands
  • pre-commit / post-commit - Before/after git commits
  • pre-prompt / post-response - LLM request lifecycle

73.8% of AI review comments are resolved (industrial study).`),
      };
  }
}

/**
 * Handle /prompt-cache command - Prompt caching management
 */
export function handlePromptCache(args: string[]): CommandHandlerResult {
  const action = args[0]?.toLowerCase();
  const manager = getPromptCacheManager();

  if (!action || action === 'status') {
    return {
      handled: true,
      entry: createEntry(manager.formatStats()),
    };
  }

  switch (action) {
    case 'on': {
      manager.updateConfig({ enabled: true });
      return {
        handled: true,
        entry: createEntry('✅ Prompt caching enabled. Reduces API costs by caching repeated prompts.'),
      };
    }

    case 'off': {
      manager.updateConfig({ enabled: false });
      return {
        handled: true,
        entry: createEntry('❌ Prompt caching disabled.'),
      };
    }

    case 'clear': {
      manager.clear();
      return {
        handled: true,
        entry: createEntry('🗑️ Prompt cache cleared.'),
      };
    }

    case 'warm': {
      // Warm the cache with common prompts
      manager.warmCache({});
      return {
        handled: true,
        entry: createEntry('🔥 Cache warmed with system prompts.'),
      };
    }

    case 'stats': {
      const stats = manager.getStats();
      return {
        handled: true,
        entry: createEntry(`📊 Prompt Cache Statistics:

  Entries: ${stats.entries}
  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%
  Hits: ${stats.hits}
  Misses: ${stats.misses}
  Tokens Saved: ${stats.totalTokensSaved.toLocaleString()}
  Est. Cost Saved: $${stats.estimatedCostSaved.toFixed(4)}`),
      };
    }

    default:
      return {
        handled: true,
        entry: createEntry(`📚 Prompt Cache Commands:
  /prompt-cache          - Show cache statistics
  /prompt-cache status   - Show detailed status
  /prompt-cache on       - Enable prompt caching
  /prompt-cache off      - Disable prompt caching
  /prompt-cache clear    - Clear the cache
  /prompt-cache warm     - Pre-warm cache with common prompts

Prompt caching can reduce API costs by up to 90%.`),
      };
  }
}

/**
 * Handle /model-router command - Model routing management
 */
export function handleModelRouter(args: string[]): CommandHandlerResult {
  const action = args[0]?.toLowerCase();
  const router = getModelRouter();

  if (!action || action === 'status') {
    const config = router.getConfig();
    const savings = router.getEstimatedSavings();
    const lines = [
      '🧭 Model Router Status',
      '',
      `  Enabled: ${config.enabled ? '✅' : '❌'}`,
      `  Default Model: ${config.defaultModel}`,
      `  Cost Sensitivity: ${config.costSensitivity}`,
      `  Min Confidence: ${(config.minConfidence * 100).toFixed(0)}%`,
      '',
      `  Total Cost: $${router.getTotalCost().toFixed(4)}`,
      `  Estimated Savings: $${savings.saved.toFixed(4)} (${savings.percentage.toFixed(1)}%)`,
    ];
    return {
      handled: true,
      entry: createEntry(lines.join('\n')),
    };
  }

  switch (action) {
    case 'on': {
      router.updateConfig({ enabled: true });
      return {
        handled: true,
        entry: createEntry('✅ Model routing enabled. Requests will be routed to optimal models based on task complexity.'),
      };
    }

    case 'off': {
      router.updateConfig({ enabled: false });
      return {
        handled: true,
        entry: createEntry('❌ Model routing disabled. All requests will use the default model.'),
      };
    }

    case 'models': {
      const lines = ['📋 Available Models:', ''];
      for (const [id, config] of Object.entries(GROK_MODELS)) {
        lines.push(`  ${config.tier.toUpperCase()}: ${id}`);
        lines.push(`    Cost: $${config.costPerMillionTokens}/M tokens`);
        lines.push(`    Max Tokens: ${config.maxTokens.toLocaleString()}`);
        lines.push(`    Vision: ${config.supportsVision ? '✅' : '❌'}`);
        lines.push('');
      }
      return {
        handled: true,
        entry: createEntry(lines.join('\n')),
      };
    }

    case 'compare': {
      const tokens = parseInt(args[1]) || 10000;
      const comparison = getCostComparison(tokens);
      const lines = [`💰 Cost Comparison for ${tokens.toLocaleString()} tokens:`, ''];
      for (const item of comparison) {
        lines.push(`  ${item.model}: $${item.cost.toFixed(4)} (${item.savings})`);
      }
      return {
        handled: true,
        entry: createEntry(lines.join('\n')),
      };
    }

    case 'sensitivity': {
      const level = args[1]?.toLowerCase() as 'low' | 'medium' | 'high';
      if (!level || !['low', 'medium', 'high'].includes(level)) {
        return {
          handled: true,
          entry: createEntry('❌ Please specify sensitivity level: /model-router sensitivity <low|medium|high>'),
        };
      }
      router.updateConfig({ costSensitivity: level });
      return {
        handled: true,
        entry: createEntry(`✅ Cost sensitivity set to ${level}. ${level === 'high' ? 'Will prefer cheaper models.' : level === 'low' ? 'Will prefer quality models.' : 'Balanced approach.'}`),
      };
    }

    case 'stats': {
      const usageStats = router.getUsageStats();
      const savings = router.getEstimatedSavings();
      const lines = ['📊 Model Router Statistics:', ''];

      if (usageStats.size === 0) {
        lines.push('  No usage recorded yet.');
      } else {
        for (const [model, stats] of usageStats) {
          lines.push(`  ${model}:`);
          lines.push(`    Calls: ${stats.calls}`);
          lines.push(`    Tokens: ${stats.tokens.toLocaleString()}`);
          lines.push(`    Cost: $${stats.cost.toFixed(4)}`);
          lines.push('');
        }
        lines.push(`  Total Cost: $${router.getTotalCost().toFixed(4)}`);
        lines.push(`  Estimated Savings: $${savings.saved.toFixed(4)} (${savings.percentage.toFixed(1)}%)`);
      }

      return {
        handled: true,
        entry: createEntry(lines.join('\n')),
      };
    }

    default:
      return {
        handled: true,
        entry: createEntry(`📚 Model Router Commands:
  /model-router             - Show router status
  /model-router on          - Enable model routing
  /model-router off         - Disable model routing
  /model-router models      - List available models
  /model-router compare [n] - Compare costs for n tokens
  /model-router sensitivity - Set cost sensitivity (low/medium/high)
  /model-router stats       - Show usage statistics

Model routing can reduce costs by 30-70% (FrugalGPT research).`),
      };
  }
}
