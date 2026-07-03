/**
 * 预览 CSS 生成：纸张结构（移植 flowCssTemplate 只读子集）+ 主题变量 + Markdown 元素样式。
 * 注入 <style> 使用；几何数值由 DomPaginationHost 以内联 style 写入，这里只管外观。
 */

import type { PagePixelGeometry } from './geometry.js';
import type { LayoutTheme } from './themes.js';
import { themeToCssVariables } from './themes.js';

export function buildPreviewCss(theme: LayoutTheme, px: PagePixelGeometry): string {
  const vars = themeToCssVariables(theme, px.scale);
  return `
.hymd-pages{
  ${vars}
  --hymd-mm:${px.scale}px;
  display:flex;
  flex-direction:column;
  gap:14px;
  align-items:flex-start;
  transform-origin:left top;
}
.hymd-paper-wrap{position:relative}
.hymd-paper{
  position:relative;
  background:var(--hymd-paper-bg);
  color:var(--hymd-text-color);
  font-family:var(--hymd-font-family);
  font-size:var(--hymd-font-size);
  line-height:var(--hymd-line-height);
  overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,0.35);
}
.hymd-paper-inner{
  position:absolute;
  display:flex;
  flex-direction:row;
  align-items:flex-start;
  overflow:hidden;
}
.hymd-col{
  flex:0 0 auto;
  overflow:hidden;
  min-height:0;
}
.hymd-col-gap{
  flex:0 0 auto;
  align-self:stretch;
  position:relative;
}
.hymd-pages.show-guides .hymd-col-gap:before{
  content:'';
  position:absolute;
  left:50%;
  top:0;
  bottom:0;
  width:1px;
  margin-left:-0.5px;
  background:rgba(110,118,129,0.55);
}
.hymd-margin-guide{
  position:absolute;
  z-index:6;
  background:rgba(0,0,0,0.75);
  pointer-events:none;
  display:none;
}
.hymd-pages.show-guides .hymd-margin-guide{display:block}
.hymd-margin-guide.left,.hymd-margin-guide.right{width:1px}
.hymd-margin-guide.top,.hymd-margin-guide.bottom{height:1px}

/* ---- Markdown 元素（em 口径随主题字号缩放；移植 flowCssTemplate 排版 token） ---- */
.hymd-col h1{font-size:1.6em;margin:.4em 0 .35em;color:var(--hymd-heading-color);border-bottom:1px solid var(--hymd-heading-border);padding-bottom:3px}
.hymd-col h2{font-size:1.3em;margin:.5em 0 .3em;color:var(--hymd-heading-color)}
.hymd-col h3{font-size:1.1em;margin:.5em 0 .25em;color:var(--hymd-heading-color)}
.hymd-col h4,.hymd-col h5,.hymd-col h6{font-size:1em;margin:.8em 0 .3em;color:var(--hymd-heading-color)}
.hymd-col p{margin:0 0 .55em}
.hymd-col a{color:var(--hymd-link-color);text-decoration:none}
.hymd-col ul,.hymd-col ol{padding-left:1.4em;margin:.3em 0}
.hymd-col li{margin:0 0 .2em}
.hymd-col blockquote{border-left:3px solid var(--hymd-quote-border);padding:3px .8em;margin:.4em 0;color:var(--hymd-quote-color);background:var(--hymd-quote-bg)}
.hymd-col code{background:var(--hymd-code-bg);color:var(--hymd-code-color);padding:1px 4px;border-radius:2px;font-family:var(--hymd-font-family-mono);font-size:.9em}
.hymd-col pre{background:var(--hymd-pre-bg);border:1px solid var(--hymd-pre-border);border-radius:3px;padding:6px;margin:4px 0;overflow-x:hidden}
.hymd-col pre code{background:none;padding:0;white-space:pre-wrap;word-break:break-all}
.hymd-col table{border-collapse:collapse;width:auto;max-width:100%;margin:6px auto}
.hymd-col th,.hymd-col td{border:1px solid var(--hymd-table-border);padding:3px 6px;font-size:.9em;text-align:center;vertical-align:middle;word-break:break-word;overflow-wrap:break-word}
.hymd-col th{background:var(--hymd-table-head-bg);font-weight:bold}
.hymd-col tr:nth-child(even){background:var(--hymd-table-stripe-bg)}
.hymd-col hr{border:none;border-top:1px solid var(--hymd-heading-border);margin:.6em 0}
.hymd-col img{max-width:100%}

/* ---- HyMD 扩展块降级卡片 ---- */
.hymd-flow-card{
  display:flex;
  align-items:center;
  gap:.5em;
  border:1px dashed var(--hymd-table-border);
  border-radius:4px;
  padding:.45em .7em;
  margin:.4em 0;
  font-size:.9em;
  background:var(--hymd-pre-bg);
}
.hymd-flow-badge{
  flex:none;
  font-size:.85em;
  padding:0 .5em;
  border-radius:3px;
  color:#ffffff;
  background:#3b82f6;
}
.hymd-flow-card-sheet .hymd-flow-badge{background:#16a34a}
.hymd-flow-card-slide .hymd-flow-badge{background:#9333ea}
.hymd-flow-card-calc .hymd-flow-badge{background:#d97706}
.hymd-flow-title{font-weight:bold}
.hymd-flow-meta{color:var(--hymd-quote-color);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ---- layout 块 mm 定尺占位框 ---- */
.hymd-layout-box{
  box-sizing:border-box;
  border:1px dashed #f97316;
  background:rgba(249,115,22,0.06);
  border-radius:3px;
  margin:.4em 0;
  display:flex;
  align-items:center;
  justify-content:center;
  overflow:hidden;
  max-width:100%;
}
.hymd-layout-box-label{
  font-size:.8em;
  color:#9a3412;
  padding:2px 6px;
  text-align:center;
}
`;
}
