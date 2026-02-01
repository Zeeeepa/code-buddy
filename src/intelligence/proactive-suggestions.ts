/**
 * Proactive Suggestions Engine
 *
 * Provides contextual suggestions based on project state:
 * - Git status analysis
 * - Code quality indicators
 * - Task recommendations
 * - Best practice reminders
 */

import fs from 'fs-extra';
import * as path from 'path';
import { execSync } from 'child_process';

export type SuggestionType =
  | 'git'
  | 'code-quality'
  | 'testing'
  | 'documentation'
  | 'security'
  | 'performance'
  | 'maintenance'
  | 'workflow';

export type SuggestionPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProactiveSuggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  description: string;
  action?: string;
  command?: string;
  context?: string;
}

export interface ProjectContext {
  gitStatus?: GitStatus;
  packageInfo?: PackageInfo;
  hasTests?: boolean;
  hasDocs?: boolean;
  hasCI?: boolean;
  recentErrors?: string[];
  lastModified?: Map<string, Date>;
}

interface GitStatus {
  branch: string;
  uncommitted: number;
  untracked: number;
  ahead: number;
  behind: number;
  hasStash: boolean;
  daysSinceCommit: number;
}

interface PackageInfo {
  name: string;
  version: string;
  dependencies: number;
  devDependencies: number;
  outdatedDeps?: number;
  hasLockfile: boolean;
  scripts: string[];
}

/**
 * Analyze project and generate proactive suggestions
 */
export async function generateSuggestions(
  projectPath: string = process.cwd()
): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = [];
  const context = await analyzeProjectContext(projectPath);

  // Git suggestions
  if (context.gitStatus) {
    suggestions.push(...generateGitSuggestions(context.gitStatus));
  }

  // Package/dependency suggestions
  if (context.packageInfo) {
    suggestions.push(...generatePackageSuggestions(context.packageInfo));
  }

  // Testing suggestions
  suggestions.push(...await generateTestingSuggestions(projectPath, context));

  // Documentation suggestions
  suggestions.push(...await generateDocSuggestions(projectPath, context));

  // Security suggestions
  suggestions.push(...await generateSecuritySuggestions(projectPath, context));

  // Workflow suggestions
  suggestions.push(...generateWorkflowSuggestions(context));

  // Sort by priority
  const priorityOrder: SuggestionPriority[] = ['urgent', 'high', 'medium', 'low'];
  suggestions.sort((a, b) =>
    priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority)
  );

  return suggestions;
}

/**
 * Analyze project context
 */
async function analyzeProjectContext(projectPath: string): Promise<ProjectContext> {
  const context: ProjectContext = {};

  // Git status
  try {
    context.gitStatus = getGitStatus(projectPath);
  } catch {
    // Not a git repo or git not available
  }

  // Package info
  try {
    const packagePath = path.join(projectPath, 'package.json');
    if (await fs.pathExists(packagePath)) {
      const pkg = await fs.readJson(packagePath);
      context.packageInfo = {
        name: pkg.name || 'unknown',
        version: pkg.version || '0.0.0',
        dependencies: Object.keys(pkg.dependencies || {}).length,
        devDependencies: Object.keys(pkg.devDependencies || {}).length,
        hasLockfile: await fs.pathExists(path.join(projectPath, 'package-lock.json')) ||
                     await fs.pathExists(path.join(projectPath, 'yarn.lock')) ||
                     await fs.pathExists(path.join(projectPath, 'pnpm-lock.yaml')),
        scripts: Object.keys(pkg.scripts || {}),
      };
    }
  } catch {
    // No package.json
  }

  // Check for tests
  context.hasTests = await fs.pathExists(path.join(projectPath, 'tests')) ||
                     await fs.pathExists(path.join(projectPath, '__tests__')) ||
                     await fs.pathExists(path.join(projectPath, 'test')) ||
                     await fs.pathExists(path.join(projectPath, 'spec'));

  // Check for docs
  context.hasDocs = await fs.pathExists(path.join(projectPath, 'docs')) ||
                    await fs.pathExists(path.join(projectPath, 'documentation')) ||
                    await fs.pathExists(path.join(projectPath, 'README.md'));

  // Check for CI
  context.hasCI = await fs.pathExists(path.join(projectPath, '.github', 'workflows')) ||
                  await fs.pathExists(path.join(projectPath, '.gitlab-ci.yml')) ||
                  await fs.pathExists(path.join(projectPath, '.circleci')) ||
                  await fs.pathExists(path.join(projectPath, 'Jenkinsfile'));

  return context;
}

