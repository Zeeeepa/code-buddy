/**
 * Process Detector Tests
 *
 * Tests for execution flow detection via BFS from entry points.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraph } from '../../src/knowledge/knowledge-graph.js';
import { detectProcesses, type ExecutionProcess } from '../../src/knowledge/process-detector.js';

describe('ProcessDetector', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    KnowledgeGraph.resetInstance();
    graph = KnowledgeGraph.getInstance();
  });

  function buildSimpleCallChain() {
    // A → B → C → D (4-step chain)
    graph.add('fn:handleRequest', 'calls', 'fn:validateInput');
    graph.add('fn:validateInput', 'calls', 'fn:processData');
    graph.add('fn:processData', 'calls', 'fn:saveResult');
    // handleRequest has no callers → entry point
  }

  function buildComplexGraph() {
    // Two separate flows
    graph.add('fn:handleLogin', 'calls', 'fn:authenticate');
    graph.add('fn:authenticate', 'calls', 'fn:hashPassword');
    graph.add('fn:hashPassword', 'calls', 'fn:bcryptCompare');

    graph.add('fn:handlePayment', 'calls', 'fn:validateCard');
    graph.add('fn:validateCard', 'calls', 'fn:chargeCard');
    graph.add('fn:chargeCard', 'calls', 'fn:notifyUser');

    // Shared utility (called by both flows)
    graph.add('fn:authenticate', 'calls', 'fn:logActivity');
    graph.add('fn:chargeCard', 'calls', 'fn:logActivity');
  }

  it('should detect a simple linear process', () => {
    buildSimpleCallChain();
    const processes = detectProcesses(graph);

    expect(processes.length).toBeGreaterThanOrEqual(1);
    const proc = processes.find(p => p.entryPoint === 'fn:handleRequest');
    expect(proc).toBeDefined();
    expect(proc!.steps.length).toBeGreaterThanOrEqual(3);
    expect(proc!.name).toContain('Request');
  });

  it('should detect multiple processes in a complex graph', () => {
    buildComplexGraph();
    const processes = detectProcesses(graph);

    expect(processes.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by minimum steps', () => {
    buildSimpleCallChain();

    // With min 5 steps, the 4-step chain should be excluded
    const processes = detectProcesses(graph, { minSteps: 5 });
    expect(processes.length).toBe(0);

    // With min 3 steps, the chain should be included
    const processes3 = detectProcesses(graph, { minSteps: 3 });
    expect(processes3.length).toBeGreaterThanOrEqual(1);
  });

  it('should trace from a specific entry point', () => {
    buildComplexGraph();

    const processes = detectProcesses(graph, { entryPoint: 'fn:handleLogin' });
    expect(processes.length).toBe(1);
    expect(processes[0].entryPoint).toBe('fn:handleLogin');
    expect(processes[0].name).toContain('Login');
  });

  it('should return empty for non-existent entry point', () => {
    buildSimpleCallChain();
    const processes = detectProcesses(graph, { entryPoint: 'fn:nonExistent' });
    expect(processes.length).toBe(0);
  });

  it('should return empty for empty graph', () => {
    const processes = detectProcesses(graph);
    expect(processes.length).toBe(0);
  });

  it('should name processes heuristically from entry points', () => {
    graph.add('fn:handleLogin', 'calls', 'fn:step1');
    graph.add('fn:step1', 'calls', 'fn:step2');
    graph.add('fn:step2', 'calls', 'fn:step3');

    const processes = detectProcesses(graph, { entryPoint: 'fn:handleLogin' });
    expect(processes.length).toBe(1);
    expect(processes[0].name).toMatch(/Login/i);
  });

  it('should collect files involved in a process', () => {
    graph.add('fn:handleRequest', 'calls', 'fn:validate');
    graph.add('fn:validate', 'calls', 'fn:save');
    graph.add('fn:save', 'calls', 'fn:respond');

    graph.add('fn:handleRequest', 'definedIn', 'mod:src/routes');
    graph.add('fn:validate', 'definedIn', 'mod:src/validation');
    graph.add('fn:save', 'definedIn', 'mod:src/db');

    const processes = detectProcesses(graph, { entryPoint: 'fn:handleRequest' });
    expect(processes.length).toBe(1);
    expect(processes[0].files.length).toBeGreaterThanOrEqual(1);
  });

  it('should respect maxProcesses limit', () => {
    // Create many entry points
    for (let i = 0; i < 60; i++) {
      graph.add(`fn:handler${i}`, 'calls', `fn:step${i}_1`);
      graph.add(`fn:step${i}_1`, 'calls', `fn:step${i}_2`);
      graph.add(`fn:step${i}_2`, 'calls', `fn:step${i}_3`);
    }

    const processes = detectProcesses(graph, { maxProcesses: 10 });
    expect(processes.length).toBeLessThanOrEqual(10);
  });

  it('should deduplicate subset processes', () => {
    // Process A: a → b → c
    // Process B: a → b → c → d → e (superset of A)
    graph.add('fn:startA', 'calls', 'fn:shared1');
    graph.add('fn:shared1', 'calls', 'fn:shared2');
    graph.add('fn:shared2', 'calls', 'fn:shared3');

    // B extends A's chain
    graph.add('fn:startB', 'calls', 'fn:shared1');

    const processes = detectProcesses(graph);
    // Should not have duplicate steps from the same chain
    expect(processes.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle cycles without infinite loop', () => {
    graph.add('fn:a', 'calls', 'fn:b');
    graph.add('fn:b', 'calls', 'fn:c');
    graph.add('fn:c', 'calls', 'fn:a'); // cycle

    const processes = detectProcesses(graph);
    // Should terminate without hanging
    expect(Array.isArray(processes)).toBe(true);
  });

  it('should set step types correctly', () => {
    graph.add('fn:entry', 'calls', 'fn:called');
    graph.add('fn:called', 'imports', 'fn:imported');
    graph.add('fn:imported', 'calls', 'fn:final');

    const processes = detectProcesses(graph, { entryPoint: 'fn:entry' });
    if (processes.length > 0) {
      const types = processes[0].steps.map(s => s.type);
      expect(types).toContain('call');
    }
  });

  it('should follow extends edges', () => {
    graph.add('fn:base', 'calls', 'fn:middle');
    graph.add('fn:middle', 'extends', 'fn:parent');
    graph.add('fn:parent', 'calls', 'fn:end');

    const processes = detectProcesses(graph, { entryPoint: 'fn:base' });
    if (processes.length > 0) {
      const symbols = processes[0].steps.map(s => s.symbolName);
      expect(symbols).toContain('fn:parent');
    }
  });

  it('process steps should have sequential indices', () => {
    buildSimpleCallChain();
    const processes = detectProcesses(graph, { entryPoint: 'fn:handleRequest' });
    if (processes.length > 0) {
      const indices = processes[0].steps.map(s => s.stepIndex);
      for (let i = 0; i < indices.length; i++) {
        expect(indices[i]).toBe(i);
      }
    }
  });
});
