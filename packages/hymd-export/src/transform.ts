import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { parseHymd, resolveSheetSource, resolveSlideSource, slideTheme } from '@hymd/parser';
import type { HymdBlock } from '@hymd/parser';
import YAML from 'yaml';
import { snapshotToGfmTables, type UniverWorkbookSnapshot } from './sheetToTable.js';

export interface PageSettings {
  preset?: string;
  columns?: number;
  margin_mm?: number[];
}

export interface SlideSourceInfo {
  blockId: string;
  /** Marp markdown 全文 */
  markdown: string;
  /** 外置源相对路径（若来自外置文件） */
  sourcePath?: string;
  theme?: string;
}

export interface TransformOptions {
  /** 文档所在目录（解析外置 assets 相对路径用） */
  docDir?: string;
  /** 读取外置资源（相对路径 → 文本）；默认基于 docDir 的 fs 读取 */
  readAsset?: (relPath: string) => string;
}

export interface TransformResult {
  /** Pandoc 友好 markdown（frontmatter 仅保留 title） */
  markdown: string;
  /** 原文档完整 frontmatter */
  frontmatter: Record<string, unknown>;
  title?: string;
  theme?: string;
  page?: PageSettings;
  /** 抽取出的幻灯源（每块一份，单独导出） */
  slides: SlideSourceInfo[];
  warnings: string[];
}

interface LineReplacement {
  /** 1-based 起始行（含） */
  startLine: number;
  /** 1-based 结束行（含） */
  endLine: number;
  /** 替换文本；null 表示删除 */
  text: string | null;
}

function defaultReadAsset(docDir: string | undefined, relPath: string): string {
  const target = isAbsolute(relPath) ? relPath : resolve(docDir ?? process.cwd(), relPath);
  return readFileSync(target, 'utf8');
}

function extractPage(frontmatter: Record<string, unknown>): PageSettings | undefined {
  const page = frontmatter.page;
  if (!page || typeof page !== 'object' || Array.isArray(page)) return undefined;
  const p = page as Record<string, unknown>;
  const result: PageSettings = {};
  if (typeof p.preset === 'string') result.preset = p.preset;
  if (typeof p.columns === 'number') result.columns = p.columns;
  if (Array.isArray(p.margin_mm) && p.margin_mm.every((n) => typeof n === 'number')) {
    result.margin_mm = p.margin_mm as number[];
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function buildSheetReplacement(
  block: HymdBlock,
  readAsset: (relPath: string) => string,
  warnings: string[],
): string {
  const source = resolveSheetSource(block);
  try {
    let snapshot: UniverWorkbookSnapshot | null = null;
    if (source.kind === 'external') {
      snapshot = JSON.parse(readAsset(source.path)) as UniverWorkbookSnapshot;
    } else if (source.kind === 'inline') {
      snapshot = source.data;
    }
    if (!snapshot) {
      return `*（空表格：${block.id}）*`;
    }
    const table = snapshotToGfmTables(snapshot);
    return table ?? `*（空表格：${block.id}）*`;
  } catch (e) {
    warnings.push(`sheet 块 ${block.id} 读取失败：${e instanceof Error ? e.message : String(e)}`);
    return `*（表格 ${block.id} 读取失败）*`;
  }
}

function collectSlide(
  block: HymdBlock,
  readAsset: (relPath: string) => string,
  warnings: string[],
): SlideSourceInfo | null {
  const theme = slideTheme(block);
  const source = resolveSlideSource(block);

  if (source.kind === 'external') {
    try {
      return { blockId: block.id, markdown: readAsset(source.path), sourcePath: source.path, theme };
    } catch (e) {
      warnings.push(`slide 块 ${block.id} 源文件读取失败：${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
  }
  if (source.kind === 'inline') {
    return { blockId: block.id, markdown: source.markdown, theme };
  }

  warnings.push(`slide 块 ${block.id} 无 source 或 slides 内容，已跳过`);
  return null;
}

/** 应用行替换（1-based 闭区间；从后往前避免行号漂移） */
function applyReplacements(lines: string[], replacements: LineReplacement[]): string[] {
  const sorted = [...replacements].sort((a, b) => b.startLine - a.startLine);
  const result = [...lines];
  for (const rep of sorted) {
    const count = rep.endLine - rep.startLine + 1;
    if (rep.text === null) {
      result.splice(rep.startLine - 1, count);
    } else {
      result.splice(rep.startLine - 1, count, ...rep.text.split('\n'));
    }
  }
  return result;
}

/**
 * 将 HyMD 文本转换为 Pandoc 友好 markdown：
 * - sheet 块 → GFM 表格（取公式算出值）
 * - slide 块 → 摘除并收集 Marp 源，正文留占位说明
 * - layout / calc 块 → 摘除
 * - frontmatter → 仅保留 title
 */
export function transformForExport(markdown: string, options: TransformOptions = {}): TransformResult {
  const readAsset = options.readAsset ?? ((rel: string) => defaultReadAsset(options.docDir, rel));
  const warnings: string[] = [];
  const slides: SlideSourceInfo[] = [];

  const doc = parseHymd(markdown);
  const lines = markdown.split(/\r?\n/);
  const replacements: LineReplacement[] = [];

  const yamlNode = doc.ast.children[0];
  if (yamlNode?.type === 'yaml' && yamlNode.position) {
    const title = typeof doc.frontmatter.title === 'string' ? doc.frontmatter.title : undefined;
    replacements.push({
      startLine: yamlNode.position.start.line,
      endLine: yamlNode.position.end.line,
      text: title ? `---\n${YAML.stringify({ title }).trimEnd()}\n---` : null,
    });
  }

  for (const block of doc.blocks) {
    if (!block.position) continue;
    const range = { startLine: block.position.start.line, endLine: block.position.end.line };

    switch (block.type) {
      case 'sheet':
        replacements.push({ ...range, text: buildSheetReplacement(block, readAsset, warnings) });
        break;
      case 'slide': {
        const slide = collectSlide(block, readAsset, warnings);
        if (slide) {
          slides.push(slide);
          replacements.push({
            ...range,
            text: `> 幻灯片 ${block.id}：内容已单独导出为 ${block.id}.pptx`,
          });
        } else {
          replacements.push({ ...range, text: null });
        }
        break;
      }
      default:
        replacements.push({ ...range, text: null });
        break;
    }
  }

  const outLines = applyReplacements(lines, replacements);
  const outMarkdown = outLines.join('\n').replace(/\n{3,}/g, '\n\n').trimStart();

  return {
    markdown: outMarkdown.endsWith('\n') ? outMarkdown : `${outMarkdown}\n`,
    frontmatter: doc.frontmatter,
    title: typeof doc.frontmatter.title === 'string' ? doc.frontmatter.title : undefined,
    theme: typeof doc.frontmatter.theme === 'string' ? doc.frontmatter.theme : undefined,
    page: extractPage(doc.frontmatter),
    slides,
    warnings,
  };
}
