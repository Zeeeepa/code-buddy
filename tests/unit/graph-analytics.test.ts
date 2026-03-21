/**
 * Tests for graph-analytics.ts
 * Dead Code Detection, Coupling Heatmap, Refactoring Suggestions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGraph } from '@/knowledge/knowledge-graph.js';
import { detectDeadCode, computeCoupling, suggestRefactoring } from '@/knowledge/graph-analytics.js';

describe('detectDeadCode', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph();
  });

  it('detects uncalled functions', () => {
    graph.add('mod:src/utils/helper', 'containsFunction', 'fn:helperA');
    graph.add('mod:src/utils/helper', 'containsFunction', 'fn:helperB');
    graph.add('fn:main', 'calls', 'fn:helperA');
    // helperB is never called

    const result = detectDeadCode(graph);
    expect(result.uncalledFunctions).toContain('fn:helperB');
    expect(result.uncalledFunctions).not.toContain('fn:helperA');
  });

  it('detects unimported modules', () => {
    graph.add('mod:src/app', 'imports', 'mod:src/utils/logger');
    graph.add('mod:src/orphan', 'imports', 'mod:src/utils/logger');
    // mod:src/orphan is never imported by anyone

    const result = detectDeadCode(graph);
    // src/app imports logger but nobody imports orphan
    expect(result.unimportedModules).toContain('mod:src/app');
  });

  it('excludes entry points (index, test files)', () => {
    // Entry point modules should be excluded from unimported modules
    graph.add('mod:src/index', 'imports', 'mod:src/utils');
    graph.add('mod:tests/unit/foo.test', 'imports', 'mod:src/utils');

    const result = detectDeadCode(graph);
    // index and test modules are entry points — not flagged as unimported
    expect(result.unimportedModules).not.toContain('mod:src/index');
    expect(result.unimportedModules).not.toContain('mod:tests/unit/foo.test');
  });

  it('detects unused classes', () => {
    graph.add('cls:FooService', 'definedIn', 'mod:src/services/foo');
    graph.add('cls:BarService', 'definedIn', 'mod:src/services/bar');
    graph.add('cls:BazService', 'extends', 'cls:FooService');
    // BarService is never extended, implemented, or has methods called

    const result = detectDeadCode(graph);
    expect(result.unusedClasses).toContain('cls:BarService');
    expect(result.unusedClasses).not.toContain('cls:FooService');
  });

  it('returns zero dead code for well-connected graph', () => {
    graph.add('mod:src/a', 'imports', 'mod:src/b');
    graph.add('mod:src/b', 'imports', 'mod:src/a');
    graph.add('mod:src/a', 'containsFunction', 'fn:doA');
    graph.add('mod:src/b', 'containsFunction', 'fn:doB');
    graph.add('fn:doA', 'calls', 'fn:doB');
    graph.add('fn:doB', 'calls', 'fn:doA');

    const result = detectDeadCode(graph);
    expect(result.uncalledFunctions).toHaveLength(0);
  });

  it('handles empty graph', () => {
    const result = detectDeadCode(graph);
    expect(result.totalDead).toBe(0);
    expect(result.byConfidence.high).toHaveLength(0);
    expect(result.byConfidence.medium).toHaveLength(0);
    expect(result.byConfidence.low).toHaveLength(0);
  });

  it('assigns low confidence to dynamic entry methods like execute()', () => {
    graph.add('mod:src/tools/foo-tool', 'containsFunction', 'fn:FooTool.execute');
    graph.add('fn:FooTool.execute', 'definedIn', 'mod:src/tools/foo-tool');
    // execute() is never called statically — but it's dispatched dynamically

    const result = detectDeadCode(graph);
    expect(result.byConfidence.low).toContain('fn:FooTool.execute');
    expect(result.byConfidence.high).not.toContain('fn:FooTool.execute');
    expect(result.byConfidence.medium).not.toContain('fn:FooTool.execute');
  });

  it('assigns low confidence to functions exported from barrel modules', () => {
    // Barrel module (index file) exports a function
    graph.add('mod:src/errors/index', 'exports', 'fn:getErrorMessage');
    graph.add('mod:src/errors/index', 'containsFunction', 'fn:getErrorMessage');
    graph.add('fn:getErrorMessage', 'definedIn', 'mod:src/errors/index');
    // Not called statically

    const result = detectDeadCode(graph);
    expect(result.byConfidence.low).toContain('fn:getErrorMessage');
    expect(result.byConfidence.high).not.toContain('fn:getErrorMessage');
  });

  it('assigns low confidence to factory pattern functions', () => {
    graph.add('mod:src/tools/registry/browser-tools', 'containsFunction', 'fn:createBrowserTools');
    graph.add('fn:createBrowserTools', 'definedIn', 'mod:src/tools/registry/browser-tools');

    const result = detectDeadCode(graph);
    expect(result.byConfidence.low).toContain('fn:createBrowserTools');
    expect(result.byConfidence.high).not.toContain('fn:createBrowserTools');
  });

  it('assigns medium confidence to non-barrel exported functions', () => {
    // Exported from a regular (non-index) module but never called
    graph.add('mod:src/utils/math', 'exports', 'fn:calculateSum');
    graph.add('mod:src/utils/math', 'containsFunction', 'fn:calculateSum');
    graph.add('fn:calculateSum', 'definedIn', 'mod:src/utils/math');

    const result = detectDeadCode(graph);
    expect(result.byConfidence.medium).toContain('fn:calculateSum');
    expect(result.byConfidence.high).not.toContain('fn:calculateSum');
  });

  it('assigns high confidence to truly dead code', () => {
    // Private helper, not exported, not matching any dynamic pattern
    graph.add('mod:src/utils/helper', 'containsFunction', 'fn:unusedHelper');
    graph.add('fn:unusedHelper', 'definedIn', 'mod:src/utils/helper');

    const result = detectDeadCode(graph);
    expect(result.byConfidence.high).toContain('fn:unusedHelper');
  });

  it('assigns low confidence to functions in registry/tools modules', () => {
    graph.add('mod:src/tools/registry/vision-tools', 'containsFunction', 'fn:processImage');
    graph.add('fn:processImage', 'definedIn', 'mod:src/tools/registry/vision-tools');

    const result = detectDeadCode(graph);
    expect(result.byConfidence.low).toContain('fn:processImage');
  });

  it('assigns low confidence to plugin-declared dynamic methods (on, emit, handleMessage)', () => {
    // EventEmitter plugin declares 'on' and 'emit' as dynamic entry methods
    graph.add('mod:src/channels/telegram', 'containsFunction', 'fn:TelegramAdapter.handleMessage');
    graph.add('fn:TelegramAdapter.handleMessage', 'definedIn', 'mod:src/channels/telegram');

    const result = detectDeadCode(graph);
    expect(result.byConfidence.low).toContain('fn:TelegramAdapter.handleMessage');
    expect(result.byConfidence.high).not.toContain('fn:TelegramAdapter.handleMessage');
  });

  it('assigns low confidence to functions in plugin-declared public API modules', () => {
    // channels/ is a public API module pattern from channelPlugin
    graph.add('mod:src/channels/slack', 'containsFunction', 'fn:sendSlackMessage');
    graph.add('fn:sendSlackMessage', 'definedIn', 'mod:src/channels/slack');

    const result = detectDeadCode(graph);
    expect(result.byConfidence.low).toContain('fn:sendSlackMessage');
  });

  it('assigns low confidence to plugin entry pattern matches (createXTools)', () => {
    graph.add('mod:src/tools/custom', 'containsFunction', 'fn:createCustomTools');
    graph.add('fn:createCustomTools', 'definedIn', 'mod:src/tools/custom');

    const result = detectDeadCode(graph);
    expect(result.byConfidence.low).toContain('fn:createCustomTools');
  });

  it('provides byConfidence breakdown that sums to uncalledFunctions length', () => {
    graph.add('mod:src/a', 'containsFunction', 'fn:dead1');
    graph.add('fn:dead1', 'definedIn', 'mod:src/a');
    graph.add('mod:src/b', 'containsFunction', 'fn:FooTool.execute');
    graph.add('fn:FooTool.execute', 'definedIn', 'mod:src/b');
    graph.add('mod:src/c', 'exports', 'fn:exported1');
    graph.add('mod:src/c', 'containsFunction', 'fn:exported1');
    graph.add('fn:exported1', 'definedIn', 'mod:src/c');

    const result = detectDeadCode(graph);
    const { high, medium, low } = result.byConfidence;
    expect(high.length + medium.length + low.length).toBe(result.uncalledFunctions.length);
  });
});

describe('computeCoupling', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph();
  });

  it('computes coupling from cross-module calls', () => {
    graph.add('fn:a1', 'definedIn', 'mod:src/a');
    graph.add('fn:b1', 'definedIn', 'mod:src/b');
    graph.add('mod:src/a', 'containsFunction', 'fn:a1');
    graph.add('mod:src/b', 'containsFunction', 'fn:b1');
    graph.add('fn:a1', 'calls', 'fn:b1');
    graph.add('fn:a1', 'calls', 'fn:b1'); // duplicate won't be added

    const result = computeCoupling(graph);
    expect(result.hotspots.length).toBeGreaterThan(0);
    expect(result.hotspots[0].calls).toBe(1);
  });

  it('counts import edges separately from call edges', () => {
    graph.add('fn:a1', 'definedIn', 'mod:src/a');
    graph.add('fn:b1', 'definedIn', 'mod:src/b');
    graph.add('fn:a1', 'calls', 'fn:b1');
    graph.add('mod:src/a', 'imports', 'mod:src/b');

    const result = computeCoupling(graph);
    expect(result.hotspots[0].calls).toBe(1);
    expect(result.hotspots[0].imports).toBe(1);
    expect(result.hotspots[0].total).toBe(2);
  });

  it('ignores intra-module calls', () => {
    graph.add('fn:a1', 'definedIn', 'mod:src/a');
    graph.add('fn:a2', 'definedIn', 'mod:src/a');
    graph.add('fn:a1', 'calls', 'fn:a2');

    const result = computeCoupling(graph);
    expect(result.hotspots).toHaveLength(0);
  });

  it('identifies most connected module', () => {
    graph.add('fn:a1', 'definedIn', 'mod:src/a');
    graph.add('fn:b1', 'definedIn', 'mod:src/b');
    graph.add('fn:c1', 'definedIn', 'mod:src/c');
    graph.add('fn:a1', 'calls', 'fn:b1');
    graph.add('fn:a1', 'calls', 'fn:c1');

    const result = computeCoupling(graph);
    expect(result.mostDependentModule).not.toBeNull();
  });

  it('handles empty graph', () => {
    const result = computeCoupling(graph);
    expect(result.hotspots).toHaveLength(0);
    expect(result.averageCoupling).toBe(0);
  });

  it('respects topN limit', () => {
    // Create many inter-module relationships
    for (let i = 0; i < 30; i++) {
      graph.add(`fn:fn${i}`, 'definedIn', `mod:src/m${i}`);
      graph.add(`mod:src/m${i}`, 'containsFunction', `fn:fn${i}`);
      if (i > 0) graph.add(`fn:fn${i}`, 'calls', `fn:fn${i - 1}`);
    }

    const result = computeCoupling(graph, 5);
    expect(result.hotspots.length).toBeLessThanOrEqual(5);
  });
});

describe('suggestRefactoring', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    graph = new KnowledgeGraph();
  });

  it('suggests god functions (>15 outgoing calls)', () => {
    graph.add('fn:godFunction', 'definedIn', 'mod:src/god');
    for (let i = 0; i < 20; i++) {
      graph.add(`fn:dep${i}`, 'definedIn', 'mod:src/deps');
      graph.add('fn:godFunction', 'calls', `fn:dep${i}`);
    }

    const suggestions = suggestRefactoring(graph);
    const godSuggestion = suggestions.find(s => s.entity === 'fn:godFunction');
    expect(godSuggestion).toBeDefined();
    expect(godSuggestion!.reason).toContain('outgoing calls');
  });

  it('suggests hub modules (>20 imports)', () => {
    for (let i = 0; i < 25; i++) {
      graph.add('mod:src/hub', 'imports', `mod:src/dep${i}`);
    }

    const suggestions = suggestRefactoring(graph);
    const hubSuggestion = suggestions.find(s => s.entity === 'mod:src/hub');
    expect(hubSuggestion).toBeDefined();
    expect(hubSuggestion!.reason).toContain('hub module');
  });

  it('returns empty for healthy code', () => {
    graph.add('fn:a', 'calls', 'fn:b');
    graph.add('fn:b', 'calls', 'fn:c');

    const suggestions = suggestRefactoring(graph);
    expect(suggestions).toHaveLength(0);
  });

  it('suggests high-caller-count entities', () => {
    graph.add('fn:utility', 'definedIn', 'mod:src/utils');
    for (let i = 0; i < 12; i++) {
      graph.add(`fn:caller${i}`, 'definedIn', `mod:src/m${i}`);
      graph.add(`fn:caller${i}`, 'calls', 'fn:utility');
    }

    const suggestions = suggestRefactoring(graph);
    const utilitySuggestion = suggestions.find(s => s.entity === 'fn:utility');
    expect(utilitySuggestion).toBeDefined();
    expect(utilitySuggestion!.totalCallers).toBe(12);
  });
});
