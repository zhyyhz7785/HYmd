import * as vscode from 'vscode';
import type { LayoutHostToWebviewMessage, LayoutWebviewToHostMessage } from './protocol.js';

const DEBOUNCE_MS = 300;

interface PreviewEntry {
  panel: vscode.WebviewPanel;
  ready: boolean;
  debounce?: ReturnType<typeof setTimeout>;
}

export class LayoutPreviewManager {
  private readonly panels = new Map<string, PreviewEntry>();
  private statusBar: vscode.StatusBarItem | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  register(context: vscode.ExtensionContext): void {
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    this.statusBar.name = 'HyMD Layout Geometry';
    context.subscriptions.push(this.statusBar);

    context.subscriptions.push(
      vscode.commands.registerCommand('hymd.openLayoutPreview', () => {
        const uri = vscode.window.activeTextEditor?.document.uri;
        if (!uri) {
          void vscode.window.showWarningMessage('请先打开一个 HyMD / Markdown 文件');
          return;
        }
        this.open(uri);
      }),
    );

    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        const key = e.document.uri.toString();
        const entry = this.panels.get(key);
        if (!entry?.ready) return;
        if (entry.debounce) clearTimeout(entry.debounce);
        entry.debounce = setTimeout(() => {
          this.postUpdate(entry, e.document.getText());
        }, DEBOUNCE_MS);
      }),
    );
  }

  open(uri: vscode.Uri): void {
    const key = uri.toString();
    const existing = this.panels.get(key);
    if (existing) {
      existing.panel.reveal(vscode.ViewColumn.Beside, true);
      this.postUpdate(existing, vscode.workspace.textDocuments.find((d) => d.uri.toString() === key)?.getText() ?? '');
      return;
    }

    const doc = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
    const title = doc ? `排版预览 — ${vscode.workspace.asRelativePath(uri)}` : 'HyMD 排版预览';

    const panel = vscode.window.createWebviewPanel(
      'hymd.layoutPreview',
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media')],
      },
    );

    const entry: PreviewEntry = { panel, ready: false };
    this.panels.set(key, entry);

    panel.webview.html = this.buildHtml(panel.webview, doc?.getText() ?? '');

    panel.webview.onDidReceiveMessage((raw: LayoutWebviewToHostMessage) => {
      switch (raw.type) {
        case 'layoutReady':
          entry.ready = true;
          this.postInit(entry, doc?.getText() ?? '');
          break;
        case 'layoutStats':
          this.updateStatusBar(raw);
          break;
        case 'layoutLog':
          console.log('[hymd-layout-preview]', raw.message);
          break;
      }
    });

    panel.onDidDispose(() => {
      if (entry.debounce) clearTimeout(entry.debounce);
      this.panels.delete(key);
      if (this.panels.size === 0) this.statusBar?.hide();
    });
  }

  private postInit(entry: PreviewEntry, content: string): void {
    const msg: LayoutHostToWebviewMessage = { type: 'layoutInit', content };
    void entry.panel.webview.postMessage(msg);
  }

  private postUpdate(entry: PreviewEntry, content: string): void {
    if (!entry.ready) return;
    const msg: LayoutHostToWebviewMessage = { type: 'layoutUpdate', content };
    void entry.panel.webview.postMessage(msg);
  }

  private updateStatusBar(raw: Extract<LayoutWebviewToHostMessage, { type: 'layoutStats' }>): void {
    if (!this.statusBar) return;
    const delta = raw.geoDeltaMm;
    const ok = delta <= 2;
    this.statusBar.text = ok
      ? `$(check) 排版 Δ${delta.toFixed(2)}mm · ${raw.page}/${raw.totalPages}页`
      : `$(warning) 排版 Δ${delta.toFixed(2)}mm · ${raw.page}/${raw.totalPages}页`;
    this.statusBar.tooltip = `纸张几何自检偏差 ${delta.toFixed(3)} mm（要求 ≤ 2 mm）`;
    this.statusBar.show();
  }

  private buildHtml(webview: vscode.Webview, initialContent: string): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media', 'layout-preview.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media', 'layout-preview.css'),
    );
    const nonce = getNonce();
    const escaped = JSON.stringify(initialContent);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
</head>
<body>
  <header id="toolbar" class="hymd-layout-toolbar">
    <div class="hymd-layout-toolbar-group">
      <button type="button" id="btn-zoom-out" title="缩小">−</button>
      <button type="button" id="btn-zoom-reset" title="100%">100%</button>
      <button type="button" id="btn-zoom-in" title="放大">+</button>
      <button type="button" id="btn-fit-width" title="适宽">适宽</button>
    </div>
    <div class="hymd-layout-toolbar-group">
      <button type="button" id="btn-prev-page" title="上一页">◀</button>
      <span id="page-indicator">1 / 1</span>
      <button type="button" id="btn-next-page" title="下一页">▶</button>
    </div>
    <div class="hymd-layout-toolbar-group">
      <label><input type="checkbox" id="chk-guides" checked /> 边距辅助线</label>
    </div>
  </header>
  <main id="viewport" class="hymd-layout-viewport">
    <div id="pages-root" class="hymd-pages"></div>
  </main>
  <div id="template-host" hidden aria-hidden="true"></div>
  <script nonce="${nonce}">window.__HYMD_LAYOUT_INITIAL__ = ${escaped};</script>
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
