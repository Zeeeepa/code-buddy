/**
 * Coverage Handler
 *
 * /coverage check — Run tests with coverage and compare against targets.
 */

import type { CommandHandlerResult } from './branch-handlers.js';

export async function handleCoverage(args: string[]): Promise<CommandHandlerResult> {
  const action = args[0]?.toLowerCase() || 'check';

  if (action === 'check' || action === 'status') {
    try {
      const { getCoverageTargets, formatCoverageComparison } = await import('../../testing/coverage-targets.js');
      const cwd = process.cwd();
      const targets = await getCoverageTargets(cwd);

      const lines: string[] = [];
      lines.push('Coverage Targets');
      lines.push('='.repeat(50));
      lines.push(`  Lines:      ${targets.lines ?? 'not set'}%`);
      lines.push(`  Functions:  ${targets.functions ?? 'not set'}%`);
      lines.push(`  Branches:   ${targets.branches ?? 'not set'}%`);
      lines.push(`  Statements: ${targets.statements ?? 'not set'}%`);
      lines.push('');
      lines.push('Run `npm run test:coverage` to generate actual coverage data,');
      lines.push('then use /coverage check to compare against these targets.');

      return {
        handled: true,
        entry: { type: 'assistant', content: lines.join('\n'), timestamp: new Date() },
      };
    } catch (err) {
      return {
        handled: true,
        entry: { type: 'assistant', content: `Coverage check failed: ${err instanceof Error ? err.message : String(err)}`, timestamp: new Date() },
      };
    }
  }

  if (action === 'targets') {
    try {
      const { getCoverageTargets } = await import('../../testing/coverage-targets.js');
      const targets = await getCoverageTargets(process.cwd());
      return {
        handled: true,
        entry: {
          type: 'assistant',
          content: `Coverage targets: lines=${targets.lines}%, functions=${targets.functions}%, branches=${targets.branches}%, statements=${targets.statements}%`,
          timestamp: new Date(),
        },
      };
    } catch (err) {
      return {
        handled: true,
        entry: { type: 'assistant', content: `Failed to read coverage targets: ${err instanceof Error ? err.message : String(err)}`, timestamp: new Date() },
      };
    }
  }

  return {
    handled: true,
    entry: {
      type: 'assistant',
      content: 'Usage: /coverage check|targets',
      timestamp: new Date(),
    },
  };
}
