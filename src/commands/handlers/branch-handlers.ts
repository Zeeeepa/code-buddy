import { ChatEntry } from "../../agent/grok-agent.js";
import { getBranchManager } from "../../persistence/conversation-branches.js";

export interface CommandHandlerResult {
  handled: boolean;
  entry?: ChatEntry;
  passToAI?: boolean;
  prompt?: string;
}

/**
 * Fork - Create conversation branch
 */
export function handleFork(args: string[]): CommandHandlerResult {
  const branchManager = getBranchManager();
  const branchName = args.join(" ") || `branch-${Date.now()}`;

  const branch = branchManager.fork(branchName);

  return {
    handled: true,
    entry: {
      type: "assistant",
      content: `🔀 Created branch: ${branch.name}

ID: ${branch.id}
Messages: ${branch.messages.length}

Use /branches to see all branches
Use /checkout <id> to switch branches`,
      timestamp: new Date(),
    },
  };
}

/**
 * Branches - List conversation branches
 */
export function handleBranches(): CommandHandlerResult {
  const branchManager = getBranchManager();
  const branches = branchManager.getAllBranches();
  const currentId = branchManager.getCurrentBranchId();

  let content = `🌳 Conversation Branches\n${"═".repeat(50)}\n\n`;

  for (const branch of branches) {
    const isCurrent = branch.id === currentId;
    content += `${isCurrent ? "→ " : "  "}${branch.name} (${branch.id})\n`;
    content += `    Messages: ${branch.messages.length} | Created: ${new Date(branch.createdAt).toLocaleString()}\n\n`;
  }

  content += `\nCommands:\n  /fork <name>     - Create new branch\n  /checkout <id>   - Switch branch\n  /merge <id>      - Merge branch`;

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
 * Checkout - Switch to a branch
 */
export function handleCheckout(args: string[]): CommandHandlerResult {
  const branchManager = getBranchManager();
  const branchId = args[0];

  if (!branchId) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `Usage: /checkout <branch-id>

Use /branches to see available branches`,
        timestamp: new Date(),
      },
    };
  }

  const result = branchManager.checkout(branchId);

  if (result) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `✅ Switched to branch: ${result.name}

Loaded ${result.messages.length} messages`,
        timestamp: new Date(),
      },
    };
  }

  return {
    handled: true,
    entry: {
      type: "assistant",
      content: `❌ Branch not found: ${branchId}`,
      timestamp: new Date(),
    },
  };
}

/**
 * Merge - Merge a branch
 */
export function handleMerge(args: string[]): CommandHandlerResult {
  const branchManager = getBranchManager();
  const branchId = args[0];

  if (!branchId) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `Usage: /merge <branch-id>`,
        timestamp: new Date(),
      },
    };
  }

  const result = branchManager.merge(branchId);

  return {
    handled: true,
    entry: {
      type: "assistant",
      content: result
        ? `✅ Merged branch: ${branchId}`
        : `❌ Merge failed: Branch not found or same as current`,
      timestamp: new Date(),
    },
  };
}
