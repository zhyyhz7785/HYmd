import * as vscode from 'vscode';
import { findBlockById, parseHymd, resolveSlideSource } from '@hymd/parser';
import { resolveSnapshotUri } from './sheetAssets.js';

export interface SlideSourceResult {
  markdown: string;
  /** 外置源相对路径（内联时为 undefined） */
  sourcePath?: string;
}

/** 读取 slide 块的 Marp 源（外置文件或内联 slides） */
export async function readSlideSource(
  docUri: vscode.Uri,
  blockId: string,
  markdown: string,
): Promise<SlideSourceResult> {
  const doc = parseHymd(markdown);
  const block = findBlockById(doc, blockId);
  if (!block || block.type !== 'slide') {
    throw new Error(`Slide block not found: ${blockId}`);
  }

  const source = resolveSlideSource(block);
  if (source.kind === 'external') {
    const uri = resolveSnapshotUri(docUri, source.path);
    const bytes = await vscode.workspace.fs.readFile(uri);
    return { markdown: Buffer.from(bytes).toString('utf8'), sourcePath: source.path };
  }
  if (source.kind === 'inline') {
    return { markdown: source.markdown };
  }
  throw new Error(`slide 块 ${blockId} 无 source 或 slides 内容`);
}

/** slide 块外置源文件 URI（内联返回 undefined） */
export function slideSourceUri(
  docUri: vscode.Uri,
  blockId: string,
  markdown: string,
): vscode.Uri | undefined {
  const doc = parseHymd(markdown);
  const block = findBlockById(doc, blockId);
  if (!block || block.type !== 'slide') return undefined;

  const source = resolveSlideSource(block);
  if (source.kind !== 'external') return undefined;
  return resolveSnapshotUri(docUri, source.path);
}
