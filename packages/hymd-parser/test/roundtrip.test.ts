import { describe, expect, it } from 'vitest';
import { parseHymd, parseSample } from '../src/parse.js';
import { serializeHymd } from '../src/serialize.js';
import type { HymdBlock, HymdDocument } from '../src/types.js';

function blockSignature(blocks: HymdBlock[]): string {
  return blocks
    .map((b) => `${b.type}:${b.id}:${JSON.stringify(b.body)}`)
    .join('|');
}

function documentsSemanticallyEqual(a: HymdDocument, b: HymdDocument): boolean {
  if (a.blocks.length !== b.blocks.length) return false;
  if (blockSignature(a.blocks) !== blockSignature(b.blocks)) return false;

  const keysA = Object.keys(a.frontmatter).sort();
  const keysB = Object.keys(b.frontmatter).sort();
  if (keysA.join() !== keysB.join()) return false;
  for (const key of keysA) {
    if (JSON.stringify(a.frontmatter[key]) !== JSON.stringify(b.frontmatter[key])) {
      return false;
    }
  }
  return true;
}

const SAMPLE_FILES = [
  '01-basic-prose.hymd.md',
  '02-report-with-sheet.hymd.md',
  '03-slide-mixed.hymd.md',
] as const;

describe('serializeHymd roundtrip', () => {
  it.each(SAMPLE_FILES)('%s parse → serialize → parse', (file) => {
    const first = parseSample(file);
    const serialized = serializeHymd(first);
    const second = parseHymd(serialized);
    expect(documentsSemanticallyEqual(first, second)).toBe(true);
  });

  it('double roundtrip remains stable on block count', () => {
    const first = parseSample('02-report-with-sheet.hymd.md');
    let doc = first;
    for (let i = 0; i < 2; i++) {
      doc = parseHymd(serializeHymd(doc));
    }
    expect(doc.blocks).toHaveLength(2);
    expect(doc.frontmatter.title).toBe('结构计算书 — 荷载汇总');
  });

  it('serialized output still contains fenced hymd blocks', () => {
    const doc = parseSample('02-report-with-sheet.hymd.md');
    const out = serializeHymd(doc);
    expect(out).toContain('```sheet');
    expect(out).toContain('id=load-table');
    expect(out).toContain('rows: 20');
  });
});
