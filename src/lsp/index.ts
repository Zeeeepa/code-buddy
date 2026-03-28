/**
 * LSP module - Language Server Protocol implementation
 */

export * from './server.js';
export {
  LSPClient,
  getLSPClient,
  resetLSPClient,
  LSP_CHECK_TOOL,
  LSP_GOTO_DEF_TOOL,
  LSP_FIND_REFS_TOOL,
} from './lsp-client.js';
export type {
  LSPLanguage,
  LSPLocation,
  LSPSymbol,
  LSPDiagnostic,
  LSPHoverInfo,
  LSPServerConfig,
  LSPOperation,
  LSPRange,
  LSPTextEdit,
  LSPWorkspaceEdit,
  LSPPrepareRenameResult,
  LSPCodeAction,
} from './lsp-client.js';
export { CompletionCache } from './completion-cache.js';
export { gatherCompletionContext } from './context-gatherer.js';
export type { CompletionContext, TriggerKind } from './context-gatherer.js';
export { AICompletionProvider, DEFAULT_AI_COMPLETION_CONFIG } from './ai-completion-provider.js';
export type {
  AICompletionConfig,
  AICompletionContext,
  CancellationToken,
} from './ai-completion-provider.js';
export { registerInlineCompletionHandler } from './inline-completion-handler.js';
export type {
  InlineCompletionItem,
  InlineCompletionList,
  InlineCompletionParams,
  InlineCompletionTriggerKind,
} from './inline-completion-handler.js';
