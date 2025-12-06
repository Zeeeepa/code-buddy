import { ChatEntry } from "../../agent/grok-agent.js";
import { getAutonomyManager, AutonomyLevel } from "../../utils/autonomy-manager.js";
import { getSlashCommandManager } from "../slash-commands.js";
import { getSkillManager } from "../../skills/skill-manager.js";
import { getConversationExporter } from "../../utils/conversation-export.js";

export interface CommandHandlerResult {
  handled: boolean;
  entry?: ChatEntry;
  passToAI?: boolean;
  prompt?: string;
}

/**
 * Help - Show available commands (dynamically from SlashCommandManager)
 */
export async function handleHelp(): Promise<CommandHandlerResult> {
  const slashManager = getSlashCommandManager();
  const allCommands = slashManager.getAllCommands();

  // Group commands by category
  const categories: Record<string, typeof allCommands> = {
    'Core': [],
    'Code & Development': [],
    'Git & Version Control': [],
    'Context & Memory': [],
    'Session & Export': [],
    'Settings & UI': [],
    'Advanced': [],
  };

  // Categorize commands
  for (const cmd of allCommands) {
    const name = cmd.name.toLowerCase();
    if (['help', 'clear', 'exit', 'model', 'mode'].includes(name)) {
      categories['Core'].push(cmd);
    } else if (['review', 'test', 'lint', 'explain', 'refactor', 'debug', 'docs', 'generate-tests', 'ai-test', 'guardian'].includes(name)) {
      categories['Code & Development'].push(cmd);
    } else if (['commit', 'checkpoints', 'restore', 'undo', 'diff', 'branches', 'fork', 'checkout', 'merge'].includes(name)) {
      categories['Git & Version Control'].push(cmd);
    } else if (['memory', 'remember', 'context', 'add', 'workspace', 'scan-todos', 'address-todo'].includes(name)) {
      categories['Context & Memory'].push(cmd);
    } else if (['save', 'export', 'cache', 'cost'].includes(name)) {
      categories['Session & Export'].push(cmd);
    } else if (['theme', 'avatar', 'voice', 'speak', 'tts', 'security', 'autonomy', 'dry-run'].includes(name)) {
      categories['Settings & UI'].push(cmd);
    } else {
      categories['Advanced'].push(cmd);
    }
  }

  // Build help text
  const lines: string[] = [];
  lines.push('╔══════════════════════════════════════════════════════════════════╗');
  lines.push('║                      📚 GROK CLI COMMANDS                        ║');
  lines.push('╚══════════════════════════════════════════════════════════════════╝');
  lines.push('');

  for (const [category, cmds] of Object.entries(categories)) {
    if (cmds.length === 0) continue;

    lines.push(`── ${category} ${'─'.repeat(50 - category.length)}`);
    lines.push('');

    for (const cmd of cmds) {
      // Build command signature with parameters
      let signature = `/${cmd.name}`;
      if (cmd.arguments && cmd.arguments.length > 0) {
        const params = cmd.arguments.map(arg =>
          arg.required ? `<${arg.name}>` : `[${arg.name}]`
        ).join(' ');
        signature += ` ${params}`;
      }

      lines.push(`  ${signature}`);
      lines.push(`      ${cmd.description}`);

      // Show parameter details if any
      if (cmd.arguments && cmd.arguments.length > 0) {
        for (const arg of cmd.arguments) {
          const reqText = arg.required ? '(required)' : '(optional)';
          lines.push(`      • ${arg.name}: ${arg.description} ${reqText}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('─────────────────────────────────────────────────────────────────');
  lines.push('  Tip: Type naturally to chat with the AI');
  lines.push('  Use Ctrl+C to cancel, "exit" to quit');
  lines.push('─────────────────────────────────────────────────────────────────');

  return {
    handled: true,
    entry: {
      type: "assistant",
      content: lines.join('\n'),
      timestamp: new Date(),
    },
  };
}

/**
 * YOLO Mode - Full auto-execution with guardrails
 */
export function handleYoloMode(args: string[]): CommandHandlerResult {
  const autonomyManager = getAutonomyManager();
  const action = args[0]?.toLowerCase();

  let content: string;

  switch (action) {
    case "on":
      autonomyManager.enableYOLO(false);
      autonomyManager.updateYOLOConfig({
        maxAutoEdits: 50,
        maxAutoCommands: 100,
      });
      content = `🚀 YOLO MODE: ENABLED

⚡ Auto-approval is ON for all operations
⚠️  Guardrails: 50 auto-edits, 100 commands per session

Use /yolo off to disable, /yolo safe for restricted mode`;
      break;

    case "safe":
      autonomyManager.enableYOLO(true);
      autonomyManager.updateYOLOConfig({
        maxAutoEdits: 20,
        maxAutoCommands: 30,
        allowedPaths: ["src/", "test/", "tests/"],
      });
      content = `🛡️ YOLO MODE: SAFE

✅ Auto-approval ON with restrictions:
   • Max 20 edits, 30 commands
   • Allowed paths: src/, test/, tests/

Use /yolo on for full mode, /yolo off to disable`;
      break;

    case "off":
      autonomyManager.disableYOLO();
      content = `⏸️ YOLO MODE: DISABLED

Manual approval is now required for operations.`;
      break;

    case "allow":
      if (args[1]) {
        autonomyManager.addToYOLOAllowList(args[1]);
        content = `✅ Added "${args[1]}" to YOLO allowed commands`;
      } else {
        content = `Usage: /yolo allow <command>`;
      }
      break;

    case "deny":
      if (args[1]) {
        autonomyManager.addToYOLODenyList(args[1]);
        content = `🚫 Added "${args[1]}" to YOLO denied commands`;
      } else {
        content = `Usage: /yolo deny <command>`;
      }
      break;

    case "status":
    default:
      content = autonomyManager.formatYOLOStatus();
      break;
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content,
      timestamp: new Date(),
    },
  };
}

/**
 * Autonomy - Set autonomy level
 */
export function handleAutonomy(args: string[]): CommandHandlerResult {
  const autonomyManager = getAutonomyManager();
  const level = args[0]?.toLowerCase() as AutonomyLevel;

  if (level && ["suggest", "confirm", "auto", "full", "yolo"].includes(level)) {
    autonomyManager.setLevel(level);

    const descriptions: Record<AutonomyLevel, string> = {
      suggest: "Suggests changes, you approve each one",
      confirm: "Asks for confirmation on important operations",
      auto: "Auto-approves safe operations, confirms destructive ones",
      full: "Auto-approves all operations (use with caution)",
      yolo: "Full auto mode with no confirmations",
    };

    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `🎚️ Autonomy Level: ${level.toUpperCase()}

${descriptions[level]}`,
        timestamp: new Date(),
      },
    };
  }

  const current = autonomyManager.getLevel();
  return {
    handled: true,
    entry: {
      type: "assistant",
      content: `🎚️ Autonomy Settings

Current: ${current.toUpperCase()}

Levels:
  suggest  - Suggests changes, you approve each
  confirm  - Confirms important operations
  auto     - Auto-approves safe operations
  full     - Auto-approves everything
  yolo     - No confirmations at all

Usage: /autonomy <level>`,
      timestamp: new Date(),
    },
  };
}

/**
 * Pipeline - Run agent workflows
 */
export function handlePipeline(args: string[]): CommandHandlerResult {
  const pipelineName = args[0];

  if (!pipelineName) {
    const content = `🔄 Available Pipelines

  • code-review: Comprehensive code review workflow
  • bug-fix: Systematic bug fixing workflow
  • feature-development: Feature development workflow
  • security-audit: Security audit workflow
  • documentation: Documentation generation workflow

Usage: /pipeline <name> [target]

Example: /pipeline code-review src/utils.ts`;

    return {
      handled: true,
      entry: {
        type: "assistant",
        content,
        timestamp: new Date(),
      },
    };
  }

  const target = args.slice(1).join(" ") || process.cwd();

  const pipelineSteps: Record<string, string> = {
    "code-review": `1. Analyze code structure
2. Check for code smells and anti-patterns
3. Review error handling
4. Check test coverage
5. Provide improvement suggestions`,
    "bug-fix": `1. Reproduce the issue
2. Analyze error messages and logs
3. Identify root cause
4. Implement fix
5. Verify fix and add tests`,
    "feature-development": `1. Understand requirements
2. Design implementation approach
3. Implement feature
4. Write tests
5. Document changes`,
    "security-audit": `1. Scan for common vulnerabilities
2. Check authentication/authorization
3. Review data handling
4. Check dependencies
5. Provide security recommendations`,
    "documentation": `1. Analyze code structure
2. Generate API documentation
3. Create usage examples
4. Update README if needed
5. Add inline comments`,
  };

  const steps = pipelineSteps[pipelineName] || "Execute the pipeline steps";

  return {
    handled: true,
    passToAI: true,
    prompt: `Run the ${pipelineName} pipeline on: ${target}

This involves:
${steps}

Execute each step and report results.`,
  };
}

/**
 * Parallel - Run parallel subagents
 */
export function handleParallel(args: string[]): CommandHandlerResult {
  const task = args.join(" ");

  if (!task) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `🔀 Parallel Subagent Runner

Usage: /parallel <task description>

Example: /parallel analyze all TypeScript files in src/

This will execute the task using parallel subagents where beneficial.`,
        timestamp: new Date(),
      },
    };
  }

  return {
    handled: true,
    passToAI: true,
    prompt: `Execute this task using parallel subagents where beneficial:

${task}

Consider splitting into parallel operations for:
- Independent file analysis
- Multiple search queries
- Concurrent API calls`,
  };
}

/**
 * Model Router - Configure dynamic model selection
 */
export function handleModelRouter(args: string[]): CommandHandlerResult {
  const action = args[0]?.toLowerCase();

  let content: string;

  switch (action) {
    case "auto":
      content = `🤖 Model Router: AUTO MODE

Models will be selected automatically based on task type.

Task Types:
  • search   → Fast model for quick searches
  • planning → Smart model for planning
  • coding   → Best model for code generation
  • review   → Smart model for reviews
  • debug    → Best model for debugging
  • docs     → Fast model for documentation
  • chat     → Default model for conversations`;
      break;

    case "manual":
      content = `🎛️ Model Router: MANUAL MODE

Use /model to change models manually.`;
      break;

    case "status":
    default:
      content = `🔄 Model Router Status

Mode: Manual (use /model-router auto to enable)

Task-to-Model Mapping:
  • search   → grok-code-fast-1
  • planning → grok-4-latest
  • coding   → grok-4-latest
  • review   → grok-4-latest
  • debug    → grok-4-latest
  • docs     → grok-code-fast-1
  • chat     → grok-code-fast-1

Commands:
  /model-router auto    - Enable auto selection
  /model-router manual  - Disable auto selection`;
      break;
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content,
      timestamp: new Date(),
    },
  };
}

/**
 * Skill - Manage specialized skills
 */
export function handleSkill(args: string[]): CommandHandlerResult {
  const skillManager = getSkillManager();
  const action = args[0]?.toLowerCase();

  let content: string;

  if (!action || action === "list") {
    const skills = skillManager.getAvailableSkills();
    const active = skillManager.getActiveSkill();

    content = `🎯 Available Skills

${skills
  .map((name) => {
    const skill = skillManager.getSkill(name);
    const isActive = active?.name === name;
    return `  ${isActive ? "✅" : "⚪"} ${name}\n     ${skill?.description || ""}`;
  })
  .join("\n\n")}

Commands:
  /skill list              - Show all skills
  /skill activate <name>   - Enable a skill
  /skill deactivate        - Disable current skill
  /skill <name>            - Quick activate`;
  } else if (action === "activate" && args[1]) {
    const skill = skillManager.activateSkill(args[1]);
    content = skill
      ? `✅ Activated skill: ${skill.name}\n\n${skill.description}`
      : `❌ Skill not found: ${args[1]}`;
  } else if (action === "deactivate") {
    skillManager.deactivateSkill();
    content = `⏸️ Skill deactivated`;
  } else {
    // Try to activate as skill name
    const skill = skillManager.activateSkill(action);
    if (skill) {
      content = `✅ Activated skill: ${skill.name}\n\n${skill.description}`;
    } else {
      content = `❌ Unknown skill: ${action}\n\nUse /skill list to see available skills`;
    }
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content,
      timestamp: new Date(),
    },
  };
}

/**
 * Save Conversation - Export chat to file
 */
export function handleSaveConversation(
  args: string[],
  conversationHistory: ChatEntry[]
): CommandHandlerResult {
  const filename = args.join(" ") || undefined;
  const exporter = getConversationExporter();

  const result = exporter.export(conversationHistory, {
    format: 'markdown',
    includeToolResults: true,
    includeTimestamps: true,
    outputPath: filename,
  });

  if (result.success) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `✅ Conversation saved!

📄 File: ${result.filePath}

The conversation has been exported in Markdown format.`,
        timestamp: new Date(),
      },
    };
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content: `❌ Failed to save conversation: ${result.error}`,
      timestamp: new Date(),
    },
  };
}
