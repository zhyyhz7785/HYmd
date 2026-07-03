/** Univer workbook snapshot → GFM 表格文本 */

export type UniverWorkbookSnapshot = Record<string, unknown>;

interface UniverCell {
  v?: unknown;
  f?: string;
  [key: string]: unknown;
}

type CellData = Record<string, Record<string, UniverCell>>;

interface UniverSheet {
  id?: string;
  name?: string;
  cellData?: CellData;
  [key: string]: unknown;
}

/** 单元格显示值：优先算出值 v，无 v 时回退公式文本 f */
export function cellDisplayValue(cell: UniverCell | undefined): string {
  if (!cell) return '';
  if (cell.v !== undefined && cell.v !== null) return String(cell.v);
  if (typeof cell.f === 'string' && cell.f.length > 0) return cell.f;
  return '';
}

function escapeGfmCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

/** 单个 sheet 的 cellData → GFM 表格（首行为表头）；无数据返回 null */
export function sheetToGfmTable(sheet: UniverSheet): string | null {
  const cellData = sheet.cellData;
  if (!cellData) return null;

  let maxRow = -1;
  let maxCol = -1;
  for (const [rowKey, row] of Object.entries(cellData)) {
    const rowIdx = Number(rowKey);
    if (!Number.isFinite(rowIdx)) continue;
    for (const colKey of Object.keys(row)) {
      const colIdx = Number(colKey);
      if (!Number.isFinite(colIdx)) continue;
      if (rowIdx > maxRow) maxRow = rowIdx;
      if (colIdx > maxCol) maxCol = colIdx;
    }
  }
  if (maxRow < 0 || maxCol < 0) return null;

  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const cells: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      cells.push(escapeGfmCell(cellDisplayValue(cellData[String(r)]?.[String(c)])));
    }
    lines.push(`| ${cells.join(' | ')} |`);
    if (r === 0) {
      lines.push(`|${' --- |'.repeat(maxCol + 1)}`);
    }
  }
  return lines.join('\n');
}

/**
 * 完整 snapshot → GFM 表格文本。
 * 多个 sheet 时每个表格前加粗显示 sheet 名；全部为空时返回 null。
 */
export function snapshotToGfmTables(snapshot: UniverWorkbookSnapshot): string | null {
  const sheets = snapshot.sheets as Record<string, UniverSheet> | undefined;
  if (!sheets) return null;

  const order = Array.isArray(snapshot.sheetOrder)
    ? (snapshot.sheetOrder as string[]).filter((id) => id in sheets)
    : Object.keys(sheets);

  const parts: string[] = [];
  for (const sheetId of order) {
    const table = sheetToGfmTable(sheets[sheetId]);
    if (!table) continue;
    if (order.length > 1) {
      const name = sheets[sheetId].name ?? sheetId;
      parts.push(`**${name}**\n\n${table}`);
    } else {
      parts.push(table);
    }
  }
  return parts.length > 0 ? parts.join('\n\n') : null;
}
