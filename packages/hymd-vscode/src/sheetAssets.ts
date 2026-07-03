import * as vscode from 'vscode';
import { basename, dirname, relative, resolve } from 'node:path';
import {
  createEmptySnapshot,
  type UniverWorkbookSnapshot,
} from '@hymd/blocks-sheet';
import {
  findBlockById,
  parseHymd,
  resolveSheetSource,
  sheetDimensions,
  updateBlockBody,
  buildExternalSheetBody,
  serializeHymd,
} from '@hymd/parser';

/** 文档主文件名（去掉 .md 后缀），如 `report.hy.md` → `report.hy` */
export function documentStem(docUri: vscode.Uri): string {
  const name = basename(docUri.fsPath);
  return name.replace(/\.md$/i, '');
}

/** 文档对应的 .assets 目录 URI */
export function assetsDirUri(docUri: vscode.Uri): vscode.Uri {
  const stem = documentStem(docUri);
  const parent = dirname(docUri.fsPath);
  return vscode.Uri.file(`${parent}/${stem}.assets`);
}

/** 解析 snapshot 相对路径为绝对 URI（限制在文档目录内） */
export function resolveSnapshotUri(docUri: vscode.Uri, snapshotPath: string): vscode.Uri {
  const docDir = dirname(docUri.fsPath);
  const normalized = snapshotPath.replace(/^\.\//, '');
  const target = resolve(docDir, normalized);
  const rel = relative(docDir, target);

  if (rel.startsWith('..') || resolve(rel) === rel) {
    throw new Error(`Snapshot path escapes document directory: ${snapshotPath}`);
  }

  return vscode.Uri.file(target);
}

/** 默认 snapshot 文件 URI */
export function defaultSnapshotUri(docUri: vscode.Uri, blockId: string): vscode.Uri {
  return vscode.Uri.joinPath(assetsDirUri(docUri), `${blockId}.univer.json`);
}

/** 默认 snapshot 相对路径 */
export function defaultSnapshotRelPath(docUri: vscode.Uri, blockId: string): string {
  const stem = documentStem(docUri);
  return `./${stem}.assets/${blockId}.univer.json`;
}

/** 读取 sheet 块 snapshot */
export async function readSheetSnapshot(
  docUri: vscode.Uri,
  blockId: string,
  markdown: string,
): Promise<UniverWorkbookSnapshot> {
  const doc = parseHymd(markdown);
  const block = findBlockById(doc, blockId);
  if (!block || block.type !== 'sheet') {
    throw new Error(`Sheet block not found: ${blockId}`);
  }

  const source = resolveSheetSource(block);
  if (source.kind === 'inline') {
    return source.data;
  }
  if (source.kind === 'external') {
    const uri = resolveSnapshotUri(docUri, source.path);
    const bytes = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as UniverWorkbookSnapshot;
  }

  const { rows, cols } = sheetDimensions(block);
  return createEmptySnapshot(rows, cols, blockId);
}

/** 写入 snapshot 并更新块体为外置路径 */
export async function writeSheetSnapshot(
  docUri: vscode.Uri,
  blockId: string,
  markdown: string,
  data: UniverWorkbookSnapshot,
  preferredPath?: string,
): Promise<{ snapshotPath: string; markdown: string }> {
  const doc = parseHymd(markdown);
  const block = findBlockById(doc, blockId);
  if (!block || block.type !== 'sheet') {
    throw new Error(`Sheet block not found: ${blockId}`);
  }

  const { rows, cols } = sheetDimensions(block);
  const source = resolveSheetSource(block);

  const snapshotRel =
    preferredPath ??
    (source.kind === 'external' ? source.path : defaultSnapshotRelPath(docUri, blockId));

  const assetsDir = assetsDirUri(docUri);
  await vscode.workspace.fs.createDirectory(assetsDir);

  const snapshotUri = resolveSnapshotUri(docUri, snapshotRel);
  await vscode.workspace.fs.writeFile(snapshotUri, Buffer.from(JSON.stringify(data, null, 2), 'utf8'));

  const newBody = buildExternalSheetBody(rows, cols, snapshotRel);
  const updated = updateBlockBody(doc, blockId, newBody);
  return { snapshotPath: snapshotRel, markdown: serializeHymd(updated) };
}
