/**
 * Tests for JSONC config support (stripJsonComments + ConfigManager JSONC loading)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stripJsonComments } from '../../src/config/toml-config.js';

describe('stripJsonComments', () => {
  it('strips single-line comments', () => {
    const input = `{
  "name": "test", // This is a comment
  "value": 42
}`;
    const result = stripJsonComments(input);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('test');
    expect(parsed.value).toBe(42);
  });

  it('strips multi-line comments', () => {
    const input = `{
  /* This is a
     multi-line comment */
  "name": "test",
  "value": 42
}`;
    const result = stripJsonComments(input);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('test');
    expect(parsed.value).toBe(42);
  });

  it('does not strip comments inside strings', () => {
    const input = `{
  "url": "https://example.com/path",
  "pattern": "// not a comment",
  "multi": "/* also not */"
}`;
    const result = stripJsonComments(input);
    const parsed = JSON.parse(result);
    expect(parsed.url).toBe('https://example.com/path');
    expect(parsed.pattern).toBe('// not a comment');
    expect(parsed.multi).toBe('/* also not */');
  });

  it('handles escaped quotes in strings', () => {
    const input = `{
  "escaped": "he said \\"hello\\"", // comment
  "next": true
}`;
    const result = stripJsonComments(input);
    const parsed = JSON.parse(result);
    expect(parsed.escaped).toBe('he said "hello"');
    expect(parsed.next).toBe(true);
  });

  it('handles empty input', () => {
    expect(stripJsonComments('')).toBe('');
  });

  it('handles input with no comments', () => {
    const input = '{"key": "value", "num": 123}';
    const result = stripJsonComments(input);
    expect(JSON.parse(result)).toEqual({ key: 'value', num: 123 });
  });

  it('handles trailing comma workaround with comments', () => {
    // JSONC often uses trailing commas before closing braces.
    // Our function strips comments but does NOT handle trailing commas
    // (that would be a separate concern).
    const input = `{
  "a": 1,
  "b": 2 // trailing comment no comma issue
}`;
    const result = stripJsonComments(input);
    const parsed = JSON.parse(result);
    expect(parsed.a).toBe(1);
    expect(parsed.b).toBe(2);
  });

  it('handles consecutive comments', () => {
    const input = `{
  // first comment
  // second comment
  /* block */ "key": "val"
}`;
    const result = stripJsonComments(input);
    const parsed = JSON.parse(result);
    expect(parsed.key).toBe('val');
  });

  it('handles comment at end of file', () => {
    const input = `{"key": "val"}
// final comment`;
    const result = stripJsonComments(input);
    // Should parse the JSON part fine
    expect(result.trim().startsWith('{')).toBe(true);
  });
});
