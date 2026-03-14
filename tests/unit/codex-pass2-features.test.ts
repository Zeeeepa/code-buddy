/**
 * Tests for Codex CLI pass 2 features:
 * 1. apply_patch format + seek_sequence
 * 2. Multi-agent tools (spawn/send/wait/close/resume)
 * 3. Session memory consolidation
 * 4. Code mode (JS exec with tool bridge)
 * 5. Agent roles
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ============================================================================
// 1. apply_patch Format + seek_sequence
// ============================================================================

describe('apply_patch', () => {
  let parsePatch: typeof import('@/tools/apply-patch.js').parsePatch;
  let seekSequence: typeof import('@/tools/apply-patch.js').seekSequence;

  beforeEach(async () => {
    const mod = await import('@/tools/apply-patch.js');
    parsePatch = mod.parsePatch;
    seekSequence = mod.seekSequence;
  });

  describe('parsePatch', () => {
    it('should parse Add File operation', () => {
      const patch = `*** Begin Patch
*** Add File: src/new.ts
+export const x = 1;
+export const y = 2;
*** End Patch`;
      const ops = parsePatch(patch);
      expect(ops).toHaveLength(1);
      expect(ops[0].type).toBe('add');
      expect(ops[0].path).toBe('src/new.ts');
      expect(ops[0].content).toBe('export const x = 1;\nexport const y = 2;');
    });

    it('should parse Delete File operation', () => {
      const patch = `*** Begin Patch
*** Delete File: src/old.ts
*** End Patch`;
      const ops = parsePatch(patch);
      expect(ops).toHaveLength(1);
      expect(ops[0].type).toBe('delete');
      expect(ops[0].path).toBe('src/old.ts');
    });

    it('should parse Update File with hunks', () => {
      const patch = `*** Begin Patch
*** Update File: src/main.ts
@@
 const x = 1;
-const y = 2;
+const y = 3;
*** End Patch`;
      const ops = parsePatch(patch);
      expect(ops).toHaveLength(1);
      expect(ops[0].type).toBe('update');
      expect(ops[0].hunks).toHaveLength(1);
      expect(ops[0].hunks![0].oldLines).toEqual(['const x = 1;', 'const y = 2;']);
      expect(ops[0].hunks![0].newLines).toEqual(['const x = 1;', 'const y = 3;']);
    });

    it('should parse multiple operations', () => {
      const patch = `*** Begin Patch
*** Add File: a.ts
+new file
*** Delete File: b.ts
*** Update File: c.ts
@@
-old
+new
*** End Patch`;
      const ops = parsePatch(patch);
      expect(ops).toHaveLength(3);
      expect(ops.map(o => o.type)).toEqual(['add', 'delete', 'update']);
    });

    it('should handle heredoc wrapper', () => {
      const patch = `<<'EOF'
*** Begin Patch
*** Add File: x.ts
+hello
*** End Patch
EOF`;
      const ops = parsePatch(patch);
      expect(ops).toHaveLength(1);
    });

    it('should return empty for invalid input', () => {
      expect(parsePatch('random text')).toHaveLength(0);
      expect(parsePatch('')).toHaveLength(0);
    });
  });

  describe('seekSequence', () => {
    it('should find exact match (pass 1)', () => {
      const lines = ['a', 'b', 'c', 'd'];
      expect(seekSequence(lines, ['b', 'c'])).toBe(1);
    });

    it('should find trailing-whitespace match (pass 2)', () => {
      const lines = ['a  ', 'b  ', 'c'];
      expect(seekSequence(lines, ['a', 'b'])).toBe(0);
    });

    it('should find full-trim match (pass 3)', () => {
      const lines = ['  a  ', '  b  ', 'c'];
      expect(seekSequence(lines, ['a', 'b'])).toBe(0);
    });

    it('should find unicode-normalized match (pass 4)', () => {
      const lines = ["const x = 'hello';", 'const y = 2;'];
      expect(seekSequence(lines, ["const x = \u2018hello\u2019;"])).toBe(0);
    });

    it('should return -1 for no match', () => {
      expect(seekSequence(['a', 'b'], ['x', 'y'])).toBe(-1);
    });

    it('should respect startIndex', () => {
      const lines = ['a', 'b', 'a', 'b'];
      expect(seekSequence(lines, ['a', 'b'], 2)).toBe(2);
    });

    it('should handle empty pattern', () => {
      expect(seekSequence(['a', 'b'], [])).toBe(0);
    });
  });
});

// ============================================================================
// 2. Multi-Agent Tools
// ============================================================================

describe('Multi-Agent Tools', () => {
  let mod: typeof import('@/agent/multi-agent/agent-tools.js');

  beforeEach(async () => {
    mod = await import('@/agent/multi-agent/agent-tools.js');
    mod.resetAgentThreads();
  });

  it('should spawn an agent', () => {
    const result = mod.spawnAgent({ prompt: 'Do something' });
    expect('id' in result).toBe(true);
    if ('id' in result) {
      expect(result.status).toBe('running');
      expect(result.depth).toBe(1);
      expect(result.nickname).toBeTruthy();
    }
  });

  it('should enforce depth limit', () => {
    // Spawn depth 1
    const a1 = mod.spawnAgent({ prompt: 'p1' });
    expect('id' in a1).toBe(true);
    if (!('id' in a1)) return;

    // Spawn depth 2
    const a2 = mod.spawnAgent({ prompt: 'p2', parentId: a1.id });
    expect('id' in a2).toBe(true);
    if (!('id' in a2)) return;

    // Spawn depth 3
    const a3 = mod.spawnAgent({ prompt: 'p3', parentId: a2.id });
    expect('id' in a3).toBe(true);
    if (!('id' in a3)) return;

    // Spawn depth 4 = blocked
    const a4 = mod.spawnAgent({ prompt: 'p4', parentId: a3.id });
    expect('error' in a4).toBe(true);
  });

  it('should send input to agent', () => {
    const agent = mod.spawnAgent({ prompt: 'start' });
    expect('id' in agent).toBe(true);
    if (!('id' in agent)) return;

    // Consume the initial prompt
    expect(mod.consumeInput(agent.id)).toBe('start');

    // Send more input
    mod.sendInput(agent.id, 'do more');
    expect(mod.consumeInput(agent.id)).toBe('do more');
  });

  it('should complete and notify parent', () => {
    const parent = mod.spawnAgent({ prompt: 'parent' });
    expect('id' in parent).toBe(true);
    if (!('id' in parent)) return;

    const child = mod.spawnAgent({ prompt: 'child', parentId: parent.id });
    expect('id' in child).toBe(true);
    if (!('id' in child)) return;

    // Consume parent's initial prompt
    mod.consumeInput(parent.id);

    mod.completeAgent(child.id, 'task done');

    // Parent should receive notification
    const notification = mod.consumeInput(parent.id);
    expect(notification).toContain('completed');
  });

  it('should close and resume agents', () => {
    const agent = mod.spawnAgent({ prompt: 'start' });
    expect('id' in agent).toBe(true);
    if (!('id' in agent)) return;

    mod.closeAgent(agent.id);
    expect(mod.getAgent(agent.id)?.status).toBe('closed');

    mod.resumeAgent(agent.id, 'continue');
    expect(mod.getAgent(agent.id)?.status).toBe('running');
    expect(mod.consumeInput(agent.id)).toBe('continue');
  });

  it('should list all agents', () => {
    mod.spawnAgent({ prompt: 'a' });
    mod.spawnAgent({ prompt: 'b' });
    expect(mod.listAgents()).toHaveLength(2);
  });

  it('should assign unique nicknames', () => {
    const names = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const agent = mod.spawnAgent({ prompt: `agent-${i}` });
      if ('id' in agent) names.add(agent.nickname);
    }
    expect(names.size).toBe(10);
  });
});

// ============================================================================
// 3. Session Memory Consolidation
// ============================================================================

describe('Memory Consolidation', () => {
  let mod: typeof import('@/memory/memory-consolidation.js');

  beforeEach(async () => {
    mod = await import('@/memory/memory-consolidation.js');
  });

  describe('extractMemoriesFromMessages', () => {
    it('should extract preference memories', () => {
      const memories = mod.extractMemoriesFromMessages([
        { role: 'user', content: 'I prefer to use single quotes in TypeScript.' },
      ]);
      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].category).toBe('preference');
    });

    it('should extract pattern memories', () => {
      const memories = mod.extractMemoriesFromMessages([
        { role: 'user', content: 'Our convention is to use kebab-case for files.' },
      ]);
      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].category).toBe('pattern');
    });

    it('should extract correction memories', () => {
      const memories = mod.extractMemoriesFromMessages([
        { role: 'user', content: 'Actually, that function was renamed to getUser.' },
      ]);
      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].category).toBe('decision');
    });

    it('should skip non-user messages', () => {
      const memories = mod.extractMemoriesFromMessages([
        { role: 'assistant', content: 'I prefer single quotes.' },
      ]);
      expect(memories).toHaveLength(0);
    });

    it('should skip content without signals', () => {
      const memories = mod.extractMemoriesFromMessages([
        { role: 'user', content: 'What does this function do?' },
      ]);
      expect(memories).toHaveLength(0);
    });
  });

  it('should export consolidateMemories', () => {
    expect(typeof mod.consolidateMemories).toBe('function');
  });

  it('should export loadMemorySummary', () => {
    expect(typeof mod.loadMemorySummary).toBe('function');
    // Should return null when no memory exists
    const result = mod.loadMemorySummary('/tmp/nonexistent-12345');
    expect(result).toBeNull();
  });
});

// ============================================================================
// 4. Code Mode
// ============================================================================

describe('Code Exec Tool', () => {
  let CodeExecTool: typeof import('@/tools/code-exec-tool.js').CodeExecTool;
  let resetCodeModeState: typeof import('@/tools/code-exec-tool.js').resetCodeModeState;

  beforeEach(async () => {
    const mod = await import('@/tools/code-exec-tool.js');
    CodeExecTool = mod.CodeExecTool;
    resetCodeModeState = mod.resetCodeModeState;
    resetCodeModeState();
  });

  it('should execute simple JavaScript', async () => {
    const tool = new CodeExecTool();
    const result = await tool.execute({ code: 'text("hello world")' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('hello world');
  });

  it('should support console.log', async () => {
    const tool = new CodeExecTool();
    const result = await tool.execute({ code: 'console.log("test output")' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('test output');
  });

  it('should support store/load', async () => {
    const tool = new CodeExecTool();
    await tool.execute({ code: 'store("key", 42)' });
    const result = await tool.execute({ code: 'text(String(load("key")))' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('42');
  });

  it('should handle errors gracefully', async () => {
    const tool = new CodeExecTool();
    const result = await tool.execute({ code: 'throw new Error("test error")' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('test error');
  });

  it('should block process access', async () => {
    const tool = new CodeExecTool();
    const result = await tool.execute({ code: 'text(typeof process)' });
    expect(result.success).toBe(true);
    expect(result.output).toContain('undefined');
  });

  it('should report completion time', async () => {
    const tool = new CodeExecTool();
    const result = await tool.execute({ code: 'text("done")' });
    expect(result.output).toContain('completed');
  });
});

// ============================================================================
// 5. Agent Roles
// ============================================================================

describe('Agent Roles', () => {
  let mod: typeof import('@/agent/multi-agent/agent-roles.js');

  beforeEach(async () => {
    mod = await import('@/agent/multi-agent/agent-roles.js');
  });

  it('should have 3 built-in roles', () => {
    expect(mod.getBuiltinRoleNames()).toEqual(['default', 'explorer', 'worker']);
  });

  it('explorer role should be read-only', () => {
    const explorer = mod.getRole('explorer');
    expect(explorer).toBeDefined();
    expect(explorer!.readOnly).toBe(true);
    expect(explorer!.canSpawnAgents).toBe(false);
  });

  it('worker role should not spawn agents', () => {
    const worker = mod.getRole('worker');
    expect(worker).toBeDefined();
    expect(worker!.canSpawnAgents).toBe(false);
    expect(worker!.blockedTools).toContain('spawn_agent');
  });

  it('default role should have full capabilities', () => {
    const def = mod.getRole('default');
    expect(def).toBeDefined();
    expect(def!.canSpawnAgents).toBe(true);
    expect(def!.allowedTools).toHaveLength(0);
    expect(def!.blockedTools).toHaveLength(0);
  });

  it('should check tool permission for explorer', () => {
    const explorer = mod.getRole('explorer')!;
    expect(mod.isToolAllowedForRole(explorer, 'read_file')).toBe(true);
    expect(mod.isToolAllowedForRole(explorer, 'grep')).toBe(true);
    expect(mod.isToolAllowedForRole(explorer, 'bash')).toBe(false);
    expect(mod.isToolAllowedForRole(explorer, 'str_replace_editor')).toBe(false);
  });

  it('should check tool permission for worker', () => {
    const worker = mod.getRole('worker')!;
    expect(mod.isToolAllowedForRole(worker, 'read_file')).toBe(true);
    expect(mod.isToolAllowedForRole(worker, 'bash')).toBe(true);
    expect(mod.isToolAllowedForRole(worker, 'spawn_agent')).toBe(false);
  });

  it('should register custom roles', () => {
    mod.registerRole({
      name: 'reviewer',
      description: 'Code reviewer',
      systemPrompt: 'You review code.',
      allowedTools: ['read_file', 'grep'],
      blockedTools: [],
      canSpawnAgents: false,
      model: null,
      reasoningEffort: null,
      readOnly: true,
    });
    const reviewer = mod.getRole('reviewer');
    expect(reviewer).toBeDefined();
    expect(reviewer!.name).toBe('reviewer');
  });

  it('listRoles should include builtins', () => {
    const roles = mod.listRoles();
    const names = roles.map(r => r.name);
    expect(names).toContain('default');
    expect(names).toContain('explorer');
    expect(names).toContain('worker');
  });
});
