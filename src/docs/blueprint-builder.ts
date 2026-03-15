/**
 * Blueprint Builder — Structured project snapshot for LLM consumption
 *
 * Builds a ProjectBlueprint from the code graph BEFORE any LLM calls.
 * The blueprint contains verified entity names, function lists, import chains,
 * and module descriptions — eliminating hallucinations by giving the LLM
 * ground truth instead of raw code.
 *
 * Used by the LLM enricher to provide context for each section.
 */

import { KnowledgeGraph } from '../knowledge/knowledge-graph.js';

// ============================================================================
// Types
// ============================================================================

export interface ModuleBlueprint {
  /** Full module path (e.g. "src/agent/codebuddy-agent") */
  path: string;
  /** Functions defined in this module */
  functions: string[];
  /** Classes defined in this module */
  classes: string[];
  /** Interfaces defined in this module */
  interfaces: string[];
  /** Modules this imports from */
  imports: string[];
  /** Modules that import this */
  importedBy: string[];
  /** PageRank score */
  rank: number;
  /** Inferred description */
  description: string;
}

export interface ProjectBlueprint {
  /** All modules with their contents */
  modules: Map<string, ModuleBlueprint>;
  /** All verified entity names (functions, classes, interfaces) */
  allEntities: Set<string>;
  /** Top modules by PageRank */
  topModules: ModuleBlueprint[];
  /** Module count */
  moduleCount: number;
  /** Function count */
  functionCount: number;
  /** Class count */
  classCount: number;
  /** Timestamp */
  builtAt: number;
}

// ============================================================================
// Builder
// ============================================================================

/**
 * Build a verified project blueprint from the knowledge graph.
 * This is a fast, synchronous operation — no LLM calls.
 */
export function buildProjectBlueprint(graph: KnowledgeGraph): ProjectBlueprint {
  const allTriples = graph.toJSON();
  const modules = new Map<string, ModuleBlueprint>();
  const allEntities = new Set<string>();

  // Collect all module entities
  const moduleIds = new Set<string>();
  for (const t of allTriples) {
    if (t.subject.startsWith('mod:')) moduleIds.add(t.subject);
    if (t.object.startsWith('mod:')) moduleIds.add(t.object);
  }

  // Build blueprint for each module
  for (const modId of moduleIds) {
    const modPath = modId.replace(/^mod:/, '');
    if (!modPath.startsWith('src/')) continue;

    const functions: string[] = [];
    const classes: string[] = [];
    const interfaces: string[] = [];
    const imports: string[] = [];
    const importedBy: string[] = [];

    // Functions
    for (const t of graph.query({ subject: modId, predicate: 'containsFunction' })) {
      const name = t.object.replace(/^fn:/, '');
      functions.push(name);
      allEntities.add(name);
    }

    // Classes
    for (const t of graph.query({ subject: modId, predicate: 'containsClass' })) {
      const name = t.object.replace(/^cls:/, '');
      classes.push(name);
      allEntities.add(name);
    }

    // Interfaces
    for (const t of graph.query({ subject: modId, predicate: 'containsInterface' })) {
      const name = t.object.replace(/^iface:/, '');
      interfaces.push(name);
      allEntities.add(name);
    }

    // Imports
    for (const t of graph.query({ subject: modId, predicate: 'imports' })) {
      imports.push(t.object.replace(/^mod:/, ''));
    }

    // Imported by
    for (const t of graph.query({ predicate: 'imports', object: modId })) {
      importedBy.push(t.subject.replace(/^mod:/, ''));
    }

    const rank = graph.getEntityRank(modId);

    modules.set(modPath, {
      path: modPath,
      functions,
      classes,
      interfaces,
      imports,
      importedBy,
      rank,
      description: '',
    });
  }

  // Sort by rank for top modules
  const topModules = [...modules.values()]
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 30);

  // Also collect function/class entities from triples
  for (const t of allTriples) {
    if (t.subject.startsWith('fn:')) allEntities.add(t.subject.replace(/^fn:/, ''));
    if (t.subject.startsWith('cls:')) allEntities.add(t.subject.replace(/^cls:/, ''));
    if (t.object.startsWith('fn:')) allEntities.add(t.object.replace(/^fn:/, ''));
    if (t.object.startsWith('cls:')) allEntities.add(t.object.replace(/^cls:/, ''));
  }

  let functionCount = 0;
  let classCount = 0;
  for (const t of allTriples) {
    if (t.predicate === 'containsFunction') functionCount++;
    if (t.predicate === 'containsClass') classCount++;
  }

  return {
    modules,
    allEntities,
    topModules,
    moduleCount: modules.size,
    functionCount,
    classCount,
    builtAt: Date.now(),
  };
}

