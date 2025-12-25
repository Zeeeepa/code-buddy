/**
 * Task Complexity Estimator
 *
 * Analyzes tasks and estimates their complexity:
 * - Natural language task parsing
 * - Scope estimation
 * - Risk assessment
 * - Time/effort estimation
 */

export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'very-complex';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TaskCategory =
  | 'bug-fix'
  | 'feature'
  | 'refactor'
  | 'documentation'
  | 'testing'
  | 'infrastructure'
  | 'security'
  | 'performance'
  | 'ui-ux'
  | 'data-migration'
  | 'integration'
  | 'unknown';

export interface ComplexityFactors {
  scopeScore: number;      // 1-10: How broad is the change?
  technicalDebt: number;   // 1-10: How much legacy code involved?
  unknowns: number;        // 1-10: How many unknowns?
  dependencies: number;    // 1-10: How many dependencies affected?
  testingEffort: number;   // 1-10: How hard to test?
  riskOfRegression: number; // 1-10: Risk of breaking existing features
}

export interface TaskEstimate {
  task: string;
  category: TaskCategory;
  complexity: ComplexityLevel;
  complexityScore: number; // 1-100
  factors: ComplexityFactors;
  risks: RiskAssessment[];
  effort: EffortEstimate;
  suggestions: string[];
  confidence: number; // 0-1
}

export interface RiskAssessment {
  risk: string;
  level: RiskLevel;
  mitigation?: string;
}

export interface EffortEstimate {
  minHours: number;
  maxHours: number;
  typicalHours: number;
  breakdown: {
    planning: number;
    implementation: number;
    testing: number;
    review: number;
  };
}

interface TaskPattern {
  pattern: RegExp;
  category: TaskCategory;
  baseComplexity: number;
  factors: Partial<ComplexityFactors>;
  risks?: string[];
}

/**
 * Task patterns for classification
 */
