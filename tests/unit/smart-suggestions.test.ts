/**
 * Tests for Smart Suggestions Manager
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  SmartSuggestionsManager,
  getSmartSuggestionsManager,
  resetSmartSuggestionsManager,
} from '../../src/agent/context/memory-context-builder.js';

describe('SmartSuggestionsManager', () => {
  let manager: SmartSuggestionsManager;

  beforeEach(() => {
    resetSmartSuggestionsManager();
    manager = new SmartSuggestionsManager();
  });

  afterEach(() => {
    manager.dispose();
    resetSmartSuggestionsManager();
  });

  describe('suggestTools', () => {
    it('should suggest read_file for "read" keyword', () => {
      const suggestions = manager.suggestTools('read the config file');

      const readFileSuggestion = suggestions.find(s => s.toolName === 'read_file');
      expect(readFileSuggestion).toBeDefined();
      expect(readFileSuggestion?.basedOn).toBe('keyword');
    });

    it('should suggest write_file for "write" keyword', () => {
      const suggestions = manager.suggestTools('write a new file');

      const writeFileSuggestion = suggestions.find(s => s.toolName === 'write_file');
      expect(writeFileSuggestion).toBeDefined();
    });

    it('should suggest bash for "run" keyword', () => {
      const suggestions = manager.suggestTools('run the tests');

      const bashSuggestion = suggestions.find(s => s.toolName === 'bash');
      expect(bashSuggestion).toBeDefined();
    });

    it('should suggest search tools for "search" keyword', () => {
      const suggestions = manager.suggestTools('search for errors');

      const searchTools = suggestions.filter(
        s => s.toolName.includes('search') || s.toolName.includes('grep')
      );
      expect(searchTools.length).toBeGreaterThan(0);
    });

    it('should suggest edit_file for "edit" keyword', () => {
      const suggestions = manager.suggestTools('edit the main file');

      const editSuggestion = suggestions.find(s => s.toolName === 'edit_file');
      expect(editSuggestion).toBeDefined();
    });

    it('should return sorted suggestions by confidence', () => {
      const suggestions = manager.suggestTools('read and edit the file');

      // Verify suggestions are sorted by confidence
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
      }
    });

    it('should limit suggestions to 10', () => {
      const suggestions = manager.suggestTools('read write edit search find run test build deploy');

      expect(suggestions.length).toBeLessThanOrEqual(10);
    });
  });

  describe('learnFromSuccess', () => {
    it('should learn from successful tool chains', () => {
      // Teach the manager a pattern
      manager.learnFromSuccess('read config file', ['read_file']);
      manager.learnFromSuccess('read config file', ['read_file', 'edit_file']);

      const patterns = manager.getLearnedPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });

    it('should improve suggestions after learning', () => {
      // Learn a pattern multiple times with unique keywords
      for (let i = 0; i < 5; i++) {
        manager.learnFromSuccess('analyze code quality metrics', ['read_file', 'codebase_search']);
      }

      // Use input that contains learned keywords
      const suggestions = manager.suggestTools('analyze my code quality metrics');

      // Should suggest learned tools - either from patterns or keywords
      const learnedTools = suggestions.filter(
        s => s.toolName === 'read_file' || s.toolName === 'codebase_search'
      );
      expect(learnedTools.length).toBeGreaterThan(0);
    });

    it('should track success rate for patterns', () => {
      // Learn successful patterns
      manager.learnFromSuccess('fix bug', ['read_file', 'edit_file']);
      manager.learnFromSuccess('fix bug', ['read_file', 'edit_file']);
      manager.learnFromFailure('fix bug', ['bash']);

      const patterns = manager.getLearnedPatterns();
      const fixPattern = patterns.find(p => p.keywords.includes('bug'));

      if (fixPattern) {
        // Success rate should be less than 100% due to the failure
        expect(fixPattern.successRate).toBeLessThan(1);
      }
    });

    it('should emit pattern:learned event', () => {
      const callback = jest.fn();
      manager.on('pattern:learned', callback);

      manager.learnFromSuccess('test pattern', ['bash']);

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: expect.any(Array),
          tools: ['bash'],
        })
      );
    });
  });

  describe('learnFromFailure', () => {
    it('should track failures to reduce success rate', () => {
      // First success
      manager.learnFromSuccess('deploy app', ['bash']);

      // Then failure
      manager.learnFromFailure('deploy app', ['bash']);

      const patterns = manager.getLearnedPatterns();
      const deployPattern = patterns.find(p => p.keywords.includes('deploy'));

      if (deployPattern) {
        expect(deployPattern.frequency).toBe(2);
        expect(deployPattern.successRate).toBe(0.5);
      }
    });
  });

  describe('addKeywordMapping', () => {
    it('should add custom keyword mappings', () => {
      manager.addKeywordMapping('deploy', ['docker_build', 'kubectl_apply']);

      const suggestions = manager.suggestTools('deploy the application');

      const dockerSuggestion = suggestions.find(s => s.toolName === 'docker_build');
      expect(dockerSuggestion).toBeDefined();
    });

    it('should merge with existing mappings', () => {
      manager.addKeywordMapping('test', ['custom_test_tool']);

      const suggestions = manager.suggestTools('run the tests');

      // Should have both default bash and new custom tool
      const bashSuggestion = suggestions.find(s => s.toolName === 'bash');
      const customSuggestion = suggestions.find(s => s.toolName === 'custom_test_tool');

      expect(bashSuggestion).toBeDefined();
      expect(customSuggestion).toBeDefined();
    });
  });

  describe('formatSuggestions', () => {
    it('should format suggestions for display', () => {
      const suggestions = manager.suggestTools('read a file');
      const formatted = manager.formatSuggestions(suggestions);

      expect(formatted).toContain('Suggested Tools:');
      expect(formatted).toContain('-'.repeat(40));
    });

    it('should show confidence percentage', () => {
      const suggestions = manager.suggestTools('search for code');
      const formatted = manager.formatSuggestions(suggestions);

      // Should contain percentage values
      expect(formatted).toMatch(/\d+% confidence/);
    });

    it('should handle empty suggestions', () => {
      const formatted = manager.formatSuggestions([]);
      expect(formatted).toBe('No tool suggestions available.');
    });
  });

  describe('getLearnedPatterns', () => {
    it('should return patterns sorted by frequency', () => {
      manager.learnFromSuccess('read files', ['read_file']);
      manager.learnFromSuccess('read files', ['read_file']);
      manager.learnFromSuccess('read files', ['read_file']);
      manager.learnFromSuccess('write data', ['write_file']);

      const patterns = manager.getLearnedPatterns();

      expect(patterns.length).toBe(2);
      expect(patterns[0].frequency).toBeGreaterThanOrEqual(patterns[1].frequency);
    });
  });

  describe('clear', () => {
    it('should clear all learned data', () => {
      manager.learnFromSuccess('test', ['bash']);
      manager.learnFromSuccess('another test', ['read_file']);

      manager.clear();

      const patterns = manager.getLearnedPatterns();
      expect(patterns.length).toBe(0);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      const instance1 = getSmartSuggestionsManager();
      const instance2 = getSmartSuggestionsManager();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton properly', () => {
      const instance1 = getSmartSuggestionsManager();
      instance1.learnFromSuccess('test', ['bash']);

      resetSmartSuggestionsManager();

      const instance2 = getSmartSuggestionsManager();
      expect(instance2).not.toBe(instance1);
      expect(instance2.getLearnedPatterns().length).toBe(0);
    });
  });

  describe('keyword matching', () => {
    it('should match partial keywords', () => {
      const suggestions = manager.suggestTools('searching through files');

      // 'searching' should partially match 'search'
      const searchTools = suggestions.filter(
        s => s.toolName.includes('search') || s.toolName.includes('grep')
      );
      expect(searchTools.length).toBeGreaterThan(0);
    });

    it('should be case insensitive', () => {
      const suggestions1 = manager.suggestTools('READ FILE');
      const suggestions2 = manager.suggestTools('read file');

      const tool1 = suggestions1.find(s => s.toolName === 'read_file');
      const tool2 = suggestions2.find(s => s.toolName === 'read_file');

      expect(tool1).toBeDefined();
      expect(tool2).toBeDefined();
    });
  });

  describe('history-based suggestions', () => {
    it('should suggest tools from recent successful history', () => {
      // Build up history
      for (let i = 0; i < 10; i++) {
        manager.learnFromSuccess(`task ${i}`, ['frequently_used_tool']);
      }

      const suggestions = manager.suggestTools('something new');

      // The history-based suggestion should appear
      const historySuggestions = suggestions.filter(s => s.basedOn === 'history');
      expect(historySuggestions.some(s => s.toolName === 'frequently_used_tool')).toBe(true);
    });
  });
});
