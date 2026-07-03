import { describe, expect, it } from 'vitest';
import { findSafeSplitIndex, paginate } from '../src/paginate.js';
import { FakePaginationHost, type FakeBlockSpec } from './fakeHost.js';

/** 栏高 100，行高 10，每行 10 字 → 每栏最多 10 行 */
function run(specs: FakeBlockSpec[], columns = 2, columnHeight = 100) {
  const host = new FakePaginationHost(specs, columns, columnHeight, 10, 10);
  const result = paginate(host, specs.length, { columns }, host.tailBlockIndexOf);
  return { host, result };
}

const cjk = (n: number) => '汉'.repeat(n);

describe('paginate — 基础行为', () => {
  it('empty document keeps single empty page', () => {
    const { host, result } = run([]);
    expect(result.pages).toBe(1);
    expect(host.flatten()).toHaveLength(0);
  });

  it('small blocks stay in first column', () => {
    const { host, result } = run([{ height: 30 }, { height: 30 }, { height: 30 }]);
    expect(result.pages).toBe(1);
    expect(host.pages[0][0]).toHaveLength(3);
    expect(host.pages[0][1]).toHaveLength(0);
  });

  it('overflowing fixed block moves to next column, then next page', () => {
    const { host, result } = run([
      { height: 80 },
      { height: 80 }, // 不入第 1 栏 → 第 2 栏
      { height: 80 }, // → 第 2 页第 1 栏
    ]);
    expect(result.pages).toBe(2);
    expect(host.pages[0][0].map((e) => e.blockIndex)).toEqual([0]);
    expect(host.pages[0][1].map((e) => e.blockIndex)).toEqual([1]);
    expect(host.pages[1][0].map((e) => e.blockIndex)).toEqual([2]);
  });

  it('trims trailing empty pages', () => {
    const { host } = run([{ height: 10 }]);
    expect(host.pageCount()).toBe(1);
  });
});

describe('paginate — 段落切分', () => {
  it('splits a long CJK paragraph across columns without losing characters', () => {
    // 250 字 → 25 行 → 需要 3 栏（每栏 10 行）
    const text = cjk(250);
    const { host, result } = run([{ text }]);
    expect(result.pages).toBe(2);
    expect(host.joinTextOf(0)).toBe(text);
    // 每栏都不溢出
    for (let p = 0; p < host.pageCount(); p += 1) {
      for (let c = 0; c < 2; c += 1) {
        expect(host.isOverflowing({ page: p, col: c })).toBe(false);
      }
    }
  });

  it('keeps whitespace-trimmed split lossless modulo spaces', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const { host } = run([{ text: words }]);
    expect(host.joinTextOf(0).replace(/\s+/g, '')).toBe(words.replace(/\s+/g, ''));
  });

  it('mixed fixed + splittable blocks preserve source order', () => {
    const text = cjk(120);
    const { host } = run([{ height: 50 }, { text }, { height: 40 }]);
    const seq = host.flatten().map((e) => e.blockIndex);
    const sorted = [...seq].sort((a, b) => a - b);
    expect(seq).toEqual(sorted);
    expect(new Set(seq)).toEqual(new Set([0, 1, 2]));
    expect(host.joinTextOf(1)).toBe(text);
  });
});

describe('paginate — 极端输入终止性', () => {
  it('single unsplittable block taller than column stays clipped, no infinite loop', () => {
    const { host, result } = run([{ height: 500 }]);
    expect(result.pages).toBe(1);
    expect(host.pages[0][0]).toHaveLength(1);
  });

  it('many oversized blocks each occupy one column', () => {
    const specs = Array.from({ length: 6 }, () => ({ height: 500 }));
    const { host, result } = run(specs);
    expect(result.pages).toBe(3); // 6 块 / 每页 2 栏
    const seq = host.flatten().map((e) => e.blockIndex);
    expect(seq).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('giant paragraph spanning many pages remains lossless', () => {
    const text = cjk(2000); // 200 行 → 20 栏 → 10 页
    const { host, result } = run([{ text }]);
    expect(result.pages).toBe(10);
    expect(host.joinTextOf(0)).toBe(text);
  });

  it('single column layout works', () => {
    const { host, result } = run([{ text: cjk(150) }], 1);
    expect(result.pages).toBe(2);
    expect(host.joinTextOf(0)).toBe(cjk(150));
  });
});

describe('findSafeSplitIndex', () => {
  it('prefers whitespace boundary within lookback window', () => {
    const text = 'hello world foobar';
    // idx 落在 foobar 内 → 回退到空格
    expect(findSafeSplitIndex(text, 14)).toBe(11);
  });

  it('returns clamped index for CJK (no whitespace)', () => {
    expect(findSafeSplitIndex(cjk(50), 25)).toBe(25);
    expect(findSafeSplitIndex(cjk(50), 0)).toBe(1);
    expect(findSafeSplitIndex(cjk(50), 999)).toBe(49);
  });
});
