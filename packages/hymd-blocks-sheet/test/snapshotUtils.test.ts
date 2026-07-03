import { describe, expect, it } from 'vitest';
import {
  createEmptySnapshot,
  defaultSnapshotPath,
  extractFormulaCells,
  normalizeSnapshot,
} from '../src/snapshotUtils.js';

describe('snapshotUtils', () => {
  it('createEmptySnapshot has correct dimensions', () => {
    const snap = createEmptySnapshot(20, 8, 'load-table');
    const sheet = (snap.sheets as Record<string, { rowCount: number; columnCount: number }>).sheet1;
    expect(sheet.rowCount).toBe(20);
    expect(sheet.columnCount).toBe(8);
  });

  it('extractFormulaCells finds f fields', () => {
    const snap = {
      sheets: {
        sheet1: {
          cellData: {
            '2': {
              '3': { f: '=SUM(B2:B3)', v: 5.5 },
            },
          },
        },
      },
    };
    const formulas = extractFormulaCells(snap);
    expect(formulas).toHaveLength(1);
    expect(formulas[0].formula).toBe('=SUM(B2:B3)');
  });

  it('normalizeSnapshot fills sheetOrder', () => {
    const snap = normalizeSnapshot({ sheets: { a: { id: 'a' } } });
    expect(snap.sheetOrder).toEqual(['a']);
  });

  it('defaultSnapshotPath', () => {
    expect(defaultSnapshotPath('load-table')).toBe('./load-table.univer.json');
  });
});
