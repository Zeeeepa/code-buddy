/**
 * Webhook Trigger Tests
 *
 * Tests for:
 * - GitHub signature verification
 * - Event parsing for PR, issue, push, workflow_run events
 * - Template variable resolution
 * - Filter matching
 * - Generic webhook handling
 * - WebhookTriggerManager lifecycle
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as crypto from 'crypto';

import {
  WebhookTriggerManager,
  resolveTemplate,
  matchFilters,
  verifyWebhookSignature,
  type WebhookTriggerConfig,
} from '../../src/triggers/webhook-trigger.js';

import {
  parseGitHubWebhook,
  verifyGitHubSignature,
  buildGitHubEventSummary,
} from '../../src/triggers/github-webhook.js';

import {
  parseGenericWebhook,
  verifyGenericAuth,
  getPath,
} from '../../src/triggers/generic-webhook.js';

// ============================================================================
// Template Resolution
// ============================================================================

describe('resolveTemplate', () => {
  it('should resolve simple variables', () => {
    const result = resolveTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('should resolve dot-notation paths', () => {
    const result = resolveTemplate(
      'PR: {{event.title}} by {{event.author}}',
      { event: { title: 'Fix bug', author: 'alice' } },
    );
    expect(result).toBe('PR: Fix bug by alice');
  });

  it('should handle missing variables as empty string', () => {
    const result = resolveTemplate('Hello {{missing}}!', {});
    expect(result).toBe('Hello !');
  });

  it('should handle deeply nested paths', () => {
    const result = resolveTemplate('{{a.b.c.d}}', {
      a: { b: { c: { d: 'deep' } } },
    });
    expect(result).toBe('deep');
  });

  it('should handle multiple variables in one template', () => {
    const result = resolveTemplate(
      '{{event.type}} in {{event.repo}}: {{event.title}}',
      { event: { type: 'PR', repo: 'org/repo', title: 'Add auth' } },
    );
    expect(result).toBe('PR in org/repo: Add auth');
  });

  it('should handle numeric values', () => {
    const result = resolveTemplate('Issue #{{event.number}}', {
      event: { number: 42 },
    });
    expect(result).toBe('Issue #42');
  });

  it('should handle null/undefined nested values', () => {
    const result = resolveTemplate('{{a.b.c}}', { a: { b: null } });
    expect(result).toBe('');
  });
});

// ============================================================================
// Filter Matching
// ============================================================================

describe('matchFilters', () => {
  it('should match when no filters are defined', () => {
    expect(matchFilters(undefined, { repo: 'test' })).toBe(true);
    expect(matchFilters({}, { repo: 'test' })).toBe(true);
  });

  it('should match exact values (case-insensitive)', () => {
    expect(matchFilters({ label: 'Bug' }, { label: 'bug' })).toBe(true);
    expect(matchFilters({ label: 'bug' }, { label: 'BUG' })).toBe(true);
  });

  it('should reject when filter key is missing from event', () => {
    expect(matchFilters({ label: 'bug' }, { repo: 'test' })).toBe(false);
  });

  it('should reject when value does not match', () => {
    expect(matchFilters({ label: 'bug' }, { label: 'feature' })).toBe(false);
  });

  it('should require all filters to match (AND logic)', () => {
    const filters = { label: 'bug', repo: 'org/repo' };
    expect(matchFilters(filters, { label: 'bug', repo: 'org/repo' })).toBe(true);
    expect(matchFilters(filters, { label: 'bug', repo: 'org/other' })).toBe(false);
  });

  it('should support wildcard patterns', () => {
    expect(matchFilters({ repo: 'org/*' }, { repo: 'org/repo' })).toBe(true);
    expect(matchFilters({ repo: 'org/*' }, { repo: 'other/repo' })).toBe(false);
    expect(matchFilters({ branch: 'feature/*' }, { branch: 'feature/auth' })).toBe(true);
  });
});

// ============================================================================
// GitHub Signature Verification
// ============================================================================

describe('verifyGitHubSignature', () => {
  const secret = 'test-webhook-secret';

  function computeSignature(body: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    return 'sha256=' + hmac.digest('hex');
  }

  it('should verify a valid signature', () => {
    const body = '{"action":"opened"}';
    const signature = computeSignature(body);
    expect(verifyGitHubSignature(signature, body, secret)).toBe(true);
  });

  it('should reject an invalid signature', () => {
    const body = '{"action":"opened"}';
    expect(verifyGitHubSignature('sha256=invalid', body, secret)).toBe(false);
  });

  it('should reject an empty signature', () => {
    expect(verifyGitHubSignature('', '{}', secret)).toBe(false);
  });

  it('should handle Buffer body', () => {
    const body = Buffer.from('{"test":true}');
    const signature = computeSignature(body.toString('utf-8'));
    expect(verifyGitHubSignature(signature, body, secret)).toBe(true);
  });
});

describe('verifyWebhookSignature', () => {
  it('should verify GitHub signatures', () => {
    const secret = 'ghsecret';
    const body = '{"action":"opened"}';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const sig = 'sha256=' + hmac.digest('hex');

    expect(verifyWebhookSignature('github', { 'x-hub-signature-256': sig }, body, secret)).toBe(true);
    expect(verifyWebhookSignature('github', { 'x-hub-signature-256': 'sha256=wrong' }, body, secret)).toBe(false);
  });

  it('should verify GitLab tokens', () => {
    expect(verifyWebhookSignature('gitlab', { 'x-gitlab-token': 'mytoken' }, '{}', 'mytoken')).toBe(true);
    expect(verifyWebhookSignature('gitlab', { 'x-gitlab-token': 'wrong' }, '{}', 'mytoken')).toBe(false);
  });

  it('should verify Slack signatures', () => {
    const secret = 'slacksecret';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"text":"hello"}';
    const sigBase = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(sigBase);
    const sig = 'v0=' + hmac.digest('hex');

    expect(verifyWebhookSignature('slack', {
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': sig,
    }, body, secret)).toBe(true);
  });

  it('should reject Slack signatures with old timestamps', () => {
    const secret = 'slacksecret';
    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
    const body = '{"text":"hello"}';
    const sigBase = `v0:${oldTimestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(sigBase);
    const sig = 'v0=' + hmac.digest('hex');

    expect(verifyWebhookSignature('slack', {
      'x-slack-request-timestamp': oldTimestamp,
      'x-slack-signature': sig,
    }, body, secret)).toBe(false);
  });

  it('should verify Linear signatures', () => {
    const secret = 'linearsecret';
    const body = '{"action":"create"}';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const sig = hmac.digest('hex');

    expect(verifyWebhookSignature('linear', { 'linear-signature': sig }, body, secret)).toBe(true);
    expect(verifyWebhookSignature('linear', { 'linear-signature': 'wrong' }, body, secret)).toBe(false);
  });

  it('should verify PagerDuty signatures', () => {
    const secret = 'pdsecret';
    const body = '{"messages":[]}';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    const sig = 'v1=' + hmac.digest('hex');

    expect(verifyWebhookSignature('pagerduty', { 'x-pagerduty-signature': sig }, body, secret)).toBe(true);
    expect(verifyWebhookSignature('pagerduty', { 'x-pagerduty-signature': 'v1=wrong' }, body, secret)).toBe(false);
  });

  it('should verify generic Bearer token', () => {
    expect(verifyWebhookSignature('generic', { 'authorization': 'Bearer mytoken' }, '{}', 'mytoken')).toBe(true);
    expect(verifyWebhookSignature('generic', { 'authorization': 'Bearer wrong' }, '{}', 'mytoken')).toBe(false);
  });

  it('should verify generic X-Webhook-Secret header', () => {
    expect(verifyWebhookSignature('generic', { 'x-webhook-secret': 'secret123' }, '{}', 'secret123')).toBe(true);
    expect(verifyWebhookSignature('generic', { 'x-webhook-secret': 'wrong' }, '{}', 'secret123')).toBe(false);
  });
});

// ============================================================================
// GitHub Event Parsing
// ============================================================================

describe('parseGitHubWebhook', () => {
  it('should parse pull_request.opened event', () => {
    const payload = {
      action: 'opened',
      pull_request: {
        number: 42,
        title: 'Add authentication',
        body: 'Implements JWT auth',
        html_url: 'https://github.com/org/repo/pull/42',
        diff_url: 'https://github.com/org/repo/pull/42.diff',
        state: 'open',
        head: { ref: 'feature/auth', sha: 'abc1234567890' },
        base: { ref: 'main' },
        user: { login: 'alice' },
        labels: [{ name: 'enhancement' }],
        draft: false,
        merged: false,
        additions: 150,
        deletions: 20,
        changed_files: 5,
      },
      repository: {
        full_name: 'org/repo',
        html_url: 'https://github.com/org/repo',
        name: 'repo',
        owner: { login: 'org' },
      },
      sender: { login: 'alice', avatar_url: 'https://example.com/alice.png' },
    };

    const event = parseGitHubWebhook({ 'x-github-event': 'pull_request' }, payload);

    expect(event.source).toBe('github');
    expect(event.type).toBe('pull_request.opened');
    expect(event.data.title).toBe('Add authentication');
    expect(event.data.body).toBe('Implements JWT auth');
    expect(event.data.number).toBe('42');
    expect(event.data.branch).toBe('feature/auth');
    expect(event.data.baseBranch).toBe('main');
    expect(event.data.author).toBe('alice');
    expect(event.data.repo).toBe('org/repo');
    expect(event.data.labels).toBe('enhancement');
    expect(event.data.additions).toBe('150');
    expect(event.data.deletions).toBe('20');
    expect(event.data.changedFiles).toBe('5');
    expect(event.data.diff).toBe('https://github.com/org/repo/pull/42.diff');
  });

  it('should parse issues.opened event', () => {
    const payload = {
      action: 'opened',
      issue: {
        number: 99,
        title: 'Bug: Login fails',
        body: 'Steps to reproduce...',
        html_url: 'https://github.com/org/repo/issues/99',
        state: 'open',
        user: { login: 'bob' },
        labels: [{ name: 'bug' }, { name: 'high-priority' }],
      },
      repository: {
        full_name: 'org/repo',
        html_url: 'https://github.com/org/repo',
        name: 'repo',
        owner: { login: 'org' },
      },
      sender: { login: 'bob', avatar_url: '' },
    };

    const event = parseGitHubWebhook({ 'x-github-event': 'issues' }, payload);

    expect(event.type).toBe('issues.opened');
    expect(event.data.title).toBe('Bug: Login fails');
    expect(event.data.number).toBe('99');
    expect(event.data.labels).toBe('bug, high-priority');
    expect(event.data.issueAuthor).toBe('bob');
  });

  it('should parse push event', () => {
    const payload = {
      ref: 'refs/heads/main',
      compare: 'https://github.com/org/repo/compare/aaa...bbb',
      commits: [
        {
          id: 'aaa1234567890',
          message: 'feat: add search\ndetailed description',
          author: { name: 'Alice', email: 'alice@example.com' },
          url: 'https://github.com/org/repo/commit/aaa123',
          added: ['src/search.ts'],
          modified: ['src/index.ts'],
          removed: [],
        },
        {
          id: 'bbb9876543210',
          message: 'test: add search tests',
          author: { name: 'Alice', email: 'alice@example.com' },
          url: 'https://github.com/org/repo/commit/bbb987',
          added: ['tests/search.test.ts'],
          modified: [],
          removed: [],
        },
      ],
      repository: {
        full_name: 'org/repo',
        html_url: 'https://github.com/org/repo',
        name: 'repo',
        owner: { login: 'org' },
      },
      sender: { login: 'alice', avatar_url: '' },
    };

    const event = parseGitHubWebhook({ 'x-github-event': 'push' }, payload);

    expect(event.type).toBe('push');
    expect(event.data.branch).toBe('main');
    expect(event.data.commitCount).toBe('2');
    expect(event.data.commits).toContain('aaa1234: feat: add search');
    expect(event.data.commits).toContain('bbb9876: test: add search tests');
    expect(event.data.filesAdded).toContain('src/search.ts');
    expect(event.data.filesModified).toContain('src/index.ts');
  });

  it('should parse workflow_run.completed event', () => {
    const payload = {
      action: 'completed',
      workflow_run: {
        name: 'CI Pipeline',
        conclusion: 'failure',
        html_url: 'https://github.com/org/repo/actions/runs/123',
        head_branch: 'feature/auth',
        head_sha: 'def456',
        run_number: 42,
      },
      repository: {
        full_name: 'org/repo',
        html_url: 'https://github.com/org/repo',
        name: 'repo',
        owner: { login: 'org' },
      },
      sender: { login: 'github-actions[bot]', avatar_url: '' },
    };

    const event = parseGitHubWebhook({ 'x-github-event': 'workflow_run' }, payload);

    expect(event.type).toBe('workflow_run.completed');
    expect(event.data.title).toBe('CI Pipeline');
    expect(event.data.conclusion).toBe('failure');
    expect(event.data.branch).toBe('feature/auth');
    expect(event.data.runNumber).toBe('42');
  });
});

describe('buildGitHubEventSummary', () => {
  it('should build a PR summary', () => {
    const event = parseGitHubWebhook({ 'x-github-event': 'pull_request' }, {
      action: 'opened',
      pull_request: {
        number: 1,
        title: 'Test PR',
        body: 'Body text',
        html_url: 'https://github.com/org/repo/pull/1',
        diff_url: '',
        state: 'open',
        head: { ref: 'feat', sha: 'abc' },
        base: { ref: 'main' },
        user: { login: 'dev' },
        labels: [],
        draft: false,
        merged: false,
        additions: 10,
        deletions: 5,
        changed_files: 2,
      },
      repository: { full_name: 'org/repo', html_url: '', name: 'repo', owner: { login: 'org' } },
      sender: { login: 'dev', avatar_url: '' },
    });

    const summary = buildGitHubEventSummary(event);
    expect(summary).toContain('PR #1: Test PR');
    expect(summary).toContain('Branch: feat -> main');
    expect(summary).toContain('+10 -5');
  });
});

// ============================================================================
// Generic Webhook Parsing
// ============================================================================

describe('parseGenericWebhook', () => {
  it('should flatten top-level scalar fields', () => {
    const event = parseGenericWebhook({}, {
      event: 'alert.triggered',
      message: 'Server CPU > 90%',
      severity: 'high',
      value: 95,
    });

    expect(event.type).toBe('alert.triggered');
    expect(event.data.message).toBe('Server CPU > 90%');
    expect(event.data.severity).toBe('high');
    expect(event.data.value).toBe('95');
  });

  it('should detect event type from header', () => {
    const event = parseGenericWebhook(
      { 'x-event-type': 'deployment.completed' },
      { status: 'success' },
    );
    expect(event.type).toBe('deployment.completed');
  });

  it('should use custom eventTypePath', () => {
    const event = parseGenericWebhook({}, {
      data: { action: 'deploy.finished' },
    }, { eventTypePath: 'data.action' });

    expect(event.type).toBe('deploy.finished');
  });

  it('should use custom eventTypeHeader', () => {
    const event = parseGenericWebhook(
      { 'My-Event': 'custom.event' },
      {},
      { eventTypeHeader: 'My-Event' },
    );
    expect(event.type).toBe('custom.event');
  });

  it('should handle nested objects', () => {
    const event = parseGenericWebhook({}, {
      event: 'test',
      data: { status: 'ok', meta: { id: '123' } },
    });

    expect(event.data['data.status']).toBe('ok');
    expect(event.data['data.meta.id']).toBe('123');
  });
});

describe('getPath', () => {
  it('should resolve nested paths', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getPath(obj, 'a.b.c')).toBe(42);
  });

  it('should return undefined for missing paths', () => {
    expect(getPath({ a: 1 }, 'b.c')).toBeUndefined();
  });

  it('should handle array indices', () => {
    const obj = { items: ['first', 'second'] };
    expect(getPath(obj, 'items.0')).toBe('first');
    expect(getPath(obj, 'items.1')).toBe('second');
  });

  it('should return undefined for null intermediate values', () => {
    expect(getPath({ a: null }, 'a.b')).toBeUndefined();
  });
});

describe('verifyGenericAuth', () => {
  it('should verify Bearer tokens', () => {
    expect(verifyGenericAuth(
      { authorization: 'Bearer mytoken' },
      'mytoken',
      { authMode: 'bearer' },
    )).toBe(true);

    expect(verifyGenericAuth(
      { authorization: 'Bearer wrong' },
      'mytoken',
      { authMode: 'bearer' },
    )).toBe(false);
  });

  it('should verify custom header', () => {
    expect(verifyGenericAuth(
      { 'x-api-key': 'secret' },
      'secret',
      { authMode: 'header', authHeaderName: 'X-API-Key' },
    )).toBe(true);
  });

  it('should pass with authMode none', () => {
    expect(verifyGenericAuth({}, 'any', { authMode: 'none' })).toBe(true);
  });

  it('should default to bearer mode', () => {
    expect(verifyGenericAuth(
      { authorization: 'Bearer tok' },
      'tok',
    )).toBe(true);
  });
});

// ============================================================================
// WebhookTriggerManager
// ============================================================================

describe('WebhookTriggerManager', () => {
  let manager: WebhookTriggerManager;

  beforeEach(() => {
    // Use an in-memory path that won't persist
    manager = new WebhookTriggerManager('/tmp/test-triggers-' + Date.now() + '.json');
  });

  afterEach(() => {
    manager.removeAllListeners();
  });

  function createTestTrigger(overrides: Partial<WebhookTriggerConfig> = {}): WebhookTriggerConfig {
    return {
      id: 'test-' + Math.random().toString(36).slice(2, 10),
      name: 'Test Trigger',
      source: 'github',
      events: ['pull_request.opened'],
      action: 'Review PR #{{event.number}}: {{event.title}}',
      enabled: true,
      createdAt: new Date().toISOString(),
      fireCount: 0,
      ...overrides,
    };
  }

  it('should add and list triggers', () => {
    const trigger = createTestTrigger();
    manager.addTrigger(trigger);

    const list = manager.listTriggers();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Test Trigger');
  });

  it('should remove a trigger', () => {
    const trigger = createTestTrigger();
    manager.addTrigger(trigger);
    expect(manager.listTriggers()).toHaveLength(1);

    const removed = manager.removeTrigger(trigger.id);
    expect(removed).toBe(true);
    expect(manager.listTriggers()).toHaveLength(0);
  });

  it('should return false when removing non-existent trigger', () => {
    expect(manager.removeTrigger('nonexistent')).toBe(false);
  });

  it('should get a trigger by ID', () => {
    const trigger = createTestTrigger();
    manager.addTrigger(trigger);

    const retrieved = manager.getTrigger(trigger.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('Test Trigger');
  });

  it('should emit trigger:added event', () => {
    const spy = vi.fn();
    manager.on('trigger:added', spy);

    const trigger = createTestTrigger();
    manager.addTrigger(trigger);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(trigger);
  });

  it('should emit trigger:removed event', () => {
    const spy = vi.fn();
    manager.on('trigger:removed', spy);

    const trigger = createTestTrigger();
    manager.addTrigger(trigger);
    manager.removeTrigger(trigger.id);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(trigger.id);
  });

  it('should handle a matching GitHub webhook', async () => {
    const trigger = createTestTrigger({
      source: 'github',
      events: ['pull_request.opened'],
      action: 'Review PR #{{event.number}}: {{event.title}}',
    });
    manager.addTrigger(trigger);

    const body = {
      action: 'opened',
      pull_request: {
        number: 42,
        title: 'Add auth',
        body: '',
        html_url: 'https://github.com/org/repo/pull/42',
        diff_url: '',
        state: 'open',
        head: { ref: 'feat', sha: 'abc' },
        base: { ref: 'main' },
        user: { login: 'dev' },
        labels: [],
        draft: false,
        merged: false,
        additions: 0,
        deletions: 0,
        changed_files: 0,
      },
      repository: { full_name: 'org/repo', html_url: '', name: 'repo', owner: { login: 'org' } },
      sender: { login: 'dev', avatar_url: '' },
    };

    const result = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'pull_request' },
      body,
    );

    expect(result.fired).toBe(true);
    expect(result.prompt).toBe('Review PR #42: Add auth');
    expect(result.eventType).toBe('pull_request.opened');
    expect(result.triggerId).toBe(trigger.id);
  });

  it('should not fire disabled triggers', async () => {
    const trigger = createTestTrigger({ enabled: false });
    manager.addTrigger(trigger);

    const result = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'pull_request' },
      { action: 'opened' },
    );

    expect(result.fired).toBe(false);
  });

  it('should not fire when event type does not match', async () => {
    const trigger = createTestTrigger({
      events: ['issues.opened'],
    });
    manager.addTrigger(trigger);

    const result = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'pull_request' },
      { action: 'opened' },
    );

    expect(result.fired).toBe(false);
  });

  it('should support wildcard event patterns', async () => {
    const trigger = createTestTrigger({
      events: ['pull_request.*'],
      action: 'PR event: {{event.type}}',
    });
    manager.addTrigger(trigger);

    const result = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'pull_request' },
      { action: 'synchronize' },
    );

    expect(result.fired).toBe(true);
    expect(result.eventType).toBe('pull_request.synchronize');
  });

  it('should support star-all event pattern', async () => {
    const trigger = createTestTrigger({
      events: ['*'],
      action: 'Any event: {{event.type}}',
    });
    manager.addTrigger(trigger);

    const result = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'push' },
      { ref: 'refs/heads/main', commits: [] },
    );

    expect(result.fired).toBe(true);
  });

  it('should apply filters', async () => {
    const trigger = createTestTrigger({
      events: ['issues.opened'],
      filters: { labels: 'bug' },
      action: 'Bug filed: {{event.title}}',
    });
    manager.addTrigger(trigger);

    // Should not match — labels don't include "bug"
    const resultNoMatch = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'issues' },
      {
        action: 'opened',
        issue: { number: 1, title: 'Feature request', body: '', html_url: '', state: 'open', user: { login: 'u' }, labels: [{ name: 'enhancement' }] },
        repository: { full_name: 'org/repo', html_url: '', name: 'repo', owner: { login: 'org' } },
        sender: { login: 'u', avatar_url: '' },
      },
    );
    expect(resultNoMatch.fired).toBe(false);

    // Should match — labels include "bug"
    const resultMatch = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'issues' },
      {
        action: 'opened',
        issue: { number: 2, title: 'Login broken', body: '', html_url: '', state: 'open', user: { login: 'u' }, labels: [{ name: 'bug' }] },
        repository: { full_name: 'org/repo', html_url: '', name: 'repo', owner: { login: 'org' } },
        sender: { login: 'u', avatar_url: '' },
      },
    );
    expect(resultMatch.fired).toBe(true);
    expect(resultMatch.prompt).toBe('Bug filed: Login broken');
  });

  it('should reject invalid signatures when secret is set', async () => {
    const trigger = createTestTrigger({
      secret: 'mysecret',
      events: ['push'],
    });
    manager.addTrigger(trigger);

    const result = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'push', 'x-hub-signature-256': 'sha256=invalid' },
      { ref: 'refs/heads/main', commits: [] },
    );

    expect(result.fired).toBe(false);
    expect(result.error).toBe('Signature verification failed');
  });

  it('should accept valid signatures when secret is set', async () => {
    const secret = 'mysecret';
    const body = { ref: 'refs/heads/main', commits: [] };
    const bodyStr = JSON.stringify(body);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(bodyStr);
    const sig = 'sha256=' + hmac.digest('hex');

    const trigger = createTestTrigger({
      secret,
      events: ['push'],
      action: 'Push to {{event.branch}}',
    });
    manager.addTrigger(trigger);

    const result = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'push', 'x-hub-signature-256': sig },
      body,
    );

    expect(result.fired).toBe(true);
  });

  it('should increment fire count', async () => {
    const trigger = createTestTrigger({
      events: ['*'],
      action: 'test',
    });
    manager.addTrigger(trigger);

    await manager.handleWebhook('github', { 'x-github-event': 'ping' }, {});
    await manager.handleWebhook('github', { 'x-github-event': 'ping' }, {});

    const updated = manager.getTrigger(trigger.id);
    expect(updated!.fireCount).toBe(2);
    expect(updated!.lastFiredAt).toBeDefined();
  });

  it('should handle generic webhooks', async () => {
    const trigger = createTestTrigger({
      source: 'generic',
      events: ['alert.triggered'],
      action: 'Alert: {{body.message}} (severity: {{body.severity}})',
    });
    manager.addTrigger(trigger);

    const result = await manager.handleWebhook(
      'generic',
      {},
      { event: 'alert.triggered', message: 'CPU > 90%', severity: 'critical' },
    );

    expect(result.fired).toBe(true);
    expect(result.prompt).toBe('Alert: CPU > 90% (severity: critical)');
  });

  it('should emit webhook:received event', async () => {
    const spy = vi.fn();
    manager.on('webhook:received', spy);

    const trigger = createTestTrigger({ events: ['*'] });
    manager.addTrigger(trigger);

    await manager.handleWebhook('github', { 'x-github-event': 'ping' }, {});

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].source).toBe('github');
  });

  it('should emit trigger:fired event', async () => {
    const spy = vi.fn();
    manager.on('trigger:fired', spy);

    const trigger = createTestTrigger({ events: ['*'], action: 'test' });
    manager.addTrigger(trigger);

    await manager.handleWebhook('github', { 'x-github-event': 'ping' }, {});

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0].fired).toBe(true);
    expect(spy.mock.calls[0][1].id).toBe(trigger.id);
  });

  it('should handle multiple triggers and fire first match', async () => {
    const trigger1 = createTestTrigger({
      id: 'first',
      events: ['push'],
      action: 'first: {{event.branch}}',
    });
    const trigger2 = createTestTrigger({
      id: 'second',
      events: ['push'],
      action: 'second: {{event.branch}}',
    });
    manager.addTrigger(trigger1);
    manager.addTrigger(trigger2);

    const result = await manager.handleWebhook(
      'github',
      { 'x-github-event': 'push' },
      { ref: 'refs/heads/main', commits: [] },
    );

    expect(result.fired).toBe(true);
    expect(result.triggerId).toBe('first');
  });

  it('should auto-generate ID and createdAt if not provided', () => {
    const trigger: WebhookTriggerConfig = {
      id: '',
      name: 'Auto ID',
      source: 'generic',
      events: ['*'],
      action: 'test',
      enabled: true,
      createdAt: '',
      fireCount: 0,
    };

    manager.addTrigger(trigger);
    const stored = manager.listTriggers()[0];
    expect(stored.id).toBeTruthy();
    expect(stored.id.length).toBeGreaterThan(0);
    expect(stored.createdAt).toBeTruthy();
  });

  it('should handle source normalization for unknown sources', async () => {
    const trigger = createTestTrigger({
      source: 'generic',
      events: ['*'],
      action: 'got event',
    });
    manager.addTrigger(trigger);

    // Unknown source should normalize to 'generic'
    const result = await manager.handleWebhook('unknown-service', {}, { event: 'test' });
    expect(result.fired).toBe(true);
  });
});
