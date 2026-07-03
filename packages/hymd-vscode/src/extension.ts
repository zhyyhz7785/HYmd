import * as vscode from 'vscode';
import { HymdEditorProvider } from './editorProvider.js';
import { LayoutPreviewManager } from './layoutPreviewPanel.js';
import { registerSheetCommands } from './sheetCommands.js';
import { registerExportCommands } from './exportCommands.js';

interface HymdTabState {
  uri: vscode.Uri;
  mode: 'wysiwyg' | 'source';
  tab: vscode.Tab;
}

/** 当前激活标签若是 HyMD WYSIWYG 或 Markdown 源码，返回其状态 */
function getActiveHymdTabState(): HymdTabState | undefined {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (!tab) return undefined;
  if (
    tab.input instanceof vscode.TabInputCustom &&
    tab.input.viewType === HymdEditorProvider.viewType
  ) {
    return { uri: tab.input.uri, mode: 'wysiwyg', tab };
  }
  if (tab.input instanceof vscode.TabInputText && /\.md$/i.test(tab.input.uri.path)) {
    return { uri: tab.input.uri, mode: 'source', tab };
  }
  return undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  const provider = new HymdEditorProvider(context);
  const layoutPreview = new LayoutPreviewManager(context);
  layoutPreview.register(context);

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      HymdEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
  );

  registerSheetCommands(context);
  registerExportCommands(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('hymd.toggleUiStyle', async () => {
      const cfg = vscode.workspace.getConfiguration('hymd');
      const current = cfg.get<string>('ui.style', 'hymd');
      const next = current === 'vscode' ? 'hymd' : 'vscode';

      // 先直接广播到所有打开的编辑器（即时生效），再持久化配置
      provider.broadcastUiStyle(next);
      updateStatusBar(next);
      try {
        await cfg.update('ui.style', next, vscode.ConfigurationTarget.Global);
      } catch {
        // 配置写入失败（如无用户配置文件）不影响本次会话的皮肤切换
      }
      void vscode.window.showInformationMessage(`HyMD 皮肤已切换为：${next}`);
    }),
  );

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.command = 'hymd.toggleUiStyle';
  statusBar.tooltip = '点击切换 HyMD UI 皮肤（hymd ↔ vscode）';
  const updateStatusBar = (style?: string) => {
    const current =
      style ?? vscode.workspace.getConfiguration('hymd').get<string>('ui.style', 'hymd');
    statusBar.text = `$(paintcan) HyMD: ${current}`;
  };
  updateStatusBar();
  statusBar.show();
  context.subscriptions.push(statusBar);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration('hymd.ui.style')) return;
      updateStatusBar();
      provider.broadcastUiStyle();
    }),
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

  context.subscriptions.push(
    vscode.commands.registerCommand('hymd.toggleSourceMode', async () => {
      const state = getActiveHymdTabState();
      if (!state) {
        void vscode.window.showWarningMessage('当前标签不是 HyMD/Markdown 文档');
        return;
      }
      const target = state.mode === 'wysiwyg' ? 'default' : HymdEditorProvider.viewType;
      await vscode.commands.executeCommand(
        'vscode.openWith',
        state.uri,
        target,
        state.tab.group.viewColumn,
      );
      // 关闭原标签，实现"切换"而非并排开两个编辑器
      try {
        await vscode.window.tabGroups.close(state.tab, true);
      } catch {
        // 原标签可能已被替换关闭
      }
    }),
  );

  const modeStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    101,
  );
  modeStatusBar.command = 'hymd.toggleSourceMode';
  const updateModeStatusBar = () => {
    const state = getActiveHymdTabState();
    if (!state) {
      modeStatusBar.hide();
      return;
    }
    if (state.mode === 'wysiwyg') {
      modeStatusBar.text = '$(code) 源码';
      modeStatusBar.tooltip = '切换到源代码编辑器';
    } else {
      modeStatusBar.text = '$(open-preview) WYSIWYG';
      modeStatusBar.tooltip = '切换到 HyMD WYSIWYG 编辑器';
    }
    modeStatusBar.show();
  };
  updateModeStatusBar();
  context.subscriptions.push(
    modeStatusBar,
    vscode.window.tabGroups.onDidChangeTabs(updateModeStatusBar),
    vscode.window.tabGroups.onDidChangeTabGroups(updateModeStatusBar),
  );
}

export function deactivate(): void {}
