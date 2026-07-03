import * as vscode from 'vscode';
import { HymdEditorProvider } from './editorProvider.js';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      HymdEditorProvider.viewType,
      new HymdEditorProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('hymd.openWysiwyg', async () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      if (!uri) {
        void vscode.window.showWarningMessage('请先打开一个 Markdown 文件');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', uri, HymdEditorProvider.viewType);
    }),
  );
}

export function deactivate(): void {}
