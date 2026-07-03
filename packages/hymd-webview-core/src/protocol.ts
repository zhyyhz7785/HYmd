/** HyMD 编辑器 UI 皮肤：hymd=清爽默认，vscode=M1 融入风格 */
export type HymdUiStyle = 'hymd' | 'vscode';

export const DEFAULT_HYMD_UI_STYLE: HymdUiStyle = 'hymd';

/** 导出格式 */
export type HymdExportFormat = 'docx' | 'pptx' | 'pdf' | 'all';

/** Layout 预览 Host → Webview */
export type LayoutHostToWebviewMessage =
  | { type: 'layoutInit'; content: string }
  | { type: 'layoutUpdate'; content: string };

/** Layout 预览 Webview → Host */
export type LayoutWebviewToHostMessage =
  | { type: 'layoutReady' }
  | { type: 'layoutStats'; page: number; totalPages: number; geoDeltaMm: number }
  | { type: 'layoutLog'; message: string };

/** Host → Webview */
export type HostToWebviewMessage =
  | {
      type: 'init';
      content: string;
      theme: 'light' | 'dark' | 'high-contrast';
      uiStyle: HymdUiStyle;
      /** 独立壳：文档绝对路径，供 sheet 块 snapshot 解析 */
      documentPath?: string;
      /** 独立壳：YAML frontmatter（含 --- 行） */
      frontmatter?: string;
    }
  | { type: 'externalUpdate'; content: string; version: number }
  | { type: 'themeChanged'; theme: 'light' | 'dark' | 'high-contrast' }
  | { type: 'uiStyleChanged'; uiStyle: HymdUiStyle }
  | { type: 'sheetSnapshotData'; blockId: string; data?: unknown; error?: string }
  | { type: 'sheetSaved'; blockId: string; ok: boolean; snapshotPath?: string; error?: string }
  | { type: 'slideSourceData'; blockId: string; markdown?: string; sourcePath?: string; error?: string }
  | { type: 'fileResult'; requestId: string; ok: boolean; content?: string; error?: string };

/** Webview → Host */
export type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'edit'; content: string; version: number }
  | { type: 'log'; message: string }
  | { type: 'requestSheetSnapshot'; blockId: string; src?: string }
  | { type: 'saveSheetSnapshot'; blockId: string; src?: string; data: unknown }
  | { type: 'overlayState'; open: boolean }
  | { type: 'requestSlideSource'; blockId: string }
  | { type: 'openSlideSource'; blockId: string }
  | { type: 'requestExport'; format: HymdExportFormat }
  | { type: 'readFile'; requestId: string; relPath: string }
  | { type: 'writeFile'; requestId: string; relPath: string; content: string };

export const HymdBlockTypes = ['sheet', 'slide', 'layout', 'calc'] as const;
export type HymdBlockTypeName = (typeof HymdBlockTypes)[number];

export function isHymdBlockLang(lang: string | undefined | null): lang is HymdBlockTypeName {
  if (!lang) return false;
  const first = lang.trim().split(/\s+/)[0]?.toLowerCase();
  return (HymdBlockTypes as readonly string[]).includes(first ?? '');
}

export function extractBlockId(lang: string, body: string): string | undefined {
  const metaPart = lang.trim().split(/\s+/).slice(1).join(' ');
  const idMatch = /(?:^|\s)id=(?:\"([^\"]+)\"|'([^']+)'|(\S+))/.exec(metaPart);
  if (idMatch) return idMatch[1] ?? idMatch[2] ?? idMatch[3];
  const bodyMatch = /^id:\s*(.+)$/m.exec(body);
  return bodyMatch?.[1]?.trim();
}

/** 从块体 YAML 文本解析 snapshot 路径 */
export function extractSnapshotPath(body: string): string | undefined {
  const m = /^snapshot:\s*(.+)$/m.exec(body);
  return m?.[1]?.trim();
}

/** 从块体判断是否有内嵌 data（简化：检测 data: 行） */
export function hasInlineData(body: string): boolean {
  return /^data:\s*$/m.test(body) || /^data:\s*\S/m.test(body);
}
