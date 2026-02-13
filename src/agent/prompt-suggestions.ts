/**
 * Prompt Suggestion Engine
 *
 * Generates follow-up prompt suggestions based on conversation context.
 * Suggestions help users continue productive conversations by offering
 * relevant next steps.
 *
 * @module agent/prompt-suggestions
 */

import { logger } from '../utils/logger.js';

/**
 * Engine for generating follow-up prompt suggestions based on
 * conversation context and the last assistant response.
 */
export class PromptSuggestionEngine {
  private enabled: boolean;
  private cachedSuggestions: string[];

  constructor(enabled = true) {
    this.enabled = enabled;
    this.cachedSuggestions = [];
  }

  /**
   * Check if suggestions are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable suggestion generation
   */
  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) {
      this.cachedSuggestions = [];
    }
    logger.info(`Prompt suggestions ${value ? 'enabled' : 'disabled'}`);
  }

  /**
   * Generate 2-3 follow-up suggestions based on context and last response.
   *
   * Currently returns the formatted prompt string that would be sent to an LLM.
   * The actual LLM call is stubbed for now - integrate with CodeBuddyClient
   * when ready.
   *
   * @param context - The conversation context or user's last message
   * @param lastResponse - The assistant's last response
   * @returns Array of suggestion strings
   */
  async generateSuggestions(context: string, lastResponse: string): Promise<string[]> {
    if (!this.enabled) {
      this.cachedSuggestions = [];
      return [];
    }

    if (!context && !lastResponse) {
      this.cachedSuggestions = [];
      return [];
    }

    // Build the prompt that would be sent to the LLM
    const prompt = this.buildSuggestionPrompt(context, lastResponse);

    // Stub: parse suggestions from the prompt structure
    // In production, this would call the LLM and parse the response
    const suggestions = this.parseStubSuggestions(context, lastResponse);

    this.cachedSuggestions = suggestions;
    logger.debug(`Generated ${suggestions.length} prompt suggestions`);

    return suggestions;
  }

  /**
   * Get the cached suggestions from the last generateSuggestions call
   */
  getSuggestions(): string[] {
    return [...this.cachedSuggestions];
  }

  /**
   * Clear cached suggestions
   */
  clearSuggestions(): void {
    this.cachedSuggestions = [];
  }

  /**
   * Build the prompt for suggestion generation
   */
  private buildSuggestionPrompt(context: string, lastResponse: string): string {
    return [
      'Based on the following conversation, suggest 2-3 short follow-up questions or actions the user might want to take next.',
      '',
      'User context:',
      context,
      '',
      'Assistant response:',
      lastResponse,
      '',
      'Provide 2-3 brief, actionable follow-up suggestions (one per line, no numbering):',
    ].join('\n');
  }

  /**
   * Stub implementation that generates suggestions based on keywords.
   * Replace with actual LLM call in production.
   */
  private parseStubSuggestions(context: string, lastResponse: string): string[] {
    const combined = `${context} ${lastResponse}`.toLowerCase();
    const suggestions: string[] = [];

    if (combined.includes('test')) {
      suggestions.push('Run the test suite to verify changes');
    }
    if (combined.includes('error') || combined.includes('bug') || combined.includes('fix')) {
      suggestions.push('Show me the full error stack trace');
    }
    if (combined.includes('file') || combined.includes('code')) {
      suggestions.push('Review the related files for potential issues');
    }
    if (combined.includes('refactor')) {
      suggestions.push('Extract this into a separate function');
    }
    if (combined.includes('deploy') || combined.includes('build')) {
      suggestions.push('Check the build output for warnings');
    }

    // Always return at least 2 suggestions
    if (suggestions.length < 2) {
      suggestions.push('Tell me more about this');
      suggestions.push('What are the next steps?');
    }

    return suggestions.slice(0, 3);
  }
}
