/**
 * Context Tree Provider
 * Shows files in AI context, recent AI edits, and conversation mentions in the sidebar
 * Grouped by category with icons
 */

import * as vscode from 'vscode';

type ContextCategory = 'context' | 'ai-edited' | 'mentioned';

export class ContextTreeProvider implements vscode.TreeDataProvider<ContextTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ContextTreeItem | undefined | void> =
    new vscode.EventEmitter<ContextTreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<ContextTreeItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private contextFiles: vscode.Uri[] = [];
  private aiEditedFiles: Map<string, { uri: vscode.Uri; timestamp: number }> = new Map();
  private mentionedFiles: Map<string, { uri: vscode.Uri; timestamp: number }> = new Map();

  /**
   * Add a file to context
   */
  addFile(uri: vscode.Uri): void {
    if (!this.contextFiles.find(f => f.toString() === uri.toString())) {
      this.contextFiles.push(uri);
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Remove a file from context
   */
  removeFile(uri: vscode.Uri): void {
    this.contextFiles = this.contextFiles.filter(f => f.toString() !== uri.toString());
    this._onDidChangeTreeData.fire();
  }

  /**
   * Clear all context files and tracked data
   */
  clear(): void {
    this.contextFiles = [];
    this.aiEditedFiles.clear();
    this.mentionedFiles.clear();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Track a file edited by AI
   */
  trackAIEdit(uri: vscode.Uri): void {
    this.aiEditedFiles.set(uri.toString(), { uri, timestamp: Date.now() });
    this._onDidChangeTreeData.fire();
  }

  /**
   * Track a file mentioned in conversation
   */
  trackMention(uri: vscode.Uri): void {
    this.mentionedFiles.set(uri.toString(), { uri, timestamp: Date.now() });
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get all context files
   */
  getFiles(): vscode.Uri[] {
    return [...this.contextFiles];
  }

  /**
   * Get context as text for AI
   */
  async getContextText(): Promise<string> {
    const contents: string[] = [];

    for (const uri of this.contextFiles) {
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const relativePath = vscode.workspace.asRelativePath(uri);
        contents.push(`--- ${relativePath} ---\n\`\`\`${doc.languageId}\n${doc.getText()}\n\`\`\`\n`);
      } catch {
        // Skip files that can't be read
      }
    }

    return contents.join('\n');
  }

  getTreeItem(element: ContextTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ContextTreeItem): Thenable<ContextTreeItem[]> {
    // Root level: show category groups
    if (!element) {
      const groups: ContextTreeItem[] = [];

      // Context files group
      if (this.contextFiles.length > 0) {
        groups.push(new ContextTreeItem(
          `Context Files (${this.contextFiles.length})`,
          vscode.Uri.parse('group:context'),
          'group',
          vscode.TreeItemCollapsibleState.Expanded,
          'context'
        ));
      }

      // AI-edited files group
      if (this.aiEditedFiles.size > 0) {
        groups.push(new ContextTreeItem(
          `AI Edited (${this.aiEditedFiles.size})`,
          vscode.Uri.parse('group:ai-edited'),
          'group',
          vscode.TreeItemCollapsibleState.Expanded,
          'ai-edited'
        ));
      }

      // Mentioned files group
      if (this.mentionedFiles.size > 0) {
        groups.push(new ContextTreeItem(
          `Mentioned (${this.mentionedFiles.size})`,
          vscode.Uri.parse('group:mentioned'),
          'group',
          vscode.TreeItemCollapsibleState.Expanded,
          'mentioned'
        ));
      }

      if (groups.length === 0) {
        return Promise.resolve([
          new ContextTreeItem(
            'No files in context',
            vscode.Uri.parse('empty:'),
            'empty',
            vscode.TreeItemCollapsibleState.None
          ),
        ]);
      }

      return Promise.resolve(groups);
    }

    // Children of a category group
    if (element.type === 'group') {
      switch (element.category) {
        case 'context':
          return Promise.resolve(
            this.contextFiles.map(uri =>
              new ContextTreeItem(
                vscode.workspace.asRelativePath(uri),
                uri,
                'file',
                vscode.TreeItemCollapsibleState.None,
                'context'
              )
            )
          );

        case 'ai-edited':
          return Promise.resolve(
            Array.from(this.aiEditedFiles.values())
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(({ uri, timestamp }) => {
                const item = new ContextTreeItem(
                  vscode.workspace.asRelativePath(uri),
                  uri,
                  'file',
                  vscode.TreeItemCollapsibleState.None,
                  'ai-edited'
                );
                item.description = this.formatTimestamp(timestamp);
                return item;
              })
          );

        case 'mentioned':
          return Promise.resolve(
            Array.from(this.mentionedFiles.values())
              .sort((a, b) => b.timestamp - a.timestamp)
              .map(({ uri, timestamp }) => {
                const item = new ContextTreeItem(
                  vscode.workspace.asRelativePath(uri),
                  uri,
                  'file',
                  vscode.TreeItemCollapsibleState.None,
                  'mentioned'
                );
                item.description = this.formatTimestamp(timestamp);
                return item;
              })
          );

        default:
          return Promise.resolve([]);
      }
    }

    return Promise.resolve([]);
  }

  private formatTimestamp(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }
}

class ContextTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly fileUri: vscode.Uri,
    public readonly type: 'file' | 'empty' | 'group',
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly category?: ContextCategory
  ) {
    super(label, collapsibleState);

    if (type === 'file') {
      this.tooltip = fileUri.fsPath;
      this.resourceUri = fileUri;
      this.command = {
        command: 'vscode.open',
        title: 'Open File',
        arguments: [fileUri],
      };
      this.contextValue = 'contextFile';

      // Set icon based on category
      switch (category) {
        case 'context':
          this.iconPath = new vscode.ThemeIcon('file-code', new vscode.ThemeColor('charts.blue'));
          break;
        case 'ai-edited':
          this.iconPath = new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.green'));
          break;
        case 'mentioned':
          this.iconPath = new vscode.ThemeIcon('mention', new vscode.ThemeColor('charts.yellow'));
          break;
        default:
          this.iconPath = new vscode.ThemeIcon('file');
      }
    } else if (type === 'group') {
      // Set group icons
      switch (category) {
        case 'context':
          this.iconPath = new vscode.ThemeIcon('folder-library', new vscode.ThemeColor('charts.blue'));
          break;
        case 'ai-edited':
          this.iconPath = new vscode.ThemeIcon('sparkle', new vscode.ThemeColor('charts.green'));
          break;
        case 'mentioned':
          this.iconPath = new vscode.ThemeIcon('comment-discussion', new vscode.ThemeColor('charts.yellow'));
          break;
      }
    } else {
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}
