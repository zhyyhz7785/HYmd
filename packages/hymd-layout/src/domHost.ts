/**
 * PaginationHost 的真实 DOM 实现（浏览器/webview 环境）。
 *
 * DOM 结构（只读版，无拖拽把手，移植自 MarkdownEditor Flow 模式）：
 *   container(.hymd-pages)
 *     └─ .hymd-paper-wrap[data-page-index]
 *          └─ .hymd-paper
 *               ├─ .hymd-paper-inner   ← absolute inset = 边距
 *               │    ├─ .hymd-col[data-col-index]（overflow:hidden，固定高）
 *               │    └─ .hymd-col-gap
 *               └─ .hymd-margin-guide.top/.right/.bottom/.left
 */

import type { PagePixelGeometry } from './geometry.js';
import type { ColumnRef, PaginationHost } from './paginate.js';

const OVERFLOW_TOLERANCE_PX = 2;

function isParagraphSplittable(el: Element | null): el is HTMLElement {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName.toLowerCase();
  if (tag !== 'p' && tag !== 'blockquote') return false;
  if (el.children.length > 0) return false;
  const text = (el.textContent ?? '').replace(/\r/g, '');
  return text.length > 1;
}

export class DomPaginationHost implements PaginationHost {
  private readonly pages: HTMLElement[] = [];
  private readonly columns: HTMLElement[][] = [];

  constructor(
    private readonly container: HTMLElement,
    private readonly templates: readonly HTMLElement[],
    private readonly px: PagePixelGeometry,
  ) {}

  reset(): void {
    this.container.innerHTML = '';
    this.pages.length = 0;
    this.columns.length = 0;
    this.createPage();
  }

  ensurePage(pageIndex: number): void {
    while (this.pages.length <= pageIndex) this.createPage();
  }

  pageCount(): number {
    return this.pages.length;
  }

  trimPages(keep: number): void {
    const safe = Math.max(1, keep);
    while (this.pages.length > safe) {
      const wrap = this.pages.pop();
      this.columns.pop();
      wrap?.remove();
    }
  }

  columnHasContent(ref: ColumnRef): boolean {
    const col = this.column(ref);
    return !!col && col.children.length > 0;
  }

  appendBlock(ref: ColumnRef, blockIndex: number): void {
    const col = this.column(ref);
    if (!col) return;
    const template = this.templates[blockIndex];
    if (!template) return;
    const node = template.cloneNode(true) as HTMLElement;
    node.setAttribute('data-block-index', String(blockIndex));
    col.appendChild(node);
  }

  removeLastBlock(ref: ColumnRef): void {
    const col = this.column(ref);
    col?.lastElementChild?.remove();
  }

  blockCount(ref: ColumnRef): number {
    return this.column(ref)?.children.length ?? 0;
  }

  isOverflowing(ref: ColumnRef): boolean {
    const col = this.column(ref);
    if (!col) return false;
    return col.scrollHeight > col.clientHeight + OVERFLOW_TOLERANCE_PX;
  }

  moveLastBlockToStartOf(from: ColumnRef, to: ColumnRef): void {
    const fromCol = this.column(from);
    const toCol = this.column(to);
    const last = fromCol?.lastElementChild;
    if (!last || !toCol) return;
    toCol.insertBefore(last, toCol.firstChild);
  }

  splittableTailText(ref: ColumnRef): string | null {
    const last = this.column(ref)?.lastElementChild ?? null;
    if (!isParagraphSplittable(last)) return null;
    return (last.textContent ?? '').replace(/\r/g, '');
  }

  setTailText(ref: ColumnRef, text: string): void {
    const last = this.column(ref)?.lastElementChild;
    if (last) last.textContent = text;
  }

  prependTailBlock(from: ColumnRef, to: ColumnRef, blockIndex: number, text: string): void {
    const source = this.column(from)?.lastElementChild;
    const toCol = this.column(to);
    if (!source || !toCol) return;
    const tailNode = source.cloneNode(false) as HTMLElement;
    tailNode.textContent = text;
    tailNode.setAttribute('data-block-index', String(blockIndex));
    toCol.insertBefore(tailNode, toCol.firstChild);
  }

  /** normalize 阶段查询栏末块的源块索引 */
  tailBlockIndexOf = (ref: ColumnRef): number => {
    const last = this.column(ref)?.lastElementChild;
    const raw = last?.getAttribute('data-block-index') ?? '-1';
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : -1;
  };

  private column(ref: ColumnRef): HTMLElement | undefined {
    return this.columns[ref.page]?.[ref.col];
  }

  private createPage(): void {
    const doc = this.container.ownerDocument;
    const pageIndex = this.pages.length;

    const wrap = doc.createElement('div');
    wrap.className = 'hymd-paper-wrap';
    wrap.setAttribute('data-page-index', String(pageIndex));

    const paper = doc.createElement('div');
    paper.className = 'hymd-paper';
    paper.style.width = `${this.px.paperWidthPx}px`;
    paper.style.height = `${this.px.paperHeightPx}px`;

    const inner = doc.createElement('div');
    inner.className = 'hymd-paper-inner';
    inner.style.left = `${this.px.marginLeftPx}px`;
    inner.style.right = `${this.px.marginRightPx}px`;
    inner.style.top = `${this.px.marginTopPx}px`;
    inner.style.bottom = `${this.px.marginBottomPx}px`;

    const cols: HTMLElement[] = [];
    for (let c = 0; c < this.px.columns; c += 1) {
      const col = doc.createElement('div');
      col.className = 'hymd-col';
      col.setAttribute('data-col-index', String(c));
      col.style.width = `${this.px.columnWidthPx}px`;
      col.style.height = `${this.px.columnHeightPx}px`;
      inner.appendChild(col);
      cols.push(col);

      if (c < this.px.columns - 1) {
        const gap = doc.createElement('div');
        gap.className = 'hymd-col-gap';
        gap.style.width = `${this.px.gutterPx}px`;
        inner.appendChild(gap);
      }
    }

    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const guide = doc.createElement('div');
      guide.className = `hymd-margin-guide ${side}`;
      if (side === 'top') {
        guide.style.top = `${this.px.marginTopPx}px`;
        guide.style.left = `${this.px.marginLeftPx}px`;
        guide.style.right = `${this.px.marginRightPx}px`;
      } else if (side === 'bottom') {
        guide.style.bottom = `${this.px.marginBottomPx}px`;
        guide.style.left = `${this.px.marginLeftPx}px`;
        guide.style.right = `${this.px.marginRightPx}px`;
      } else if (side === 'left') {
        guide.style.left = `${this.px.marginLeftPx}px`;
        guide.style.top = `${this.px.marginTopPx}px`;
        guide.style.bottom = `${this.px.marginBottomPx}px`;
      } else {
        guide.style.right = `${this.px.marginRightPx}px`;
        guide.style.top = `${this.px.marginTopPx}px`;
        guide.style.bottom = `${this.px.marginBottomPx}px`;
      }
      paper.appendChild(guide);
    }

    paper.appendChild(inner);
    wrap.appendChild(paper);
    this.container.appendChild(wrap);
    this.pages.push(wrap);
    this.columns.push(cols);
  }
}
