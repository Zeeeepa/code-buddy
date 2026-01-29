/**
 * Tests for Shortcuts Handler
 */

import { describe, it, expect } from '@jest/globals';
import { handleShortcuts } from '../../src/commands/handlers/core-handlers.js';

describe('handleShortcuts', () => {
  it('should return handled: true', () => {
    const result = handleShortcuts();
    expect(result.handled).toBe(true);
  });

  it('should return an assistant entry', () => {
    const result = handleShortcuts();
    expect(result.entry).toBeDefined();
    expect(result.entry?.type).toBe('assistant');
  });

  it('should include Navigation shortcuts', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    expect(content).toContain('Navigation');
    expect(content).toContain('Ctrl+R');
    expect(content).toContain('Reverse search');
    expect(content).toContain('Ctrl+P');
    expect(content).toContain('Ctrl+N');
    expect(content).toContain('Up/Down');
    expect(content).toContain('Tab');
  });

  it('should include Editing shortcuts', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    expect(content).toContain('Editing');
    expect(content).toContain('Ctrl+A');
    expect(content).toContain('Ctrl+E');
    expect(content).toContain('Ctrl+W');
    expect(content).toContain('Ctrl+U');
    expect(content).toContain('Ctrl+K');
    expect(content).toContain('Ctrl+L');
  });

  it('should include Control shortcuts', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    expect(content).toContain('Control');
    expect(content).toContain('Ctrl+C');
    expect(content).toContain('Ctrl+D');
    expect(content).toContain('Enter');
  });

  it('should include Multiline Input shortcuts', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    expect(content).toContain('Multiline');
    expect(content).toContain('Shift+Enter');
    expect(content).toContain('Ctrl+Enter');
    expect(content).toContain('Esc');
  });

  it('should include Tool Confirmations shortcuts', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    expect(content).toContain('Tool Confirmations');
    expect(content).toContain('Y / Enter');
    expect(content).toContain('Accept');
  });

  it('should include Voice Mode shortcuts', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    expect(content).toContain('Voice Mode');
    expect(content).toContain('Ctrl+V');
    expect(content).toContain('Space');
  });

  it('should include Special character shortcuts', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    expect(content).toContain('Special');
    expect(content).toContain('/');
    expect(content).toContain('slash command');
    expect(content).toContain('!');
    expect(content).toContain('shell command');
    expect(content).toContain('@');
    expect(content).toContain('file');
  });

  it('should include Vim Mode shortcuts', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    expect(content).toContain('Vim Mode');
    expect(content).toContain('/vim on');
    expect(content).toContain('insert mode');
  });

  it('should include a tip about /shortcuts command', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    expect(content).toContain('Tip:');
    expect(content).toContain('/shortcuts');
  });

  it('should have proper formatting with headers', () => {
    const result = handleShortcuts();
    const content = result.entry?.content || '';

    // Should have section headers
    expect(content).toContain('KEYBOARD SHORTCUTS');
    expect(content).toMatch(/[─═]+/); // Should have line characters
  });

  it('should include timestamp', () => {
    const before = new Date();
    const result = handleShortcuts();
    const after = new Date();

    expect(result.entry?.timestamp).toBeDefined();
    expect(result.entry?.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(result.entry?.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
