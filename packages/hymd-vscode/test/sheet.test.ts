import { describe, expect, it } from 'vitest';
import {
  parseHymd,
  serializeHymd,
  updateBlockBody,
  sheetBodyForEmbed,
  sheetBodyForExport,
  resolveSheetSource,
} from '@hymd/parser';
import { extractFormulaCells } from '@hymd/blocks-sheet';

const FORMULA_SNAPSHOT = {
  id: 't1',
  sheetOrder: ['sheet1'],
  sheets: {
    sheet1: {
      id: 'sheet1',
      cellData: {
        '1': { '1': { f: '=SUM(B2:B3)', v: 5.5 } },
      },
    },
  },
};

describe('sheet embed/export roundtrip', () => {
  it('embed then export preserves formulas semantically', () => {
    const md = '```sheet id=load-table\nrows: 20\ncols: 8\nsnapshot: ./load-table.univer.json\n```';
    const doc = parseHymd(md);
    const block = doc.blocks[0];

    const embedded = updateBlockBody(doc, block.id, sheetBodyForEmbed(block, FORMULA_SNAPSHOT));
    const embeddedBlock = parseHymd(serializeHymd(embedded)).blocks[0];
    expect(resolveSheetSource(embeddedBlock).kind).toBe('inline');

    const exported = updateBlockBody(
      parseHymd(serializeHymd(embedded)),
      block.id,
      sheetBodyForExport(embeddedBlock, './load-table.univer.json'),
    );
    const exportedBlock = parseHymd(serializeHymd(exported)).blocks[0];
    expect(resolveSheetSource(exportedBlock).kind).toBe('external');

    const reEmbedded = updateBlockBody(
      parseHymd(serializeHymd(exported)),
      block.id,
      sheetBodyForEmbed(exportedBlock, FORMULA_SNAPSHOT),
    );
    const finalBlock = parseHymd(serializeHymd(reEmbedded)).blocks[0];
    const src = resolveSheetSource(finalBlock);
    expect(src.kind).toBe('inline');
    if (src.kind === 'inline') {
      expect(extractFormulaCells(src.data).some((f) => f.formula === '=SUM(B2:B3)')).toBe(true);
    }
  });
});

describe('protocol helpers', () => {
  it('extractSnapshotPath', async () => {
    const { extractSnapshotPath } = await import('../src/protocol.js');
    const body = 'rows: 20\nsnapshot: ./a.json\n';
    expect(extractSnapshotPath(body)).toBe('./a.json');
  });
});
