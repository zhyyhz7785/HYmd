import * as vscode from 'vscode';
import {
  findBlockById,
  parseHymd,
  resolveSheetSource,
  serializeHymd,
  sheetBodyForEmbed,
  sheetBodyForExport,
  updateBlockBody,
} from '@hymd/parser';
import { readSheetSnapshot, resolveSnapshotUri, defaultSnapshotUri, defaultSnapshotRelPath } from './sheetAssets.js';

async function getActiveHymdDocument(): Promise<{ uri: vscode.Uri; text: string } | undefined> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('请先打开 HyMD 文档');
    return undefined;
  }
  return { uri: editor.document.uri, text: editor.document.getText() };
}

async function applyMarkdown(uri: vscode.Uri, markdown: string): Promise<void> {
  const edit = new vscode.WorkspaceEdit();
  const doc = await vscode.workspace.openTextDocument(uri);
  const fullRange = new vscode.Range(
    doc.lineAt(0).range.start,
    doc.lineAt(Math.max(0, doc.lineCount - 1)).range.end,
  );
  edit.replace(uri, fullRange, markdown);
  await vscode.workspace.applyEdit(edit);
  await doc.save();
}

/** 将外置 snapshot 嵌入块体 data */
export async function embedSheetSnapshot(blockId?: string): Promise<void> {
  const ctx = await getActiveHymdDocument();
  if (!ctx) return;

  const doc = parseHymd(ctx.text);
  const block = blockId
    ? findBlockById(doc, blockId)
    : doc.blocks.find((b) => b.type === 'sheet');

  if (!block || block.type !== 'sheet') {
    void vscode.window.showWarningMessage('未找到 sheet 块');
    return;
  }

  const source = resolveSheetSource(block);
  if (source.kind !== 'external') {
    void vscode.window.showInformationMessage('当前 sheet 块已是内嵌或无外置 snapshot');
    return;
  }

  try {
    const uri = resolveSnapshotUri(ctx.uri, source.path);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const data = JSON.parse(Buffer.from(bytes).toString('utf8'));
    const newBody = sheetBodyForEmbed(block, data);
    const updated = updateBlockBody(doc, block.id, newBody);
    await applyMarkdown(ctx.uri, serializeHymd(updated));
    void vscode.window.showInformationMessage(`已嵌入 snapshot 到块 ${block.id}`);
  } catch (e) {
    void vscode.window.showErrorMessage(`嵌入失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 将内嵌 data 导出为 assets 文件 */
export async function exportSheetSnapshot(blockId?: string): Promise<void> {
  const ctx = await getActiveHymdDocument();
  if (!ctx) return;

  const doc = parseHymd(ctx.text);
  const block = blockId
    ? findBlockById(doc, blockId)
    : doc.blocks.find((b) => b.type === 'sheet');

  if (!block || block.type !== 'sheet') {
    void vscode.window.showWarningMessage('未找到 sheet 块');
    return;
  }

  const source = resolveSheetSource(block);
  if (source.kind !== 'inline') {
    void vscode.window.showInformationMessage('当前 sheet 块无内嵌 data 可导出');
    return;
  }

  try {
    const snapshotUri = defaultSnapshotUri(ctx.uri, block.id);
    const snapshotRel = defaultSnapshotRelPath(ctx.uri, block.id);

    await vscode.workspace.fs.createDirectory(snapshotUri.with({ path: snapshotUri.path.replace(/\/[^/]+$/, '') }));
    await vscode.workspace.fs.writeFile(
      snapshotUri,
      Buffer.from(JSON.stringify(source.data, null, 2), 'utf8'),
    );

    const newBody = sheetBodyForExport(block, snapshotRel);
    const updated = updateBlockBody(doc, block.id, newBody);
    await applyMarkdown(ctx.uri, serializeHymd(updated));
    void vscode.window.showInformationMessage(`已导出到 ${snapshotRel}`);
  } catch (e) {
    void vscode.window.showErrorMessage(`导出失败: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** 供命令 palette：对当前文档第一个 sheet 块操作 */
export function registerSheetCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('hymd.sheet.embedSnapshot', () => embedSheetSnapshot()),
    vscode.commands.registerCommand('hymd.sheet.exportSnapshot', () => exportSheetSnapshot()),
  );
}
