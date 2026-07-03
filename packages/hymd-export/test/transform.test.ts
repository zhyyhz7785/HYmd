import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cellDisplayValue, sheetToGfmTable, snapshotToGfmTables } from '../src/sheetToTable.js';
import { transformForExport } from '../src/transform.js';
import { resolveReferenceDoc, defaultTemplatesDir } from '../src/referenceDoc.js';
import { buildPrintCss } from '../src/exportPdf.js';
import { checkPandoc } from '../src/runners.js';
import { exportDocx } from '../src/exportDocx.js';
import { exportPptx } from '../src/exportPptx.js';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(__dirname, '../../../samples');

describe('sheetToTable', () => {
  it('cellDisplayValue prefers computed v over formula f', () => {
    expect(cellDisplayValue({ v: 5.5, f: '=SUM(B2:B3)' })).toBe('5.5');
    expect(cellDisplayValue({ f: '=A1+B1' })).toBe('=A1+B1');
    expect(cellDisplayValue(undefined)).toBe('');
  });

  it('sheetToGfmTable escapes pipes and newlines', () => {
    const table = sheetToGfmTable({
      cellData: {
        '0': { '0': { v: 'a|b' }, '1': { v: 'line\nbreak' } },
      },
    });
    expect(table).toContain('a\\|b');
    expect(table).toContain('line break');
  });

  it('snapshotToGfmTables reads formula computed values from sample', () => {
    const snapPath = join(samplesDir, '02-report-with-sheet.hy.assets/load-table.univer.json');
    const snapshot = JSON.parse(readFileSync(snapPath, 'utf8'));
    const table = snapshotToGfmTables(snapshot);
    expect(table).toBeTruthy();
    expect(table).toMatch(/\|/);
  });
});

describe('transformForExport', () => {
  it('preserves title in frontmatter and converts sheet to GFM table', () => {
    const md = readFileSync(join(samplesDir, '02-report-with-sheet.hy.md'), 'utf8');
    const result = transformForExport(md, { docDir: samplesDir });
    expect(result.title).toBe('结构计算书 — 荷载汇总');
    expect(result.theme).toBe('engineering-report');
    expect(result.page?.margin_mm).toEqual([25, 20, 25, 20]);
    expect(result.markdown).toContain('---');
    expect(result.markdown).toContain('title:');
    expect(result.markdown).toMatch(/\|.*\|/);
    expect(result.markdown).not.toContain('```sheet');
    expect(result.markdown).not.toContain('```layout');
  });

  it('extracts slide blocks and leaves placeholder', () => {
    const md = readFileSync(join(samplesDir, '03-slide-mixed.hy.md'), 'utf8');
    const result = transformForExport(md, { docDir: samplesDir });
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].blockId).toBe('intro-deck');
    expect(result.slides[0].markdown).toContain('marp: true');
    expect(result.markdown).toContain('intro-deck.pptx');
    expect(result.markdown).not.toContain('```slide');
  });
});

describe('resolveReferenceDoc', () => {
  it('matches theme template before default', () => {
    const templatesDir = defaultTemplatesDir();
    const docPath = join(samplesDir, '02-report-with-sheet.hy.md');
    const themed = resolveReferenceDoc({
      docPath,
      theme: 'engineering-report',
      format: 'docx',
      templatesDir,
    });
    expect(themed).toContain('engineering-report.reference.docx');

    const fallback = resolveReferenceDoc({
      docPath,
      theme: 'nonexistent-theme',
      format: 'docx',
      templatesDir,
    });
    expect(fallback).toContain('default.reference.docx');
  });

  it('prefers doc-local reference over theme', () => {
    const docPath = join(samplesDir, '02-report-with-sheet.hy.md');
    const local = join(samplesDir, '02-report-with-sheet.hy.assets', 'reference.docx');
    const resolved = resolveReferenceDoc({
      docPath,
      theme: 'engineering-report',
      format: 'docx',
      exists: (p) => p === local || p.includes('default.reference.docx'),
    });
    expect(resolved).toBe(local);
  });
});

describe('buildPrintCss', () => {
  it('uses mm margins from page settings', () => {
    const css = buildPrintCss({ preset: 'A4', margin_mm: [25, 20, 25, 20] });
    expect(css).toContain('25mm 20mm 25mm 20mm');
    expect(css).toContain('size: A4');
  });
});

describe('e2e export (pandoc gated)', () => {
  let pandocAvailable = false;

  it('checks pandoc availability', async () => {
    try {
      await checkPandoc();
      pandocAvailable = true;
    } catch {
      pandocAvailable = false;
    }
    expect(typeof pandocAvailable).toBe('boolean');
  });

  it.skipIf(() => !pandocAvailable)('sample 02 exports non-empty docx', async () => {
    const docPath = join(samplesDir, '02-report-with-sheet.hy.md');
    const outDir = join(samplesDir, '.test-exports-02');
    const r = await exportDocx({ docPath, outDir });
    expect(existsSync(r.outPath)).toBe(true);
    expect(readFileSync(r.outPath).length).toBeGreaterThan(1000);
  });

  it.skipIf(() => !pandocAvailable)('sample 03 exports marp pptx', async () => {
    const docPath = join(samplesDir, '03-slide-mixed.hy.md');
    const outDir = join(samplesDir, '.test-exports-03');
    const r = await exportPptx({ docPath, outDir });
    expect(r.mode).toBe('marp');
    expect(r.outPaths.length).toBe(1);
    expect(existsSync(r.outPaths[0])).toBe(true);
    expect(readFileSync(r.outPaths[0]).length).toBeGreaterThan(1000);
  });
});