const TASK_PATTERNS: TaskPattern[] = [
  // Bug fixes
  {
    pattern: /(?:fix|bug|issue|error|crash|broken|not working|fails?|incorrect)/i,
    category: 'bug-fix',
    baseComplexity: 25,
    factors: { scopeScore: 3, testingEffort: 4, riskOfRegression: 4 },
  },
  {
    pattern: /(?:regression|rollback|revert|hotfix|critical bug|production issue)/i,
    category: 'bug-fix',
    baseComplexity: 45,
    factors: { scopeScore: 5, riskOfRegression: 7, unknowns: 5 },
    risks: ['Time pressure may lead to incomplete fix', 'Root cause may be deeper'],
  },

  // Features
  {
    pattern: /(?:add|new|create|implement|build)\s+(?:a\s+)?(?:simple|basic|small)/i,
    category: 'feature',
    baseComplexity: 30,
    factors: { scopeScore: 4, technicalDebt: 2, testingEffort: 4 },
  },
  {
    pattern: /(?:add|new|create|implement|build)\s+(?:a\s+)?(?:feature|functionality|capability)/i,
    category: 'feature',
    baseComplexity: 50,
    factors: { scopeScore: 6, testingEffort: 6, dependencies: 5 },
  },
  {
    pattern: /(?:major|complex|comprehensive|full)\s+(?:feature|system|implementation)/i,
    category: 'feature',
    baseComplexity: 75,
    factors: { scopeScore: 8, dependencies: 7, testingEffort: 8, unknowns: 6 },
    risks: ['Scope creep likely', 'May require architectural changes'],
  },

  // Refactoring
  {
    pattern: /(?:refactor|restructure|reorganize|clean up|improve)\s+(?:small|minor|simple)/i,
    category: 'refactor',
    baseComplexity: 25,
    factors: { scopeScore: 3, riskOfRegression: 4, testingEffort: 4 },
  },
  {
    pattern: /(?:refactor|restructure|reorganize)\s+(?:the|a|an)?\s*\w+/i,
    category: 'refactor',
    baseComplexity: 45,
    factors: { scopeScore: 5, riskOfRegression: 6, technicalDebt: 5 },
    risks: ['May uncover additional issues', 'Tests may need updates'],
  },
  {
    pattern: /(?:major|complete|full|comprehensive)\s+(?:refactor|rewrite|overhaul)/i,
    category: 'refactor',
    baseComplexity: 80,
    factors: { scopeScore: 9, riskOfRegression: 8, technicalDebt: 7, testingEffort: 9 },
    risks: ['High risk of introducing bugs', 'Significant time investment'],
  },

  // Documentation
  {
    pattern: /(?:document|write docs|add comments|readme|jsdoc)/i,
    category: 'documentation',
    baseComplexity: 15,
    factors: { scopeScore: 2, testingEffort: 1, riskOfRegression: 1 },
  },

  // Testing
  {
    pattern: /(?:add|write|create)\s+(?:unit\s+)?tests?/i,
    category: 'testing',
    baseComplexity: 30,
    factors: { scopeScore: 4, testingEffort: 2, technicalDebt: 3 },
  },
  {
    pattern: /(?:integration|e2e|end-to-end|acceptance)\s+tests?/i,
    category: 'testing',
    baseComplexity: 50,
    factors: { scopeScore: 6, dependencies: 6, unknowns: 4 },
  },

  // Infrastructure
  {
    pattern: /(?:deploy|devops|ci\/cd|pipeline|docker|kubernetes|infrastructure)/i,
    category: 'infrastructure',
    baseComplexity: 55,
    factors: { scopeScore: 5, dependencies: 7, unknowns: 6, riskOfRegression: 5 },
    risks: ['Environment differences', 'May affect production'],
  },

  // Security
  {
    pattern: /(?:security|vulnerab|auth|permission|access control|encryption)/i,
    category: 'security',
    baseComplexity: 60,
    factors: { scopeScore: 6, riskOfRegression: 7, testingEffort: 8, unknowns: 5 },
    risks: ['Security implications if done wrong', 'Requires thorough testing'],
  },

  // Performance
  {
    pattern: /(?:performance|optimize|speed|slow|latency|memory|cpu)/i,
    category: 'performance',
    baseComplexity: 50,
    factors: { scopeScore: 5, unknowns: 6, testingEffort: 7, technicalDebt: 4 },
    risks: ['May require profiling', 'Fixes might have trade-offs'],
  },

  // UI/UX
  {
    pattern: /(?:ui|ux|interface|design|style|css|layout|responsive)/i,
    category: 'ui-ux',
    baseComplexity: 40,
    factors: { scopeScore: 5, testingEffort: 5, dependencies: 4 },
  },

  // Data migration
  {
    pattern: /(?:migrat|database|schema|data transform|etl)/i,
    category: 'data-migration',
    baseComplexity: 65,
    factors: { scopeScore: 7, riskOfRegression: 8, unknowns: 6, testingEffort: 8 },
    risks: ['Data loss risk', 'Rollback may be difficult', 'May require downtime'],
  },

  // Integration
  {
    pattern: /(?:integrat|api|webhook|third-party|external service)/i,
    category: 'integration',
    baseComplexity: 55,
    factors: { scopeScore: 6, dependencies: 8, unknowns: 6, testingEffort: 7 },
    risks: ['External dependency changes', 'Rate limits', 'API versioning'],
  },
];

/**
 * Complexity modifiers based on keywords
 */
