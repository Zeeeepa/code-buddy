import { describe, expect, it } from 'vitest';
import { SlashCommandBridge } from '../src/main/commands/slash-command-bridge';

describe('SlashCommandBridge remote execution', () => {
  it('allows prompt-rewriting slash commands remotely', async () => {
    const bridge = new SlashCommandBridge();
    bridge.listCommands = async () => [
      {
        name: 'plan',
        description: 'Create a plan',
        prompt: 'Plan this task:\n\n{{args}}',
        isBuiltin: true,
      },
    ];

    const result = await bridge.executeRemoteInput('/plan fix auth flow');
    expect(result).toEqual({
      allowed: true,
      prompt: 'Plan this task:\n\nfix auth flow',
    });
  });

  it('blocks handled/tokenized slash commands remotely', async () => {
    const bridge = new SlashCommandBridge();
    bridge.listCommands = async () => [
      {
        name: 'clear',
        description: 'Clear the chat',
        prompt: '__CLEAR_CHAT__',
        isBuiltin: true,
      },
    ];

    const result = await bridge.executeRemoteInput('/clear');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('/clear');
  });
});
