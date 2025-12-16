/**
 * CI/CD Integration Module
 *
 * Provides awareness and integration with CI/CD pipelines.
 * Features:
 * - GitHub Actions workflow management
 * - Pipeline status monitoring
 * - Automated PR creation from issues
 * - Build artifact management
 */

import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import * as yaml from "js-yaml";
import { EventEmitter } from "events";
import { logger } from "../utils/logger.js";

/**
 * CI/CD provider types
 */
export type CICDProvider = "github-actions" | "gitlab-ci" | "jenkins" | "circleci" | "azure-pipelines";

/**
 * Workflow status
 */
export type WorkflowStatus = "success" | "failure" | "pending" | "running" | "cancelled" | "skipped";

/**
 * Workflow run information
 */
export interface WorkflowRun {
  id: string;
  name: string;
  status: WorkflowStatus;
  conclusion?: string;
  branch: string;
  commit: string;
  url?: string;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  name: string;
  path: string;
  triggers: string[];
  jobs: string[];
  provider: CICDProvider;
}

/**
 * GitHub Actions workflow
 */
export interface GitHubActionsWorkflow {
  name?: string;
  on?: Record<string, unknown> | string | string[];
  jobs?: Record<string, {
    "runs-on"?: string;
    steps?: Array<{
      name?: string;
      uses?: string;
      run?: string;
      with?: Record<string, unknown>;
    }>;
  }>;
}

/**
 * CI/CD configuration
 */
export interface CICDConfig {
  provider: CICDProvider;
  workflowsPath: string;
  autoDetect: boolean;
  monitorRuns: boolean;
}

/**
 * Default CI/CD configuration
 */
export const DEFAULT_CICD_CONFIG: CICDConfig = {
  provider: "github-actions",
  workflowsPath: ".github/workflows",
  autoDetect: true,
  monitorRuns: true,
};

/**
 * Workflow templates
 */
export const WORKFLOW_TEMPLATES: Record<string, string> = {
  "node-ci": `name: Node.js CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
    - uses: actions/checkout@v4
    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    - run: npm ci
    - run: npm run build --if-present
    - run: npm test
`,

  "python-ci": `name: Python CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12']

    steps:
    - uses: actions/checkout@v4
    - name: Set up Python \${{ matrix.python-version }}
      uses: actions/setup-python@v5
      with:
        python-version: \${{ matrix.python-version }}
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r requirements.txt
    - name: Run tests
      run: pytest
`,

  "rust-ci": `name: Rust CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

env:
  CARGO_TERM_COLOR: always

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4
    - name: Build
      run: cargo build --verbose
    - name: Run tests
      run: cargo test --verbose
    - name: Run clippy
      run: cargo clippy -- -D warnings
`,

  "docker-build": `name: Docker Build

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3
    - name: Build
      uses: docker/build-push-action@v5
      with:
        context: .
        push: false
        tags: app:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max
`,

  "release": `name: Release

on:
  push:
    tags: [ 'v*' ]

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4
    - name: Create Release
      uses: softprops/action-gh-release@v1
      with:
        generate_release_notes: true
`,
};

/**
 * CI/CD Integration Manager
 *
 * Manages CI/CD pipeline integration and workflow management.
 */
export class CICDManager extends EventEmitter {
  private config: CICDConfig;
  private workingDirectory: string;
  private workflows: WorkflowDefinition[] = [];

  constructor(workingDirectory: string, config: Partial<CICDConfig> = {}) {
    super();
    this.workingDirectory = workingDirectory;
    this.config = { ...DEFAULT_CICD_CONFIG, ...config };

    if (this.config.autoDetect) {
      this.detectWorkflows();
    }
  }

  /**
   * Detect CI/CD provider and workflows
   */
  detectWorkflows(): void {
    this.workflows = [];

    // GitHub Actions
    const ghPath = path.join(this.workingDirectory, ".github/workflows");
    if (fs.existsSync(ghPath)) {
      this.config.provider = "github-actions";
      this.loadGitHubWorkflows(ghPath);
    }

    // GitLab CI
    const gitlabPath = path.join(this.workingDirectory, ".gitlab-ci.yml");
    if (fs.existsSync(gitlabPath)) {
      this.config.provider = "gitlab-ci";
      this.loadGitLabWorkflow(gitlabPath);
    }

    // CircleCI
    const circlePath = path.join(this.workingDirectory, ".circleci/config.yml");
    if (fs.existsSync(circlePath)) {
      this.config.provider = "circleci";
      this.loadCircleCIWorkflow(circlePath);
    }

    this.emit("workflows:detected", this.workflows);
    logger.debug(`Detected ${this.workflows.length} CI/CD workflows`);
  }

