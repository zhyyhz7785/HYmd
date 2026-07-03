import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __dirname: string | undefined;

export type ReferenceFormat = 'docx' | 'pptx';

export interface ResolveReferenceDocOptions {
  /** .hy.md 文档绝对路径 */
  docPath: string;
  /** frontmatter theme */
  theme?: string;
  format: ReferenceFormat;
  /** 模板目录；默认包内 templates/ */
  templatesDir?: string;
  /** 存在性检查（测试注入） */
  exists?: (path: string) => boolean;
}

function moduleDir(): string {
  try {
    const metaUrl = import.meta.url;
    if (metaUrl) return dirname(fileURLToPath(metaUrl));
  } catch {
    /* cjs bundle：import.meta 不可用 */
  }
  if (typeof __dirname !== 'undefined' && __dirname) return __dirname;
  return process.cwd();
}

/** 包内置 templates 目录（dist/../templates） */
export function defaultTemplatesDir(): string {
  return join(moduleDir(), '..', 'templates');
}

/** 文档 stem：`report.hy.md` → `report.hy` */
export function documentStem(docPath: string): string {
  return basename(docPath).replace(/\.md$/i, '');
}

/**
 * reference-doc 匹配顺序：
 * 1. `<docDir>/<stem>.assets/reference.<format>`
 * 2. `<templatesDir>/<theme>.reference.<format>`
 * 3. `<templatesDir>/default.reference.<format>`
 * 4. undefined（Pandoc 内置样式）
 */
export function resolveReferenceDoc(options: ResolveReferenceDocOptions): string | undefined {
  const exists = options.exists ?? existsSync;
  const templatesDir = options.templatesDir ?? defaultTemplatesDir();
  const docDir = dirname(options.docPath);
  const stem = documentStem(options.docPath);

  const candidates: string[] = [join(docDir, `${stem}.assets`, `reference.${options.format}`)];
  if (options.theme) {
    candidates.push(join(templatesDir, `${options.theme}.reference.${options.format}`));
  }
  candidates.push(join(templatesDir, `default.reference.${options.format}`));

  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  return undefined;
}
