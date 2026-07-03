/**
 * 测试用假测量器：用「字符数/行 × 行高」模型代替 DOM 溢出检测，
 * 使 paginate 算法可以在 node 环境确定性单测。
 */

import type { ColumnRef, PaginationHost } from '../src/paginate.js';

export interface FakeBlockSpec {
  /** 固定高度块（不可切分，如表格/卡片） */
  height?: number;
  /** 可切分文本块（段落模型） */
  text?: string;
}

interface FakeEntry {
  blockIndex: number;
  splittable: boolean;
  text?: string;
  height?: number;
}

export class FakePaginationHost implements PaginationHost {
  /** pages[p][c] = 栏内条目 */
  pages: FakeEntry[][][] = [];

  constructor(
    private readonly specs: readonly FakeBlockSpec[],
    private readonly columns: number,
    private readonly columnHeight: number,
    private readonly charsPerLine: number,
    private readonly lineHeight: number,
  ) {}

  private entryHeight(e: FakeEntry): number {
    if (e.text !== undefined) {
      return Math.max(1, Math.ceil(e.text.length / this.charsPerLine)) * this.lineHeight;
    }
    return e.height ?? 0;
  }

  private column(ref: ColumnRef): FakeEntry[] | undefined {
    return this.pages[ref.page]?.[ref.col];
  }

  reset(): void {
    this.pages = [];
    this.ensurePage(0);
  }

  ensurePage(pageIndex: number): void {
    while (this.pages.length <= pageIndex) {
      this.pages.push(Array.from({ length: this.columns }, () => []));
    }
  }

  pageCount(): number {
    return this.pages.length;
  }

  trimPages(keep: number): void {
    const safe = Math.max(1, keep);
    while (this.pages.length > safe) this.pages.pop();
  }

  columnHasContent(ref: ColumnRef): boolean {
    return (this.column(ref)?.length ?? 0) > 0;
  }

  appendBlock(ref: ColumnRef, blockIndex: number): void {
    const spec = this.specs[blockIndex];
    this.column(ref)?.push({
      blockIndex,
      splittable: spec.text !== undefined,
      text: spec.text,
      height: spec.height,
    });
  }

  removeLastBlock(ref: ColumnRef): void {
    this.column(ref)?.pop();
  }

  blockCount(ref: ColumnRef): number {
    return this.column(ref)?.length ?? 0;
  }

  isOverflowing(ref: ColumnRef): boolean {
    const col = this.column(ref);
    if (!col) return false;
    const total = col.reduce((sum, e) => sum + this.entryHeight(e), 0);
    return total > this.columnHeight + 2;
  }

  moveLastBlockToStartOf(from: ColumnRef, to: ColumnRef): void {
    const src = this.column(from);
    const dst = this.column(to);
    const last = src?.pop();
    if (last && dst) dst.unshift(last);
  }

  splittableTailText(ref: ColumnRef): string | null {
    const col = this.column(ref);
    const last = col?.[col.length - 1];
    if (!last || !last.splittable || last.text === undefined || last.text.length <= 1) return null;
    return last.text;
  }

  setTailText(ref: ColumnRef, text: string): void {
    const col = this.column(ref);
    const last = col?.[col.length - 1];
    if (last) last.text = text;
  }

  prependTailBlock(_from: ColumnRef, to: ColumnRef, blockIndex: number, text: string): void {
    this.column(to)?.unshift({ blockIndex, splittable: true, text });
  }

  tailBlockIndexOf = (ref: ColumnRef): number => {
    const col = this.column(ref);
    const last = col?.[col.length - 1];
    return last ? last.blockIndex : -1;
  };

  /** 按 页→栏→条目 顺序展平（供断言内容完整性/顺序） */
  flatten(): FakeEntry[] {
    const out: FakeEntry[] = [];
    for (const page of this.pages) {
      for (const col of page) out.push(...col);
    }
    return out;
  }

  /** 拼接指定源块的全部文本片段 */
  joinTextOf(blockIndex: number): string {
    return this.flatten()
      .filter((e) => e.blockIndex === blockIndex && e.text !== undefined)
      .map((e) => e.text)
      .join('');
  }
}
