import { ChatEntry } from "../../agent/grok-agent.js";
import { getThemeManager } from "../../themes/theme-manager.js";

export interface CommandHandlerResult {
  handled: boolean;
  entry?: ChatEntry;
  passToAI?: boolean;
  prompt?: string;
}

/**
 * Theme - Change UI color theme
 */
export function handleTheme(args: string[]): CommandHandlerResult {
  const themeManager = getThemeManager();
  const action = args[0]?.toLowerCase();

  let content: string;

  if (!action || action === "list") {
    const themes = themeManager.getAvailableThemes();
    const currentTheme = themeManager.getCurrentTheme();

    content = `🎨 Available Themes\n${"═".repeat(40)}\n\n`;

    for (const theme of themes) {
      const isCurrent = theme.id === currentTheme.id;
      const marker = isCurrent ? "▶" : " ";
      const builtinMarker = theme.isBuiltin ? "" : " (custom)";
      content += `${marker} ${theme.name}${builtinMarker}\n`;
      content += `    ${theme.description}\n\n`;
    }

    content += `\n💡 Usage: /theme <name>\n`;
    content += `   Example: /theme neon`;
  } else {
    // Try to set the theme
    const success = themeManager.setTheme(action);

    if (success) {
      const theme = themeManager.getCurrentTheme();
      content = `🎨 Theme Changed!\n\n`;
      content += `Now using: ${theme.name}\n`;
      content += `${theme.description}\n\n`;
      content += `💡 The theme will be applied to new messages.`;
    } else {
      const themes = themeManager.getAvailableThemes();
      content = `❌ Theme "${action}" not found.\n\n`;
      content += `Available themes:\n`;
      content += themes.map(t => `  • ${t.id}`).join("\n");
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
 * Avatar - Change chat avatars
 */
export function handleAvatar(args: string[]): CommandHandlerResult {
  const themeManager = getThemeManager();
  const action = args[0]?.toLowerCase();

  let content: string;

  if (!action || action === "list") {
    const presets = themeManager.getAvatarPresets();
    const currentAvatars = themeManager.getAvatars();

    content = `👤 Avatar Presets\n${"═".repeat(40)}\n\n`;

    for (const preset of presets) {
      content += `${preset.name} (${preset.id})\n`;
      content += `    ${preset.description}\n`;
      content += `    Preview: ${preset.avatars.user} ${preset.avatars.assistant} ${preset.avatars.tool}\n\n`;
    }

    content += `\nCurrent avatars:\n`;
    content += `    User: ${currentAvatars.user}\n`;
    content += `    Assistant: ${currentAvatars.assistant}\n`;
    content += `    Tool: ${currentAvatars.tool}\n`;

    content += `\n💡 Usage: /avatar <preset>\n`;
    content += `   Example: /avatar emoji`;
  } else if (action === "custom") {
    // Custom avatar syntax: /avatar custom user 🦊
    const avatarType = args[1]?.toLowerCase() as "user" | "assistant" | "tool" | "system";
    const avatarValue = args.slice(2).join(" ");

    if (!avatarType || !avatarValue) {
      content = `Usage: /avatar custom <type> <value>\n\n`;
      content += `Types: user, assistant, tool, system\n`;
      content += `Example: /avatar custom user 🦊`;
    } else if (!["user", "assistant", "tool", "system"].includes(avatarType)) {
      content = `❌ Invalid avatar type: ${avatarType}\n\n`;
      content += `Valid types: user, assistant, tool, system`;
    } else {
      themeManager.setCustomAvatar(avatarType, avatarValue);
      content = `✅ Custom avatar set!\n\n`;
      content += `${avatarType}: ${avatarValue}`;
    }
  } else if (action === "reset") {
    themeManager.clearCustomAvatars();
    content = `✅ Avatars reset to theme defaults!`;
  } else {
    // Try to apply preset
    const success = themeManager.applyAvatarPreset(action);

    if (success) {
      const avatars = themeManager.getAvatars();
      content = `👤 Avatar Preset Applied!\n\n`;
      content += `Now using:\n`;
      content += `    User: ${avatars.user}\n`;
      content += `    Assistant: ${avatars.assistant}\n`;
      content += `    Tool: ${avatars.tool}\n`;
    } else {
      const presets = themeManager.getAvatarPresets();
      content = `❌ Avatar preset "${action}" not found.\n\n`;
      content += `Available presets:\n`;
      content += presets.map(p => `  • ${p.id}`).join("\n");
      content += `\n\nOr use: /avatar custom <type> <value>`;
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
