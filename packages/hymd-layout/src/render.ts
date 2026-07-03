/**
 * 文档渲染：HymdDocument → 顶级块 HTML 字符串序列。
 *
 * 每个顶级 mdast 节点独立转换为一段 HTML，供分页引擎按块分配到栏。
 * prose 走 remark-rehype；HyMD 扩展块（sheet/slide/calc）生成降级卡片；
 * layout 块生成 mm 定尺占位框（尺寸用 calc(var(--hymd-mm) * N) 表达）。
 */

import type { Root, RootContent } from 'mdast';
import rehypeStringify from 'rehype-stringify';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { isHymdBlockType, normalizeBlockLang, parseMetaString } from '@hymd/parser';
import type { HymdBlock, HymdBlockType, HymdDocument } from '@hymd/parser';

export interface RenderedBlock {
  kind: 'prose' | HymdBlockType;
  html: string;
}

const proseProcessor = unified().use(remarkRehype).use(rehypeStringify);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function proseNodeToHtml(node: RootContent): string {
  const root: Root = { type: 'root', children: [node] };
  const hast = proseProcessor.runSync(root);
  return String(proseProcessor.stringify(hast)).trim();
}

function findBlockForNode(
  doc: HymdDocument,
  node: RootContent,
  fallbackType: HymdBlockType,
  seen: Map<HymdBlockType, number>,
): HymdBlock | undefined {
  const nth = (seen.get(fallbackType) ?? 0) + 1;
  seen.set(fallbackType, nth);
  if (node.position?.start?.offset !== undefined) {
    const byPos = doc.blocks.find(
      (b) => b.type === fallbackType && b.position?.start?.offset === node.position?.start?.offset,
    );
    if (byPos) return byPos;
  }
  // 回退：同类型第 n 个
  let count = 0;
  for (const b of doc.blocks) {
    if (b.type !== fallbackType) continue;
    count += 1;
    if (count === nth) return b;
  }
  return undefined;
}

function numberOr(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function renderSheetCard(block: HymdBlock | undefined): string {
  const id = block?.id ?? 'sheet';
  const rows = numberOr(block?.body.rows, 0);
  const cols = numberOr(block?.body.cols, 0);
  const snapshot = typeof block?.body.snapshot === 'string' ? block.body.snapshot : '';
  const dims = rows > 0 || cols > 0 ? `${cols} 列 × ${rows} 行` : '尺寸未声明';
  const meta = snapshot ? `${dims} · ${snapshot}` : dims;
  return (
    `<div class="hymd-flow-card hymd-flow-card-sheet" data-block-id="${escapeHtml(id)}">` +
    `<span class="hymd-flow-badge">表格</span>` +
    `<span class="hymd-flow-title">${escapeHtml(id)}</span>` +
    `<span class="hymd-flow-meta">${escapeHtml(meta)}</span>` +
    `</div>`
  );
}

function renderSlideCard(block: HymdBlock | undefined): string {
  const id = block?.id ?? 'slide';
  const source = typeof block?.body.source === 'string' ? block.body.source : '';
  const theme = block?.attrs.theme ?? '';
  const parts = [theme ? `主题 ${theme}` : '', source].filter(Boolean).join(' · ');
  return (
    `<div class="hymd-flow-card hymd-flow-card-slide" data-block-id="${escapeHtml(id)}">` +
    `<span class="hymd-flow-badge">幻灯</span>` +
    `<span class="hymd-flow-title">${escapeHtml(id)}</span>` +
    `<span class="hymd-flow-meta">${escapeHtml(parts || '未声明来源')}</span>` +
    `</div>`
  );
}

function renderCalcCard(block: HymdBlock | undefined): string {
  const id = block?.id ?? 'calc';
  const formula = typeof block?.body.formula === 'string' ? block.body.formula : '';
  return (
    `<div class="hymd-flow-card hymd-flow-card-calc" data-block-id="${escapeHtml(id)}">` +
    `<span class="hymd-flow-badge">计算</span>` +
    `<span class="hymd-flow-title">${escapeHtml(id)}</span>` +
    `<span class="hymd-flow-meta">${escapeHtml(formula || '公式未声明')}</span>` +
    `</div>`
  );
}

function renderLayoutBox(block: HymdBlock | undefined): string {
  const id = block?.id ?? 'layout';
  const widthMm = numberOr(block?.body.width_mm, 0);
  const heightMm = numberOr(block?.body.height_mm, 0);
  const anchor = typeof block?.body.anchor === 'string' ? block.body.anchor : '';
  const styles: string[] = [];
  if (widthMm > 0) styles.push(`width:calc(var(--hymd-mm) * ${widthMm})`);
  if (heightMm > 0) styles.push(`height:calc(var(--hymd-mm) * ${heightMm})`);
  const label = [
    `layout: ${id}`,
    widthMm > 0 || heightMm > 0 ? `${widthMm}×${heightMm} mm` : '尺寸未声明',
    anchor ? `anchor: ${anchor}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    `<div class="hymd-layout-box" data-block-id="${escapeHtml(id)}"` +
    (styles.length ? ` style="${styles.join(';')}"` : '') +
    `><span class="hymd-layout-box-label">${escapeHtml(label)}</span></div>`
  );
}

/** 顶级块渲染：跳过 frontmatter yaml 节点；扩展块出卡片/占位框，其余走 remark-rehype */
export function renderDocumentBlocks(doc: HymdDocument): RenderedBlock[] {
  const rendered: RenderedBlock[] = [];
  const seen = new Map<HymdBlockType, number>();

  for (const node of doc.ast.children) {
    if (node.type === 'yaml') continue;

    if (node.type === 'code' && isHymdBlockType(node.lang ?? '')) {
      const blockType = normalizeBlockLang(node.lang ?? '');
      const block = findBlockForNode(doc, node, blockType, seen);
      switch (blockType) {
        case 'sheet':
          rendered.push({ kind: 'sheet', html: renderSheetCard(block) });
          break;
        case 'slide':
          rendered.push({ kind: 'slide', html: renderSlideCard(block) });
          break;
        case 'calc':
          rendered.push({ kind: 'calc', html: renderCalcCard(block) });
          break;
        case 'layout':
          rendered.push({ kind: 'layout', html: renderLayoutBox(block) });
          break;
      }
      continue;
    }

    const html = proseNodeToHtml(node);
    if (html) rendered.push({ kind: 'prose', html });
  }

  return rendered;
}

/** 供测试与诊断：从 info string 提取属性 */
export { parseMetaString };
