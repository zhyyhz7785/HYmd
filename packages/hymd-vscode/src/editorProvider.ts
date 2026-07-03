import * as vscode from 'vscode';
import { parseHymd } from '@hymd/parser';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol.js';
import {
  DocumentSyncState,
  fullDocumentReplaceRange,
  normalizeMarkdown,
} from './sync/documentSync.js';

const DEBOUNCE_MS = 220;

function resolveTheme(): HostToWebviewMessage['theme'] {
  const kind = vscode.window.activeColorTheme.kind;
  if (kind === vscode.ColorThemeKind.Dark) return 'dark';
  if (kind === vscode.ColorThemeKind.HighContrast) return 'high-contrast';
  return 'light';
}

export class HymdEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'hymd.editor';

  constructor(private readonly context: vscode.ExtensionContext) {}

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const syncState = new DocumentSyncState(document.getText());
    let webviewReady = false;
    let editVersion = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media'),
      ],
    };

    webviewPanel.webview.html = this.getWebviewHtml(webviewPanel.webview);

    const postToWebview = (msg: HostToWebviewMessage) => {
      webviewPanel.webview.postMessage(msg);
    };

    const pushInit = () => {
      postToWebview({
        type: 'init',
        content: document.getText(),
        theme: resolveTheme(),
      });
    };

    const applyWebviewEdit = async (content: string, version: number) => {
      const normalized = normalizeMarkdown(content);
      if (normalized === normalizeMarkdown(document.getText())) {
        syncState.onHostApplied(version);
        return;
      }

      const edit = new vscode.WorkspaceEdit();
      const range = fullDocumentReplaceRange(document.lineCount);
      edit.replace(document.uri, new vscode.Range(range.start, range.end), normalized);

      const ok = await vscode.workspace.applyEdit(edit);
      if (ok) {
        syncState.onHostApplied(version);
        await document.save();
      }
    };

    webviewPanel.webview.onDidReceiveMessage(async (raw: WebviewToHostMessage) => {
      switch (raw.type) {
        case 'ready':
          webviewReady = true;
          pushInit();
          break;
        case 'edit':
          if (!syncState.onWebviewEdit(raw.content, raw.version)) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            void applyWebviewEdit(raw.content, raw.version);
          }, DEBOUNCE_MS);
          break;
        case 'log':
          console.log('[hymd-webview]', raw.message);
          break;
      }
    });

    const docChangeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return;
      if (!webviewReady) return;

      const content = document.getText();
      if (!syncState.shouldApplyExternal(content, ++editVersion)) return;

      postToWebview({
        type: 'externalUpdate',
        content,
        version: editVersion,
      });
    });

    const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
      postToWebview({ type: 'themeChanged', theme: resolveTheme() });
    });

    webviewPanel.onDidDispose(() => {
      docChangeSub.dispose();
      themeSub.dispose();
      if (debounceTimer) clearTimeout(debounceTimer);
    });
  }

  private getWebviewHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media', 'webview.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media', 'editor.css'),
    );
    const blockCardsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media', 'block-cards.css'),
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <link rel="stylesheet" href="${blockCardsUri}" />
</head>
<body data-theme="light">
  <div id="editor-root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let n = '';
  for (let i = 0; i < 32; i++) n += chars.charAt(Math.floor(Math.random() * chars.length));
  return n;
}

/** 供测试/工具：解析 HyMD 块列表 */
export function listHymdBlocks(markdown: string) {
  return parseHymd(markdown).blocks;
}
