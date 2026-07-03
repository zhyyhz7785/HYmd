import * as vscode from 'vscode';
import { parseHymd } from '@hymd/parser';
import type { HostToWebviewMessage, HymdUiStyle, WebviewToHostMessage } from './protocol.js';
import {
  DocumentSyncState,
  fullDocumentReplaceRange,
  normalizeMarkdown,
} from './sync/documentSync.js';
import { joinFrontmatter, splitFrontmatter } from './sync/frontmatterGuard.js';
import { readSheetSnapshot, writeSheetSnapshot } from './sheetAssets.js';

const DEBOUNCE_MS = 220;

function resolveTheme(): 'light' | 'dark' | 'high-contrast' {
  const kind = vscode.window.activeColorTheme.kind;
  if (kind === vscode.ColorThemeKind.Dark) return 'dark';
  if (kind === vscode.ColorThemeKind.HighContrast) return 'high-contrast';
  return 'light';
}

function resolveUiStyle(resource?: vscode.Uri): HymdUiStyle {
  const value = vscode.workspace
    .getConfiguration('hymd', resource)
    .get<string>('ui.style', 'hymd');
  return value === 'vscode' ? 'vscode' : 'hymd';
}

export class HymdEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'hymd.editor';

  private readonly activePanels = new Set<vscode.WebviewPanel>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  /** 向所有打开的 HyMD 编辑器立即推送指定皮肤（不依赖配置事件） */
  broadcastUiStyle(uiStyle?: HymdUiStyle): void {
    const style = uiStyle ?? resolveUiStyle();
    const msg: HostToWebviewMessage = { type: 'uiStyleChanged', uiStyle: style };
    for (const panel of this.activePanels) {
      void panel.webview.postMessage(msg);
    }
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    // frontmatter 不进 Milkdown：同步状态机只跟踪正文（body）
    const initialSplit = splitFrontmatter(document.getText());
    let currentFrontmatter = initialSplit.frontmatter;
    const syncState = new DocumentSyncState(initialSplit.body);
    let webviewReady = false;
    let editVersion = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let overlayOpen = false;

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'media'),
      ],
    };

    const docUri = document.uri;
    this.activePanels.add(webviewPanel);
    webviewPanel.webview.html = this.getWebviewHtml(
      webviewPanel.webview,
      resolveUiStyle(docUri),
    );

    const postToWebview = (msg: HostToWebviewMessage) => {
      webviewPanel.webview.postMessage(msg);
    };

    const pushUiStyle = () => {
      postToWebview({ type: 'uiStyleChanged', uiStyle: resolveUiStyle(docUri) });
    };

    const pushInit = () => {
      const split = splitFrontmatter(document.getText());
      currentFrontmatter = split.frontmatter;
      postToWebview({
        type: 'init',
        content: split.body,
        theme: resolveTheme(),
        uiStyle: resolveUiStyle(docUri),
      });
    };

    const applyWebviewEdit = async (content: string, version: number) => {
      // webview 只回传正文，写盘前拼回 frontmatter
      const normalized = normalizeMarkdown(joinFrontmatter(currentFrontmatter, content));
      if (normalized === normalizeMarkdown(document.getText())) {
        syncState.onHostApplied(version);
        return;
      }

      const edit = new vscode.WorkspaceEdit();
      const range = fullDocumentReplaceRange(document.lineCount);
      edit.replace(
        document.uri,
        new vscode.Range(
          new vscode.Position(range.start.line, range.start.character),
          new vscode.Position(range.end.line, range.end.character),
        ),
        normalized,
      );

      const ok = await vscode.workspace.applyEdit(edit);
      if (ok) {
        syncState.onHostApplied(version);
        await document.save();
      }
    };

    const applyMarkdownFromHost = async (markdown: string) => {
      const edit = new vscode.WorkspaceEdit();
      const range = fullDocumentReplaceRange(document.lineCount);
      edit.replace(
        document.uri,
        new vscode.Range(
          new vscode.Position(range.start.line, range.start.character),
          new vscode.Position(range.end.line, range.end.character),
        ),
        markdown,
      );
      await vscode.workspace.applyEdit(edit);
      await document.save();
      syncState.onHostApplied(++editVersion);
      const split = splitFrontmatter(markdown);
      currentFrontmatter = split.frontmatter;
      postToWebview({ type: 'externalUpdate', content: split.body, version: editVersion });
    };

    webviewPanel.webview.onDidReceiveMessage(async (raw: WebviewToHostMessage) => {
      switch (raw.type) {
        case 'ready':
          webviewReady = true;
          pushInit();
          break;
        case 'edit':
          if (overlayOpen) return;
          if (!syncState.onWebviewEdit(raw.content, raw.version)) return;
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            void applyWebviewEdit(raw.content, raw.version);
          }, DEBOUNCE_MS);
          break;
        case 'requestSheetSnapshot':
          try {
            const data = await readSheetSnapshot(document.uri, raw.blockId, document.getText());
            postToWebview({ type: 'sheetSnapshotData', blockId: raw.blockId, data });
          } catch (e) {
            postToWebview({
              type: 'sheetSnapshotData',
              blockId: raw.blockId,
              error: e instanceof Error ? e.message : String(e),
            });
          }
          break;
        case 'saveSheetSnapshot':
          try {
            const result = await writeSheetSnapshot(
              document.uri,
              raw.blockId,
              document.getText(),
              raw.data as Record<string, unknown>,
              raw.src,
            );
            await applyMarkdownFromHost(result.markdown);
            postToWebview({
              type: 'sheetSaved',
              blockId: raw.blockId,
              ok: true,
              snapshotPath: result.snapshotPath,
            });
          } catch (e) {
            postToWebview({
              type: 'sheetSaved',
              blockId: raw.blockId,
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
          break;
        case 'overlayState':
          overlayOpen = raw.open;
          break;
        case 'log':
          console.log('[hymd-webview]', raw.message);
          break;
      }
    });

    const docChangeSub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() !== document.uri.toString()) return;

      // 即使 webview 不可用也要刷新 frontmatter（用户可能在源码视图改了 page 配置）
      const split = splitFrontmatter(document.getText());
      currentFrontmatter = split.frontmatter;

      if (!webviewReady || overlayOpen) return;
      if (!syncState.shouldApplyExternal(split.body, ++editVersion)) return;

      postToWebview({
        type: 'externalUpdate',
        content: split.body,
        version: editVersion,
      });
    });

    const themeSub = vscode.window.onDidChangeActiveColorTheme(() => {
      postToWebview({ type: 'themeChanged', theme: resolveTheme() });
    });

    const configSub = vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        !e.affectsConfiguration('hymd.ui.style', docUri) &&
        !e.affectsConfiguration('hymd', docUri)
      ) {
        return;
      }
      if (!webviewReady) return;
      pushUiStyle();
    });

    const viewStateSub = webviewPanel.onDidChangeViewState((e) => {
      if (!webviewReady || !e.webviewPanel.visible) return;
      pushUiStyle();
    });

    webviewPanel.onDidDispose(() => {
      this.activePanels.delete(webviewPanel);
      docChangeSub.dispose();
      themeSub.dispose();
      configSub.dispose();
      viewStateSub.dispose();
      if (debounceTimer) clearTimeout(debounceTimer);
    });
  }

  private getWebviewHtml(webview: vscode.Webview, uiStyle: HymdUiStyle): string {
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
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <link rel="stylesheet" href="${blockCardsUri}" />
</head>
<body data-theme="light" data-ui="${uiStyle}">
  <div id="editor-root"></div>
  <div id="sheet-overlay-root" hidden></div>
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