/**
 * Get git status
 */
function getGitStatus(projectPath: string): GitStatus {
  const execOptions = { cwd: projectPath, encoding: 'utf-8' as const };

  // Get current branch
  const branch = execSync('git branch --show-current', execOptions).trim();

  // Get status
  const statusOutput = execSync('git status --porcelain', execOptions);
  const lines = statusOutput.trim().split('\n').filter(Boolean);

  let uncommitted = 0;
  let untracked = 0;

  for (const line of lines) {
    if (line.startsWith('??')) {
      untracked++;
    } else {
      uncommitted++;
    }
  }

  // Get ahead/behind
  let ahead = 0;
  let behind = 0;
  try {
    const aheadBehind = execSync(
      'git rev-list --left-right --count HEAD...@{upstream}',
      execOptions
    ).trim();
    const [a, b] = aheadBehind.split('\t').map(Number);
    ahead = a || 0;
    behind = b || 0;
  } catch {
    // No upstream
  }

  // Check stash
  let hasStash = false;
  try {
    const stashList = execSync('git stash list', execOptions).trim();
    hasStash = stashList.length > 0;
  } catch {
    // No stash
  }

  // Days since last commit
  let daysSinceCommit = 0;
  try {
    const lastCommit = execSync('git log -1 --format=%ct', execOptions).trim();
    const timestamp = parseInt(lastCommit, 10);
    const now = Math.floor(Date.now() / 1000);
    daysSinceCommit = Math.floor((now - timestamp) / (60 * 60 * 24));
  } catch {
    // No commits
  }

  return { branch, uncommitted, untracked, ahead, behind, hasStash, daysSinceCommit };
}

/**
 * Generate git-related suggestions
 */
function generateGitSuggestions(status: GitStatus): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];

  // Uncommitted changes
  if (status.uncommitted > 10) {
    suggestions.push({
      id: 'git-many-uncommitted',
      type: 'git',
      priority: 'high',
      title: 'Many uncommitted changes',
      description: `You have ${status.uncommitted} files with uncommitted changes. Consider committing more frequently.`,
      action: 'Review and commit changes',
      command: 'git status && git add -p',
    });
  } else if (status.uncommitted > 0) {
    suggestions.push({
      id: 'git-uncommitted',
      type: 'git',
      priority: 'low',
      title: 'Uncommitted changes',
      description: `You have ${status.uncommitted} files with uncommitted changes.`,
      command: 'git status',
    });
  }

  // Untracked files
  if (status.untracked > 5) {
    suggestions.push({
      id: 'git-many-untracked',
      type: 'git',
      priority: 'medium',
      title: 'Many untracked files',
      description: `You have ${status.untracked} untracked files. Consider adding them or updating .gitignore.`,
      action: 'Review untracked files',
      command: 'git status --porcelain | grep "^??"',
    });
  }

  // Unpushed commits
  if (status.ahead > 0) {
    suggestions.push({
      id: 'git-unpushed',
      type: 'git',
      priority: 'medium',
      title: 'Unpushed commits',
      description: `You have ${status.ahead} commits that haven't been pushed.`,
      action: 'Push your changes',
      command: 'git push',
    });
  }

  // Behind remote
  if (status.behind > 0) {
    suggestions.push({
      id: 'git-behind',
      type: 'git',
      priority: 'high',
      title: 'Behind remote',
      description: `Your branch is ${status.behind} commits behind the remote.`,
      action: 'Pull latest changes',
      command: 'git pull',
    });
  }

  // Stashed changes
  if (status.hasStash) {
    suggestions.push({
      id: 'git-stash',
      type: 'git',
      priority: 'low',
      title: 'Stashed changes exist',
      description: 'You have stashed changes that might need attention.',
      action: 'Review stash',
      command: 'git stash list',
    });
  }

  // Long time since commit
  if (status.daysSinceCommit >= 7) {
    suggestions.push({
      id: 'git-stale',
      type: 'git',
      priority: 'low',
      title: 'No recent commits',
      description: `No commits in the last ${status.daysSinceCommit} days. Project might be stale.`,
    });
  }

  // Main branch warning
  if (status.branch === 'main' || status.branch === 'master') {
    if (status.uncommitted > 0) {
      suggestions.push({
        id: 'git-main-branch',
        type: 'git',
        priority: 'medium',
        title: 'Working on main branch',
        description: 'You have uncommitted changes on the main branch. Consider using a feature branch.',
        action: 'Create a feature branch',
        command: 'git checkout -b feature/my-feature',
      });
    }
  }

  return suggestions;
}

