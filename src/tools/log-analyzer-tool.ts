/**
 * Log Analysis Tool
 *
 * Parses and analyzes log files in common formats (JSON, standard, syslog, simple).
 * Detects patterns, anomalies, and provides summary statistics.
 *
 * Streams large files line-by-line to avoid memory issues.
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import type { ToolResult } from '../types/index.js';

// ============================================================================
// Types
// ============================================================================

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'unknown';

export interface LogEntry {
  timestamp?: string;
  level: LogLevel;
  message: string;
  source?: string;
  line: number;
  raw: string;
}

export interface LogPattern {
  pattern: string;
  count: number;
  severity: string;
}

export interface LogAnomaly {
  line: number;
  message: string;
  reason: string;
}

export interface LogAnalysisResult {
  totalLines: number;
  entries: LogEntry[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
    timeRange?: { start: string; end: string };
  };
  patterns: LogPattern[];
  anomalies: LogAnomaly[];
}

export interface LogAnalyzeOptions {
  maxLines?: number;
  levelFilter?: string;
  search?: string;
  tail?: number;
}

// ============================================================================
// Log Level Normalization
// ============================================================================

const LEVEL_MAP: Record<string, LogLevel> = {
  error: 'error',
  err: 'error',
  fatal: 'error',
  critical: 'error',
  crit: 'error',
  emerg: 'error',
  alert: 'error',
  panic: 'error',
  warn: 'warn',
  warning: 'warn',
  info: 'info',
  notice: 'info',
  informational: 'info',
  debug: 'debug',
  dbg: 'debug',
  trace: 'trace',
  verbose: 'trace',
};

function normalizeLevel(raw: string): LogLevel {
  return LEVEL_MAP[raw.toLowerCase()] || 'unknown';
}

// ============================================================================
// Line Parsers
// ============================================================================

/**
 * Try parsing a line as JSON log ({"level":"error","msg":"...","ts":"..."})
 */
function tryParseJSON(line: string, lineNum: number): LogEntry | null {
  if (!line.startsWith('{')) return null;
  try {
    const obj = JSON.parse(line);
    const level = obj.level || obj.severity || obj.loglevel || obj.log_level || '';
    const message = obj.msg || obj.message || obj.text || obj.error || '';
    const timestamp = obj.ts || obj.timestamp || obj.time || obj.t || obj['@timestamp'] || '';
    const source = obj.source || obj.logger || obj.module || obj.component || '';
    if (!message && !level) return null;
    return {
      timestamp: timestamp ? String(timestamp) : undefined,
      level: normalizeLevel(String(level)),
      message: String(message),
      source: source ? String(source) : undefined,
      line: lineNum,
      raw: line,
    };
  } catch {
    return null;
  }
}

/**
 * Standard format: [2026-03-19 10:00:00] ERROR: message
 */
const STANDARD_RE = /^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*)\]\s*(\w+):?\s*(.*)/;

function tryParseStandard(line: string, lineNum: number): LogEntry | null {
  const m = line.match(STANDARD_RE);
  if (!m) return null;
  return {
    timestamp: m[1],
    level: normalizeLevel(m[2]),
    message: m[3].trim(),
    line: lineNum,
    raw: line,
  };
}

/**
 * Syslog format: Mar 19 10:00:00 hostname process[pid]: message
 */
const SYSLOG_RE = /^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[\d+\])?:\s*(.*)/;

function tryParseSyslog(line: string, lineNum: number): LogEntry | null {
  const m = line.match(SYSLOG_RE);
  if (!m) return null;
  // Syslog doesn't have explicit levels; try to infer from message
  const inferredLevel = inferLevelFromMessage(m[4]);
  return {
    timestamp: m[1],
    level: inferredLevel,
    message: m[4].trim(),
    source: `${m[2]}/${m[3]}`,
    line: lineNum,
    raw: line,
  };
}

/**
 * Simple format: ERROR message / WARN message / INFO message
 */
const SIMPLE_RE = /^(ERROR|WARN(?:ING)?|INFO|DEBUG|TRACE|FATAL|CRITICAL)\b[:\s]+(.*)/i;

function tryParseSimple(line: string, lineNum: number): LogEntry | null {
  const m = line.match(SIMPLE_RE);
  if (!m) return null;
  return {
    level: normalizeLevel(m[1]),
    message: m[2].trim(),
    line: lineNum,
    raw: line,
  };
}

/**
 * ISO timestamp prefix: 2026-03-19T10:00:00.000Z [LEVEL] message
 */
const ISO_PREFIX_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\s]*)\s+\[?(\w+)\]?\s*(.*)/;

function tryParseISO(line: string, lineNum: number): LogEntry | null {
  const m = line.match(ISO_PREFIX_RE);
  if (!m) return null;
  const level = normalizeLevel(m[2]);
  if (level === 'unknown') return null; // Avoid false positives
  return {
    timestamp: m[1],
    level,
    message: m[3].trim(),
    line: lineNum,
    raw: line,
  };
}

