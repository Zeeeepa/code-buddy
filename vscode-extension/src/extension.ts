import * as vscode from 'vscode';
import OpenAI from 'openai';
import { DiffCommandManager } from './commands/diff-commands';
import { StatusBarManager } from './status-bar-manager';
import { ContextTreeProvider } from './providers/context-tree-provider';

let client: OpenAI | null = null;
let statusBarManager: StatusBarManager;
let diffCommandManager: DiffCommandManager;
let contextTreeProvider: ContextTreeProvider;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('Code Buddy');
  statusBarManager = new StatusBarManager();
  diffCommandManager = new DiffCommandManager();
  contextTreeProvider = new ContextTreeProvider();

  // Register context tree view
  const contextTreeView = vscode.window.createTreeView('codeBuddy.context', {
    treeDataProvider: contextTreeProvider,
    showCollapseAll: true,
  });

  // Auto-track files opened alongside AI interactions
  const onDocOpen = vscode.workspace.onDidOpenTextDocument(doc => {
    if (doc.uri.scheme === 'file') {
      contextTreeProvider.trackMention(doc.uri);
    }
  });

  initializeClient();

  // Register existing commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeBuddy.start', startCodeBuddy),
    vscode.commands.registerCommand('codeBuddy.askQuestion', askQuestion),
    vscode.commands.registerCommand('codeBuddy.explainCode', explainCode),
    vscode.commands.registerCommand('codeBuddy.refactorCode', refactorCode),
    vscode.commands.registerCommand('codeBuddy.generateTests', generateTests),
    vscode.commands.registerCommand('codeBuddy.fixError', fixError),
    vscode.commands.registerCommand('codeBuddy.commitChanges', generateCommitMessage),

    // New commands: diff view
    vscode.commands.registerCommand('codeBuddy.showDiff', async (originalUri?: vscode.Uri, proposedContent?: string, title?: string) => {
      if (!originalUri || !proposedContent) {
        // If called without arguments, show a file picker for demonstration
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showWarningMessage('Code Buddy: Open a file first.');
          return;
        }
        vscode.window.showInformationMessage('Code Buddy: Use this command programmatically with (uri, content, title) arguments.');
        return;
      }
      await diffCommandManager.showDiff(originalUri, proposedContent, title);
    }),

    vscode.commands.registerCommand('codeBuddy.applyChanges', async (uri?: vscode.Uri) => {
      await diffCommandManager.applyChanges(uri);
    }),

    vscode.commands.registerCommand('codeBuddy.rejectChanges', async (uri?: vscode.Uri) => {
      await diffCommandManager.rejectChanges(uri);
    }),

    // New command: switch model
    vscode.commands.registerCommand('codeBuddy.switchModel', async () => {
      const newModel = await statusBarManager.showModelPicker();
      if (newModel) {
        // Reinitialize client with new model config
        initializeClient();
      }
    }),

    // Context tree commands
    vscode.commands.registerCommand('codeBuddy.contextRefresh', () => {
      contextTreeProvider.refresh();
    }),

    vscode.commands.registerCommand('codeBuddy.contextClear', () => {
      contextTreeProvider.clear();
      vscode.window.showInformationMessage('Code Buddy: Context cleared.');
    }),

    vscode.commands.registerCommand('codeBuddy.contextRemoveFile', (item: { fileUri?: vscode.Uri }) => {
      if (item?.fileUri) {
        contextTreeProvider.removeFile(item.fileUri);
      }
    }),

    // Disposables
    contextTreeView,
    onDocOpen,
    statusBarManager,
    diffCommandManager,
    outputChannel
  );
}

function getConfiguredModel(): string {
  return vscode.workspace.getConfiguration('codeBuddy').get<string>('model') || 'grok-3-latest';
}

function initializeClient() {
  const apiKey = vscode.workspace.getConfiguration('codeBuddy').get<string>('apiKey');
  if (apiKey) {
    client = new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' });
    statusBarManager.setConnectionStatus('connected');
  } else {
    statusBarManager.setConnectionStatus('disconnected');
  }
}

async function ensureClient(): Promise<OpenAI> {
  if (!client) {
    const apiKey = await vscode.window.showInputBox({ prompt: 'Enter Grok API key', password: true });
    if (!apiKey) throw new Error('API key required');
    await vscode.workspace.getConfiguration('codeBuddy').update('apiKey', apiKey, true);
    initializeClient();
  }
  return client!;
}

async function startCodeBuddy() {
  const terminal = vscode.window.createTerminal({ name: 'Code Buddy', shellPath: 'npx', shellArgs: ['@phuetz/code-buddy'] });
  terminal.show();
}

