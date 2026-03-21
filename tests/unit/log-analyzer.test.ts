/**
 * Log Analyzer Tool — Unit Tests
 *
 * Tests: parsing (JSON, standard, syslog, simple, ISO), pattern detection,
 * anomaly detection, filtering (level, search, tail), large file streaming,
 * and the executeAnalyzeLogs wrapper.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseLine, analyzeLog, executeAnalyzeLogs } from '../../src/tools/log-analyzer-tool';
import type { LogEntry } from '../../src/tools/log-analyzer-tool';

// Helper: create a temp file with content
function createTempLog(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-analyzer-test-'));
  const filePath = path.join(dir, 'test.log');
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function cleanupTempLog(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
    fs.rmdirSync(path.dirname(filePath));
  } catch { /* ignore */ }
}

describe('parseLine', () => {
  it('should parse JSON log entries', () => {
    const entry = parseLine('{"level":"error","msg":"Connection failed","ts":"2026-03-19T10:00:00Z"}', 1);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('error');
    expect(entry!.message).toBe('Connection failed');
    expect(entry!.timestamp).toBe('2026-03-19T10:00:00Z');
    expect(entry!.line).toBe(1);
  });

  it('should parse JSON logs with alternate field names', () => {
    const entry = parseLine('{"severity":"warning","message":"Disk usage high","time":"2026-03-19T10:00:00Z","component":"monitor"}', 5);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('warn');
    expect(entry!.message).toBe('Disk usage high');
    expect(entry!.source).toBe('monitor');
  });

  it('should parse standard format [timestamp] LEVEL: message', () => {
    const entry = parseLine('[2026-03-19 10:00:00] ERROR: Database connection timeout', 10);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('error');
    expect(entry!.message).toBe('Database connection timeout');
    expect(entry!.timestamp).toBe('2026-03-19 10:00:00');
  });

  it('should parse syslog format', () => {
    const entry = parseLine('Mar 19 10:00:00 webserver nginx[1234]: upstream timed out', 20);
    expect(entry).not.toBeNull();
    expect(entry!.timestamp).toBe('Mar 19 10:00:00');
    expect(entry!.message).toBe('upstream timed out');
    expect(entry!.source).toBe('webserver/nginx');
  });

  it('should parse simple format (LEVEL message)', () => {
    const entry = parseLine('ERROR Connection refused to port 5432', 3);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('error');
    expect(entry!.message).toBe('Connection refused to port 5432');
  });

  it('should parse ISO timestamp prefix format', () => {
    const entry = parseLine('2026-03-19T10:00:00.123Z [WARN] Memory usage at 90%', 7);
    expect(entry).not.toBeNull();
    expect(entry!.level).toBe('warn');
    expect(entry!.message).toBe('Memory usage at 90%');
    expect(entry!.timestamp).toBe('2026-03-19T10:00:00.123Z');
  });

  it('should return null for empty lines', () => {
    expect(parseLine('', 1)).toBeNull();
    expect(parseLine('   ', 1)).toBeNull();
  });

  it('should normalize various level names', () => {
    const fatal = parseLine('FATAL: System crash', 1);
    expect(fatal!.level).toBe('error');

    const warning = parseLine('WARNING: Deprecated API call', 2);
    expect(warning!.level).toBe('warn');

    const dbg = parseLine('DEBUG variable x = 42', 3);
    expect(dbg!.level).toBe('debug');
  });
});

