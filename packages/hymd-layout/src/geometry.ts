/**
 * 页面几何：纸张预设、frontmatter page 解析、mm↔px 换算。
 *
 * 换算口径继承 HyCADTool.MarkdownEditor（Doc/058）：
 *   px = mm × scale （scale=1 时 1mm 对应 1px；不依赖浏览器 96DPI 或 CSS mm 单位）
 */

import type { HymdFrontmatter } from '@hymd/parser';

/** ISO A 系列 + Letter（短边 × 长边，mm）；与 MarkdownEditor EditorViewModel.PaperDefs 一致 */
export const PAPER_PRESETS: Readonly<Record<string, { shortMm: number; longMm: number }>> = {
  A0: { shortMm: 841, longMm: 1189 },
  A1: { shortMm: 594, longMm: 841 },
  A2: { shortMm: 420, longMm: 594 },
  A3: { shortMm: 297, longMm: 420 },
  A4: { shortMm: 210, longMm: 297 },
  Letter: { shortMm: 215.9, longMm: 279.4 },
};

export type PaperOrientation = 'portrait' | 'landscape';

/** 解析后的页面几何（全部 mm 口径） */
export interface PageGeometry {
  preset: string;
  orientation: PaperOrientation;
  widthMm: number;
  heightMm: number;
  /** 上、右、下、左（与 spec frontmatter margin_mm 顺序一致） */
  marginMm: [number, number, number, number];
  columns: number;
  /** 栏间距 */
  gutterMm: number;
}

export const DEFAULT_PAGE_GEOMETRY: PageGeometry = {
  preset: 'A4',
  orientation: 'portrait',
  widthMm: 210,
  heightMm: 297,
  marginMm: [25, 20, 25, 20],
  columns: 1,
  gutterMm: 8,
};

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 从 frontmatter 解析页面几何。
 * 支持字段：page.preset / page.orientation / page.columns / page.margin_mm / page.gutter_mm
 * 非法或缺失字段回退默认值（A4 竖版单栏）。
 */
export function resolvePageGeometry(frontmatter: HymdFrontmatter | undefined): PageGeometry {
  const page = (frontmatter?.page ?? {}) as Record<string, unknown>;

  const presetRaw = typeof page.preset === 'string' ? page.preset.trim() : '';
  const presetKey =
    Object.keys(PAPER_PRESETS).find((k) => k.toLowerCase() === presetRaw.toLowerCase()) ?? 'A4';
  const def = PAPER_PRESETS[presetKey];

  const orientation: PaperOrientation =
    typeof page.orientation === 'string' && page.orientation.toLowerCase() === 'landscape'
      ? 'landscape'
      : 'portrait';

  const widthMm = orientation === 'portrait' ? def.shortMm : def.longMm;
  const heightMm = orientation === 'portrait' ? def.longMm : def.shortMm;

  let marginMm: [number, number, number, number] = [...DEFAULT_PAGE_GEOMETRY.marginMm];
  if (Array.isArray(page.margin_mm) && page.margin_mm.length === 4) {
    const parsed = page.margin_mm.map(asNumber);
    if (parsed.every((v): v is number => v !== undefined && v >= 0)) {
      marginMm = [parsed[0]!, parsed[1]!, parsed[2]!, parsed[3]!];
    }
  }
  // 边距总和不得吞掉整页（保底 20mm 内容区）
  const maxH = Math.max(0, widthMm - 20);
  const maxV = Math.max(0, heightMm - 20);
  if (marginMm[1] + marginMm[3] > maxH) {
    const ratio = maxH / (marginMm[1] + marginMm[3]);
    marginMm[1] *= ratio;
    marginMm[3] *= ratio;
  }
  if (marginMm[0] + marginMm[2] > maxV) {
    const ratio = maxV / (marginMm[0] + marginMm[2]);
    marginMm[0] *= ratio;
    marginMm[2] *= ratio;
  }

  const columns = clamp(Math.round(asNumber(page.columns) ?? 1), 1, 10);
  const gutterMm = clamp(asNumber(page.gutter_mm) ?? DEFAULT_PAGE_GEOMETRY.gutterMm, 0, 100);

  return { preset: presetKey, orientation, widthMm, heightMm, marginMm, columns, gutterMm };
}

/** mm → px（px = mm × scale） */
export function mmToPx(mm: number, scale: number): number {
  return mm * scale;
}

/** px → mm（mm = px / scale） */
export function pxToMm(px: number, scale: number): number {
  return px / Math.max(0.01, scale);
}

/** 页面几何按 scale 展开为像素口径（供 CSS/DOM 使用） */
export interface PagePixelGeometry {
  scale: number;
  paperWidthPx: number;
  paperHeightPx: number;
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  gutterPx: number;
  columns: number;
  /** 单栏内容宽度（扣除边距与栏间距后均分） */
  columnWidthPx: number;
  /** 栏内容高度（页高 − 上下边距） */
  columnHeightPx: number;
}

export function toPixelGeometry(geometry: PageGeometry, scale: number): PagePixelGeometry {
  const s = clamp(scale, 0.05, 20);
  const paperWidthPx = mmToPx(geometry.widthMm, s);
  const paperHeightPx = mmToPx(geometry.heightMm, s);
  const marginTopPx = mmToPx(geometry.marginMm[0], s);
  const marginRightPx = mmToPx(geometry.marginMm[1], s);
  const marginBottomPx = mmToPx(geometry.marginMm[2], s);
  const marginLeftPx = mmToPx(geometry.marginMm[3], s);
  const gutterPx = mmToPx(geometry.gutterMm, s);
  const innerWidthPx = paperWidthPx - marginLeftPx - marginRightPx;
  const totalGutterPx = Math.max(0, geometry.columns - 1) * gutterPx;
  const columnWidthPx = Math.max(1, (innerWidthPx - totalGutterPx) / Math.max(1, geometry.columns));
  const columnHeightPx = Math.max(1, paperHeightPx - marginTopPx - marginBottomPx);

  return {
    scale: s,
    paperWidthPx,
    paperHeightPx,
    marginTopPx,
    marginRightPx,
    marginBottomPx,
    marginLeftPx,
    gutterPx,
    columns: geometry.columns,
    columnWidthPx,
    columnHeightPx,
  };
}
