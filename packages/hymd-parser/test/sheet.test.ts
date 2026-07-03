import { describe, expect, it } from 'vitest';
import { parseHymd } from '../src/parse.js';
import { serializeHymd } from '../src/serialize.js';
import { updateBlockBody } from '../src/mutate.js';
import {
  buildInlineSheetBody,
  resolveSheetSource,
  sheetBodyForEmbed,
  sheetBodyForExport,
} from '../src/sheet.js';
import { extractFormulaCells } from '@hymd/blocks-sheet';

const SNAPSHOT_WITH_FORMULA = {
  id: 't1',
  name: 'Test',
  sheetOrder: ['sheet1'],
  sheets: {
    sheet1: {
      id: 'sheet1',
      name: 'Sheet1',
      rowCount: 10,
      columnCount: 5,
      cellData: {
        '0': { '0': { v: '合计' } },
        '1': { '1': { f: '=SUM(B2:B3)', v: 5.5 } },
      },
    },
  },
};

describe('resolveSheetSource', () => {
  it('external snapshot path', () => {
    const doc = parseHymd('```sheet id=t1\nrows: 3\ncols: 2\nsnapshot: ./a.univer.json\n```');
    const src = resolveSheetSource(doc.blocks[0]);
    expect(src.kind).toBe('external');
    if (src.kind === 'external') expect(src.path).toBe('./a.univer.json');
  });

  it('inline data', () => {
    const md = `\`\`\`sheet id=t2\nrows: 5\ncols: 3\ndata:\n  id: inline-1\n  sheetOrder:\n    - sheet1\n  sheets:\n    sheet1:\n      id: sheet1\n\`\`\``;
    const doc = parseHymd(md);
    const src = resolveSheetSource(doc.blocks[0]);
    expect(src.kind).toBe('inline');
  });

  it('empty when no source', () => {
    const doc = parseHymd('```sheet id=t3\nrows: 3\ncols: 2\n```');
    expect(resolveSheetSource(doc.blocks[0]).kind).toBe('empty');
  });
});

describe('sheet formula roundtrip', () => {
  it('inline data preserves formulas through parse → serialize → parse', () => {
    const doc = parseHymd('```sheet id=formula-test\nrows: 10\ncols: 5\n```');
    const body = buildInlineSheetBody(10, 5, SNAPSHOT_WITH_FORMULA);
    const updated = updateBlockBody(doc, 'formula-test', body);
    const second = parseHymd(serializeHymd(updated));

    const src = resolveSheetSource(second.blocks[0]);
    expect(src.kind).toBe('inline');
    if (src.kind === 'inline') {
      const formulas = extractFormulaCells(src.data);
      expect(formulas.some((f) => f.formula === '=SUM(B2:B3)')).toBe(true);
    }
  });

  it('embed/export body helpers', () => {
    const block = parseHymd('```sheet id=e1\nrows: 20\ncols: 8\nsnapshot: ./x.json\n```').blocks[0];
    const embedded = sheetBodyForEmbed(block, SNAPSHOT_WITH_FORMULA);
    expect(embedded.data).toBeDefined();
    expect(embedded.snapshot).toBeUndefined();

    const inlineBlock = { ...block, body: embedded, bodyRaw: '' };
    const exported = sheetBodyForExport(inlineBlock, './e1.univer.json');
    expect(exported.snapshot).toBe('./e1.univer.json');
    expect(exported.data).toBeUndefined();
  });

  it('updateBlockBody mutates AST', () => {
    const doc = parseHymd('```sheet id=mut\nrows: 3\ncols: 2\n```');
    const newBody = buildInlineSheetBody(3, 2, SNAPSHOT_WITH_FORMULA);
    const updated = updateBlockBody(doc, 'mut', newBody);
    const out = serializeHymd(updated);
    expect(out).toContain('data:');
    expect(resolveSheetSource(parseHymd(out).blocks[0]).kind).toBe('inline');
  });
});
