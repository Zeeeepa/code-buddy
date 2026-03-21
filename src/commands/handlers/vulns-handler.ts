/**
 * /vulns Slash Command Handler
 *
 * Scan dependencies for known vulnerabilities.
 */

import type { CommandHandlerResult } from './branch-handlers.js';

export async function handleVulns(args: string[]): Promise<CommandHandlerResult> {
  const { executeScanVulnerabilities } = await import('../../security/dependency-vuln-scanner.js');

  const packageManager = args[0] as 'npm' | 'pip' | 'cargo' | 'go' | 'gem' | 'composer' | undefined;
  const projectPath = args.find(a => a.startsWith('--path='))?.split('=')[1] || undefined;

  const result = await executeScanVulnerabilities({
    path: projectPath,
    package_manager: packageManager && ['npm', 'pip', 'cargo', 'go', 'gem', 'composer'].includes(packageManager)
      ? packageManager
      : undefined,
  });

  return {
    handled: true,
    entry: {
      type: 'assistant',
      content: result.output || result.error || 'Scan complete.',
      timestamp: new Date(),
    },
  };
}
