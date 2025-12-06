import { ChatEntry } from "../../agent/grok-agent.js";
import { getMemoryManager } from "../../memory/persistent-memory.js";
import { getCommentWatcher } from "../../tools/comment-watcher.js";

export interface CommandHandlerResult {
  handled: boolean;
  entry?: ChatEntry;
  passToAI?: boolean;
  prompt?: string;
}

/**
 * Memory - Manage persistent memory
 */
export async function handleMemory(args: string[]): Promise<CommandHandlerResult> {
  const memoryManager = getMemoryManager();
  await memoryManager.initialize();

  const action = args[0]?.toLowerCase();

  let content: string;

  switch (action) {
    case "recall":
      if (args[1]) {
        const value = memoryManager.recall(args[1]);
        content = value
          ? `📝 ${args[1]}: ${value}`
          : `❌ Memory not found: ${args[1]}`;
      } else {
        content = `Usage: /memory recall <key>`;
      }
      break;

    case "forget":
      if (args[1]) {
        await memoryManager.forget(args[1]);
        content = `🗑️ Forgot: ${args[1]}`;
      } else {
        content = `Usage: /memory forget <key>`;
      }
      break;

    case "list":
    default:
      content = memoryManager.formatMemories();
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
 * Remember - Quick memory store
 */
export async function handleRemember(args: string[]): Promise<CommandHandlerResult> {
  const memoryManager = getMemoryManager();
  await memoryManager.initialize();

  const key = args[0];
  const value = args.slice(1).join(" ");

  if (!key || !value) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `Usage: /remember <key> <value>`,
        timestamp: new Date(),
      },
    };
  }

  await memoryManager.remember(key, value);

  return {
    handled: true,
    entry: {
      type: "assistant",
      content: `✅ Remembered: ${key} = ${value}`,
      timestamp: new Date(),
    },
  };
}

/**
 * Scan Todos - Find AI-directed comments
 */
export async function handleScanTodos(): Promise<CommandHandlerResult> {
  const commentWatcher = getCommentWatcher();

  await commentWatcher.scanProject();
  const content = commentWatcher.formatComments();

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
 * Address Todo - Handle specific AI comment
 */
export async function handleAddressTodo(
  args: string[]
): Promise<CommandHandlerResult> {
  const commentWatcher = getCommentWatcher();
  const index = parseInt(args[0], 10);

  if (isNaN(index)) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `Usage: /address-todo <index>

Run /scan-todos first to see available items`,
        timestamp: new Date(),
      },
    };
  }

  const comments = commentWatcher.getDetectedComments();

  if (index < 1 || index > comments.length) {
    return {
      handled: true,
      entry: {
        type: "assistant",
        content: `❌ Invalid index. Available: 1-${comments.length}`,
        timestamp: new Date(),
      },
    };
  }

  const comment = comments[index - 1];
  const prompt = commentWatcher.generatePromptForComment(comment);

  return {
    handled: true,
    passToAI: true,
    prompt,
  };
}