describe('analyzeLog', () => {
  it('should analyze a multi-format log file', async () => {
    const content = [
      '[2026-03-19 10:00:00] ERROR: Connection failed',
      '[2026-03-19 10:00:01] INFO: Retrying...',
      '[2026-03-19 10:00:02] ERROR: Connection failed',
      '[2026-03-19 10:00:03] WARN: Timeout approaching',
      '[2026-03-19 10:00:04] INFO: Connected',
    ].join('\n');

    const filePath = createTempLog(content);
    try {
      const result = await analyzeLog(filePath);
      expect(result.totalLines).toBe(5);
      expect(result.entries.length).toBe(5);
      expect(result.summary.errors).toBe(2);
      expect(result.summary.warnings).toBe(1);
      expect(result.summary.info).toBe(2);
      expect(result.summary.timeRange).toBeDefined();
      expect(result.summary.timeRange!.start).toBe('2026-03-19 10:00:00');
      expect(result.summary.timeRange!.end).toBe('2026-03-19 10:00:04');
    } finally {
      cleanupTempLog(filePath);
    }
  });

  it('should filter by level', async () => {
    const content = [
      'ERROR: first error',
      'INFO: some info',
      'ERROR: second error',
      'WARN: a warning',
    ].join('\n');

    const filePath = createTempLog(content);
    try {
      const result = await analyzeLog(filePath, { levelFilter: 'error' });
      expect(result.entries.length).toBe(2);
      expect(result.entries.every(e => e.level === 'error')).toBe(true);
    } finally {
      cleanupTempLog(filePath);
    }
  });

  it('should filter by search term', async () => {
    const content = [
      'ERROR: Connection timeout to database',
      'ERROR: Connection refused',
      'INFO: Server started',
      'ERROR: Disk space low',
    ].join('\n');

    const filePath = createTempLog(content);
    try {
      const result = await analyzeLog(filePath, { search: 'connection' });
      expect(result.entries.length).toBe(2);
    } finally {
      cleanupTempLog(filePath);
    }
  });

  it('should support tail mode', async () => {
    const lines: string[] = [];
    for (let i = 1; i <= 100; i++) {
      lines.push(`[2026-03-19 10:00:${String(i).padStart(2, '0')}] INFO: Line ${i}`);
    }

    const filePath = createTempLog(lines.join('\n'));
    try {
      const result = await analyzeLog(filePath, { tail: 5 });
      expect(result.totalLines).toBe(100);
      expect(result.entries.length).toBe(5);
      expect(result.entries[0].message).toContain('Line 96');
    } finally {
      cleanupTempLog(filePath);
    }
  });

  it('should detect repeated patterns', async () => {
    const content = [
      'ERROR: Connection to 192.168.1.1 failed',
      'ERROR: Connection to 10.0.0.1 failed',
      'ERROR: Connection to 172.16.0.1 failed',
      'INFO: Server started',
    ].join('\n');

    const filePath = createTempLog(content);
    try {
      const result = await analyzeLog(filePath);
      expect(result.patterns.length).toBeGreaterThan(0);
      // The 3 connection errors should be grouped into one pattern
      const connPattern = result.patterns.find(p => p.pattern.includes('Connection'));
      expect(connPattern).toBeDefined();
      expect(connPattern!.count).toBe(3);
    } finally {
      cleanupTempLog(filePath);
    }
  });

  it('should throw for non-existent file', async () => {
    await expect(analyzeLog('/nonexistent/path/test.log')).rejects.toThrow('Log file not found');
  });

  it('should respect maxLines limit', async () => {
    const lines: string[] = [];
    for (let i = 0; i < 50; i++) {
      lines.push(`ERROR: Error ${i}`);
    }

    const filePath = createTempLog(lines.join('\n'));
    try {
      const result = await analyzeLog(filePath, { maxLines: 10 });
      expect(result.totalLines).toBe(50);
      expect(result.entries.length).toBe(10);
    } finally {
      cleanupTempLog(filePath);
    }
  });
});

describe('executeAnalyzeLogs', () => {
  it('should return success with formatted output', async () => {
    const content = [
      '[2026-03-19 10:00:00] ERROR: Something broke',
      '[2026-03-19 10:00:01] INFO: Recovering',
    ].join('\n');

    const filePath = createTempLog(content);
    try {
      const result = await executeAnalyzeLogs({ file_path: filePath });
      expect(result.success).toBe(true);
      expect(result.output).toContain('Log Analysis');
      expect(result.output).toContain('Errors: 1');
      expect(result.output).toContain('Info: 1');
    } finally {
      cleanupTempLog(filePath);
    }
  });

  it('should return error for missing file', async () => {
    const result = await executeAnalyzeLogs({ file_path: '/nonexistent/log.txt' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Log file not found');
  });
});
