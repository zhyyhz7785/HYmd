import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseHymd } from '@hymd/parser';
import { paginate, renderDocumentBlocks, resolvePageGeometry } from '../src/index.js';
import { FakePaginationHost, type FakeBlockSpec } from './fakeHost.js';
import type { RenderedBlock } from '../src/render.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const REGRESSION_DIR = join(ROOT, 'samples', 'layout-regression');

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function toFakeSpecs(blocks: RenderedBlock[]): FakeBlockSpec[] {
  return blocks.map((block) => {
    const plain = stripHtml(block.html);
    if (block.kind === 'prose' && plain.length > 0) {
      return { text: plain };
    }
    const height = Math.max(28, Math.ceil(Math.max(plain.length, 1) / 28) * 14);
    return { height };
  });
}

function runRegression(text: string) {
  const doc = parseHymd(text);
  const geo = resolvePageGeometry(doc.frontmatter);
  const rendered = renderDocumentBlocks(doc);
  const specs = toFakeSpecs(rendered);
  const columnHeight = 220;
  const host = new FakePaginationHost(specs, geo.columns, columnHeight, 36, 11);
  const result = paginate(host, specs.length, { columns: geo.columns }, host.tailBlockIndexOf);
  return { host, result, blockCount: specs.length };
}

function assertBlockOrder(host: FakePaginationHost, blockCount: number): void {
  const flat = host.flatten();
  const indices = flat.map((e) => e.blockIndex);
  expect(indices.length).toBeGreaterThanOrEqual(blockCount === 0 ? 0 : 1);
  for (let i = 1; i < indices.length; i += 1) {
    expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1]!);
  }
  const seen = new Set(indices);
  for (let b = 0; b < blockCount; b += 1) {
    expect(seen.has(b)).toBe(true);
  }
}

describe('layout-regression samples', () => {
  const files = readdirSync(REGRESSION_DIR)
    .filter((f) => f.endsWith('.hy.md'))
    .sort();

  expect(files.length).toBe(10);

  for (const file of files) {
    it(`${file}: render→paginate terminates with preserved block order`, () => {
      const text = readFileSync(join(REGRESSION_DIR, file), 'utf8');
      const { host, result, blockCount } = runRegression(text);
      expect(result.pages).toBeGreaterThanOrEqual(1);
      assertBlockOrder(host, blockCount);
      for (let p = 0; p < host.pageCount(); p += 1) {
        for (let c = 0; c < 2; c += 1) {
          expect(host.isOverflowing({ page: p, col: c })).toBe(false);
        }
      }
    });
  }
});
