/**
 * Inline Completion Handler
 *
 * Implements the `textDocument/inlineCompletion` LSP method (LSP 3.18+).
 * This is separate from regular completions — it powers the grey "ghost text"
 * that appears inline in the editor, accepted with Tab.
 *
 * VS Code, Neovim (with plugins), and other modern editors use this for
 * Copilot-style tab-to-accept completions.
 */

import type { Connection } from 'vscode-languageserver/node';
import type { TextDocuments } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { AICompletionProvider } from './ai-completion-provider.js';
import type { CancellationToken } from './ai-completion-provider.js';
import { gatherCompletionContext } from './context-gatherer.js';
import { logger } from '../utils/logger.js';

// ---------------------------------------------------------------------------
// Types (matching LSP 3.18 InlineCompletion proposal)
// ---------------------------------------------------------------------------

/**
 * A position in a text document (0-based line and character).
 */
export interface InlinePosition {
  line: number;
  character: number;
}

/**
 * A range in a text document.
 */
export interface InlineRange {
  start: InlinePosition;
  end: InlinePosition;
}

/**
 * Request parameters for textDocument/inlineCompletion.
 */
export interface InlineCompletionParams {
  /** The text document. */
  textDocument: { uri: string };
  /** The position inside the text document. */
  position: InlinePosition;
  /** Additional context. */
  context?: {
    /** How the inline completion was triggered. */
    triggerKind: InlineCompletionTriggerKind;
    /** Selected completion from the completion list (if applicable). */
    selectedCompletionInfo?: {
      range: InlineRange;
      text: string;
    };
  };
}

/**
 * How an inline completion was triggered.
 */
export enum InlineCompletionTriggerKind {
  /** Completion was triggered explicitly (Ctrl+Space or similar). */
  Invoked = 0,
  /** Completion was triggered automatically while typing. */
  Automatic = 1,
}

/**
 * An inline completion item.
 */
export interface InlineCompletionItem {
  /** The text to insert. Can be multi-line. */
  insertText: string;
  /**
   * The range to replace. If not provided, the text is inserted at the cursor.
   * When provided, the range must be a single-line range within the current line
   * that contains the position at which the item was requested.
   */
  range?: InlineRange;
  /**
   * An optional command that is executed after inserting this completion.
   */
  command?: {
    title: string;
    command: string;
    arguments?: unknown[];
  };
  /**
   * The filter text to use when determining if this inline completion should
   * be shown. Defaults to the insertText.
   */
  filterText?: string;
}

/**
 * The result of an inline completion request.
 */
export interface InlineCompletionList {
  items: InlineCompletionItem[];
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

/**
 * Register the textDocument/inlineCompletion handler on the LSP connection.
 *
 * This is a custom request handler since the inline completion proposal
 * is not yet part of all LSP client libraries' built-in types.
 *
 * @param connection The LSP connection
 * @param documents  The text document manager
 * @param aiProvider The AI completion provider instance
 */
export function registerInlineCompletionHandler(
  connection: Connection,
  documents: TextDocuments<TextDocument>,
  aiProvider: AICompletionProvider,
): void {
  connection.onRequest(
    'textDocument/inlineCompletion',
    async (
      params: InlineCompletionParams,
      token: CancellationToken,
    ): Promise<InlineCompletionList> => {
      const emptyResult: InlineCompletionList = { items: [] };

      if (!aiProvider.getConfig().enabled) {
        return emptyResult;
      }

      const document = documents.get(params.textDocument.uri);
      if (!document) {
        return emptyResult;
      }

      const text = document.getText();
      const { line, character } = params.position;

      // Gather structured context using the existing context-gatherer
      const ctx = gatherCompletionContext(text, params.textDocument.uri, line, character);

      // Skip if the cursor is in a comment or prefix is trivial
      if (ctx.prefix.trim().length < 2) {
        return emptyResult;
      }

      try {
        const completionItems = await aiProvider.provideCompletions(
          params.textDocument.uri,
          { line, character },
          {
            prefix: ctx.prefix,
            suffix: ctx.suffix,
            language: ctx.language,
            filePath: ctx.filePath,
            linesBefore: ctx.linesBefore,
            linesAfter: ctx.linesAfter,
          },
          token,
        );

        if (completionItems.length === 0) {
          return emptyResult;
        }

        // Convert CompletionItem[] → InlineCompletionItem[]
        const inlineItems: InlineCompletionItem[] = completionItems.map(
          (item) => {
            // Extract raw text (strip snippet escaping if present)
            let insertText =
              typeof item.insertText === 'string'
                ? item.insertText
                : item.label;

            // Remove snippet tab stop markers ($0, ${1:placeholder}, etc.)
            insertText = insertText
              .replace(/\$\{?\d+(?::[^}]*)?\}?/g, '')
              .replace(/\\\$/g, '$')
              .replace(/\\\}/g, '}');

            return {
              insertText,
              // Range covers from cursor to end of line (replaces nothing, just inserts)
              range: {
                start: { line, character },
                end: { line, character },
              },
            };
          },
        );

        return { items: inlineItems };
      } catch (error) {
        logger.error(`Inline completion error: ${error}`);
        return emptyResult;
      }
    },
  );

  logger.info('Inline completion handler registered (textDocument/inlineCompletion)');
}
