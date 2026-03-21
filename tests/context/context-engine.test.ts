/**
 * Tests for ContextEngine pluggable interface
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ContextEngine, ContextMeta, AssembleResult } from '../../src/context/context-engine.js';
import { DefaultContextEngine } from '../../src/context/default-context-engine.js';
import type { CodeBuddyMessage } from '../../src/codebuddy/client.js';

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

/**
 * Mock ContextEngine that records hook call order
 */
class MockContextEngine implements ContextEngine {
  readonly id = 'mock-engine';
  readonly callOrder: string[] = [];

  async bootstrap(config: Record<string, unknown>): Promise<void> {
    this.callOrder.push('bootstrap');
  }

  ingest(messages: CodeBuddyMessage[], meta: ContextMeta): CodeBuddyMessage[] {
    this.callOrder.push('ingest');
    return messages;
  }

  assemble(messages: CodeBuddyMessage[], budget: number): AssembleResult {
    this.callOrder.push('assemble');
    return { messages, tokenCount: 100 };
  }

  compact(messages: CodeBuddyMessage[], targetTokens: number): CodeBuddyMessage[] {
    this.callOrder.push('compact');
    return messages;
  }

  afterTurn(messages: CodeBuddyMessage[], response: CodeBuddyMessage): void {
    this.callOrder.push('afterTurn');
  }

  prepareSubagentSpawn(messages: CodeBuddyMessage[], role: string): CodeBuddyMessage[] {
    this.callOrder.push('prepareSubagentSpawn');
    return messages.slice(-5);
  }

  onSubagentEnded(agentId: string, messages: CodeBuddyMessage[], result?: string): void {
    this.callOrder.push('onSubagentEnded');
  }
}

/**
 * Mock engine that owns compaction (ownsCompaction = true)
 */
class OwningContextEngine implements ContextEngine {
  readonly id = 'owning-engine';
  readonly ownsCompaction = true;
  assembleCalled = false;

  async bootstrap(_config: Record<string, unknown>): Promise<void> {}
  ingest(messages: CodeBuddyMessage[], _meta: ContextMeta): CodeBuddyMessage[] { return messages; }
  assemble(messages: CodeBuddyMessage[], budget: number): AssembleResult {
    this.assembleCalled = true;
    // Custom compaction: just keep last 2 messages
    const trimmed = messages.slice(-2);
    return { messages: trimmed, tokenCount: 50 };
  }
  compact(messages: CodeBuddyMessage[], _targetTokens: number): CodeBuddyMessage[] { return messages; }
  afterTurn(_messages: CodeBuddyMessage[], _response: CodeBuddyMessage): void {}
  prepareSubagentSpawn(messages: CodeBuddyMessage[], _role: string): CodeBuddyMessage[] { return messages; }
  onSubagentEnded(_agentId: string, _messages: CodeBuddyMessage[], _result?: string): void {}
}

describe('ContextEngine Interface', () => {
  let engine: MockContextEngine;
  const sampleMessages: CodeBuddyMessage[] = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' },
  ];

  beforeEach(() => {
    engine = new MockContextEngine();
  });

  it('should call all 7 hooks in order', async () => {
    await engine.bootstrap({});
    engine.ingest(sampleMessages, { userMessage: 'test' });
    engine.assemble(sampleMessages, 4096);
    engine.compact(sampleMessages, 2000);
    engine.afterTurn(sampleMessages, { role: 'assistant', content: 'response' });
    engine.prepareSubagentSpawn(sampleMessages, 'explorer');
    engine.onSubagentEnded('agent-1', sampleMessages, 'done');

    expect(engine.callOrder).toEqual([
      'bootstrap',
      'ingest',
      'assemble',
      'compact',
      'afterTurn',
      'prepareSubagentSpawn',
      'onSubagentEnded',
    ]);
  });

  it('should have a unique id', () => {
    expect(engine.id).toBe('mock-engine');
  });

  it('ingest should pass through messages by default', () => {
    const result = engine.ingest(sampleMessages, {});
    expect(result).toBe(sampleMessages);
  });

  it('assemble should return messages with token count', () => {
    const result = engine.assemble(sampleMessages, 4096);
    expect(result.messages).toBe(sampleMessages);
    expect(result.tokenCount).toBe(100);
  });

  it('prepareSubagentSpawn should return a subset', () => {
    const longMessages: CodeBuddyMessage[] = Array.from({ length: 20 }, (_, i) => ({
      role: 'user' as const,
      content: `Message ${i}`,
    }));
    const result = engine.prepareSubagentSpawn(longMessages, 'worker');
    expect(result.length).toBe(5);
  });
});

