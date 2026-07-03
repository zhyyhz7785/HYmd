/** 浏览器/webview 安全入口：不含 node:fs 的 parseFile 链 */
export { parseHymd } from './parse.js';
export {
  BLOCK_REGISTRY,
  isHymdBlockType,
  normalizeBlockLang,
  parseMetaString,
  serializeBlockInfo,
  serializeMetaString,
  validateBlockBody,
} from './blocks.js';
export { findBlockById, listSheetBlocks, updateBlockBody } from './mutate.js';
export { serializeHymd, serializeHymdWithFrontmatter } from './serialize.js';
export {
  buildExternalSheetBody,
  buildInlineSheetBody,
  resolveSheetSource,
  sheetBodyForEmbed,
  sheetBodyForExport,
  sheetDimensions,
} from './sheet.js';
export type { SheetSource } from './sheet.js';
export { resolveSlideSource, slideTheme } from './slide.js';
export type { SlideSource } from './slide.js';
export type {
  BlockTypeDefinition,
  HymdBlock,
  HymdBlockType,
  HymdDocument,
  HymdFrontmatter,
} from './types.js';
