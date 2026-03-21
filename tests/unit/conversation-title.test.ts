/**
 * Tests for src/utils/conversation-title.ts
 *
 * Heuristic conversation title generation from first user message.
 */

import { describe, it, expect } from 'vitest';
import { generateConversationTitle } from '../../src/utils/conversation-title';

describe('generateConversationTitle', () => {
  it('returns default title for empty message', () => {
    expect(generateConversationTitle('')).toBe('New conversation');
  });

  it('returns default title for null/undefined input', () => {
    expect(generateConversationTitle(null as unknown as string)).toBe('New conversation');
    expect(generateConversationTitle(undefined as unknown as string)).toBe('New conversation');
  });

  it('capitalizes action verb prefix', () => {
    const title = generateConversationTitle('fix the login button');
    expect(title).toMatch(/^Fix/);
    expect(title).toContain('login button');
  });

  it('handles "create" action verb', () => {
    const title = generateConversationTitle('create a new API endpoint for user profiles');
    expect(title).toMatch(/^Create/);
  });

  it('handles "refactor" action verb', () => {
    const title = generateConversationTitle('refactor the authentication module');
    expect(title).toMatch(/^Refactor/);
    expect(title).toContain('authentication module');
  });

  it('enforces 60 character maximum', () => {
    const longMessage = 'implement a comprehensive logging system with structured output, rotation, and multiple transports for production use';
    const title = generateConversationTitle(longMessage);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title).toMatch(/\.\.\.$/);
  });

  it('detects file paths in messages', () => {
    const title = generateConversationTitle('there is a bug in src/utils/index.ts');
    expect(title).toContain('index.ts');
  });

  it('handles question messages', () => {
    const title = generateConversationTitle('how does the authentication system work?');
    expect(title).toContain('authentication');
  });

  it('handles short messages without truncation', () => {
    const title = generateConversationTitle('fix typo');
    expect(title).toBe('Fix typo');
    expect(title.length).toBeLessThanOrEqual(60);
  });
});
