/**
 * GitHub Webhook Parser
 *
 * Specialized parser for GitHub webhook events. Extracts structured data
 * from GitHub webhook payloads for use in prompt templates.
 *
 * Supported events:
 * - pull_request.opened / pull_request.synchronize / pull_request.closed
 * - issues.opened / issues.closed / issues.labeled
 * - push
 * - workflow_run.completed
 * - issue_comment.created
 * - release.published
 * - check_suite.completed
 */

import * as crypto from 'crypto';
import type { WebhookEvent } from './webhook-trigger.js';

// ============================================================================
// Types
// ============================================================================

export interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    full_name: string;
    html_url: string;
    name: string;
    owner: { login: string };
  };
  sender?: {
    login: string;
    avatar_url: string;
  };
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    diff_url: string;
    state: string;
    head: { ref: string; sha: string };
    base: { ref: string };
    user: { login: string };
    labels: Array<{ name: string }>;
    draft: boolean;
    merged: boolean;
    additions: number;
    deletions: number;
    changed_files: number;
  };
  issue?: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    user: { login: string };
    labels: Array<{ name: string }>;
  };
  commits?: Array<{
    id: string;
    message: string;
    author: { name: string; email: string };
    url: string;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
  ref?: string;
  compare?: string;
  workflow_run?: {
    name: string;
    conclusion: string | null;
    html_url: string;
    head_branch: string;
    head_sha: string;
    run_number: number;
  };
  comment?: {
    body: string;
    html_url: string;
    user: { login: string };
  };
  release?: {
    tag_name: string;
    name: string | null;
    body: string | null;
    html_url: string;
    draft: boolean;
    prerelease: boolean;
  };
  check_suite?: {
    conclusion: string | null;
    head_branch: string;
    head_sha: string;
  };
}

// ============================================================================
// GitHub Event Parser
// ============================================================================

/**
 * Parse a GitHub webhook into a standardized WebhookEvent.
 * Extracts all relevant fields into the data map for template resolution.
 */
export function parseGitHubWebhook(
  headers: Record<string, string>,
  body: unknown,
): WebhookEvent {
  const eventHeader = headers['x-github-event'] || headers['X-GitHub-Event'] || 'unknown';
  const payload = body as GitHubWebhookPayload;
  const action = payload.action || '';
  const eventType = action ? `${eventHeader}.${action}` : eventHeader;

  const data: Record<string, string> = {
    type: eventType,
    event: eventHeader,
    action,
  };

  // Repository info
  if (payload.repository) {
    data.repo = payload.repository.full_name;
    data.repoName = payload.repository.name;
    data.repoUrl = payload.repository.html_url;
    data.repoOwner = payload.repository.owner.login;
  }

  // Sender info
  if (payload.sender) {
    data.author = payload.sender.login;
    data.senderAvatar = payload.sender.avatar_url;
  }

  // Pull request data
  if (payload.pull_request) {
    const pr = payload.pull_request;
    data.title = pr.title;
    data.body = pr.body || '';
    data.url = pr.html_url;
    data.diff = pr.diff_url;
    data.number = String(pr.number);
    data.branch = pr.head.ref;
    data.baseBranch = pr.base.ref;
    data.sha = pr.head.sha;
    data.prAuthor = pr.user.login;
    data.labels = pr.labels.map(l => l.name).join(', ');
    data.isDraft = String(pr.draft);
    data.isMerged = String(pr.merged);
    data.additions = String(pr.additions);
    data.deletions = String(pr.deletions);
    data.changedFiles = String(pr.changed_files);
    data.state = pr.state;
  }

  // Issue data
  if (payload.issue) {
    const issue = payload.issue;
    data.title = issue.title;
    data.body = issue.body || '';
    data.url = issue.html_url;
    data.number = String(issue.number);
    data.issueAuthor = issue.user.login;
    data.labels = issue.labels.map(l => l.name).join(', ');
    data.state = issue.state;
  }

  // Push data
  if (eventHeader === 'push' && payload.commits) {
    data.ref = payload.ref || '';
    data.branch = (payload.ref || '').replace('refs/heads/', '');
    data.commitCount = String(payload.commits.length);
    data.compare = payload.compare || '';

    // Summarize commits
    data.commits = payload.commits
      .map(c => `${c.id.slice(0, 7)}: ${c.message.split('\n')[0]}`)
      .join('\n');

    // Changed files
    const allAdded = new Set<string>();
    const allModified = new Set<string>();
    const allRemoved = new Set<string>();
    for (const commit of payload.commits) {
      commit.added?.forEach(f => allAdded.add(f));
      commit.modified?.forEach(f => allModified.add(f));
      commit.removed?.forEach(f => allRemoved.add(f));
    }
    data.filesAdded = Array.from(allAdded).join(', ');
    data.filesModified = Array.from(allModified).join(', ');
    data.filesRemoved = Array.from(allRemoved).join(', ');
  }

  // Workflow run data
  if (payload.workflow_run) {
    const wf = payload.workflow_run;
    data.title = wf.name;
    data.conclusion = wf.conclusion || 'unknown';
    data.url = wf.html_url;
    data.branch = wf.head_branch;
    data.sha = wf.head_sha;
    data.runNumber = String(wf.run_number);
  }

  // Comment data
  if (payload.comment) {
    data.commentBody = payload.comment.body;
    data.commentUrl = payload.comment.html_url;
    data.commentAuthor = payload.comment.user.login;
  }

  // Release data
  if (payload.release) {
    const rel = payload.release;
    data.title = rel.name || rel.tag_name;
    data.tagName = rel.tag_name;
    data.body = rel.body || '';
    data.url = rel.html_url;
    data.isDraft = String(rel.draft);
    data.isPrerelease = String(rel.prerelease);
  }

  // Check suite data
  if (payload.check_suite) {
    data.conclusion = payload.check_suite.conclusion || 'unknown';
    data.branch = payload.check_suite.head_branch;
    data.sha = payload.check_suite.head_sha;
  }

  return {
    source: 'github',
    type: eventType,
    data,
    rawBody: body,
    headers,
  };
}