const COMPLEXITY_MODIFIERS: Array<{ pattern: RegExp; modifier: number; reason: string }> = [
  { pattern: /(?:urgent|asap|rush|immediately)/i, modifier: 1.2, reason: 'Time pressure increases complexity' },
  { pattern: /(?:legacy|old|deprecated)/i, modifier: 1.3, reason: 'Legacy code involvement' },
  { pattern: /(?:all|every|entire|whole|complete)/i, modifier: 1.4, reason: 'Broad scope' },
  { pattern: /(?:database|persistence|storage)/i, modifier: 1.2, reason: 'Data persistence concerns' },
  { pattern: /(?:concurrent|parallel|async|threading)/i, modifier: 1.3, reason: 'Concurrency complexity' },
  { pattern: /(?:backward.?compat|migration)/i, modifier: 1.3, reason: 'Compatibility requirements' },
  { pattern: /(?:cross.?platform|multi.?platform)/i, modifier: 1.4, reason: 'Platform variability' },
  { pattern: /(?:real.?time|live|streaming)/i, modifier: 1.3, reason: 'Real-time requirements' },
  { pattern: /(?:simple|trivial|quick|minor|small)/i, modifier: 0.7, reason: 'Indicated simplicity' },
  { pattern: /(?:prototype|poc|proof of concept)/i, modifier: 0.8, reason: 'Prototype scope' },
];

/**
 * Estimate task complexity
 */
export function estimateTaskComplexity(taskDescription: string): TaskEstimate {
  // Classify the task
  let category: TaskCategory = 'unknown';
  let baseComplexity = 50;
  let baseFactors: Partial<ComplexityFactors> = {};
  const detectedRisks: string[] = [];

  // Find matching patterns
  for (const pattern of TASK_PATTERNS) {
    if (pattern.pattern.test(taskDescription)) {
      category = pattern.category;
      baseComplexity = pattern.baseComplexity;
      baseFactors = pattern.factors;
      if (pattern.risks) {
        detectedRisks.push(...pattern.risks);
      }
      break;
    }
  }

  // Apply modifiers
  let complexityMultiplier = 1;
  const modifierReasons: string[] = [];

  for (const modifier of COMPLEXITY_MODIFIERS) {
    if (modifier.pattern.test(taskDescription)) {
      complexityMultiplier *= modifier.modifier;
      modifierReasons.push(modifier.reason);
    }
  }

  // Calculate final complexity score
  const complexityScore = Math.min(100, Math.round(baseComplexity * complexityMultiplier));

  // Determine complexity level
  const complexity = getComplexityLevel(complexityScore);

  // Calculate factors
  const factors: ComplexityFactors = {
    scopeScore: baseFactors.scopeScore || 5,
    technicalDebt: baseFactors.technicalDebt || 5,
    unknowns: baseFactors.unknowns || 5,
    dependencies: baseFactors.dependencies || 5,
    testingEffort: baseFactors.testingEffort || 5,
    riskOfRegression: baseFactors.riskOfRegression || 5,
  };

  // Adjust factors based on modifiers
  if (complexityMultiplier > 1.2) {
    factors.unknowns = Math.min(10, factors.unknowns + 2);
    factors.riskOfRegression = Math.min(10, factors.riskOfRegression + 1);
  }

  // Assess risks
  const risks: RiskAssessment[] = detectedRisks.map(risk => ({
    risk,
    level: getRiskLevel(complexityScore),
  }));

  // Add generic risks based on factors
  if (factors.riskOfRegression >= 7) {
    risks.push({
      risk: 'High risk of regression',
      level: 'high',
      mitigation: 'Ensure comprehensive test coverage before changes',
    });
  }
  if (factors.unknowns >= 7) {
    risks.push({
      risk: 'Significant unknowns in requirements',
      level: 'medium',
      mitigation: 'Spike/investigation phase recommended',
    });
  }
  if (factors.dependencies >= 7) {
    risks.push({
      risk: 'Many dependencies affected',
      level: 'medium',
      mitigation: 'Coordinate with dependent teams/systems',
    });
  }

  // Estimate effort
  const effort = calculateEffort(complexityScore, factors);

  // Generate suggestions
  const suggestions = generateSuggestions(category, complexity, factors);

  // Calculate confidence based on how well we matched
  const confidence = category !== 'unknown' ? 0.7 + (modifierReasons.length * 0.05) : 0.4;

  return {
    task: taskDescription,
    category,
    complexity,
    complexityScore,
    factors,
    risks,
    effort,
    suggestions,
    confidence: Math.min(0.95, confidence),
  };
}

