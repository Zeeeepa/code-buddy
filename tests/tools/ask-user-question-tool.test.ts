/**
 * AskUserQuestion Tool Tests
 *
 * Verifies validation, non-TTY behavior (option B = explicit error),
 * single/multi-select parsing, and "Other" free-text fallback.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock readline.createInterface so we can drive rl.question() callbacks.
// Hoisted so the factory can reference it.
const { mockRlQuestion, mockRlClose } = vi.hoisted(() => ({
  mockRlQuestion: vi.fn(),
  mockRlClose: vi.fn(),
}));

vi.mock('readline', () => ({
  createInterface: vi.fn(() => ({
    question: mockRlQuestion,
    close: mockRlClose,
  })),
}));

import { executeAskUserQuestion } from '../../src/tools/ask-user-question-tool.js';

/**
 * Helper: queue a sequence of fake user answers. Each call to rl.question(prompt, cb)
 * pops the next answer from the queue and invokes cb with it on the next tick.
 */
function queueAnswers(...answers: string[]): void {
  let i = 0;
  mockRlQuestion.mockImplementation((_prompt: string, cb: (answer: string) => void) => {
    const answer = answers[i++] ?? '';
    setImmediate(() => cb(answer));
  });
}

describe('AskUserQuestion Tool', () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY;
    mockRlQuestion.mockReset();
    mockRlClose.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
      writable: true,
    });
  });

  /** Force TTY=true so executeAskUserQuestion enters readline mode */
  function setTTY(value: boolean) {
    Object.defineProperty(process.stdin, 'isTTY', {
      value,
      configurable: true,
      writable: true,
    });
  }

  describe('validation', () => {
    it('rejects when questions is missing', async () => {
      const result = await executeAskUserQuestion({} as never);
      expect(result.success).toBe(false);
      expect(result.error).toContain('questions must be an array');
    });

    it('rejects when questions is empty', async () => {
      const result = await executeAskUserQuestion({ questions: [] });
      expect(result.success).toBe(false);
      expect(result.error).toContain('1–4 items');
    });

    it('rejects when questions exceeds 4', async () => {
      const result = await executeAskUserQuestion({
        questions: Array.from({ length: 5 }, (_, i) => ({
          question: `Q${i}?`,
          header: `H${i}`,
          options: [
            { label: 'a', description: 'd1' },
            { label: 'b', description: 'd2' },
          ],
        })),
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('1–4');
    });

    it('rejects when header exceeds 12 chars', async () => {
      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'this-is-way-too-long',
            options: [
              { label: 'a', description: 'd1' },
              { label: 'b', description: 'd2' },
            ],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('≤12 chars');
    });

    it('rejects when options has fewer than 2 items', async () => {
      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'H',
            options: [{ label: 'only', description: 'd' }],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('2–4');
    });

    it('rejects when options has more than 4 items', async () => {
      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'H',
            options: Array.from({ length: 5 }, (_, i) => ({
              label: `o${i}`,
              description: 'd',
            })),
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('2–4');
    });

    it('rejects when option label is empty', async () => {
      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'H',
            options: [
              { label: '', description: 'd' },
              { label: 'b', description: 'd' },
            ],
          },
        ],
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('label');
    });
  });

  describe('non-TTY behavior (V4.3 Q2 option B)', () => {
    it('returns explicit error when stdin is not a TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
        writable: true,
      });

      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'H',
            options: [
              { label: 'a', description: 'd1' },
              { label: 'b', description: 'd2' },
            ],
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('interactive TTY');
      expect(result.error).toContain('best judgement');
    });

    it('does not block on readline in non-TTY (no hang)', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        configurable: true,
        writable: true,
      });
      const start = Date.now();
      await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'H',
            options: [
              { label: 'a', description: 'd1' },
              { label: 'b', description: 'd2' },
            ],
          },
        ],
      });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('interactive readline (TTY=true)', () => {
    it('returns the option label when user picks a valid number (single-select)', async () => {
      setTTY(true);
      queueAnswers('2');

      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'fruit',
            options: [
              { label: 'apple', description: 'red' },
              { label: 'banana', description: 'yellow' },
              { label: 'cherry', description: 'small' },
            ],
          },
        ],
      });

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output!);
      expect(parsed.fruit).toBe('banana');
      expect(mockRlClose).toHaveBeenCalled();
    });

    it('routes "Other" pick (last+1) to free-text follow-up prompt', async () => {
      setTTY(true);
      // First answer: pick "Other" (option index = options.length+1 = 3 here)
      // Second answer: free text
      queueAnswers('3', 'my custom answer');

      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'h',
            options: [
              { label: 'a', description: 'd1' },
              { label: 'b', description: 'd2' },
            ],
          },
        ],
      });

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output!);
      expect(parsed.h).toBe('my custom answer');
      // 1st call = main pick prompt, 2nd call = "Enter your answer:" free-text
      expect(mockRlQuestion).toHaveBeenCalledTimes(2);
      expect(mockRlQuestion.mock.calls[1]![0]).toContain('Enter your answer');
    });

    it('preserves free-text fallback when user types non-numeric input', async () => {
      setTTY(true);
      queueAnswers('skip this whole thing');

      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'h',
            options: [
              { label: 'a', description: 'd1' },
              { label: 'b', description: 'd2' },
            ],
          },
        ],
      });

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output!);
      expect(parsed.h).toBe('skip this whole thing');
    });

    it('multi-select expands comma-separated numbers to labels', async () => {
      setTTY(true);
      queueAnswers('1,3');

      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'multi',
            multiSelect: true,
            options: [
              { label: 'a', description: 'd1' },
              { label: 'b', description: 'd2' },
              { label: 'c', description: 'd3' },
            ],
          },
        ],
      });

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output!);
      expect(parsed.multi).toBe('a, c');
    });

    it('asks all questions in order and returns a header→answer map', async () => {
      setTTY(true);
      queueAnswers('1', '2');

      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'first?',
            header: 'q1',
            options: [
              { label: 'alpha', description: 'a' },
              { label: 'beta', description: 'b' },
            ],
          },
          {
            question: 'second?',
            header: 'q2',
            options: [
              { label: 'gamma', description: 'g' },
              { label: 'delta', description: 'd' },
            ],
          },
        ],
      });

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output!);
      expect(parsed.q1).toBe('alpha');
      expect(parsed.q2).toBe('delta');
      expect(mockRlQuestion).toHaveBeenCalledTimes(2);
    });

    it('renders option labels and descriptions in the prompt', async () => {
      setTTY(true);
      queueAnswers('1');

      await executeAskUserQuestion({
        questions: [
          {
            question: 'which color?',
            header: 'color',
            options: [
              { label: 'orange', description: 'warm color' },
              { label: 'blue', description: 'cool color' },
            ],
          },
        ],
      });

      const renderedPrompt = mockRlQuestion.mock.calls[0]![0];
      expect(renderedPrompt).toContain('which color?');
      expect(renderedPrompt).toContain('[color]');
      expect(renderedPrompt).toContain('orange');
      expect(renderedPrompt).toContain('warm color');
      expect(renderedPrompt).toContain('Other');
    });

    it('records "(no answer)" when user submits empty input', async () => {
      setTTY(true);
      queueAnswers('');

      const result = await executeAskUserQuestion({
        questions: [
          {
            question: 'pick?',
            header: 'h',
            options: [
              { label: 'a', description: 'd1' },
              { label: 'b', description: 'd2' },
            ],
          },
        ],
      });

      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.output!);
      expect(parsed.h).toBe('(no answer)');
    });
  });
});
