/**
 * Tests for Kitty Keyboard Protocol utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enableKittyKeyboard,
  disableKittyKeyboard,
  parseKittyKey,
  isKittySupported,
} from '../../src/utils/kitty-keyboard.js';

describe('kitty-keyboard', () => {
  describe('parseKittyKey', () => {
    it('parses a simple key press (no modifiers)', () => {
      // 'a' = codepoint 97, modifiers 1 (none)
      const result = parseKittyKey('\x1b[97;1u');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('a');
      expect(result!.modifiers.shift).toBe(false);
      expect(result!.modifiers.alt).toBe(false);
      expect(result!.modifiers.ctrl).toBe(false);
      expect(result!.modifiers.super).toBe(false);
      expect(result!.eventType).toBe('press');
    });

    it('parses Shift modifier', () => {
      // Shift = bit 0, so modifiers field = 2 (1 + 1)
      const result = parseKittyKey('\x1b[97;2u');
      expect(result).not.toBeNull();
      expect(result!.modifiers.shift).toBe(true);
      expect(result!.modifiers.alt).toBe(false);
      expect(result!.modifiers.ctrl).toBe(false);
    });

    it('parses Ctrl modifier', () => {
      // Ctrl = bit 2, so modifiers field = 5 (1 + 4)
      const result = parseKittyKey('\x1b[98;5u');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('b');
      expect(result!.modifiers.ctrl).toBe(true);
      expect(result!.modifiers.shift).toBe(false);
    });

    it('parses Alt modifier', () => {
      // Alt = bit 1, so modifiers field = 3 (1 + 2)
      const result = parseKittyKey('\x1b[99;3u');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('c');
      expect(result!.modifiers.alt).toBe(true);
    });

    it('parses Ctrl+Shift combination', () => {
      // Ctrl+Shift = bit 0 + bit 2 = 5, so modifiers field = 6 (1 + 5)
      const result = parseKittyKey('\x1b[65;6u');
      expect(result).not.toBeNull();
      expect(result!.key).toBe('A');
      expect(result!.modifiers.shift).toBe(true);
      expect(result!.modifiers.ctrl).toBe(true);
      expect(result!.modifiers.alt).toBe(false);
    });

    it('parses Super modifier', () => {
      // Super = bit 3, so modifiers field = 9 (1 + 8)
      const result = parseKittyKey('\x1b[97;9u');
      expect(result).not.toBeNull();
      expect(result!.modifiers.super).toBe(true);
    });

    it('parses repeat event type', () => {
      // Event type 2 = repeat
      const result = parseKittyKey('\x1b[97;1:2u');
      expect(result).not.toBeNull();
      expect(result!.eventType).toBe('repeat');
    });

    it('parses release event type', () => {
      // Event type 3 = release
      const result = parseKittyKey('\x1b[97;1:3u');
      expect(result).not.toBeNull();
      expect(result!.eventType).toBe('release');
    });

    it('returns null for non-CSI-u sequences', () => {
      expect(parseKittyKey('\x1b[A')).toBeNull();        // Arrow key
      expect(parseKittyKey('hello')).toBeNull();          // Plain text
      expect(parseKittyKey('\x1b[1;2A')).toBeNull();      // CSI A (not u)
      expect(parseKittyKey('')).toBeNull();               // Empty string
    });
  });

  describe('isKittySupported', () => {
    const originalTermProgram = process.env.TERM_PROGRAM;

    afterEach(() => {
      if (originalTermProgram !== undefined) {
        process.env.TERM_PROGRAM = originalTermProgram;
      } else {
        delete process.env.TERM_PROGRAM;
      }
    });

    it('returns true for kitty', () => {
      process.env.TERM_PROGRAM = 'kitty';
      expect(isKittySupported()).toBe(true);
    });

    it('returns true for WezTerm', () => {
      process.env.TERM_PROGRAM = 'WezTerm';
      expect(isKittySupported()).toBe(true);
    });

    it('returns true for ghostty', () => {
      process.env.TERM_PROGRAM = 'ghostty';
      expect(isKittySupported()).toBe(true);
    });

    it('returns true for foot', () => {
      process.env.TERM_PROGRAM = 'foot';
      expect(isKittySupported()).toBe(true);
    });

    it('returns false for unsupported terminals', () => {
      process.env.TERM_PROGRAM = 'xterm';
      expect(isKittySupported()).toBe(false);
    });

    it('returns false when TERM_PROGRAM is empty', () => {
      process.env.TERM_PROGRAM = '';
      expect(isKittySupported()).toBe(false);
    });
  });

  describe('enableKittyKeyboard', () => {
    it('writes CSI >1u to stdout when TTY', () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      enableKittyKeyboard();

      expect(writeSpy).toHaveBeenCalledWith('\x1b[>1u');

      writeSpy.mockRestore();
      Object.defineProperty(process.stdout, 'isTTY', { value: origIsTTY, configurable: true });
    });

    it('does not write when not a TTY', () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

      enableKittyKeyboard();

      expect(writeSpy).not.toHaveBeenCalled();

      writeSpy.mockRestore();
      Object.defineProperty(process.stdout, 'isTTY', { value: origIsTTY, configurable: true });
    });
  });

  describe('disableKittyKeyboard', () => {
    it('writes CSI <u to stdout when TTY', () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
      const origIsTTY = process.stdout.isTTY;
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      disableKittyKeyboard();

      expect(writeSpy).toHaveBeenCalledWith('\x1b[<u');

      writeSpy.mockRestore();
      Object.defineProperty(process.stdout, 'isTTY', { value: origIsTTY, configurable: true });
    });
  });
});
