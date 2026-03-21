/**
 * Unit tests for Transform Handler
 */

import { describe, it, expect } from 'vitest';
import { handleTransform, buildTransformPrompt } from '../../src/commands/handlers/transform-handler';

describe('Transform Handler', () => {
  it('should show usage when no args provided', async () => {
    const result = await handleTransform([]);

    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Usage: /transform');
    expect(result.entry?.content).toContain('modernize');
    expect(result.entry?.content).toContain('typescript');
    expect(result.entry?.content).toContain('async');
    expect(result.entry?.content).toContain('functional');
    expect(result.entry?.content).toContain('es-modules');
  });

  it('should reject unknown transformation type', async () => {
    const result = await handleTransform(['unknown-type', 'src/file.ts']);

    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Unknown transformation type');
    expect(result.entry?.content).toContain('unknown-type');
  });

  it('should require a file path', async () => {
    const result = await handleTransform(['modernize']);

    expect(result.handled).toBe(true);
    expect(result.entry?.content).toContain('Please specify a file or directory');
  });

  it('should pass to AI with correct prompt for valid transform', async () => {
    const result = await handleTransform(['modernize', 'src/utils/index.ts']);

    expect(result.handled).toBe(true);
    expect(result.passToAI).toBe(true);
    expect(result.prompt).toContain('src/utils/index.ts');
    expect(result.prompt).toContain('modernize');
  });

  it('should build correct prompt for es-modules transformation', () => {
    const prompt = buildTransformPrompt('es-modules', 'src/legacy.js');

    expect(prompt).toContain('src/legacy.js');
    expect(prompt).toContain('require()');
    expect(prompt).toContain('import');
    expect(prompt).toContain('module.exports');
    expect(prompt).toContain('str_replace_editor');
  });

  it('should build correct prompt for typescript conversion', () => {
    const prompt = buildTransformPrompt('typescript', 'src/utils.js');

    expect(prompt).toContain('src/utils.js');
    expect(prompt).toContain('TypeScript');
    expect(prompt).toContain('type annotations');
    expect(prompt).toContain('.js to .ts');
  });
});