/**
 * Get complexity level from score
 */
function getComplexityLevel(score: number): ComplexityLevel {
  if (score <= 20) return 'trivial';
  if (score <= 40) return 'simple';
  if (score <= 60) return 'moderate';
  if (score <= 80) return 'complex';
  return 'very-complex';
}

/**
 * Get risk level from complexity score
 */
function getRiskLevel(score: number): RiskLevel {
  if (score <= 30) return 'low';
  if (score <= 55) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

/**
 * Calculate effort estimate
 */
function calculateEffort(complexityScore: number, factors: ComplexityFactors): EffortEstimate {
  // Base hours by complexity
  const baseHours = complexityScore * 0.4; // 0-40 hours base

  // Factor adjustments
  const factorMultiplier = (
    factors.scopeScore +
    factors.technicalDebt +
    factors.unknowns +
    factors.dependencies +
    factors.testingEffort
  ) / 50; // 0.1 to 1.0

  const typicalHours = Math.round(baseHours * (0.8 + factorMultiplier * 0.4));
  const minHours = Math.round(typicalHours * 0.6);
  const maxHours = Math.round(typicalHours * 1.6);

  return {
    minHours,
    maxHours,
    typicalHours,
    breakdown: {
      planning: Math.round(typicalHours * 0.15),
      implementation: Math.round(typicalHours * 0.55),
      testing: Math.round(typicalHours * 0.20),
      review: Math.round(typicalHours * 0.10),
    },
  };
}

/**
 * Generate suggestions based on task analysis
 */
function generateSuggestions(
  category: TaskCategory,
  complexity: ComplexityLevel,
  factors: ComplexityFactors
): string[] {
  const suggestions: string[] = [];

  // Category-specific suggestions
  switch (category) {
    case 'bug-fix':
      suggestions.push('Start by reproducing the issue consistently');
      suggestions.push('Check for related issues in the codebase');
      break;
    case 'feature':
      suggestions.push('Define clear acceptance criteria before starting');
      if (complexity === 'complex' || complexity === 'very-complex') {
        suggestions.push('Consider breaking into smaller, incremental deliverables');
      }
      break;
    case 'refactor':
      suggestions.push('Ensure comprehensive test coverage before refactoring');
      suggestions.push('Make small, atomic commits for easier rollback');
      break;
    case 'security':
      suggestions.push('Follow OWASP guidelines for security implementations');
      suggestions.push('Get security review before deployment');
      break;
    case 'performance':
      suggestions.push('Profile before and after to measure improvement');
      suggestions.push('Focus on bottlenecks identified through metrics');
      break;
    case 'data-migration':
      suggestions.push('Create backup before migration');
      suggestions.push('Test on a copy of production data first');
      suggestions.push('Plan rollback strategy');
      break;
    case 'integration':
      suggestions.push('Test with sandbox/staging APIs first');
      suggestions.push('Implement proper error handling for API failures');
      break;
  }

  // Factor-based suggestions
  if (factors.unknowns >= 7) {
    suggestions.push('Schedule a spike to reduce unknowns before estimation');
  }
  if (factors.technicalDebt >= 7) {
    suggestions.push('Consider allocating time for tech debt reduction');
  }
  if (factors.testingEffort >= 7) {
    suggestions.push('Plan for extended testing phase');
  }
  if (factors.dependencies >= 7) {
    suggestions.push('Map out all affected dependencies upfront');
  }

  // Complexity-based suggestions
  if (complexity === 'very-complex') {
    suggestions.push('Consider pair programming or mob programming');
    suggestions.push('Break task into multiple PRs if possible');
  }

  return suggestions.slice(0, 5); // Limit to 5 suggestions
}

/**
 * Format task estimate for display
 */
export function formatTaskEstimate(estimate: TaskEstimate): string {
  const lines: string[] = [
    '',
    '═══════════════════════════════════════════════════════════',
    '              TASK COMPLEXITY ESTIMATE',
    '═══════════════════════════════════════════════════════════',
    '',
    `Task: ${estimate.task}`,
    '',
    `Category:    ${estimate.category}`,
    `Complexity:  ${estimate.complexity.toUpperCase()} (${estimate.complexityScore}/100)`,
    `Confidence:  ${(estimate.confidence * 100).toFixed(0)}%`,
    '',
    'EFFORT ESTIMATE',
    '───────────────────────────────────────────────────────────',
    `  Typical:   ${estimate.effort.typicalHours} hours`,
    `  Range:     ${estimate.effort.minHours} - ${estimate.effort.maxHours} hours`,
    '',
    '  Breakdown:',
    `    Planning:       ${estimate.effort.breakdown.planning}h`,
    `    Implementation: ${estimate.effort.breakdown.implementation}h`,
    `    Testing:        ${estimate.effort.breakdown.testing}h`,
    `    Code Review:    ${estimate.effort.breakdown.review}h`,
    '',
    'COMPLEXITY FACTORS',
    '───────────────────────────────────────────────────────────',
    `  Scope:            ${renderBar(estimate.factors.scopeScore)}`,
    `  Technical Debt:   ${renderBar(estimate.factors.technicalDebt)}`,
    `  Unknowns:         ${renderBar(estimate.factors.unknowns)}`,
    `  Dependencies:     ${renderBar(estimate.factors.dependencies)}`,
    `  Testing Effort:   ${renderBar(estimate.factors.testingEffort)}`,
    `  Regression Risk:  ${renderBar(estimate.factors.riskOfRegression)}`,
    '',
  ];

  if (estimate.risks.length > 0) {
    lines.push('RISKS');
    lines.push('───────────────────────────────────────────────────────────');
    for (const risk of estimate.risks) {
      const icon = risk.level === 'critical' ? '!!!' :
                   risk.level === 'high' ? '!!' :
                   risk.level === 'medium' ? '!' : '-';
      lines.push(`  [${icon}] ${risk.risk}`);
      if (risk.mitigation) {
        lines.push(`      → ${risk.mitigation}`);
      }
    }
    lines.push('');
  }

  if (estimate.suggestions.length > 0) {
    lines.push('SUGGESTIONS');
    lines.push('───────────────────────────────────────────────────────────');
    for (const suggestion of estimate.suggestions) {
      lines.push(`  • ${suggestion}`);
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Render a bar for visualization
 */
function renderBar(value: number): string {
  const filled = '█'.repeat(value);
  const empty = '░'.repeat(10 - value);
  return `${filled}${empty} ${value}/10`;
}

/**
 * Compare multiple task estimates
 */
export function compareTasks(tasks: string[]): {
  estimates: TaskEstimate[];
  priorityOrder: number[];
  totalEffort: EffortEstimate;
} {
  const estimates = tasks.map(estimateTaskComplexity);

  // Sort by complexity score (lowest first = do first)
  const priorityOrder = estimates
    .map((e, i) => ({ index: i, score: e.complexityScore }))
    .sort((a, b) => a.score - b.score)
    .map(item => item.index);

  // Calculate total effort
  const totalEffort: EffortEstimate = {
    minHours: estimates.reduce((sum, e) => sum + e.effort.minHours, 0),
    maxHours: estimates.reduce((sum, e) => sum + e.effort.maxHours, 0),
    typicalHours: estimates.reduce((sum, e) => sum + e.effort.typicalHours, 0),
    breakdown: {
      planning: estimates.reduce((sum, e) => sum + e.effort.breakdown.planning, 0),
      implementation: estimates.reduce((sum, e) => sum + e.effort.breakdown.implementation, 0),
      testing: estimates.reduce((sum, e) => sum + e.effort.breakdown.testing, 0),
      review: estimates.reduce((sum, e) => sum + e.effort.breakdown.review, 0),
    },
  };

  return { estimates, priorityOrder, totalEffort };
}

export default estimateTaskComplexity;
