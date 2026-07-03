export {
  DEFAULT_PAGE_GEOMETRY,
  PAPER_PRESETS,
  mmToPx,
  pxToMm,
  resolvePageGeometry,
  toPixelGeometry,
} from './geometry.js';
export type { PageGeometry, PagePixelGeometry, PaperOrientation } from './geometry.js';

export { THEMES, resolveTheme, themeToCssVariables } from './themes.js';
export type { LayoutTheme } from './themes.js';

export { renderDocumentBlocks } from './render.js';
export type { RenderedBlock } from './render.js';

export { findSafeSplitIndex, paginate } from './paginate.js';
export type {
  ColumnRef,
  PaginationHost,
  PaginationOptions,
  PaginationResult,
} from './paginate.js';

export { DomPaginationHost } from './domHost.js';

export { buildPreviewCss } from './css.js';
