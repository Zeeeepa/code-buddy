import { BaseTool, ParameterDefinition } from './base-tool.js';
import { ToolResult } from '../types/index.js';
import { logger } from '../utils/logger.js';

export class InteractiveShellTool extends BaseTool {
  readonly name = 'interactive_shell';
  readonly description = 'Launch an interactive PTY shell and hand over control to the user. Use this ONLY when a command requires manual user intervention (e.g., answering prompts, editing in Vim, resolving git conflicts) or when you are stuck and need the user to run commands manually. The agentic loop will PAUSE until the user types "exit".';

  constructor() {
    super();
  }

  protected getParameters(): Record<string, ParameterDefinition> {
    return {
      initial_command: {
        type: 'string',
        description: 'Optional command to pre-fill or execute immediately when the interactive shell opens (e.g., "npm init" or "git rebase -i HEAD~3").',
        required: false,
      },
      reason: {
        type: 'string',
        description: 'Explain to the user why you are handing over control.',
        required: true,
      }
    };
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const initialCommand = input.initial_command as string | undefined;
    const reason = input.reason as string;

    // We emit a special signal to the AgentExecutor, just like PLAN_APPROVAL
    // This tells the UI to detach and give stdin/stdout back to the user.
    return this.success(`__INTERACTIVE_SHELL_REQUEST__\nReason: ${reason}\nCommand: ${initialCommand || ''}`);
  }
}