/**
 * Infer log level from message content (fallback for syslog, etc.)
 */
function inferLevelFromMessage(msg: string): LogLevel {
  const lower = msg.toLowerCase();
  if (/\b(?:error|failed|failure|fatal|crash|exception|panic)\b/.test(lower)) return 'error';
  if (/\b(?:warn(?:ing)?|deprecated|caution)\b/.test(lower)) return 'warn';
  if (/\b(?:debug|verbose|trace)\b/.test(lower)) return 'debug';
  return 'info';
}

/**
 * Parse a single log line using cascading parsers
 */
export function parseLine(line: string, lineNum: number): LogEntry | null {
  if (!line.trim()) return null;

  return (
    tryParseJSON(line, lineNum) ||
    tryParseStandard(line, lineNum) ||
    tryParseSyslog(line, lineNum) ||
    tryParseISO(line, lineNum) ||
    tryParseSimple(line, lineNum) ||
    null
  );
}

// ============================================================================
// Pattern Detection
// ============================================================================

/**
 * Normalize a message for pattern grouping.
 * Replaces variable parts (numbers, UUIDs, hashes, IPs, timestamps) with placeholders.
 */
function normalizeMessage(msg: string): string {
  return msg
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<IP>')
    .replace(/\b[0-9a-f]{40}\b/gi, '<HASH>')
    .replace(/\b[0-9a-f]{7,12}\b/gi, '<HEX>')
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\s]*/g, '<TIMESTAMP>')
    .replace(/\d+/g, '<N>')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectPatterns(entries: LogEntry[]): LogPattern[] {
  const counts = new Map<string, { count: number; severity: string }>();

  for (const entry of entries) {
    const normalized = normalizeMessage(entry.message);
    if (!normalized) continue;
    const existing = counts.get(normalized);
    if (existing) {
      existing.count++;
    } else {
      counts.set(normalized, { count: 1, severity: entry.level });
    }
  }

  // Only return patterns that appear more than once, sorted by count desc
  return Array.from(counts.entries())
    .filter(([, v]) => v.count > 1)
    .map(([pattern, v]) => ({ pattern, count: v.count, severity: v.severity }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50); // Limit to top 50 patterns
}

// ============================================================================
// Anomaly Detection
// ============================================================================

function detectAnomalies(entries: LogEntry[]): LogAnomaly[] {
  const anomalies: LogAnomaly[] = [];

  if (entries.length < 2) return anomalies;

  // 1. Detect sudden spike in error rate
  // Split entries into buckets of 100 lines each
  const bucketSize = Math.max(10, Math.floor(entries.length / 20));
  const buckets: { start: number; errors: number; total: number }[] = [];
  for (let i = 0; i < entries.length; i += bucketSize) {
    const slice = entries.slice(i, i + bucketSize);
    const errors = slice.filter(e => e.level === 'error').length;
    buckets.push({ start: entries[i].line, errors, total: slice.length });
  }

  // Compare each bucket to the average error rate
  const totalErrors = buckets.reduce((s, b) => s + b.errors, 0);
  const avgErrorRate = totalErrors / buckets.length;
  for (const bucket of buckets) {
    if (avgErrorRate > 0 && bucket.errors > avgErrorRate * 3 && bucket.errors >= 3) {
      anomalies.push({
        line: bucket.start,
        message: `Error spike: ${bucket.errors} errors in ${bucket.total} lines`,
        reason: `Error rate ${(bucket.errors / bucket.total * 100).toFixed(1)}% is >3x the average ${(avgErrorRate / bucketSize * 100).toFixed(1)}%`,
      });
    }
  }

  // 2. Detect stack traces (multi-line errors)
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (/^\s+at\s+/.test(entry.raw) || /Traceback \(most recent call last\)/.test(entry.raw)) {
      anomalies.push({
        line: entry.line,
        message: entry.raw.trim().slice(0, 120),
        reason: 'Stack trace detected',
      });
    }
  }

  // 3. Detect new error types (errors that appear only once)
  const errorMessages = entries.filter(e => e.level === 'error');
  const errorCounts = new Map<string, number>();
  for (const e of errorMessages) {
    const norm = normalizeMessage(e.message);
    errorCounts.set(norm, (errorCounts.get(norm) || 0) + 1);
  }
  for (const e of errorMessages) {
    const norm = normalizeMessage(e.message);
    if (errorCounts.get(norm) === 1) {
      anomalies.push({
        line: e.line,
        message: e.message.slice(0, 120),
        reason: 'Unique error — appeared only once',
      });
    }
  }

  return anomalies.slice(0, 50); // Limit
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze a log file, streaming line-by-line for large files.
 */
export async function analyzeLog(
  filePath: string,
  options?: LogAnalyzeOptions,
): Promise<LogAnalysisResult> {
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Log file not found: ${resolvedPath}`);
  }

  const maxLines = options?.maxLines ?? 100_000;
  const levelFilter = options?.levelFilter?.toLowerCase();
  const search = options?.search?.toLowerCase();
  const tail = options?.tail;

  const entries: LogEntry[] = [];
  let totalLines = 0;
  const timestamps: string[] = [];

  // For tail mode, we need to buffer last N lines
  const tailBuffer: string[] = [];

  const stream = fs.createReadStream(resolvedPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    totalLines++;

    if (tail) {
      tailBuffer.push(line);
      if (tailBuffer.length > tail) {
        tailBuffer.shift();
      }
      continue;
    }

    if (entries.length >= maxLines) continue; // Count totalLines but skip parsing

    const entry = parseLine(line, totalLines);
    if (!entry) continue;

    // Apply level filter
    if (levelFilter && entry.level !== levelFilter) continue;

    // Apply search filter
    if (search && !entry.message.toLowerCase().includes(search) && !entry.raw.toLowerCase().includes(search)) continue;

    entries.push(entry);
    if (entry.timestamp) timestamps.push(entry.timestamp);
  }

  // If tail mode, parse the buffered lines
  if (tail) {
    const startLine = Math.max(1, totalLines - tailBuffer.length + 1);
    for (let i = 0; i < tailBuffer.length; i++) {
      const lineNum = startLine + i;
      const entry = parseLine(tailBuffer[i], lineNum);
      if (!entry) continue;

      if (levelFilter && entry.level !== levelFilter) continue;
      if (search && !entry.message.toLowerCase().includes(search) && !entry.raw.toLowerCase().includes(search)) continue;

      entries.push(entry);
      if (entry.timestamp) timestamps.push(entry.timestamp);
    }
  }

  // Build summary
  const errors = entries.filter(e => e.level === 'error').length;
  const warnings = entries.filter(e => e.level === 'warn').length;
  const info = entries.filter(e => e.level === 'info').length;

  const timeRange = timestamps.length >= 2
    ? { start: timestamps[0], end: timestamps[timestamps.length - 1] }
    : undefined;

  // Detect patterns and anomalies
  const patterns = detectPatterns(entries);
  const anomalies = detectAnomalies(entries);

  return {
    totalLines,
    entries,
    summary: { errors, warnings, info, timeRange },
    patterns,
    anomalies,
  };
}

// ============================================================================
// Tool Execute Function
// ============================================================================

/**
 * Execute the analyze_logs tool (called from tool handler / registry adapter).
 */
export async function executeAnalyzeLogs(args: {
  file_path: string;
  max_lines?: number;
  level_filter?: string;
  search?: string;
  tail?: number;
}): Promise<ToolResult> {
  try {
    const result = await analyzeLog(args.file_path, {
      maxLines: args.max_lines,
      levelFilter: args.level_filter,
      search: args.search,
      tail: args.tail,
    });

    const lines: string[] = [];
    lines.push(`# Log Analysis: ${path.basename(args.file_path)}`);
    lines.push('');
    lines.push(`Total lines: ${result.totalLines}`);
    lines.push(`Parsed entries: ${result.entries.length}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`- Errors: ${result.summary.errors}`);
    lines.push(`- Warnings: ${result.summary.warnings}`);
    lines.push(`- Info: ${result.summary.info}`);
    if (result.summary.timeRange) {
      lines.push(`- Time range: ${result.summary.timeRange.start} → ${result.summary.timeRange.end}`);
    }

    if (result.patterns.length > 0) {
      lines.push('');
      lines.push('## Top Patterns');
      for (const p of result.patterns.slice(0, 10)) {
        lines.push(`- [${p.severity}] (${p.count}x) ${p.pattern}`);
      }
    }

    if (result.anomalies.length > 0) {
      lines.push('');
      lines.push('## Anomalies');
      for (const a of result.anomalies.slice(0, 10)) {
        lines.push(`- Line ${a.line}: ${a.reason} — ${a.message}`);
      }
    }

    // Show sample entries (first 20)
    if (result.entries.length > 0) {
      lines.push('');
      lines.push('## Sample Entries');
      for (const e of result.entries.slice(0, 20)) {
        const ts = e.timestamp ? `[${e.timestamp}]` : '';
        lines.push(`  L${e.line} ${ts} ${e.level.toUpperCase()}: ${e.message.slice(0, 200)}`);
      }
      if (result.entries.length > 20) {
        lines.push(`  ... and ${result.entries.length - 20} more entries`);
      }
    }

    return { success: true, output: lines.join('\n') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('analyze_logs failed', { error: message });
    return { success: false, error: message };
  }
}
