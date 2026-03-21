/**
 * Code Graph Populator
 *
 * Converts CartographyResult data into KnowledgeGraph triples.
 * Population runs after cartography scan — no new file I/O needed.
 *
 * Node naming convention:
 *   mod:src/agent/codebuddy-agent  — Module (file)
 *   cls:CodeBuddyAgent             — Class
 *   fn:executePlan                  — Exported function
 *   iface:ExecutorConfig            — Interface/type
 *   layer:agent                     — Architecture layer
 *   pat:singleton                   — Design pattern
 */

import { KnowledgeGraph } from './knowledge-graph.js';
import type { CartographyResult, ComponentEntry } from '../agent/repo-profiling/cartography.js';
import { logger } from '../utils/logger.js';

/**
 * Populate a KnowledgeGraph from cartography scan results.
 * Returns the number of triples added.
 */
export function populateCodeGraph(
  graph: KnowledgeGraph,
  carto: CartographyResult,
): number {
  const before = graph.getStats().tripleCount;

  // 1. Architecture layers
  for (const layer of carto.architecture.layers) {
    graph.add(`layer:${layer.name}`, 'hasDirectory', layer.directory, {
      nodeType: 'layer',
      fileCount: String(layer.fileCount),
    });
  }

  // 2. Import edges (full graph)
  if (carto.importEdges) {
    for (const [importer, imported] of carto.importEdges) {
      graph.add(`mod:${importer}`, 'imports', `mod:${imported}`);
      graph.add(`mod:${imported}`, 'usedBy', `mod:${importer}`);
    }
  }

  // 3. Hot modules (always available, even if importEdges is missing)
  for (const hot of carto.importGraph.hotModules) {
    graph.add(`mod:${hot.module}`, 'importCount', String(hot.importedBy), {
      nodeType: 'module',
    });
  }

  // 4. Components → definedIn triples
  const components = carto.components;
  if (components) {
    addComponentTriples(graph, components.agents, 'agent');
    addComponentTriples(graph, components.tools, 'tool');
    addComponentTriples(graph, components.channels, 'channel');
    addComponentTriples(graph, components.facades, 'facade');

    for (const mw of components.middlewares) {
      const file = normalizeModulePath(mw.file);
      graph.add(`cls:${mw.name}`, 'definedIn', `mod:${file}`, {
        nodeType: 'middleware',
        ...(mw.priority != null ? { priority: String(mw.priority) } : {}),
      });
    }

    // 5. Key exports → module exports symbol
    for (const ke of components.keyExports) {
      const mod = `mod:${ke.module}`;
      for (const exp of ke.exports) {
        // Classify: PascalCase = class, camelCase = function, UPPER_CASE = constant
        const prefix = classifyExport(exp);
        graph.add(mod, 'exports', `${prefix}:${exp}`);
        graph.add(`${prefix}:${exp}`, 'definedIn', mod);
      }
    }
  }

  // 6. Layer → contains modules (by path convention)
  for (const layer of carto.architecture.layers) {
    const layerDir = layer.directory;
    // Find modules that belong to this layer via import edges or hot modules
    if (carto.importEdges) {
      const allMods = new Set<string>();
      for (const [a, b] of carto.importEdges) {
        allMods.add(a);
        allMods.add(b);
      }
      for (const mod of allMods) {
        if (mod.startsWith(layerDir + '/') || mod === layerDir) {
          graph.add(`layer:${layer.name}`, 'contains', `mod:${mod}`);
          graph.add(`mod:${mod}`, 'belongsTo', `layer:${layer.name}`);
        }
      }
    }
  }

  // 7. Design patterns
  addPatternTriples(graph, carto.patterns.singletons, 'singleton');
  addPatternTriples(graph, carto.patterns.registries, 'registry');
  addPatternTriples(graph, carto.patterns.factories, 'factory');
  addPatternTriples(graph, carto.patterns.facades, 'facade');
  addPatternTriples(graph, carto.patterns.middlewares, 'middleware');
  addPatternTriples(graph, carto.patterns.observers, 'observer');

  // 8. API surface — add metadata to modules with routes
  for (const route of carto.apiSurface.restRoutes) {
    const file = normalizeModulePath(route.file);
    graph.add(`mod:${file}`, 'exposes', `${route.method} ${route.path}`, {
      nodeType: 'route',
    });
  }

  // 9. Circular dependency warnings
  for (const circ of carto.importGraph.circularRisks) {
    graph.add(`mod:${circ.a}`, 'circularWith', `mod:${circ.b}`);
  }

  const added = graph.getStats().tripleCount - before;
  logger.debug(`CodeGraphPopulator: added ${added} triples`);
  return added;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function addComponentTriples(
  graph: KnowledgeGraph,
  entries: ComponentEntry[],
  nodeType: string,
): void {
  for (const entry of entries) {
    const file = normalizeModulePath(entry.file);
    graph.add(`cls:${entry.name}`, 'definedIn', `mod:${file}`, { nodeType });
  }
}

function addPatternTriples(
  graph: KnowledgeGraph,
  modules: string[],
  pattern: string,
): void {
  for (const mod of modules) {
    graph.add(`mod:${mod}`, 'patternOf', `pat:${pattern}`);
  }
}

function normalizeModulePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/\.[^.]+$/, ''); // strip extension
}

function classifyExport(name: string): 'cls' | 'fn' | 'iface' {
  if (/^[A-Z][a-z]/.test(name)) return 'cls'; // PascalCase → class
  if (/^I[A-Z]/.test(name)) return 'iface';    // IFoo → interface
  return 'fn';                                    // camelCase → function
}
