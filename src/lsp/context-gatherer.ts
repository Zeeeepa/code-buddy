/**
 * Completion Context Gatherer
 *
 * Gathers surrounding code context for tab-completion requests.
 * Determines trigger kind (import, block, expression, parameter, etc.)
 * and extracts prefix/suffix/surrounding lines for the completion engine.
 *
 * Lightweight — no AST parsing, only string inspection.
 */

import * as path from 'path';

export type TriggerKind =
  | 'statement'
  | 'expression'
  | 'block'
  | 'parameter'
  | 'import'
  | 'comment'
  | 'unknown';

export interface CompletionContext {
  /** Detected programming language */
  language: string;
  /** Text before cursor on the current line */
  prefix: string;
  /** Text after cursor on the current line */
  suffix: string;
  /** Up to 15 lines before the cursor line */
  linesBefore: string[];
  /** Up to 5 lines after the cursor line */
  linesAfter: string[];
  /** Detected trigger kind based on surrounding code */
  triggerKind: TriggerKind;
  /** Absolute or relative file path */
  filePath: string;
  /** 0-based line number */
  line: number;
  /** 0-based character offset within the line */
  character: number;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.md': 'markdown',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.sql': 'sql',
  '.lua': 'lua',
  '.zig': 'zig',
  '.ex': 'elixir',
  '.exs': 'elixir',
};

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE[ext] || 'unknown';
}

// ---------------------------------------------------------------------------
// Trigger kind detection
// ---------------------------------------------------------------------------

function detectTriggerKind(currentLine: string, prefix: string): TriggerKind {
  const trimmed = currentLine.trimStart();

  // Comment detection (single-line)
  if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
    return 'comment';
  }

  // Import detection
  if (/^(import|from|require)\b/.test(trimmed)) {
    return 'import';
  }

  // Block detection — line ends with { or ) before the cursor
  const trimmedPrefix = prefix.trimEnd();
  if (trimmedPrefix.endsWith('{') || trimmedPrefix.endsWith(')')) {
    return 'block';
  }

  // Parameter detection — cursor is between unmatched parentheses
  let depth = 0;
  for (let i = prefix.length - 1; i >= 0; i--) {
    if (prefix[i] === ')') depth++;
    if (prefix[i] === '(') {
      if (depth === 0) return 'parameter';
      depth--;
    }
  }

  // Expression detection — prefix ends with = : return (possibly with whitespace)
  if (/(?:=|:|return)\s*$/.test(trimmedPrefix)) {
    return 'expression';
  }

  // If the line has content it is likely a statement
  if (trimmed.length > 0) {
    return 'statement';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Gather completion context from a document at a given cursor position.
 *
 * @param documentText Full document text
 * @param filePath     Path of the file being edited
 * @param line         0-based line index
 * @param character    0-based character offset within the line
 */
export function gatherCompletionContext(
  documentText: string,
  filePath: string,
  line: number,
  character: number,
): CompletionContext {
  const lines = documentText.split('\n');

  // Clamp line to valid range
  const clampedLine = Math.max(0, Math.min(line, lines.length - 1));

  const currentLine = lines[clampedLine] ?? '';
  const clampedChar = Math.max(0, Math.min(character, currentLine.length));

  const prefix = currentLine.slice(0, clampedChar);
  const suffix = currentLine.slice(clampedChar);

  // Surrounding lines (15 before, 5 after)
  const linesBefore = lines.slice(Math.max(0, clampedLine - 15), clampedLine);
  const linesAfter = lines.slice(clampedLine + 1, clampedLine + 6);

  const language = detectLanguage(filePath);
  const triggerKind = detectTriggerKind(currentLine, prefix);

  return {
    language,
    prefix,
    suffix,
    linesBefore,
    linesAfter,
    triggerKind,
    filePath,
    line: clampedLine,
    character: clampedChar,
  };
}
