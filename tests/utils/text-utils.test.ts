/**
 * Tests for text-utils
 */

import {
  deleteCharBefore,
  deleteCharAfter,
  deleteWordBefore,
  deleteWordAfter,
  insertText,
  moveToLineStart,
  moveToLineEnd,
  moveToPreviousWord,
  moveToNextWord,
} from '../../src/utils/text-utils.js';

describe('Text Utils', () => {
  describe('deleteCharBefore', () => {
    it('should delete character before cursor', () => {
      const result = deleteCharBefore('hello', 5);
      expect(result.text).toBe('hell');
      expect(result.position).toBe(4);
    });

    it('should not delete at position 0', () => {
      const result = deleteCharBefore('hello', 0);
      expect(result.text).toBe('hello');
      expect(result.position).toBe(0);
    });

    it('should delete in middle of text', () => {
      const result = deleteCharBefore('hello', 3);
      expect(result.text).toBe('helo');
      expect(result.position).toBe(2);
    });
  });

  describe('deleteCharAfter', () => {
    it('should delete character after cursor', () => {
      const result = deleteCharAfter('hello', 0);
      expect(result.text).toBe('ello');
      expect(result.position).toBe(0);
    });

    it('should not delete at end of text', () => {
      const result = deleteCharAfter('hello', 5);
      expect(result.text).toBe('hello');
      expect(result.position).toBe(5);
    });

    it('should delete in middle of text', () => {
      const result = deleteCharAfter('hello', 2);
      expect(result.text).toBe('helo');
      expect(result.position).toBe(2);
    });
  });

  describe('deleteWordBefore', () => {
    it('should delete word before cursor', () => {
      const result = deleteWordBefore('hello world', 11);
      expect(result.text).toBe('hello ');
      expect(result.position).toBe(6);
    });

    it('should delete partial word', () => {
      const result = deleteWordBefore('hello world', 8);
      expect(result.text).toBe('hello rld');
      expect(result.position).toBe(6);
    });

    it('should handle empty string', () => {
      const result = deleteWordBefore('', 0);
      expect(result.text).toBe('');
      expect(result.position).toBe(0);
    });
  });

  describe('deleteWordAfter', () => {
    it('should delete word after cursor including trailing space', () => {
      const result = deleteWordAfter('hello world', 0);
      // moveToNextWord goes past the word AND whitespace to start of next word
      expect(result.text).toBe('world');
      expect(result.position).toBe(0);
    });

    it('should delete from middle of word to next word start', () => {
      const result = deleteWordAfter('hello world', 2);
      // Deletes 'llo ' (rest of word + space) leaving 'heworld'
      expect(result.text).toBe('heworld');
      expect(result.position).toBe(2);
    });

    it('should handle end of string', () => {
      const result = deleteWordAfter('hello', 5);
      expect(result.text).toBe('hello');
      expect(result.position).toBe(5);
    });
  });

  describe('insertText', () => {
    it('should insert at cursor position', () => {
      const result = insertText('hello', 5, ' world');
      expect(result.text).toBe('hello world');
      expect(result.position).toBe(11);
    });

    it('should insert at beginning', () => {
      const result = insertText('world', 0, 'hello ');
      expect(result.text).toBe('hello world');
      expect(result.position).toBe(6);
    });

    it('should insert in middle', () => {
      const result = insertText('heo', 2, 'll');
      expect(result.text).toBe('hello');
      expect(result.position).toBe(4);
    });

    it('should handle empty string insertion', () => {
      const result = insertText('hello', 2, '');
      expect(result.text).toBe('hello');
      expect(result.position).toBe(2);
    });
  });

  describe('moveToLineStart', () => {
    it('should move to start of line', () => {
      const pos = moveToLineStart('hello\nworld', 8);
      expect(pos).toBe(6);
    });

    it('should stay at 0 for first line', () => {
      const pos = moveToLineStart('hello', 3);
      expect(pos).toBe(0);
    });

    it('should handle multiline', () => {
      const pos = moveToLineStart('line1\nline2\nline3', 15);
      expect(pos).toBe(12);
    });
  });

  describe('moveToLineEnd', () => {
    it('should move to end of line', () => {
      const pos = moveToLineEnd('hello\nworld', 2);
      expect(pos).toBe(5);
    });

    it('should move to end of text for last line', () => {
      const pos = moveToLineEnd('hello', 2);
      expect(pos).toBe(5);
    });

    it('should handle multiline', () => {
      const pos = moveToLineEnd('line1\nline2\nline3', 7);
      expect(pos).toBe(11);
    });
  });

  describe('moveToPreviousWord', () => {
    it('should move to start of previous word', () => {
      const pos = moveToPreviousWord('hello world', 11);
      expect(pos).toBe(6);
    });

    it('should skip whitespace', () => {
      const pos = moveToPreviousWord('hello   world', 8);
      expect(pos).toBe(0);
    });

    it('should return 0 at beginning', () => {
      const pos = moveToPreviousWord('hello', 0);
      expect(pos).toBe(0);
    });
  });

  describe('moveToNextWord', () => {
    it('should move to start of next word', () => {
      const pos = moveToNextWord('hello world', 0);
      expect(pos).toBe(6);
    });

    it('should skip whitespace', () => {
      const pos = moveToNextWord('hello   world', 5);
      expect(pos).toBe(8);
    });

    it('should return length at end', () => {
      const pos = moveToNextWord('hello', 5);
      expect(pos).toBe(5);
    });
  });
});
