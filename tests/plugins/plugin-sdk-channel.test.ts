import { describe, it, expect } from 'vitest';
import { defineChannel } from '../../src/plugin-sdk/channel.js';
import type {
  ChannelMessageToolDescription,
  ChannelPlugin,
  DefineChannelConfig,
} from '../../src/plugin-sdk/channel.js';

function makeBaseConfig(): Omit<DefineChannelConfig, 'type'> {
  return {
    async connect() {},
    async disconnect() {},
    async send() {
      return { success: true, timestamp: new Date() };
    },
    getStatus() {
      return { type: 'webchat' as const, connected: true, authenticated: true };
    },
    onMessage() {},
  };
}

describe('Channel Plugin — describeMessageTool', () => {
  it('defineChannel with describeMessageTool creates valid channel', () => {
    const channel = defineChannel({
      type: 'webchat',
      ...makeBaseConfig(),
      describeMessageTool() {
        return {
          name: 'webchat_send',
          description: 'Send a message via webchat',
          parameters: {
            type: 'object',
            properties: { text: { type: 'string' } },
          },
        };
      },
    });

    expect(channel.describeMessageTool).toBeDefined();
    const tool = channel.describeMessageTool!();
    expect(tool.name).toBe('webchat_send');
    expect(tool.description).toBe('Send a message via webchat');
    expect(tool.parameters).toBeDefined();
    expect(tool.parameters.type).toBe('object');
  });

  it('defineChannel without describeMessageTool works (backward compat)', () => {
    const channel = defineChannel({
      type: 'webchat',
      ...makeBaseConfig(),
    });

    expect(channel.describeMessageTool).toBeUndefined();
  });

  it('describeMessageTool returns correct ChannelMessageToolDescription shape', () => {
    const expectedTool: ChannelMessageToolDescription = {
      name: 'slack_send_message',
      description: 'Send a Slack message to a channel or DM',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel ID' },
          text: { type: 'string', description: 'Message text' },
        },
        required: ['channel', 'text'],
      },
    };

    const channel = defineChannel({
      type: 'slack',
      ...makeBaseConfig(),
      describeMessageTool() {
        return expectedTool;
      },
    });

    const tool = channel.describeMessageTool!();
    expect(tool).toEqual(expectedTool);
  });

  it('describeMessageTool preserves this binding via defineChannel', () => {
    const config: DefineChannelConfig = {
      type: 'telegram',
      ...makeBaseConfig(),
      describeMessageTool() {
        // Access `this.type` to verify binding works
        return {
          name: `${this.type}_send`,
          description: `Send via ${this.type}`,
          parameters: { type: 'object', properties: {} },
        };
      },
    };

    const channel = defineChannel(config);
    const tool = channel.describeMessageTool!();
    expect(tool.name).toBe('telegram_send');
    expect(tool.description).toBe('Send via telegram');
  });

  it('channel satisfies ChannelPlugin interface with describeMessageTool', () => {
    const channel: ChannelPlugin = defineChannel({
      type: 'webchat',
      ...makeBaseConfig(),
      describeMessageTool() {
        return {
          name: 'webchat_send',
          description: 'Send via webchat',
          parameters: {},
        };
      },
    });

    // Type check: ChannelPlugin with describeMessageTool is assignable
    expect(channel.type).toBe('webchat');
    expect(typeof channel.describeMessageTool).toBe('function');
  });
});
