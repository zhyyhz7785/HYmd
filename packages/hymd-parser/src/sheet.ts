import type { HymdBlock } from './types.js';

export type UniverWorkbookSnapshot = Record<string, unknown>;

export type SheetSource =
  | { kind: 'external'; path: string }
  | { kind: 'inline'; data: UniverWorkbookSnapshot }
  | { kind: 'empty' };

/** 解析 sheet 块的数据来源 */
export function resolveSheetSource(block: HymdBlock): SheetSource {
  if (block.type !== 'sheet') {
    throw new Error(`resolveSheetSource: expected sheet block, got ${block.type}`);
  }

  const snapshotPath = block.body.snapshot;
  if (typeof snapshotPath === 'string' && snapshotPath.trim()) {
    return { kind: 'external', path: snapshotPath.trim() };
  }

  const inline = block.body.data;
  if (inline && typeof inline === 'object' && !Array.isArray(inline)) {
    return { kind: 'inline', data: inline as UniverWorkbookSnapshot };
  }

  return { kind: 'empty' };
}

/** 构建 sheet 块体（外置 snapshot 模式） */
export function buildExternalSheetBody(
  rows: number,
  cols: number,
  snapshotPath: string,
): Record<string, unknown> {
  return { rows, cols, snapshot: snapshotPath };
}

/** 构建 sheet 块体（内嵌 data 模式） */
export function buildInlineSheetBody(
  rows: number,
  cols: number,
  data: UniverWorkbookSnapshot,
): Record<string, unknown> {
  return { rows, cols, data };
}

/** 从块体提取 rows/cols，带默认值 */
export function sheetDimensions(block: HymdBlock): { rows: number; cols: number } {
  const rows = typeof block.body.rows === 'number' ? block.body.rows : 20;
  const cols = typeof block.body.cols === 'number' ? block.body.cols : 8;
  return { rows, cols };
}

/** embed：外置 → 内嵌 */
export function sheetBodyForEmbed(
  block: HymdBlock,
  snapshotData: UniverWorkbookSnapshot,
): Record<string, unknown> {
  const { rows, cols } = sheetDimensions(block);
  return buildInlineSheetBody(rows, cols, snapshotData);
}

/** export：内嵌 → 外置 */
export function sheetBodyForExport(
  block: HymdBlock,
  snapshotPath: string,
): Record<string, unknown> {
  const { rows, cols } = sheetDimensions(block);
  return buildExternalSheetBody(rows, cols, snapshotPath);
}