// ============================================================================
// GitHub Signature Verification
// ============================================================================

/**
 * Verify a GitHub webhook signature using HMAC SHA-256.
 *
 * @param signature - The X-Hub-Signature-256 header value
 * @param body - The raw request body (string or Buffer)
 * @param secret - The webhook secret
 * @returns true if the signature is valid
 */
export function verifyGitHubSignature(
  signature: string,
  body: string | Buffer,
  secret: string,
): boolean {
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(typeof body === 'string' ? body : body.toString('utf-8'));
  const expected = 'sha256=' + hmac.digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

/**
 * Build a human-readable summary of a GitHub event for use in prompts.
 */
export function buildGitHubEventSummary(event: WebhookEvent): string {
  const d = event.data;
  const parts: string[] = [];

  parts.push(`GitHub Event: ${d.type}`);
  if (d.repo) parts.push(`Repository: ${d.repo}`);
  if (d.author) parts.push(`Author: ${d.author}`);

  switch (event.type.split('.')[0]) {
    case 'pull_request':
      parts.push(`PR #${d.number}: ${d.title}`);
      if (d.body) parts.push(`Description: ${d.body.slice(0, 500)}`);
      parts.push(`Branch: ${d.branch} -> ${d.baseBranch}`);
      if (d.additions || d.deletions) {
        parts.push(`Changes: +${d.additions} -${d.deletions} (${d.changedFiles} files)`);
      }
      break;

    case 'issues':
      parts.push(`Issue #${d.number}: ${d.title}`);
      if (d.body) parts.push(`Description: ${d.body.slice(0, 500)}`);
      if (d.labels) parts.push(`Labels: ${d.labels}`);
      break;

    case 'push':
      parts.push(`Branch: ${d.branch}`);
      parts.push(`Commits: ${d.commitCount}`);
      if (d.commits) parts.push(d.commits);
      break;

    case 'workflow_run':
      parts.push(`Workflow: ${d.title}`);
      parts.push(`Conclusion: ${d.conclusion}`);
      parts.push(`Branch: ${d.branch}`);
      break;

    default:
      if (d.title) parts.push(`Title: ${d.title}`);
      if (d.body) parts.push(`Body: ${d.body.slice(0, 500)}`);
      break;
  }

  if (d.url) parts.push(`URL: ${d.url}`);

  return parts.join('\n');
}
