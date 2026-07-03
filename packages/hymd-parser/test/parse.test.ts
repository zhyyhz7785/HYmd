import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseHymd, parseSample } from '../src/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function loadSample(name: string): string {
  return readFileSync(join(ROOT, 'samples', name), 'utf8');
}

describe('parseHymd — samples', () => {
  it('01-basic-prose: frontmatter, zero blocks', () => {
    const doc = parseSample('01-basic-prose.hy.md');
    expect(doc.frontmatter.title).toBe('HyMD 基础示例');
    expect(doc.frontmatter.theme).toBe('github-light');
    expect((doc.frontmatter.hymd as { version?: string })?.version).toBe('0.1');
    expect(doc.blocks).toHaveLength(0);
  });

  it('02-report-with-sheet: page + sheet + layout blocks', () => {
    const doc = parseSample('02-report-with-sheet.hy.md');
    expect(doc.frontmatter.title).toBe('结构计算书 — 荷载汇总');
    const page = doc.frontmatter.page as { preset?: string; columns?: number; margin_mm?: number[] };
    expect(page.preset).toBe('A4');
    expect(page.columns).toBe(2);
    expect(page.margin_mm).toEqual([25, 20, 25, 20]);

    expect(doc.blocks).toHaveLength(2);
    const sheet = doc.blocks.find((b) => b.type === 'sheet');
    expect(sheet?.id).toBe('load-table');
    expect(sheet?.body.rows).toBe(20);
    expect(sheet?.body.cols).toBe(8);
    expect(sheet?.body.snapshot).toContain('load-table.univer.json');

    const layout = doc.blocks.find((b) => b.type === 'layout');
    expect(layout?.id).toBe('layout-1');
    expect(layout?.body.width_mm).toBe(160);
  });

  it('03-slide-mixed: slide block + ordinary code untouched', () => {
    const doc = parseSample('03-slide-mixed.hy.md');
    expect(doc.blocks).toHaveLength(1);
    const slide = doc.blocks[0];
    expect(slide.type).toBe('slide');
    expect(slide.id).toBe('intro-deck');
    expect(slide.attrs.theme).toBe('default');
    expect(slide.body.source).toContain('intro-deck.marp.md');
  });

  it('parseMeta via sheet block attrs', () => {
    const text = loadSample('02-report-with-sheet.hy.md');
    const doc = parseHymd(text);
    expect(doc.blocks[0].attrs.id).toBe('load-table');
  });
});

describe('parseHymd — block registry', () => {
  it('recognizes all v0.1 block types', () => {
    const text = `
\`\`\`sheet id=t1
rows: 1
\`\`\`

\`\`\`slide id=s1
theme: default
\`\`\`

\`\`\`layout id=l1
width_mm: 10
\`\`\`

\`\`\`calc id=c1
formula: "=SUM(A1:A3)"
\`\`\`
`;
    const doc = parseHymd(text);
    expect(doc.blocks.map((b) => b.type)).toEqual(['sheet', 'slide', 'layout', 'calc']);
  });

  it('does not treat javascript as hymd block', () => {
    const text = '```javascript\nconsole.log(1)\n```';
    const doc = parseHymd(text);
    expect(doc.blocks).toHaveLength(0);
  });
});
