/**
 * Tests for Tool Analytics Module
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  ToolAnalytics,
  getToolAnalytics,
  resetToolAnalytics,
} from '../../src/analytics/tool-analytics.js';

describe('ToolAnalytics', () => {
  let analytics: ToolAnalytics;

  beforeEach(() => {
    resetToolAnalytics();
    analytics = new ToolAnalytics();
  });

  afterEach(() => {
    analytics.dispose();
    resetToolAnalytics();
  });

  describe('recordExecution', () => {
    it('should record a successful tool execution', () => {
      analytics.recordSuccess('read_file', 100);

      const stats = analytics.getToolStats('read_file');
      expect(stats).toBeDefined();
      expect(stats?.totalExecutions).toBe(1);
      expect(stats?.successCount).toBe(1);
      expect(stats?.failureCount).toBe(0);
      expect(stats?.successRate).toBe(100);
    });

    it('should record a failed tool execution', () => {
      analytics.recordFailure('bash', 200, 'Command not found');

      const stats = analytics.getToolStats('bash');
      expect(stats).toBeDefined();
      expect(stats?.totalExecutions).toBe(1);
      expect(stats?.successCount).toBe(0);
      expect(stats?.failureCount).toBe(1);
      expect(stats?.successRate).toBe(0);
      expect(stats?.commonErrors).toContain('Command not found');
    });

    it('should calculate success rate correctly', () => {
      analytics.recordSuccess('edit_file', 100);
      analytics.recordSuccess('edit_file', 150);
      analytics.recordFailure('edit_file', 200, 'File not found');

      const stats = analytics.getToolStats('edit_file');
      expect(stats?.totalExecutions).toBe(3);
      expect(stats?.successCount).toBe(2);
      expect(stats?.failureCount).toBe(1);
      expect(stats?.successRate).toBeCloseTo(66.67, 1);
    });

    it('should track duration statistics', () => {
      analytics.recordSuccess('search', 50);
      analytics.recordSuccess('search', 100);
      analytics.recordSuccess('search', 150);

      const stats = analytics.getToolStats('search');
      expect(stats?.avgDuration).toBe(100);
      expect(stats?.minDuration).toBe(50);
      expect(stats?.maxDuration).toBe(150);
    });
  });

  describe('getMostUsedTools', () => {
    it('should return tools sorted by usage', () => {
      // Use tool1 5 times
      for (let i = 0; i < 5; i++) {
        analytics.recordSuccess('tool1', 100);
      }
      // Use tool2 3 times
      for (let i = 0; i < 3; i++) {
        analytics.recordSuccess('tool2', 100);
      }
      // Use tool3 1 time
      analytics.recordSuccess('tool3', 100);

      const mostUsed = analytics.getMostUsedTools(3);
      expect(mostUsed[0].toolName).toBe('tool1');
      expect(mostUsed[0].totalExecutions).toBe(5);
      expect(mostUsed[1].toolName).toBe('tool2');
      expect(mostUsed[2].toolName).toBe('tool3');
    });
  });

  describe('getHighestSuccessRate', () => {
    it('should return tools with highest success rate (min 5 uses)', () => {
      // Tool with 100% success (5 uses)
      for (let i = 0; i < 5; i++) {
        analytics.recordSuccess('perfect_tool', 100);
      }

      // Tool with 80% success (5 uses)
      for (let i = 0; i < 4; i++) {
        analytics.recordSuccess('good_tool', 100);
      }
      analytics.recordFailure('good_tool', 100, 'error');

      // Tool with less than 5 uses (should be excluded)
      analytics.recordSuccess('rarely_used', 100);

      const highSuccess = analytics.getHighestSuccessRate(5);
      expect(highSuccess.length).toBe(2);
      expect(highSuccess[0].toolName).toBe('perfect_tool');
      expect(highSuccess[0].successRate).toBe(100);
      expect(highSuccess[1].toolName).toBe('good_tool');
    });
  });

  describe('suggestTools', () => {
    it('should suggest tools based on patterns', () => {
      // Record some successful tool chains
      analytics.recordSuccess('read_file', 100);
      analytics.recordSuccess('edit_file', 100);

      const suggestions = analytics.suggestTools('context', 'read_file');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest edit_file when read_file was used', () => {
      // Build up a pattern
      for (let i = 0; i < 5; i++) {
        analytics.recordSuccess('read_file', 100);
        analytics.recordSuccess('edit_file', 100);
      }

      const suggestions = analytics.suggestTools('edit a file', 'read_file');
      const editSuggestion = suggestions.find(s => s.toolName === 'edit_file');
      expect(editSuggestion).toBeDefined();
    });
  });

  describe('getCommonChains', () => {
    it('should detect common tool chains', () => {
      // Create a repeated pattern
      for (let i = 0; i < 3; i++) {
        analytics.recordSuccess('read_file', 100);
        analytics.recordSuccess('edit_file', 100);
      }

      const chains = analytics.getCommonChains(5);
      const readEditChain = chains.find(
        c => c.tools.includes('read_file') && c.tools.includes('edit_file')
      );
      expect(readEditChain).toBeDefined();
      expect(readEditChain?.frequency).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getSnapshot', () => {
    it('should return a complete analytics snapshot', () => {
      analytics.recordSuccess('tool1', 100);
      analytics.recordFailure('tool2', 100, 'error');

      const snapshot = analytics.getSnapshot();
      expect(snapshot.totalExecutions).toBe(2);
      expect(snapshot.uniqueTools).toBe(2);
      expect(snapshot.overallSuccessRate).toBe(50);
    });
  });

  describe('formatAnalytics', () => {
    it('should format analytics for display', () => {
      analytics.recordSuccess('read_file', 100);
      analytics.recordSuccess('write_file', 100);

      const formatted = analytics.formatAnalytics();
      expect(formatted).toContain('Tool Usage Analytics');
      expect(formatted).toContain('Total Executions: 2');
    });
  });

  describe('exportToJson', () => {
    it('should export valid JSON', () => {
      analytics.recordSuccess('test_tool', 100);

      const json = analytics.exportToJson();
      const parsed = JSON.parse(json);

      expect(parsed.snapshot).toBeDefined();
      expect(parsed.toolStats).toBeDefined();
      expect(parsed.exportedAt).toBeDefined();
    });
  });

  describe('clear', () => {
    it('should clear all analytics data', () => {
      analytics.recordSuccess('tool1', 100);
      analytics.recordSuccess('tool2', 100);

      analytics.clear();

      expect(analytics.getAllToolStats().length).toBe(0);
      expect(analytics.getSnapshot().totalExecutions).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getToolAnalytics();
      const instance2 = getToolAnalytics();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton properly', () => {
      const instance1 = getToolAnalytics();
      instance1.recordSuccess('test', 100);

      resetToolAnalytics();

      const instance2 = getToolAnalytics();
      expect(instance2).not.toBe(instance1);
      expect(instance2.getAllToolStats().length).toBe(0);
    });
  });

  describe('events', () => {
    it('should emit execution:recorded event', () => {
      const callback = jest.fn();
      analytics.on('execution:recorded', callback);

      analytics.recordSuccess('test_tool', 100);

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'test_tool',
          success: true,
        })
      );
    });

    it('should emit analytics:cleared event', () => {
      const callback = jest.fn();
      analytics.on('analytics:cleared', callback);

      analytics.clear();

      expect(callback).toHaveBeenCalled();
    });
  });
});
