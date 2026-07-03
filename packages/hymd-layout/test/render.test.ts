import { describe, expect, it } from 'vitest';
import { parseHymd } from '@hymd/parser';
import { renderDocumentBlocks } from '../src/render.js';

const SAMPLE = `---
title: 结构计算书
theme: engineering-report
page:
  preset: A4
  columns: 2
  margin_mm: [25, 20, 25, 20]
---

# 设计说明

正文段落，**加粗**与 \`行内代码\`。

\`\`\`sheet id=load-table
rows: 20
cols: 8
snapshot: ./x.hy.assets/load-table.univer.json
\`\`\`

| 项目 | 数值 |
| --- | --- |
| 安全系数 | 1.35 |

\`\`\`layout id=summary-box
width_mm: 160
height_mm: 40
anchor: column-1
\`\`\`

\`\`\`javascript
console.log('plain');
\`\`\`
`;

describe('renderDocumentBlocks', () => {
  const blocks = renderDocumentBlocks(parseHymd(SAMPLE));

  it('skips frontmatter and yields one entry per top-level block', () => {
    expect(blocks.map((b) => b.kind)).toEqual([
      'prose', // h1
      'prose', // p
      'sheet',
      'prose', // table
      'layout',
      'prose', // js code
    ]);
    for (const b of blocks) expect(b.html.length).toBeGreaterThan(0);
  });

  it('renders prose with remark-rehype (headings/strong/table)', () => {
    expect(blocks[0].html).toBe('<h1>设计说明</h1>');
    expect(blocks[1].html).toContain('<strong>加粗</strong>');
    expect(blocks[3].html).toContain('<table>');
    expect(blocks[3].html).toContain('<td>1.35</td>');
  });

  it('renders sheet degradation card with id and dims', () => {
    const sheet = blocks[2].html;
    expect(sheet).toContain('hymd-flow-card-sheet');
    expect(sheet).toContain('load-table');
    expect(sheet).toContain('8 列 × 20 行');
    expect(sheet).toContain('load-table.univer.json');
  });

  it('renders layout block as mm-sized placeholder box', () => {
    const layout = blocks[4].html;
    expect(layout).toContain('hymd-layout-box');
    expect(layout).toContain('width:calc(var(--hymd-mm) * 160)');
    expect(layout).toContain('height:calc(var(--hymd-mm) * 40)');
    expect(layout).toContain('anchor: column-1');
  });

  it('keeps ordinary code fences as pre/code', () => {
    expect(blocks[5].html).toContain('<pre>');
    expect(blocks[5].html).toContain('console.log');
  });

  it('escapes html in card fields', () => {
    const doc = parseHymd('```sheet id=a\nsnapshot: ./<b>.json\n```\n');
    const [card] = renderDocumentBlocks(doc);
    expect(card.html).not.toContain('<b>');
    expect(card.html).toContain('&lt;b&gt;');
  });
});
