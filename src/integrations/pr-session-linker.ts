/**
 * PR Session Linker
 *
 * Links CLI sessions to pull requests for context-aware assistance.
 */

import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface PRInfo {
  number: number;
  repo: string;
  title: string;
  body: string;
  state: string;
  draft: boolean;
  url: string;
  branch: string;
}

export type ReviewStatus = 'approved' | 'changes_requested' | 'pending' | 'draft' | null;

// ============================================================================
// PRSessionLinker
// ============================================================================

export class PRSessionLinker {
  private currentPR: PRInfo | null = null;
  private reviewStatus: ReviewStatus = null;

  /**
   * Link session to a PR by number or URL
   */
  async linkToPR(prIdentifier: string): Promise<PRInfo> {
    let prNumber: number;
    let repo = '';

    // Parse URL format: https://github.com/owner/repo/pull/123
    const urlMatch = prIdentifier.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
    if (urlMatch) {
      repo = urlMatch[1];
      prNumber = parseInt(urlMatch[2], 10);
    } else {
      // Parse plain number
      prNumber = parseInt(prIdentifier, 10);
      if (isNaN(prNumber)) {
        throw new Error(`Invalid PR identifier: ${prIdentifier}`);
      }
    }

    // Stub: in production, fetch from GitHub API
    this.currentPR = {
      number: prNumber,
      repo: repo || 'owner/repo',
      title: `PR #${prNumber}`,
      body: '',
      state: 'open',
      draft: false,
      url: repo
        ? `https://github.com/${repo}/pull/${prNumber}`
        : `https://github.com/owner/repo/pull/${prNumber}`,
      branch: `feature/pr-${prNumber}`,
    };

    this.reviewStatus = 'pending';
    logger.debug(`Linked to PR #${prNumber}`);
    return this.currentPR;
  }

  /**
   * Get currently linked PR info
   */
  getCurrentPR(): PRInfo | null {
    return this.currentPR;
  }

  /**
   * Get review status of linked PR
   */
  getReviewStatus(): ReviewStatus {
    if (!this.currentPR) return null;
    return this.reviewStatus;
  }

  /**
   * Remove the PR link
   */
  unlinkPR(): void {
    this.currentPR = null;
    this.reviewStatus = null;
    logger.debug('Unlinked PR');
  }

  /**
   * Format a footer string showing PR status for prompt injection
   */
  formatPRFooter(): string {
    if (!this.currentPR) {
      return '';
    }

    const statusIcon = {
      approved: 'approved',
      changes_requested: 'changes requested',
      pending: 'pending review',
      draft: 'draft',
    };

    const statusText = this.reviewStatus
      ? statusIcon[this.reviewStatus] || this.reviewStatus
      : 'unknown';

    return `[PR #${this.currentPR.number}: ${this.currentPR.title} | Status: ${statusText} | ${this.currentPR.url}]`;
  }

  /**
   * Attempt to auto-detect PR from branch name (stub)
   */
  async autoLinkFromBranch(branch: string): Promise<PRInfo | null> {
    logger.debug(`Attempting auto-link from branch: ${branch}`);

    // Stub: in production, use `gh pr list --head <branch>` or API
    // For now, only handle branches that look like PR references
    const prMatch = branch.match(/pr[/-](\d+)/i);
    if (prMatch) {
      return this.linkToPR(prMatch[1]);
    }

    return null;
  }
}
