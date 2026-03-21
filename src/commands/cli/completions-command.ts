/**
 * buddy completions — generate and install shell completion scripts
 */

import { Command } from 'commander';
import { join } from 'path';

export function createCompletionsCommand(): Command {
  const cmd = new Command('completions')
    .description('Generate or install shell completion scripts (bash, zsh, fish, powershell)')
    .argument('[shell]', 'Shell type: bash, zsh, fish, powershell, or "install"')
    .action(async (shell?: string) => {
      const { generateCompletion, getInstallInstructions } = await import('../../utils/shell-completions.js');
      const { writeFile, appendFile, readFile } = await import('fs/promises');
      const { existsSync, mkdirSync } = await import('fs');
      const { homedir } = await import('os');

      if (shell === 'install') {
        const detectedShell = detectShell();
        if (!detectedShell) {
          console.error('Could not detect shell. Please specify: buddy completions bash|zsh|fish|powershell');
          process.exit(1);
        }

        const script = generateCompletion(detectedShell);
        const home = homedir();
        const completionDir = join(home, '.buddy', 'completions');
        mkdirSync(completionDir, { recursive: true });

        const ext = detectedShell === 'powershell' ? 'ps1' : detectedShell === 'fish' ? 'fish' : 'sh';
        const scriptPath = join(completionDir, `buddy.${ext}`);
        await writeFile(scriptPath, script, 'utf-8');

        // Add source line to appropriate rc file
        const rcFile = getRcFile(detectedShell, home);
        if (rcFile) {
          const sourceLine = getSourceLine(detectedShell, scriptPath);
          if (existsSync(rcFile)) {
            const content = await readFile(rcFile, 'utf-8');
            if (!content.includes(sourceLine)) {
              await appendFile(rcFile, `\n# Code Buddy completions\n${sourceLine}\n`);
              console.log(`Added completion source to ${rcFile}`);
            } else {
              console.log(`Completions already installed in ${rcFile}`);
            }
          } else {
            await writeFile(rcFile, `# Code Buddy completions\n${sourceLine}\n`, 'utf-8');
            console.log(`Created ${rcFile} with completion source`);
          }
        }

        console.log(`Completion script installed: ${scriptPath}`);
        console.log(`Shell: ${detectedShell}`);
        console.log('Restart your shell or run the source command to activate.');
        return;
      }

      // Print completion script for specified shell
      const validShells = ['bash', 'zsh', 'fish', 'powershell'] as const;
      type ShellType = typeof validShells[number];
      const targetShell = (shell as ShellType) || detectShell();

      if (!targetShell || !validShells.includes(targetShell as ShellType)) {
        console.log('Usage: buddy completions [bash|zsh|fish|powershell|install]');
        console.log('');
        console.log('Subcommands:');
        console.log('  buddy completions bash        Print bash completion script');
        console.log('  buddy completions zsh         Print zsh completion script');
        console.log('  buddy completions fish        Print fish completion script');
        console.log('  buddy completions powershell  Print PowerShell completion script');
        console.log('  buddy completions install     Auto-detect shell and install completions');
        console.log('');
        const instructions = getInstallInstructions(targetShell || 'bash');
        console.log(instructions);
        return;
      }

      const output = generateCompletion(targetShell as ShellType);
      process.stdout.write(output);
    });

  return cmd;
}

function detectShell(): 'bash' | 'zsh' | 'fish' | 'powershell' | null {
  const shell = process.env.SHELL || '';
  if (shell.includes('zsh')) return 'zsh';
  if (shell.includes('bash')) return 'bash';
  if (shell.includes('fish')) return 'fish';
  // Windows PowerShell
  if (process.platform === 'win32' || process.env.PSModulePath) return 'powershell';
  return null;
}

function getRcFile(shell: string, home: string): string | null {
  switch (shell) {
    case 'bash': return join(home, '.bashrc');
    case 'zsh': return join(home, '.zshrc');
    case 'fish': return join(home, '.config', 'fish', 'conf.d', 'buddy.fish');
    case 'powershell': return join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
    default: return null;
  }
}

function getSourceLine(shell: string, scriptPath: string): string {
  const escaped = scriptPath.replace(/\\/g, '/');
  switch (shell) {
    case 'bash':
    case 'zsh':
      return `source "${escaped}"`;
    case 'fish':
      return `source "${escaped}"`;
    case 'powershell':
      return `. "${escaped}"`;
    default:
      return `source "${escaped}"`;
  }
}
