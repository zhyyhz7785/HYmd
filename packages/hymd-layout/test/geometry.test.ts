import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_GEOMETRY,
  PAPER_PRESETS,
  mmToPx,
  pxToMm,
  resolvePageGeometry,
  toPixelGeometry,
} from '../src/geometry.js';

describe('resolvePageGeometry', () => {
  it('parses sample 02 frontmatter (A4 / 2 columns / margin [25,20,25,20])', () => {
    const geo = resolvePageGeometry({
      title: 'x',
      page: { preset: 'A4', columns: 2, margin_mm: [25, 20, 25, 20] },
    });
    expect(geo.preset).toBe('A4');
    expect(geo.widthMm).toBe(210);
    expect(geo.heightMm).toBe(297);
    expect(geo.columns).toBe(2);
    expect(geo.marginMm).toEqual([25, 20, 25, 20]);
    expect(geo.orientation).toBe('portrait');
  });

  it('falls back to A4 portrait single column on missing page', () => {
    expect(resolvePageGeometry({})).toEqual(DEFAULT_PAGE_GEOMETRY);
    expect(resolvePageGeometry(undefined)).toEqual(DEFAULT_PAGE_GEOMETRY);
  });

  it('supports landscape orientation (swaps width/height)', () => {
    const geo = resolvePageGeometry({ page: { preset: 'A3', orientation: 'landscape' } });
    expect(geo.widthMm).toBe(420);
    expect(geo.heightMm).toBe(297);
  });

  it('is case-insensitive for preset and clamps invalid columns', () => {
    const geo = resolvePageGeometry({ page: { preset: 'a2', columns: 0 } });
    expect(geo.preset).toBe('A2');
    expect(geo.columns).toBe(1);
    const geo2 = resolvePageGeometry({ page: { preset: 'Letter', columns: 99 } });
    expect(geo2.preset).toBe('Letter');
    expect(geo2.columns).toBe(10);
  });

  it('ignores malformed margin_mm', () => {
    const geo = resolvePageGeometry({ page: { margin_mm: [1, 2, 3] } });
    expect(geo.marginMm).toEqual(DEFAULT_PAGE_GEOMETRY.marginMm);
    const geo2 = resolvePageGeometry({ page: { margin_mm: ['a', 'b', 'c', 'd'] } });
    expect(geo2.marginMm).toEqual(DEFAULT_PAGE_GEOMETRY.marginMm);
  });

  it('shrinks oversized margins so content area stays >= 20mm', () => {
    const geo = resolvePageGeometry({ page: { preset: 'A4', margin_mm: [200, 150, 200, 150] } });
    expect(geo.marginMm[1] + geo.marginMm[3]).toBeLessThanOrEqual(210 - 20 + 1e-9);
    expect(geo.marginMm[0] + geo.marginMm[2]).toBeLessThanOrEqual(297 - 20 + 1e-9);
  });

  it('has all ISO A presets matching 841x1189 halving chain', () => {
    expect(PAPER_PRESETS.A0).toEqual({ shortMm: 841, longMm: 1189 });
    expect(PAPER_PRESETS.A4).toEqual({ shortMm: 210, longMm: 297 });
  });
});

describe('mm↔px 换算（验收：往返误差 ≤ 2mm）', () => {
  const scales = [0.25, 0.5, 1, 1.5, 3.7795, 4, 10];

  it('roundtrips mm→px→mm within 2mm across scales', () => {
    for (const scale of scales) {
      for (const mm of [0, 5, 25, 210, 297, 841, 1189]) {
        const back = pxToMm(mmToPx(mm, scale), scale);
        expect(Math.abs(back - mm)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('pixel geometry decomposition reconstructs paper width within 2mm', () => {
    for (const scale of scales) {
      for (const columns of [1, 2, 3]) {
        const geo = resolvePageGeometry({
          page: { preset: 'A4', columns, margin_mm: [25, 20, 25, 20] },
        });
        const px = toPixelGeometry(geo, scale);
        const reconstructedWidthPx =
          px.marginLeftPx +
          px.marginRightPx +
          px.columnWidthPx * columns +
          px.gutterPx * (columns - 1);
        const deviationMm = Math.abs(pxToMm(reconstructedWidthPx, scale) - geo.widthMm);
        expect(deviationMm).toBeLessThanOrEqual(2);

        const heightDeviationMm = Math.abs(
          pxToMm(px.marginTopPx + px.marginBottomPx + px.columnHeightPx, scale) - geo.heightMm,
        );
        expect(heightDeviationMm).toBeLessThanOrEqual(2);
      }
    }
  });

  it('A4 at scale 4 gives 840x1188 px paper', () => {
    const px = toPixelGeometry(DEFAULT_PAGE_GEOMETRY, 4);
    expect(px.paperWidthPx).toBe(840);
    expect(px.paperHeightPx).toBe(1188);
    expect(px.marginTopPx).toBe(100);
  });
});