/**
 * Generate package-related suggestions
 */
function generatePackageSuggestions(pkg: PackageInfo): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];

  // No lockfile
  if (!pkg.hasLockfile) {
    suggestions.push({
      id: 'pkg-no-lockfile',
      type: 'maintenance',
      priority: 'high',
      title: 'Missing lockfile',
      description: 'No package-lock.json, yarn.lock, or pnpm-lock.yaml found. This can lead to inconsistent installs.',
      action: 'Generate lockfile',
      command: 'npm install',
    });
  }

  // Many dependencies
  if (pkg.dependencies > 50) {
    suggestions.push({
      id: 'pkg-many-deps',
      type: 'maintenance',
      priority: 'low',
      title: 'Many dependencies',
      description: `Project has ${pkg.dependencies} dependencies. Consider auditing for unused or redundant packages.`,
      command: 'npx depcheck',
    });
  }

  // Missing common scripts
  const commonScripts = ['test', 'build', 'lint'];
  const missingScripts = commonScripts.filter(s => !pkg.scripts.includes(s));

  if (missingScripts.length > 0) {
    suggestions.push({
      id: 'pkg-missing-scripts',
      type: 'workflow',
      priority: 'low',
      title: 'Missing common npm scripts',
      description: `Consider adding these scripts: ${missingScripts.join(', ')}`,
    });
  }

  return suggestions;
}

/**
 * Generate testing suggestions
 */
async function generateTestingSuggestions(
  projectPath: string,
  context: ProjectContext
): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = [];

  if (!context.hasTests) {
    suggestions.push({
      id: 'test-no-tests',
      type: 'testing',
      priority: 'medium',
      title: 'No test directory found',
      description: 'Consider adding tests to ensure code quality and prevent regressions.',
      action: 'Set up testing framework',
      command: 'npm install --save-dev jest @types/jest ts-jest',
    });
  } else {
    // Check if tests are passing
    if (context.packageInfo?.scripts.includes('test')) {
      suggestions.push({
        id: 'test-run',
        type: 'testing',
        priority: 'low',
        title: 'Run tests regularly',
        description: 'Consider running tests before committing changes.',
        command: 'npm test',
      });
    }
  }

  // Check for coverage config
  const hasJestConfig = await fs.pathExists(path.join(projectPath, 'jest.config.js')) ||
                        await fs.pathExists(path.join(projectPath, 'jest.config.ts'));

  if (context.hasTests && !hasJestConfig) {
    suggestions.push({
      id: 'test-no-config',
      type: 'testing',
      priority: 'low',
      title: 'No Jest configuration',
      description: 'Consider adding a jest.config.js for better test configuration.',
    });
  }

  return suggestions;
}

/**
 * Generate documentation suggestions
 */
