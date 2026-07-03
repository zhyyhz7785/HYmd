import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';
import { micromark } from 'micromark';
import { marked } from 'marked';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import remarkParse from 'remark-parse';
import Showdown from 'showdown';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const SAMPLE_FILES = [
  '01-basic-prose.hy.md',
  '02-report-with-sheet.hy.md',
  '03-slide-mixed.hy.md',
] as const;

type Renderer = (md: string) => string;

const renderers: Record<string, Renderer> = {
  remark: (md) => {
    const file = unified().use(remarkParse).use(remarkGfm).use(remarkHtml);
    return String(file.processSync(md));
  },
  markdownIt: (md) => new MarkdownIt({ html: true }).render(md),
  marked: (md) => marked.parse(md) as string,
  micromark: (md) => micromark(md),
  showdown: (md) => new Showdown.Converter({ tables: true }).makeHtml(md),
};

/** 样例中应出现在 prose 中的可见文本 */
const PROSE_SNIPPETS: Record<(typeof SAMPLE_FILES)[number], string[]> = {
  '01-basic-prose.hy.md': ['HyMD 基础示例', 'GFM 表格'],
  '02-report-with-sheet.hy.md': ['设计说明', '荷载汇总表', '安全系数'],
  '03-slide-mixed.hy.md': ['技术汇报', '讨论', 'not a hymd block'],
};

/** 含扩展块的样例：降级后 code 块内应出现的片段 */
const BLOCK_SNIPPETS: Partial<Record<(typeof SAMPLE_FILES)[number], string[]>> = {
  '02-report-with-sheet.hy.md': ['rows:', 'load-table'],
  '03-slide-mixed.hy.md': ['intro-deck', 'marp.md'],
};

function hasCodeFenceDegradation(html: string, snippets: string[]): boolean {
  const lower = html.toLowerCase();
  const hasPre = lower.includes('<pre') || lower.includes('<code');
  if (!hasPre) return false;
  return snippets.every((s) => html.includes(s) || lower.includes(s.toLowerCase()));
}

describe('degradation — 5 markdown renderers', () => {
  for (const sample of SAMPLE_FILES) {
    for (const [name, render] of Object.entries(renderers)) {
      it(`${sample} via ${name} renders without error`, () => {
        const md = readFileSync(join(ROOT, 'samples', sample), 'utf8');
        expect(() => render(md)).not.toThrow();
        const html = render(md);
        expect(html.length).toBeGreaterThan(0);

        for (const snippet of PROSE_SNIPPETS[sample]) {
          expect(html).toContain(snippet);
        }

        const blockSnippets = BLOCK_SNIPPETS[sample];
        if (blockSnippets) {
          expect(hasCodeFenceDegradation(html, blockSnippets)).toBe(true);
        }
      });
    }
  }
});

describe('degradation — ordinary code block preserved', () => {
  it('javascript block not confused with hymd sheet', () => {
    const md = readFileSync(join(ROOT, 'samples', '03-slide-mixed.hy.md'), 'utf8');
    const html = renderers.remark(md);
    expect(html).toContain('not a hymd block');
    expect(html.toLowerCase()).toMatch(/language-javascript|class="language-js"/);
  });
});
