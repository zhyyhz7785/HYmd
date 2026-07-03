/** Univer IWorkbookData 的 HyMD 简化类型（避免强依赖运行时类型） */
export type UniverWorkbookSnapshot = Record<string, unknown>;

export interface FormulaCell {
  sheetId: string;
  row: number;
  col: number;
  formula: string;
}

/** 从 snapshot 提取含公式 f 的单元格 */
export function extractFormulaCells(snapshot: UniverWorkbookSnapshot): FormulaCell[] {
  const result: FormulaCell[] = [];
  const sheets = snapshot.sheets as Record<string, Record<string, unknown>> | undefined;
  if (!sheets) return result;

  for (const [sheetId, sheet] of Object.entries(sheets)) {
    const cellData = sheet.cellData as Record<string, Record<string, Record<string, unknown>>> | undefined;
    if (!cellData) continue;

    for (const [rowKey, row] of Object.entries(cellData)) {
      for (const [colKey, cell] of Object.entries(row)) {
        const formula = cell.f;
        if (typeof formula === 'string' && formula.length > 0) {
          result.push({
            sheetId,
            row: Number(rowKey),
            col: Number(colKey),
            formula,
          });
        }
      }
    }
  }
  return result;
}

/** 创建空 workbook snapshot（rows × cols） */
export function createEmptySnapshot(
  rows: number,
  cols: number,
  id = 'sheet-new',
  name = 'Sheet1',
): UniverWorkbookSnapshot {
  const sheetId = 'sheet1';
  return {
    id,
    name,
    sheetOrder: [sheetId],
    sheets: {
      [sheetId]: {
        id: sheetId,
        name,
        rowCount: Math.max(rows, 1),
        columnCount: Math.max(cols, 1),
        cellData: {},
      },
    },
  };
}

/** 规范化 snapshot：补全缺失的 id/name */
export function normalizeSnapshot(
  snapshot: UniverWorkbookSnapshot,
  fallbackId = 'workbook',
): UniverWorkbookSnapshot {
  const copy = structuredClone(snapshot);
  if (!copy.id) copy.id = fallbackId;
  if (!copy.name) copy.name = fallbackId;
  if (!Array.isArray(copy.sheetOrder) || copy.sheetOrder.length === 0) {
    const sheets = copy.sheets as Record<string, unknown> | undefined;
    const keys = sheets ? Object.keys(sheets) : ['sheet1'];
    copy.sheetOrder = keys;
  }
  return copy;
}

/** 默认 assets 相对路径 */
export function defaultSnapshotPath(blockId: string): string {
  return `./${blockId}.univer.json`;
}