async function generateDocSuggestions(
  projectPath: string,
  context: ProjectContext
): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = [];

  // Check README
  const hasReadme = await fs.pathExists(path.join(projectPath, 'README.md'));

  if (!hasReadme) {
    suggestions.push({
      id: 'doc-no-readme',
      type: 'documentation',
      priority: 'high',
      title: 'Missing README',
      description: 'Project lacks a README.md file. Consider adding one for documentation.',
      action: 'Create README.md',
    });
  } else {
    // Check README size
    const stat = await fs.stat(path.join(projectPath, 'README.md'));
    if (stat.size < 500) {
      suggestions.push({
        id: 'doc-short-readme',
        type: 'documentation',
        priority: 'low',
        title: 'Short README',
        description: 'README.md is quite short. Consider adding more documentation.',
      });
    }
  }

  // Check CHANGELOG
  const hasChangelog = await fs.pathExists(path.join(projectPath, 'CHANGELOG.md'));
  if (!hasChangelog && context.packageInfo) {
    suggestions.push({
      id: 'doc-no-changelog',
      type: 'documentation',
      priority: 'low',
      title: 'Missing CHANGELOG',
      description: 'Consider adding a CHANGELOG.md to track version changes.',
    });
  }

  return suggestions;
}

/**
 * Generate security suggestions
 */
async function generateSecuritySuggestions(
  projectPath: string,
  _context: ProjectContext
): Promise<ProactiveSuggestion[]> {
  const suggestions: ProactiveSuggestion[] = [];

  // Check for .env file
  const hasEnv = await fs.pathExists(path.join(projectPath, '.env'));
  const hasEnvExample = await fs.pathExists(path.join(projectPath, '.env.example'));

  if (hasEnv && !hasEnvExample) {
    suggestions.push({
      id: 'sec-no-env-example',
      type: 'security',
      priority: 'medium',
      title: 'Missing .env.example',
      description: 'You have a .env file but no .env.example. Consider adding one for documentation.',
    });
  }

  // Check gitignore for secrets
  const gitignorePath = path.join(projectPath, '.gitignore');
  if (await fs.pathExists(gitignorePath)) {
    const gitignore = await fs.readFile(gitignorePath, 'utf-8');
    if (!gitignore.includes('.env')) {
      suggestions.push({
        id: 'sec-env-not-ignored',
        type: 'security',
        priority: 'urgent',
        title: '.env not in .gitignore',
        description: 'Your .env file might be committed to git. Add it to .gitignore immediately!',
        action: 'Add .env to .gitignore',
      });
    }
  }

  return suggestions;
}

/**
 * Generate workflow suggestions
 */
function generateWorkflowSuggestions(context: ProjectContext): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];

  if (!context.hasCI) {
    suggestions.push({
      id: 'workflow-no-ci',
      type: 'workflow',
      priority: 'low',
      title: 'No CI/CD configuration',
      description: 'Consider setting up CI/CD for automated testing and deployment.',
      action: 'Set up GitHub Actions',
    });
  }

  return suggestions;
}

/**
 * Format suggestions for display
 */
export function formatSuggestions(suggestions: ProactiveSuggestion[]): string {
  if (suggestions.length === 0) {
    return 'No suggestions at this time.';
  }

  const lines: string[] = [
    '',
    '═══════════════════════════════════════════════════════════',
    '              PROACTIVE SUGGESTIONS',
    '═══════════════════════════════════════════════════════════',
    '',
  ];

  const priorityIcons: Record<SuggestionPriority, string> = {
    urgent: '!!!',
    high: '!!',
    medium: '!',
    low: '-',
  };

  for (const suggestion of suggestions) {
    const icon = priorityIcons[suggestion.priority];
    lines.push(`[${icon}] ${suggestion.title}`);
    lines.push(`    ${suggestion.description}`);
    if (suggestion.action) {
      lines.push(`    → ${suggestion.action}`);
    }
    if (suggestion.command) {
      lines.push(`    $ ${suggestion.command}`);
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}

/**
 * Get suggestions by type
 */
export function filterSuggestionsByType(
  suggestions: ProactiveSuggestion[],
  type: SuggestionType
): ProactiveSuggestion[] {
  return suggestions.filter(s => s.type === type);
}

/**
 * Get urgent suggestions only
 */
export function getUrgentSuggestions(
  suggestions: ProactiveSuggestion[]
): ProactiveSuggestion[] {
  return suggestions.filter(s => s.priority === 'urgent' || s.priority === 'high');
}

export default generateSuggestions;