  /**
   * Load GitHub Actions workflows
   */
  private loadGitHubWorkflows(dir: string): void {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const workflow = yaml.load(content) as GitHubActionsWorkflow;

        if (workflow) {
          const triggers = this.extractTriggers(workflow.on);
          const jobs = Object.keys(workflow.jobs || {});

          this.workflows.push({
            name: workflow.name || file,
            path: filePath,
            triggers,
            jobs,
            provider: "github-actions",
          });
        }
      } catch (error) {
        logger.warn(`Failed to parse workflow ${file}: ${error}`);
      }
    }
  }

  /**
   * Extract triggers from workflow
   */
  private extractTriggers(on: GitHubActionsWorkflow["on"]): string[] {
    if (!on) return [];
    if (typeof on === "string") return [on];
    if (Array.isArray(on)) return on;
    return Object.keys(on);
  }

  /**
   * Load GitLab CI workflow
   */
  private loadGitLabWorkflow(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const config = yaml.load(content) as Record<string, unknown>;

      if (config) {
        const jobs = Object.keys(config).filter(
          (k) => !k.startsWith(".") && k !== "stages" && k !== "variables" && k !== "default"
        );

        this.workflows.push({
          name: "GitLab CI",
          path: filePath,
          triggers: ["push", "merge_request"],
          jobs,
          provider: "gitlab-ci",
        });
      }
    } catch (error) {
      logger.warn(`Failed to parse GitLab CI config: ${error}`);
    }
  }

  /**
   * Load CircleCI workflow
   */
  private loadCircleCIWorkflow(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const config = yaml.load(content) as Record<string, unknown>;

      if (config) {
        const workflows = config.workflows as Record<string, unknown> || {};
        const jobs = Object.keys(config.jobs as Record<string, unknown> || {});

        for (const [name] of Object.entries(workflows)) {
          if (name !== "version") {
            this.workflows.push({
              name,
              path: filePath,
              triggers: ["push"],
              jobs,
              provider: "circleci",
            });
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to parse CircleCI config: ${error}`);
    }
  }

  /**
   * Get workflow status using GitHub CLI
   */
  async getWorkflowRuns(workflowName?: string, limit: number = 5): Promise<WorkflowRun[]> {
    return new Promise((resolve) => {
      const args = ["run", "list", "--limit", String(limit), "--json", "databaseId,name,status,conclusion,headBranch,headSha,url,createdAt,updatedAt"];

      if (workflowName) {
        args.push("--workflow", workflowName);
      }

      let stdout = "";
      const proc = spawn("gh", args, { cwd: this.workingDirectory });

      proc.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          resolve([]);
          return;
        }

        try {
          const runs = JSON.parse(stdout);
          resolve(
            runs.map((run: Record<string, unknown>) => ({
              id: String(run.databaseId),
              name: run.name as string,
              status: this.mapStatus(run.status as string, run.conclusion as string),
              conclusion: run.conclusion as string,
              branch: run.headBranch as string,
              commit: (run.headSha as string).slice(0, 7),
              url: run.url as string,
              startedAt: run.createdAt ? new Date(run.createdAt as string) : undefined,
              completedAt: run.updatedAt ? new Date(run.updatedAt as string) : undefined,
            }))
          );
        } catch {
          resolve([]);
        }
      });

      proc.on("error", () => resolve([]));
    });
  }

  /**
   * Map GitHub status to WorkflowStatus
   */
  private mapStatus(status: string, conclusion?: string): WorkflowStatus {
    if (status === "completed") {
      if (conclusion === "success") return "success";
      if (conclusion === "failure") return "failure";
      if (conclusion === "cancelled") return "cancelled";
      if (conclusion === "skipped") return "skipped";
    }
    if (status === "in_progress" || status === "queued") return "running";
    return "pending";
  }

  /**
   * Create a new workflow from template
   */
  createWorkflow(name: string, template: string): string {
    const templateContent = WORKFLOW_TEMPLATES[template];
    if (!templateContent) {
      throw new Error(`Unknown template: ${template}. Available: ${Object.keys(WORKFLOW_TEMPLATES).join(", ")}`);
    }

    const workflowDir = path.join(this.workingDirectory, this.config.workflowsPath);
    if (!fs.existsSync(workflowDir)) {
      fs.mkdirSync(workflowDir, { recursive: true });
    }

    const fileName = `${name.toLowerCase().replace(/\s+/g, "-")}.yml`;
    const filePath = path.join(workflowDir, fileName);

    fs.writeFileSync(filePath, templateContent);
    this.detectWorkflows();

    this.emit("workflow:created", { name, path: filePath });
    return filePath;
  }

  /**
   * Validate workflow syntax
   */
  validateWorkflow(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const workflow = yaml.load(content) as GitHubActionsWorkflow;

      if (!workflow) {
        errors.push("Empty workflow file");
        return { valid: false, errors };
      }

      if (!workflow.name) {
        errors.push("Workflow missing 'name' field");
      }

      if (!workflow.on) {
        errors.push("Workflow missing 'on' trigger configuration");
      }

      if (!workflow.jobs || Object.keys(workflow.jobs).length === 0) {
        errors.push("Workflow must have at least one job");
      }

      for (const [jobName, job] of Object.entries(workflow.jobs || {})) {
        if (!job["runs-on"]) {
          errors.push(`Job '${jobName}' missing 'runs-on' field`);
        }
        if (!job.steps || job.steps.length === 0) {
          errors.push(`Job '${jobName}' must have at least one step`);
        }
      }

      return { valid: errors.length === 0, errors };
    } catch (error) {
      errors.push(`YAML parse error: ${error}`);
      return { valid: false, errors };
    }
  }

  /**
   * Trigger workflow run
   */
  async triggerWorkflow(workflowFile: string, ref: string = "main"): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn("gh", ["workflow", "run", workflowFile, "--ref", ref], {
        cwd: this.workingDirectory,
      });

      proc.on("close", (code) => {
        resolve(code === 0);
      });

      proc.on("error", () => resolve(false));
    });
  }

  /**
   * Get list of workflows
   */
  getWorkflows(): WorkflowDefinition[] {
    return [...this.workflows];
  }

  /**
   * Get available templates
   */
  getTemplates(): string[] {
    return Object.keys(WORKFLOW_TEMPLATES);
  }

  /**
   * Format status for display
   */
  formatStatus(): string {
    const lines: string[] = ["⚙️ CI/CD Integration"];

    lines.push(`  Provider: ${this.config.provider}`);
    lines.push(`  Workflows: ${this.workflows.length}`);

    if (this.workflows.length > 0) {
      lines.push("");
      for (const workflow of this.workflows) {
        lines.push(`  📋 ${workflow.name}`);
        lines.push(`     Jobs: ${workflow.jobs.join(", ")}`);
        lines.push(`     Triggers: ${workflow.triggers.join(", ")}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Generate workflow suggestion based on project
   */
  suggestWorkflow(): string | null {
    // Check for package.json (Node.js)
    if (fs.existsSync(path.join(this.workingDirectory, "package.json"))) {
      return "node-ci";
    }

    // Check for requirements.txt or pyproject.toml (Python)
    if (
      fs.existsSync(path.join(this.workingDirectory, "requirements.txt")) ||
      fs.existsSync(path.join(this.workingDirectory, "pyproject.toml"))
    ) {
      return "python-ci";
    }

    // Check for Cargo.toml (Rust)
    if (fs.existsSync(path.join(this.workingDirectory, "Cargo.toml"))) {
      return "rust-ci";
    }

    // Check for Dockerfile
    if (fs.existsSync(path.join(this.workingDirectory, "Dockerfile"))) {
      return "docker-build";
    }

    return null;
  }

  /**
   * Get configuration
   */
  getConfig(): CICDConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CICDConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
let cicdManager: CICDManager | null = null;

/**
 * Get or create CI/CD manager instance
 */
export function getCICDManager(
  workingDirectory?: string,
  config?: Partial<CICDConfig>
): CICDManager {
  if (!cicdManager || workingDirectory) {
    cicdManager = new CICDManager(workingDirectory || process.cwd(), config);
  }
  return cicdManager;
}

/**
 * Initialize CI/CD manager
 */
export function initializeCICD(
  workingDirectory: string,
  config?: Partial<CICDConfig>
): CICDManager {
  cicdManager = new CICDManager(workingDirectory, config);
  return cicdManager;
}