describe('DefaultContextEngine', () => {
  let engine: DefaultContextEngine;

  beforeEach(() => {
    engine = new DefaultContextEngine();
  });

  it('should have id "default"', () => {
    expect(engine.id).toBe('default');
  });

  it('bootstrap should not throw', async () => {
    await expect(engine.bootstrap({})).resolves.toBeUndefined();
  });

  it('ingest should pass through messages', () => {
    const msgs: CodeBuddyMessage[] = [{ role: 'user', content: 'hi' }];
    expect(engine.ingest(msgs, {})).toBe(msgs);
  });

  it('assemble without manager returns empty tokenCount', () => {
    const msgs: CodeBuddyMessage[] = [{ role: 'user', content: 'hi' }];
    const result = engine.assemble(msgs, 4096);
    expect(result.messages).toBe(msgs);
    expect(result.tokenCount).toBe(0);
  });

  it('afterTurn should be no-op', () => {
    expect(() => {
      engine.afterTurn(
        [{ role: 'user', content: 'hi' }],
        { role: 'assistant', content: 'hello' }
      );
    }).not.toThrow();
  });

  it('prepareSubagentSpawn should limit context for explorer role', () => {
    const msgs: CodeBuddyMessage[] = [
      { role: 'system', content: 'sys' },
      ...Array.from({ length: 30 }, (_, i) => ({
        role: 'user' as const,
        content: `msg-${i}`,
      })),
    ];
    const result = engine.prepareSubagentSpawn(msgs, 'explorer');
    // 1 system + 10 recent
    expect(result.length).toBe(11);
  });

  it('prepareSubagentSpawn should give more context for worker role', () => {
    const msgs: CodeBuddyMessage[] = [
      { role: 'system', content: 'sys' },
      ...Array.from({ length: 30 }, (_, i) => ({
        role: 'user' as const,
        content: `msg-${i}`,
      })),
    ];
    const result = engine.prepareSubagentSpawn(msgs, 'worker');
    // 1 system + 20 recent
    expect(result.length).toBe(21);
  });

  it('onSubagentEnded should be no-op for default engine', () => {
    expect(() => {
      engine.onSubagentEnded('agent-1', [{ role: 'user', content: 'hi' }], 'done');
    }).not.toThrow();
  });

  it('ownsCompaction should be false for default engine', () => {
    expect(engine.ownsCompaction).toBe(false);
  });
});

describe('OwningContextEngine (ownsCompaction = true)', () => {
  it('should have ownsCompaction = true', () => {
    const engine = new OwningContextEngine();
    expect(engine.ownsCompaction).toBe(true);
  });

  it('assemble should trim messages when ownsCompaction is true', () => {
    const engine = new OwningContextEngine();
    const msgs: CodeBuddyMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'how are you' },
    ];
    const result = engine.assemble(msgs, 4096);
    // Owning engine keeps only last 2
    expect(result.messages.length).toBe(2);
    expect(result.tokenCount).toBe(50);
    expect(engine.assembleCalled).toBe(true);
  });

  it('onSubagentEnded should be callable', () => {
    const engine = new OwningContextEngine();
    expect(() => {
      engine.onSubagentEnded('agent-1', [], 'result');
    }).not.toThrow();
  });
});
