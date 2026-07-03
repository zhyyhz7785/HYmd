import * as vscode from 'vscode';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import {
  exportAll,
  exportDocx,
  exportPdf,
  exportPptx,
  type ExportOptions,
} from '@hymd/export';
import type { HymdExportFormat } from './protocol.js';

function resolveTemplatesDir(extensionPath: string): string {
  try {
    const req = createRequire(join(extensionPath, 'package.json'));
    const pkgJson = req.resolve('@hymd/export/package.json');
    return join(dirname(pkgJson), 'templates');
  } catch {
    return join(extensionPath, 'node_modules', '@hymd', 'export', 'templates');
  }
}

function resolveActiveDocUri(): vscode.Uri | undefined {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (tab?.input instanceof vscode.TabInputCustom) {
    return tab.input.uri;
  }
  if (tab?.input instanceof vscode.TabInputText) {
    return tab.input.uri;
  }
  return vscode.window.activeTextEditor?.document.uri;
}

function buildExportOptions(
  docUri: vscode.Uri,
  extensionPath: string,
  blockId?: string,
): ExportOptions {
  const cfg = vscode.workspace.getConfiguration('hymd.export', docUri);
  return {
    docPath: docUri.fsPath,
    blockId,
    pandocPath: cfg.get<string>('pandocPath') || undefined,
    marpPath: cfg.get<string>('marpPath') || undefined,
    browserPath: cfg.get<string>('browserPath') || undefined,
    marpResolveDir: extensionPath,
    templatesDir: resolveTemplatesDir(extensionPath),
  };
}

async function runExport(
  format: HymdExportFormat,
  docUri: vscode.Uri,
  extensionPath: string,
  blockId?: string,
): Promise<string[]> {
  const options = buildExportOptions(docUri, extensionPath, blockId);

  switch (format) {
    case 'docx': {
      const r = await exportDocx(options);
      return [r.outPath];
    }
    case 'pptx': {
      const r = await exportPptx(options);
      return r.outPaths;
    }
    case 'pdf': {
      const r = await exportPdf(options);
      return [r.outPath];
    }
    case 'all': {
      const r = await exportAll(options);
      const paths: string[] = [];
      if (r.docx) paths.push(r.docx.outPath);
      if (r.pptx) paths.push(...r.pptx.outPaths);
      if (r.pdf) paths.push(r.pdf.outPath);
      if (Object.keys(r.errors).length > 0) {
        const detail = Object.entries(r.errors)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
        void vscode.window.showWarningMessage(`部分格式导出失败：\n${detail}`);
      }
      return paths;
    }
    default:
      throw new Error(`未知导出格式：${format}`);
  }
}

const FORMAT_LABELS: Record<HymdExportFormat, string> = {
  docx: 'Word (docx)',
  pptx: 'PowerPoint (pptx)',
  pdf: 'PDF',
  all: '全部格式',
};

export function registerExportCommands(context: vscode.ExtensionContext): void {
  const extensionPath = context.extensionPath;

  async function executeExport(format: HymdExportFormat, blockId?: string): Promise<void> {
    const docUri = resolveActiveDocUri();
    if (!docUri) {
      void vscode.window.showWarningMessage('请先打开一个 HyMD 文档');
      return;
    }
    if (!/\.md$/i.test(docUri.fsPath)) {
      void vscode.window.showWarningMessage('当前文件不是 Markdown 文档');
      return;
    }

    const label = blockId ? `${FORMAT_LABELS[format]}（${blockId}）` : FORMAT_LABELS[format];

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `HyMD 导出：${label}`,
        cancellable: false,
      },
      async () => {
        try {
          const outputs = await runExport(format, docUri, extensionPath, blockId);
          const outDir = dirname(outputs[0] ?? docUri.fsPath);
          const pick = await vscode.window.showInformationMessage(
            `已导出 ${outputs.length} 个文件`,
            '打开目录',
            '确定',
          );
          if (pick === '打开目录') {
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outDir));
          }
        } catch (e) {
          void vscode.window.showErrorMessage(
            `导出失败：${e instanceof Error ? e.message : String(e)}`,
          );
        }
      },
    );
  }

  const formats: HymdExportFormat[] = ['docx', 'pptx', 'pdf', 'all'];
  for (const format of formats) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`hymd.export.${format}`, () => executeExport(format)),
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('hymd.export.pick', async () => {
      const picked = await vscode.window.showQuickPick(
        [
          { label: 'Word (docx)', format: 'docx' as const },
          { label: 'PowerPoint (pptx)', format: 'pptx' as const },
          { label: 'PDF', format: 'pdf' as const },
          { label: '全部格式 (docx + pptx + pdf)', format: 'all' as const },
        ],
        { placeHolder: '选择导出格式' },
      );
      if (picked) await executeExport(picked.format);
    }),
  );
}

/** 供 editorProvider 调用：webview requestExport 消息 */
export async function handleWebviewExportRequest(
  context: vscode.ExtensionContext,
  docUri: vscode.Uri,
  format: HymdExportFormat,
  blockId?: string,
): Promise<void> {
  const label = blockId ? `${FORMAT_LABELS[format]}（${blockId}）` : FORMAT_LABELS[format];
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `HyMD 导出：${label}`,
      cancellable: false,
    },
    async () => {
      try {
        const outputs = await runExport(format, docUri, context.extensionPath, blockId);
        const outDir = dirname(outputs[0] ?? docUri.fsPath);
        const pick = await vscode.window.showInformationMessage(
          `已导出 ${outputs.length} 个文件`,
          '打开目录',
          '确定',
        );
        if (pick === '打开目录') {
          await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outDir));
        }
      } catch (e) {
        void vscode.window.showErrorMessage(
          `导出失败：${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  );
}
