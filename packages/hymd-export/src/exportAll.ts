import { exportDocx, type DocxExportResult } from './exportDocx.js';
import { exportPdf, type PdfExportResult } from './exportPdf.js';
import { exportPptx, type PptxExportResult } from './exportPptx.js';
import type { ExportOptions } from './exportShared.js';

export interface AllExportResult {
  docx?: DocxExportResult;
  pptx?: PptxExportResult;
  pdf?: PdfExportResult;
  /** 各格式失败原因（格式名 → 错误消息） */
  errors: Record<string, string>;
  warnings: string[];
}

/** 一键导出 docx + pptx + pdf；单格式失败不阻断其余格式 */
export async function exportAll(options: ExportOptions): Promise<AllExportResult> {
  const result: AllExportResult = { errors: {}, warnings: [] };

  try {
    result.docx = await exportDocx(options);
    result.warnings.push(...result.docx.warnings);
  } catch (e) {
    result.errors.docx = e instanceof Error ? e.message : String(e);
  }

  try {
    result.pptx = await exportPptx(options);
    result.warnings.push(...result.pptx.warnings);
  } catch (e) {
    result.errors.pptx = e instanceof Error ? e.message : String(e);
  }

  try {
    result.pdf = await exportPdf(options);
    result.warnings.push(...result.pdf.warnings);
  } catch (e) {
    result.errors.pdf = e instanceof Error ? e.message : String(e);
  }

  result.warnings = [...new Set(result.warnings)];

  if (!result.docx && !result.pptx && !result.pdf) {
    const detail = Object.entries(result.errors)
      .map(([fmt, msg]) => `${fmt}: ${msg}`)
      .join('\n');
    throw new Error(`导出全部失败：\n${detail}`);
  }
  return result;
}