async function askQuestion() {
  const openai = await ensureClient();
  const question = await vscode.window.showInputBox({ prompt: 'Ask Code Buddy' });
  if (!question) return;

  statusBarManager.setLoading('Thinking...');
  try {
    const response = await openai.chat.completions.create({
      model: getConfiguredModel(),
      messages: [{ role: 'user', content: question }],
    });
    const answer = response.choices[0]?.message?.content || 'No response';
    outputChannel.appendLine('Q: ' + question + '\nA: ' + answer + '\n');
    outputChannel.show();
  } finally {
    statusBarManager.clearLoading();
  }
}

async function explainCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const code = editor.document.getText(editor.selection);
  if (!code) return;

  const openai = await ensureClient();
  statusBarManager.setLoading('Explaining...');
  try {
    const response = await openai.chat.completions.create({
      model: getConfiguredModel(),
      messages: [{ role: 'system', content: 'Explain this code clearly.' }, { role: 'user', content: code }],
    });
    outputChannel.appendLine('Explanation:\n' + (response.choices[0]?.message?.content || '') + '\n');
    outputChannel.show();
  } finally {
    statusBarManager.clearLoading();
  }
}

async function refactorCode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const selection = editor.selection;
  const code = editor.document.getText(selection);
  if (!code) return;

  const instruction = await vscode.window.showInputBox({ prompt: 'How to refactor?' });
  if (!instruction) return;

  const openai = await ensureClient();
  statusBarManager.setLoading('Refactoring...');
  try {
    const response = await openai.chat.completions.create({
      model: getConfiguredModel(),
      messages: [{ role: 'system', content: 'Refactor code. Return only code.' }, { role: 'user', content: instruction + '\n' + code }],
    });
    const refactored = response.choices[0]?.message?.content || code;

    // Show diff instead of directly replacing
    await diffCommandManager.showDiff(
      editor.document.uri,
      editor.document.getText().replace(code, refactored),
      `Code Buddy: Refactor - ${vscode.workspace.asRelativePath(editor.document.uri)}`
    );
  } finally {
    statusBarManager.clearLoading();
  }
}

async function generateTests() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;
  const code = editor.document.getText(editor.selection);
  if (!code) return;

  const openai = await ensureClient();
  statusBarManager.setLoading('Generating tests...');
  try {
    const response = await openai.chat.completions.create({
      model: getConfiguredModel(),
      messages: [{ role: 'system', content: 'Generate unit tests using Jest.' }, { role: 'user', content: code }],
    });
    const content = response.choices[0]?.message?.content || '';
    const doc = await vscode.workspace.openTextDocument({ content, language: 'typescript' });
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
  } finally {
    statusBarManager.clearLoading();
  }
}

async function fixError() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
  const cursorPos = editor.selection.active;
  const errors = diagnostics.filter(d => d.range.contains(cursorPos));
  if (!errors.length) { vscode.window.showInformationMessage('No errors at cursor'); return; }

  const errorMsgs = errors.map(e => e.message).join('; ');
  const originalContent = editor.document.getText();
  const openai = await ensureClient();
  statusBarManager.setLoading('Fixing...');
  try {
    const response = await openai.chat.completions.create({
      model: getConfiguredModel(),
      messages: [{ role: 'system', content: 'Fix the error. Return the complete fixed file.' },
                 { role: 'user', content: 'Errors: ' + errorMsgs + '\nCode:\n' + originalContent }],
    });
    const fixedContent = response.choices[0]?.message?.content || '';

    if (fixedContent) {
      // Show diff for the fix so user can review before applying
      await diffCommandManager.showDiff(
        editor.document.uri,
        fixedContent,
        `Code Buddy: Fix Error - ${vscode.workspace.asRelativePath(editor.document.uri)}`
      );
    } else {
      outputChannel.appendLine('Fix suggestion: No response received.\n');
      outputChannel.show();
    }
  } finally {
    statusBarManager.clearLoading();
  }
}

async function generateCommitMessage() {
  const gitExt = vscode.extensions.getExtension('vscode.git');
  if (!gitExt) { vscode.window.showErrorMessage('Git extension not found'); return; }
  const api = gitExt.exports.getAPI(1);
  const repo = api.repositories[0];
  if (!repo) { vscode.window.showErrorMessage('No git repo found'); return; }

  const diff = await repo.diff(true);
  if (!diff) { vscode.window.showInformationMessage('No staged changes'); return; }

  const openai = await ensureClient();
  statusBarManager.setLoading('Generating...');
  try {
    const response = await openai.chat.completions.create({
      model: getConfiguredModel(),
      messages: [{ role: 'system', content: 'Generate conventional commit message.' }, { role: 'user', content: diff }],
      max_tokens: 200,
    });
    repo.inputBox.value = response.choices[0]?.message?.content || '';
    vscode.window.showInformationMessage('Commit message generated');
  } finally {
    statusBarManager.clearLoading();
  }
}

export function deactivate() {
  // All disposables are cleaned up via context.subscriptions
}
