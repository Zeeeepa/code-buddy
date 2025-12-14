/**
 * Tool Manager Tests
 */

import {
  createToolManager,
  ToolManager,
  ToolRegistration,
  Tool,
  ToolResult,
} from '../src/tools/tool-manager.js';

// ============================================================================
// Mock Tool
// ============================================================================

class MockTool implements Tool {
  name = 'mock_tool';
  description = 'A mock tool for testing';
  executeCount = 0;
  lastArgs: Record<string, unknown> | null = null;

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    this.executeCount++;
    this.lastArgs = args;
    return {
      success: true,
      output: 'Mock output',
    };
  }
}

class FailingTool implements Tool {
  name = 'failing_tool';
  description = 'A tool that always fails';

  async execute(): Promise<ToolResult> {
    throw new Error('Intentional failure');
  }
}

class _SlowTool implements Tool {
  name = 'slow_tool';
  description = 'A tool that takes time';

  async execute(): Promise<ToolResult> {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true, output: 'Done' };
  }
}

// ============================================================================
// Tool Manager Tests
// ============================================================================

describe('ToolManager', () => {
  let manager: ToolManager;

  beforeEach(() => {
    manager = createToolManager();
  });

  describe('Registration', () => {
    it('should register a tool', () => {
      const registration: ToolRegistration = {
        name: 'test_tool',
        description: 'Test tool',
        factory: () => new MockTool(),
        defaultPermission: 'always',
        defaultTimeout: 30,
        readOnly: true,
      };

      manager.register(registration);

      expect(manager.has('test_tool')).toBe(true);
      expect(manager.getNames()).toContain('test_tool');
    });

    it('should register multiple tools', () => {
      const registrations: ToolRegistration[] = [
        {
          name: 'tool1',
          description: 'Tool 1',
          factory: () => new MockTool(),
          defaultPermission: 'always',
          defaultTimeout: 30,
          readOnly: true,
        },
        {
          name: 'tool2',
          description: 'Tool 2',
          factory: () => new MockTool(),
          defaultPermission: 'ask',
          defaultTimeout: 60,
          readOnly: false,
        },
      ];

      manager.registerAll(registrations);

      expect(manager.has('tool1')).toBe(true);
      expect(manager.has('tool2')).toBe(true);
      expect(manager.getNames().length).toBe(2);
    });

    it('should get registration info', () => {
      manager.register({
        name: 'test',
        description: 'Test',
        factory: () => new MockTool(),
        defaultPermission: 'ask',
        defaultTimeout: 45,
        readOnly: false,
        tags: ['test', 'mock'],
      });

      const reg = manager.getRegistration('test');

      expect(reg?.defaultPermission).toBe('ask');
      expect(reg?.defaultTimeout).toBe(45);
      expect(reg?.readOnly).toBe(false);
      expect(reg?.tags).toContain('test');
    });
  });

  describe('Lazy Instantiation', () => {
    it('should not instantiate until get is called', () => {
      let instantiated = false;
      manager.register({
        name: 'lazy_tool',
        description: 'Lazy tool',
        factory: () => {
          instantiated = true;
          return new MockTool();
        },
        defaultPermission: 'always',
        defaultTimeout: 30,
        readOnly: true,
      });

      expect(instantiated).toBe(false);
      expect(manager.getStats().instantiated).toBe(0);

      manager.get('lazy_tool');

      expect(instantiated).toBe(true);
      expect(manager.getStats().instantiated).toBe(1);
    });

    it('should cache instances', () => {
      let factoryCalls = 0;
      manager.register({
        name: 'cached_tool',
        description: 'Cached tool',
        factory: () => {
          factoryCalls++;
          return new MockTool();
        },
        defaultPermission: 'always',
        defaultTimeout: 30,
        readOnly: true,
      });

      manager.get('cached_tool');
      manager.get('cached_tool');
      manager.get('cached_tool');

      expect(factoryCalls).toBe(1);
    });

    it('should return undefined for unknown tools', () => {
      expect(manager.get('unknown')).toBeUndefined();
    });
  });

  describe('Tags and Filtering', () => {
    beforeEach(() => {
      manager.registerAll([
        {
          name: 'file_read',
          description: 'Read files',
          factory: () => new MockTool(),
          defaultPermission: 'always',
          defaultTimeout: 30,
          readOnly: true,
          tags: ['file', 'read'],
        },
        {
          name: 'file_write',
          description: 'Write files',
          factory: () => new MockTool(),
          defaultPermission: 'ask',
          defaultTimeout: 30,
          readOnly: false,
          tags: ['file', 'write'],
        },
        {
          name: 'web_search',
          description: 'Search web',
          factory: () => new MockTool(),
          defaultPermission: 'always',
          defaultTimeout: 30,
          readOnly: true,
          tags: ['web', 'read'],
        },
      ]);
    });

    it('should get tools by tag', () => {
      const fileTools = manager.getByTag('file');
      expect(fileTools).toContain('file_read');
      expect(fileTools).toContain('file_write');
      expect(fileTools).not.toContain('web_search');
    });

    it('should get read-only tools', () => {
      const readOnly = manager.getReadOnlyTools();
      expect(readOnly).toContain('file_read');
      expect(readOnly).toContain('web_search');
      expect(readOnly).not.toContain('file_write');
    });
  });

  describe('Permission Checking', () => {
    it('should allow tools with always permission', () => {
      manager.register({
        name: 'always_allowed',
        description: 'Always allowed',
        factory: () => new MockTool(),
        defaultPermission: 'always',
        defaultTimeout: 30,
        readOnly: true,
      });

      const result = manager.checkPermission('always_allowed', {});

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('should require confirmation for ask permission', () => {
      manager.register({
        name: 'ask_permission',
        description: 'Ask permission',
        factory: () => new MockTool(),
        defaultPermission: 'ask',
        defaultTimeout: 30,
        readOnly: false,
      });

      const result = manager.checkPermission('ask_permission', {});

      expect(result.allowed).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('should block tools with never permission', () => {
      manager.register({
        name: 'never_allowed',
        description: 'Never allowed',
        factory: () => new MockTool(),
        defaultPermission: 'never',
        defaultTimeout: 30,
        readOnly: false,
      });

      const result = manager.checkPermission('never_allowed', {});

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('disabled');
    });
  });

  describe('Tool Execution', () => {
    it('should execute tools successfully', async () => {
      const mockTool = new MockTool();
      manager.register({
        name: 'exec_test',
        description: 'Execution test',
        factory: () => mockTool,
        defaultPermission: 'always',
        defaultTimeout: 30,
        readOnly: true,
      });

      const result = await manager.execute('exec_test', { arg: 'value' });

      expect(result.success).toBe(true);
      expect(result.output).toBe('Mock output');
    });

    it('should return error for unknown tools', async () => {
      const result = await manager.execute('nonexistent', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should handle tool failures', async () => {
      manager.register({
        name: 'fail_test',
        description: 'Failure test',
        factory: () => new FailingTool(),
        defaultPermission: 'always',
        defaultTimeout: 30,
        readOnly: true,
      });

      const result = await manager.execute('fail_test', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Intentional failure');
    });

    it('should emit events on execution', async () => {
      const events: string[] = [];
      manager.on('tool:executed', () => events.push('executed'));

      manager.register({
        name: 'event_test',
        description: 'Event test',
        factory: () => new MockTool(),
        defaultPermission: 'always',
        defaultTimeout: 30,
        readOnly: true,
      });

      await manager.execute('event_test', {});

      expect(events).toContain('executed');
    });

    it('should call confirmation callback when required', async () => {
      let confirmationCalled = false;

      manager.register({
        name: 'confirm_test',
        description: 'Confirmation test',
        factory: () => new MockTool(),
        defaultPermission: 'ask',
        defaultTimeout: 30,
        readOnly: false,
      });

      await manager.execute('confirm_test', {}, {
        onConfirmation: async () => {
          confirmationCalled = true;
          return true;
        },
      });

      expect(confirmationCalled).toBe(true);
    });

    it('should block when confirmation denied', async () => {
      manager.register({
        name: 'deny_test',
        description: 'Deny test',
        factory: () => new MockTool(),
        defaultPermission: 'ask',
        defaultTimeout: 30,
        readOnly: false,
      });

      const result = await manager.execute('deny_test', {}, {
        onConfirmation: async () => false,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('denied');
    });

    it('should skip permission check when requested', async () => {
      manager.register({
        name: 'skip_check',
        description: 'Skip check test',
        factory: () => new MockTool(),
        defaultPermission: 'never', // Would normally block
        defaultTimeout: 30,
        readOnly: false,
      });

      const result = await manager.execute('skip_check', {}, {
        skipPermissionCheck: true,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Stats and Cache', () => {
    it('should report stats', () => {
      manager.registerAll([
        {
          name: 'stat1',
          description: 'Stat 1',
          factory: () => new MockTool(),
          defaultPermission: 'always',
          defaultTimeout: 30,
          readOnly: true,
        },
        {
          name: 'stat2',
          description: 'Stat 2',
          factory: () => new MockTool(),
          defaultPermission: 'ask',
          defaultTimeout: 30,
          readOnly: false,
        },
        {
          name: 'stat3',
          description: 'Stat 3',
          factory: () => new MockTool(),
          defaultPermission: 'never',
          defaultTimeout: 30,
          readOnly: true,
        },
      ]);

      manager.get('stat1'); // Instantiate one

      const stats = manager.getStats();

      expect(stats.registered).toBe(3);
      expect(stats.instantiated).toBe(1);
      expect(stats.readOnly).toBe(2);
      expect(stats.byPermission.always).toBe(1);
      expect(stats.byPermission.ask).toBe(1);
      expect(stats.byPermission.never).toBe(1);
    });

    it('should clear cache', () => {
      manager.register({
        name: 'cache_test',
        description: 'Cache test',
        factory: () => new MockTool(),
        defaultPermission: 'always',
        defaultTimeout: 30,
        readOnly: true,
      });

      manager.get('cache_test');
      expect(manager.getStats().instantiated).toBe(1);

      manager.clearCache();
      expect(manager.getStats().instantiated).toBe(0);
    });
  });
});
