/**
 * Analytics Repository
 *
 * Repository for analytics, tool statistics, and repair learning.
 */

import type Database from 'better-sqlite3';
import type { Analytics, ToolStats, RepairLearning } from '../schema.js';
import { getDatabaseManager } from '../database-manager.js';

// ============================================================================
// Types
// ============================================================================

export interface AnalyticsFilter {
  startDate?: string;
  endDate?: string;
  projectId?: string;
  model?: string;
}

export interface RepairLearningFilter {
  errorType?: RepairLearning['error_type'];
  language?: string;
  framework?: string;
  minSuccessRate?: number;
}

// ============================================================================
// Analytics Repository
// ============================================================================

export class AnalyticsRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabaseManager().getDatabase();
  }

  // ============================================================================
  // Analytics Methods
  // ============================================================================

  /**
   * Record daily analytics
   */
  recordAnalytics(data: Omit<Analytics, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO analytics (date, project_id, model, tokens_in, tokens_out, cost, requests, tool_calls, errors, avg_response_time_ms, cache_hit_rate, session_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date, project_id, model) DO UPDATE SET
        tokens_in = analytics.tokens_in + excluded.tokens_in,
        tokens_out = analytics.tokens_out + excluded.tokens_out,
        cost = analytics.cost + excluded.cost,
        requests = analytics.requests + excluded.requests,
        tool_calls = analytics.tool_calls + excluded.tool_calls,
        errors = analytics.errors + excluded.errors,
        avg_response_time_ms = (analytics.avg_response_time_ms * analytics.requests + excluded.avg_response_time_ms * excluded.requests) / (analytics.requests + excluded.requests),
        cache_hit_rate = (analytics.cache_hit_rate * analytics.requests + excluded.cache_hit_rate * excluded.requests) / (analytics.requests + excluded.requests),
        session_count = analytics.session_count + excluded.session_count
    `);

    stmt.run(
      data.date,
      data.project_id || null,
      data.model || null,
      data.tokens_in,
      data.tokens_out,
      data.cost,
      data.requests,
      data.tool_calls,
      data.errors,
      data.avg_response_time_ms,
      data.cache_hit_rate,
      data.session_count
    );
  }

  /**
   * Get analytics by filter
   */
  getAnalytics(filter: AnalyticsFilter = {}): Analytics[] {
    let sql = 'SELECT * FROM analytics WHERE 1=1';
    const params: unknown[] = [];

    if (filter.startDate) {
      sql += ' AND date >= ?';
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      sql += ' AND date <= ?';
      params.push(filter.endDate);
    }

    if (filter.projectId) {
      sql += ' AND project_id = ?';
      params.push(filter.projectId);
    }

    if (filter.model) {
      sql += ' AND model = ?';
      params.push(filter.model);
    }

    sql += ' ORDER BY date DESC';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as Analytics[];
  }

  /**
   * Get daily summary
   */
  getDailySummary(days: number = 30): {
    date: string;
    totalCost: number;
    totalRequests: number;
    totalTokens: number;
    avgResponseTime: number;
  }[] {
    const stmt = this.db.prepare(`
      SELECT
        date,
        SUM(cost) as totalCost,
        SUM(requests) as totalRequests,
        SUM(tokens_in + tokens_out) as totalTokens,
        AVG(avg_response_time_ms) as avgResponseTime
      FROM analytics
      WHERE date >= date('now', '-' || ? || ' days')
      GROUP BY date
      ORDER BY date DESC
    `);

    return stmt.all(days) as {
      date: string;
      totalCost: number;
      totalRequests: number;
      totalTokens: number;
      avgResponseTime: number;
    }[];
  }

  /**
   * Get total cost for period
   */
  getTotalCost(filter: AnalyticsFilter = {}): number {
    let sql = 'SELECT COALESCE(SUM(cost), 0) as total FROM analytics WHERE 1=1';
    const params: unknown[] = [];

    if (filter.startDate) {
      sql += ' AND date >= ?';
      params.push(filter.startDate);
    }

    if (filter.endDate) {
      sql += ' AND date <= ?';
      params.push(filter.endDate);
    }

    if (filter.projectId) {
      sql += ' AND project_id = ?';
      params.push(filter.projectId);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params) as { total: number };
    return result.total;
  }

  // ============================================================================
  // Tool Statistics Methods
  // ============================================================================

  /**
   * Record tool usage
   */
  recordToolUsage(
    toolName: string,
    success: boolean,
    timeMs: number,
    cacheHit: boolean,
    projectId?: string
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO tool_stats (tool_name, project_id, success_count, failure_count, total_time_ms, cache_hits, cache_misses)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tool_name, project_id) DO UPDATE SET
        success_count = tool_stats.success_count + excluded.success_count,
        failure_count = tool_stats.failure_count + excluded.failure_count,
        total_time_ms = tool_stats.total_time_ms + excluded.total_time_ms,
        cache_hits = tool_stats.cache_hits + excluded.cache_hits,
        cache_misses = tool_stats.cache_misses + excluded.cache_misses,
        last_used = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      toolName,
      projectId || null,
      success ? 1 : 0,
      success ? 0 : 1,
      timeMs,
      cacheHit ? 1 : 0,
      cacheHit ? 0 : 1
    );
  }

  /**
   * Get tool statistics
   */
  getToolStats(projectId?: string): ToolStats[] {
    let sql = 'SELECT * FROM tool_stats';
    const params: unknown[] = [];

    if (projectId) {
      sql += ' WHERE project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY (success_count + failure_count) DESC';

    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as ToolStats[];
  }

  /**
   * Get top tools by usage
   */
  getTopTools(limit: number = 10): { tool_name: string; usage: number; success_rate: number; avg_time_ms: number }[] {
    const stmt = this.db.prepare(`
      SELECT
        tool_name,
        SUM(success_count + failure_count) as usage,
        SUM(success_count) * 1.0 / SUM(success_count + failure_count) as success_rate,
        SUM(total_time_ms) * 1.0 / SUM(success_count + failure_count) as avg_time_ms
      FROM tool_stats
      GROUP BY tool_name
      ORDER BY usage DESC
      LIMIT ?
    `);

    return stmt.all(limit) as { tool_name: string; usage: number; success_rate: number; avg_time_ms: number }[];
  }

  // ============================================================================
  // Repair Learning Methods
  // ============================================================================

  /**
   * Record repair attempt
   */
  recordRepairAttempt(
    errorPattern: string,
    errorType: RepairLearning['error_type'],
    strategy: string,
    success: boolean,
    attempts: number,
    options: {
      contextHash?: string;
      language?: string;
      framework?: string;
      example?: string;
    } = {}
  ): void {
    // First, try to get existing record
    const existing = this.db.prepare(`
      SELECT id, examples FROM repair_learning
      WHERE error_pattern = ? AND strategy = ? AND (context_hash = ? OR context_hash IS NULL)
    `).get(errorPattern, strategy, options.contextHash || null) as { id: number; examples: string | null } | undefined;

    if (existing) {
      // Update existing record
      const stmt = this.db.prepare(`
        UPDATE repair_learning SET
          success_count = success_count + ?,
          failure_count = failure_count + ?,
          avg_attempts = (avg_attempts * (success_count + failure_count) + ?) / (success_count + failure_count + 1),
          last_used = CURRENT_TIMESTAMP,
          examples = ?
        WHERE id = ?
      `);

      let examples: string[] = existing.examples ? JSON.parse(existing.examples) : [];
      if (success && options.example) {
        examples = [...examples.slice(-4), options.example]; // Keep last 5 examples
      }

      stmt.run(
        success ? 1 : 0,
        success ? 0 : 1,
        attempts,
        JSON.stringify(examples),
        existing.id
      );
    } else {
      // Insert new record
      const stmt = this.db.prepare(`
        INSERT INTO repair_learning (error_pattern, error_type, strategy, context_hash, language, framework, success_count, failure_count, avg_attempts, examples)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const examples = success && options.example ? [options.example] : [];

      stmt.run(
        errorPattern,
        errorType,
        strategy,
        options.contextHash || null,
        options.language || null,
        options.framework || null,
        success ? 1 : 0,
        success ? 0 : 1,
        attempts,
        JSON.stringify(examples)
      );
    }
  }

  /**
   * Get best repair strategies for error pattern
   */
  getBestStrategies(
    errorPattern: string,
    filter: RepairLearningFilter = {},
    limit: number = 5
  ): RepairLearning[] {
    let sql = `
      SELECT * FROM repair_learning
      WHERE error_pattern LIKE ?
    `;
    const params: unknown[] = [`%${errorPattern}%`];

    if (filter.errorType) {
      sql += ' AND error_type = ?';
      params.push(filter.errorType);
    }

    if (filter.language) {
      sql += ' AND language = ?';
      params.push(filter.language);
    }

    if (filter.framework) {
      sql += ' AND framework = ?';
      params.push(filter.framework);
    }

    if (filter.minSuccessRate !== undefined) {
      sql += ' AND success_rate >= ?';
      params.push(filter.minSuccessRate);
    }

    sql += ' ORDER BY success_rate DESC, success_count DESC LIMIT ?';
    params.push(limit);

    const stmt = this.db.prepare(sql);
    const results = stmt.all(...params) as (RepairLearning & { examples: string | null })[];

    return results.map(r => ({
      ...r,
      examples: r.examples ? JSON.parse(r.examples) : undefined,
    }));
  }

  /**
   * Get repair learning statistics
   */
  getRepairStats(): {
    totalPatterns: number;
    avgSuccessRate: number;
    byErrorType: Record<string, { count: number; avgSuccessRate: number }>;
  } {
    const totalPatterns = (this.db.prepare('SELECT COUNT(DISTINCT error_pattern) as count FROM repair_learning').get() as { count: number }).count;

    const avgSuccessRate = (this.db.prepare('SELECT AVG(success_rate) as avg FROM repair_learning').get() as { avg: number | null }).avg || 0;

    const byTypeRows = this.db.prepare(`
      SELECT error_type, COUNT(*) as count, AVG(success_rate) as avgSuccessRate
      FROM repair_learning
      GROUP BY error_type
    `).all() as { error_type: string; count: number; avgSuccessRate: number }[];

    const byErrorType: Record<string, { count: number; avgSuccessRate: number }> = {};
    for (const row of byTypeRows) {
      byErrorType[row.error_type] = { count: row.count, avgSuccessRate: row.avgSuccessRate };
    }

    return { totalPatterns, avgSuccessRate, byErrorType };
  }

  // ============================================================================
  // Cleanup Methods
  // ============================================================================

  /**
   * Delete old analytics data
   */
  deleteOldAnalytics(daysToKeep: number = 90): number {
    const stmt = this.db.prepare(`
      DELETE FROM analytics WHERE date < date('now', '-' || ? || ' days')
    `);
    const result = stmt.run(daysToKeep);
    return result.changes;
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.db.exec('DELETE FROM analytics');
    this.db.exec('DELETE FROM tool_stats');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: AnalyticsRepository | null = null;

export function getAnalyticsRepository(): AnalyticsRepository {
  if (!instance) {
    instance = new AnalyticsRepository();
  }
  return instance;
}

export function resetAnalyticsRepository(): void {
  instance = null;
}
