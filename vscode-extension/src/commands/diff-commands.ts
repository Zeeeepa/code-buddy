/**
 * Diff Commands
 * Provides commands for showing proposed changes in VS Code's diff editor
 * and applying/rejecting them.
 */

import * as vscode from 'vscode';

/**
 * Content provider for the 'codebuddy-proposed' virtual document scheme.
 * Serves proposed content so VS Code's diff editor can compare original vs proposed.
 */
export class ProposedContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  readonly onDidChange = this._onDidChange.event;

  private contents = new Map<string, string>();

  setContent(uri: vscode.Uri, content: string): void {
    this.contents.set(uri.toString(), content);
    this._onDidChange.fire(uri);
  }

  removeContent(uri: vscode.Uri): void {
    this.contents.delete(uri.toString());
  }

  clear(): void {
    this.contents.clear();
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contents.get(uri.toString()) || '';
  }
}

/**
 * Tracks a pending proposed change for a file so it can be applied later.
 */
interface ProposedChange {
  originalUri: vscode.Uri;
  proposedUri: vscode.Uri;
  newContent: string;
  title: string;
}

/**
 * Manages diff view commands: showing diffs, applying changes, rejecting changes.
 */
export class DiffCommandManager implements vscode.Disposable {
  private proposedContentProvider: ProposedContentProvider;
  private providerRegistration: vscode.Disposable;
  private pendingChanges = new Map<string, ProposedChange>();
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.proposedContentProvider = new ProposedContentProvider();
    this.providerRegistration = vscode.workspace.registerTextDocumentContentProvider(
      'codebuddy-proposed',
      this.proposedContentProvider
    );
  }

  /**
   * Show a diff between the original file and proposed content.
   * Opens VS Code's built-in diff editor.
   */
  async showDiff(originalUri: vscode.Uri, proposedContent: string, title?: string): Promise<void> {
    const proposedUri = vscode.Uri.parse(
      `codebuddy-proposed:${originalUri.path}?ts=${Date.now()}`
    );

    // Store the proposed content for the content provider
    this.proposedContentProvider.setContent(proposedUri, proposedContent);

    // Track the pending change so it can be applied later
    const diffTitle = title || `Code Buddy: ${vscode.workspace.asRelativePath(originalUri)}`;
    this.pendingChanges.set(originalUri.toString(), {
      originalUri,
      proposedUri,
      newContent: proposedContent,
      title: diffTitle,
    });

    // Set context so keybindings/menus can react
    await vscode.commands.executeCommand('setContext', 'codeBuddy.proposedDiffVisible', true);

    // Open VS Code's built-in diff editor
    await vscode.commands.executeCommand(
      'vscode.diff',
      originalUri,
      proposedUri,
      diffTitle
    );
  }

  /**
   * Apply proposed changes to the actual file.
   * If no URI is given, applies the most recent pending change.
   */
  async applyChanges(uri?: vscode.Uri): Promise<boolean> {
    const targetKey = uri?.toString() || this.getLastPendingKey();
    if (!targetKey) {
      vscode.window.showWarningMessage('Code Buddy: No proposed changes to apply.');
      return false;
    }

    const pending = this.pendingChanges.get(targetKey);
    if (!pending) {
      vscode.window.showWarningMessage('Code Buddy: No proposed changes found for this file.');
      return false;
    }

    try {
      const doc = await vscode.workspace.openTextDocument(pending.originalUri);
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        0, 0,
        doc.lineCount - 1,
        doc.lineAt(doc.lineCount - 1).text.length
      );
      edit.replace(pending.originalUri, fullRange, pending.newContent);
      const success = await vscode.workspace.applyEdit(edit);

      if (success) {
        vscode.window.showInformationMessage('Code Buddy: Changes applied successfully.');
        this.clearPending(targetKey, pending.proposedUri);
      } else {
        vscode.window.showErrorMessage('Code Buddy: Failed to apply changes.');
      }
      return success;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Code Buddy: Error applying changes: ${msg}`);
      return false;
    }
  }

  /**
   * Reject proposed changes (discard without applying).
   */
  async rejectChanges(uri?: vscode.Uri): Promise<void> {
    const targetKey = uri?.toString() || this.getLastPendingKey();
    if (!targetKey) {
      vscode.window.showInformationMessage('Code Buddy: No pending changes to reject.');
      return;
    }

    const pending = this.pendingChanges.get(targetKey);
    if (pending) {
      this.clearPending(targetKey, pending.proposedUri);
      vscode.window.showInformationMessage('Code Buddy: Proposed changes discarded.');
    }
  }

  /**
   * Check if there are pending proposed changes.
   */
  hasPendingChanges(): boolean {
    return this.pendingChanges.size > 0;
  }

  /**
   * Get the list of files with pending proposed changes.
   */
  getPendingFiles(): vscode.Uri[] {
    return Array.from(this.pendingChanges.values()).map(c => c.originalUri);
  }

  private getLastPendingKey(): string | undefined {
    const keys = Array.from(this.pendingChanges.keys());
    return keys.length > 0 ? keys[keys.length - 1] : undefined;
  }

  private clearPending(key: string, proposedUri: vscode.Uri): void {
    this.pendingChanges.delete(key);
    this.proposedContentProvider.removeContent(proposedUri);

    if (this.pendingChanges.size === 0) {
      vscode.commands.executeCommand('setContext', 'codeBuddy.proposedDiffVisible', false);
    }
  }

  dispose(): void {
    this.providerRegistration.dispose();
    this.proposedContentProvider.clear();
    this.pendingChanges.clear();
    for (const d of this.disposables) {
      d.dispose();
    }
    vscode.commands.executeCommand('setContext', 'codeBuddy.proposedDiffVisible', false);
  }
}
