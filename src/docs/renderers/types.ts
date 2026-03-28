/**
 * Shared types for docs renderers.
 * Extracted to break circular dependencies between
 * multi-format-renderer, html-theme, and wiki-generator.
 */

export type OutputFormat = 'markdown' | 'html' | 'json' | 'wiki';

export interface RenderInput {
  moduleId: string;
  title: string;
  markdown: string;
  members: string[];
  cohesion: number;
  filePaths: string[];
  generatedAt?: string;
}

export interface RenderOutput {
  format: OutputFormat;
  content: string;
  filename: string;
  sizeBytes: number;
}

/**
 * Create a URL-safe slug from an identifier.
 */
export function slug(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
