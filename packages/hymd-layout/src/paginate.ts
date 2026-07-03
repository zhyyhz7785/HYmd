/**
 * 分页引擎：移植 HyCADTool.MarkdownEditor PreviewHtmlRenderer 的 Flow 分页算法
 * （distributeBlocksSequential / normalizeOverflowFrom / splitParagraphToNext）。
 *
 * 算法通过 PaginationHost 抽象与 DOM 解耦：
 *   - 生产实现：DomPaginationHost（真实 DOM 溢出检测）
 *   - 测试实现：假测量器（文本行高模型），保证算法可在 node 环境单测
 */

export interface ColumnRef {
  page: number;
  col: number;
}

export interface PaginationHost {
  /** 重置为单页空栏 */
  reset(): void;
  /** 确保页存在（不足则创建） */
  ensurePage(pageIndex: number): void;
  pageCount(): number;
  /** 裁掉尾部页，至少保留 keep 页 */
  trimPages(keep: number): void;
  columnHasContent(ref: ColumnRef): boolean;

  /** 将源块 blockIndex 克隆追加到指定栏 */
  appendBlock(ref: ColumnRef, blockIndex: number): void;
  removeLastBlock(ref: ColumnRef): void;
  blockCount(ref: ColumnRef): number;
  /** DOM 口径：scrollHeight > clientHeight + 2 */
  isOverflowing(ref: ColumnRef): boolean;
  /** 将 from 栏最后一个块移动到 to 栏开头 */
  moveLastBlockToStartOf(from: ColumnRef, to: ColumnRef): void;

  /** 末块可切分（纯文本段落/引用）时返回其文本，否则 null */
  splittableTailText(ref: ColumnRef): string | null;
  /** 覆写末块文本（用于二分探测与落定 head） */
  setTailText(ref: ColumnRef, text: string): void;
  /** 以 from 栏末块为模板，把尾段文本作为新块插入 to 栏开头 */
  prependTailBlock(from: ColumnRef, to: ColumnRef, blockIndex: number, text: string): void;
}

export interface PaginationOptions {
  /** 每页栏数（≥1） */
  columns: number;
}

export interface PaginationResult {
  pages: number;
}

function nextPosition(ref: ColumnRef, columns: number): ColumnRef {
  const col = ref.col + 1;
  return col >= columns ? { page: ref.page + 1, col: 0 } : { page: ref.page, col };
}

/** 向左寻找空白切点，避免切在词中间（CJK 直接按字符切）；与 C# findSafeSplitIndex 一致 */
export function findSafeSplitIndex(text: string, idx: number): number {
  if (!text) return idx;
  const safe = Math.max(1, Math.min(idx, text.length - 1));
  let left = safe;
  while (left > 1) {
    if (/\s/.test(text.charAt(left))) return left;
    left -= 1;
    if (safe - left > 24) break;
  }
  return safe;
}

function trySplitTailToNext(
  host: PaginationHost,
  ref: ColumnRef,
  blockIndex: number,
  columns: number,
): boolean {
  const original = host.splittableTailText(ref);
  if (original === null || original.length < 2) return false;

  let low = 1;
  let high = original.length - 1;
  let best = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const probe = findSafeSplitIndex(original, mid);
    host.setTailText(ref, original.slice(0, probe));
    if (!host.isOverflowing(ref)) {
      best = probe;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (best <= 0 || best >= original.length) {
    host.setTailText(ref, original);
    return false;
  }
  const head = original.slice(0, best).replace(/\s+$/, '');
  const tail = original.slice(best).replace(/^\s+/, '');
  if (!head || !tail) {
    host.setTailText(ref, original);
    return false;
  }
  host.setTailText(ref, head);
  if (host.isOverflowing(ref)) {
    host.setTailText(ref, original);
    return false;
  }
  const next = nextPosition(ref, columns);
  host.ensurePage(next.page);
  host.prependTailBlock(ref, next, blockIndex, tail);
  return true;
}

function normalizeOverflowFrom(
  host: PaginationHost,
  start: ColumnRef,
  columns: number,
  tailBlockIndexOf: (ref: ColumnRef) => number,
): void {
  let guard = 0;
  while (guard < 4000) {
    guard += 1;
    let changed = false;
    for (let p = start.page; p < host.pageCount(); p += 1) {
      for (let c = p === start.page ? start.col : 0; c < columns; c += 1) {
        const ref = { page: p, col: c };
        while (host.isOverflowing(ref)) {
          if (host.blockCount(ref) === 0) break;
          if (host.blockCount(ref) === 1) {
            const blockIndex = tailBlockIndexOf(ref);
            if (blockIndex >= 0 && trySplitTailToNext(host, ref, blockIndex, columns)) {
              changed = true;
              continue;
            }
            break;
          }
          const next = nextPosition(ref, columns);
          host.ensurePage(next.page);
          host.moveLastBlockToStartOf(ref, next);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
}

/**
 * 顺序分块分页：逐块追加 → 溢出则整块后移 → 独占仍溢出则二分切段 → 裁掉尾部空页。
 * tailBlockIndexOf 供 normalize 阶段查询栏末块的源块索引（DOM 实现读 data-block-index）。
 */
export function paginate(
  host: PaginationHost,
  blockCount: number,
  options: PaginationOptions,
  tailBlockIndexOf: (ref: ColumnRef) => number,
): PaginationResult {
  const columns = Math.max(1, options.columns);
  host.reset();

  let cursor: ColumnRef = { page: 0, col: 0 };
  for (let b = 0; b < blockCount; b += 1) {
    let placed = false;
    let guard = 0;
    while (!placed && guard < 2000) {
      guard += 1;
      host.ensurePage(cursor.page);
      const ref = { ...cursor };
      host.appendBlock(ref, b);
      if (!host.isOverflowing(ref)) {
        placed = true;
        break;
      }
      if (host.blockCount(ref) === 1) {
        if (!trySplitTailToNext(host, ref, b, columns)) {
          // 独占仍溢出且不可切：保留在原栏（overflow:hidden 裁剪），推进游标
          placed = true;
          cursor = nextPosition(ref, columns);
        } else {
          normalizeOverflowFrom(host, ref, columns, tailBlockIndexOf);
          cursor = nextPosition(ref, columns);
          placed = true;
        }
        break;
      }
      host.removeLastBlock(ref);
      cursor = nextPosition(ref, columns);
    }
  }

  normalizeOverflowFrom(host, { page: 0, col: 0 }, columns, tailBlockIndexOf);

  // 裁剪尾部空页（与 C# distributeBlocksSequential 尾段一致）
  let usedPages = Math.max(1, host.pageCount());
  for (let p = host.pageCount() - 1; p >= 1; p -= 1) {
    let hasAny = false;
    for (let c = 0; c < columns; c += 1) {
      if (host.columnHasContent({ page: p, col: c })) {
        hasAny = true;
        break;
      }
    }
    if (hasAny) break;
    usedPages = p;
  }
  host.trimPages(usedPages);

  return { pages: host.pageCount() };
}