// ============================================================================
// Blueprint Context Serializer
// ============================================================================

/**
 * Serialize the blueprint into a compact text block for LLM context injection.
 * Used by the enricher to give the LLM verified facts about the codebase.
 */
export function serializeBlueprintForLLM(blueprint: ProjectBlueprint, maxChars: number = 4000): string {
  const lines: string[] = [
    '<verified_entities>',
    `Project: ${blueprint.moduleCount} modules, ${blueprint.functionCount} functions, ${blueprint.classCount} classes`,
    '',
    'Top modules (by architectural importance):',
  ];

  let charCount = lines.join('\n').length;

  for (const mod of blueprint.topModules) {
    const entry = [
      `- ${mod.path} (rank: ${mod.rank.toFixed(3)}, imported by ${mod.importedBy.length} modules)`,
    ];
    if (mod.classes.length > 0) {
      entry.push(`  Classes: ${mod.classes.slice(0, 5).join(', ')}`);
    }
    if (mod.functions.length > 0) {
      entry.push(`  Functions: ${mod.functions.slice(0, 8).join(', ')}`);
    }

    const entryText = entry.join('\n');
    if (charCount + entryText.length > maxChars - 100) break;
    lines.push(entryText);
    charCount += entryText.length;
  }

  lines.push('</verified_entities>');
  return lines.join('\n');
}

/**
 * Validate an identifier against the blueprint.
 * Returns true if the name exists in the project's verified entities.
 */
export function isVerifiedEntity(blueprint: ProjectBlueprint, name: string): boolean {
  // Strip common prefixes
  const clean = name
    .replace(/^(fn|cls|mod|iface):/, '')
    .replace(/\(\)$/, '');

  if (blueprint.allEntities.has(clean)) return true;

  // Check partial match: ClassName.methodName → check ClassName exists
  const dotIdx = clean.indexOf('.');
  if (dotIdx > 0) {
    const className = clean.substring(0, dotIdx);
    return blueprint.allEntities.has(className);
  }

  return false;
}

/**
 * Find the closest matching entity name for a potentially hallucinated one.
 * Uses simple Levenshtein-like prefix matching.
 */
export function findClosestEntity(blueprint: ProjectBlueprint, name: string): string | null {
  const clean = name.replace(/\(\)$/, '');
  const lower = clean.toLowerCase();

  let bestMatch = '';
  let bestScore = 0;

  for (const entity of blueprint.allEntities) {
    const entityLower = entity.toLowerCase();

    // Exact suffix match (e.g. "processMessage" matches "CodeBuddyAgent.processMessage")
    if (entityLower.endsWith(lower) || entityLower === lower) {
      return entity;
    }

    // Partial prefix match
    let commonLen = 0;
    for (let i = 0; i < Math.min(lower.length, entityLower.length); i++) {
      if (lower[i] === entityLower[i]) commonLen++;
      else break;
    }
    const score = commonLen / Math.max(lower.length, entityLower.length);
    if (score > bestScore && score > 0.6) {
      bestScore = score;
      bestMatch = entity;
    }
  }

  return bestMatch || null;
}
