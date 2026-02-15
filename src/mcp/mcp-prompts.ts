/**
 * MCP Prompts - Workflow templates for common development tasks
 *
 * Prompts:
 * - code_review:    Review code changes
 * - explain_code:   Explain file/function
 * - generate_tests: Generate tests
 * - refactor:       Refactor with strategy
 * - fix_bugs:       Find and fix bugs
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Register workflow prompt templates with the MCP server.
 */
export function registerPrompts(server: McpServer): void {
  // code_review - Review code changes
  server.prompt(
    'code_review',
    'Review code changes for bugs, security issues, and best practices',
    {
      path: z.string().optional().describe('File or directory path to review (defaults to staged changes)'),
    },
    (args) => {
      const target = args.path
        ? `the file at \`${args.path}\``
        : 'the current staged git changes (run `git diff --staged`)';

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Please review ${target}. Focus on:`,
              '',
              '1. **Bugs & Logic Errors** - Incorrect behavior, edge cases, off-by-one errors',
              '2. **Security Issues** - Injection vulnerabilities, secrets exposure, unsafe operations',
              '3. **Performance** - Unnecessary computations, memory leaks, N+1 queries',
              '4. **Code Quality** - Readability, naming, DRY violations, missing error handling',
              '5. **TypeScript** - Type safety, proper use of generics, avoiding `any`',
              '',
              'For each issue found, provide:',
              '- File and line number',
              '- Severity (critical/warning/suggestion)',
              '- Description of the issue',
              '- Suggested fix with code snippet',
            ].join('\n'),
          },
        }],
      };
    }
  );

  // explain_code - Explain file/function
  server.prompt(
    'explain_code',
    'Explain how a file or function works in detail',
    {
      path: z.string().describe('Path to the file to explain'),
      function_name: z.string().optional().describe('Specific function to explain (explains whole file if omitted)'),
    },
    (args) => {
      const target = args.function_name
        ? `the function \`${args.function_name}\` in \`${args.path}\``
        : `the file \`${args.path}\``;

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Please explain ${target}. Include:`,
              '',
              '1. **Purpose** - What it does and why it exists',
              '2. **How It Works** - Step-by-step walkthrough of the logic',
              '3. **Dependencies** - What it imports/uses and why',
              '4. **Data Flow** - Input → processing → output',
              '5. **Key Patterns** - Design patterns, idioms, or conventions used',
              '6. **Edge Cases** - Important boundary conditions handled',
              '',
              'Use code snippets from the file to illustrate key points.',
            ].join('\n'),
          },
        }],
      };
    }
  );

  // generate_tests - Generate tests
  server.prompt(
    'generate_tests',
    'Generate comprehensive tests for a file or module',
    {
      path: z.string().describe('Path to the file to generate tests for'),
      framework: z.string().optional().describe('Test framework to use (default: jest)'),
    },
    (args) => {
      const framework = args.framework || 'jest';

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Generate comprehensive tests for \`${args.path}\` using ${framework}. Include:`,
              '',
              '1. **Unit tests** for each exported function/method',
              '2. **Happy path** tests with typical inputs',
              '3. **Error cases** - invalid inputs, edge cases, boundary conditions',
              '4. **Mock setup** for external dependencies (API calls, file system, etc.)',
              '5. **Integration tests** if the module interacts with other components',
              '',
              'Follow these conventions:',
              '- Use descriptive test names: `it(\'should return error when file not found\')`',
              '- Group related tests with `describe` blocks',
              '- Use `beforeEach`/`afterEach` for setup/cleanup',
              `- Place the test file in the \`tests/\` directory`,
              '- Match the existing test patterns in the project',
            ].join('\n'),
          },
        }],
      };
    }
  );

  // refactor - Refactor with strategy
  server.prompt(
    'refactor',
    'Refactor code using a specific strategy',
    {
      path: z.string().describe('Path to the file to refactor'),
      strategy: z.string().describe('Refactoring strategy (e.g., extract-function, simplify, split-module, dry, rename)'),
    },
    (args) => {
      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Refactor \`${args.path}\` using the **${args.strategy}** strategy.`,
              '',
              'Guidelines:',
              '1. **Read the file first** to understand current structure',
              '2. **Explain what you plan to change** and why before making edits',
              '3. **Preserve behavior** - refactoring should not change functionality',
              '4. **Keep changes minimal** - only refactor what the strategy calls for',
              '5. **Update imports** if moving or renaming things',
              '6. **Run existing tests** after refactoring to verify nothing broke',
              '',
              'Common strategies:',
              '- `extract-function`: Pull complex logic into named functions',
              '- `simplify`: Reduce complexity, flatten nesting, simplify conditionals',
              '- `split-module`: Break large file into focused modules',
              '- `dry`: Eliminate duplication',
              '- `rename`: Improve naming for clarity',
            ].join('\n'),
          },
        }],
      };
    }
  );

  // fix_bugs - Find and fix bugs
  server.prompt(
    'fix_bugs',
    'Find and fix bugs in a file',
    {
      path: z.string().describe('Path to the file to fix'),
      description: z.string().optional().describe('Description of the bug or symptoms'),
    },
    (args) => {
      const bugDesc = args.description
        ? `\n\n**Reported issue:** ${args.description}`
        : '';

      return {
        messages: [{
          role: 'user',
          content: {
            type: 'text',
            text: [
              `Find and fix bugs in \`${args.path}\`.${bugDesc}`,
              '',
              'Steps:',
              '1. **Read the file** and understand its purpose',
              '2. **Identify bugs** - logic errors, type issues, edge cases, race conditions',
              '3. **For each bug found:**',
              '   - Explain what\'s wrong and how it manifests',
              '   - Show the fix with a code edit',
              '   - Explain why the fix works',
              '4. **Run tests** to verify the fixes',
              '5. **Check for related issues** that might have the same root cause',
            ].join('\n'),
          },
        }],
      };
    }
  );
}
