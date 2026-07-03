import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { documentStem } from './referenceDoc.js';
import { transformForExport, type TransformResult } from './transform.js';

export interface ExportOptions {
  /** .hy.md 文档绝对路径 */
  docPath: string;
  /** 文档文本；缺省从 docPath 读取 */
  markdown?: string;
  /** 输出目录；默认 `<docDir>/<stem>.exports` */
  outDir?: string;
  /** 仅导出指定 slide 块（pptx 模式） */
  blockId?: string;
  pandocPath?: string;
  marpPath?: string;
  /** 解析依赖树中 marp-cli 的起始目录（扩展宿主场景传扩展根目录） */
  marpResolveDir?: string;
  browserPath?: string;
  templatesDir?: string;
}

export interface PreparedExport {
  docPath: string;
  docDir: string;
  stem: string;
  outDir: string;
  transform: TransformResult;
}

/** 读取 + transform + 建输出目录 */
export function prepareExport(options: ExportOptions): PreparedExport {
  const docPath = options.docPath;
  const docDir = dirname(docPath);
  const stem = documentStem(docPath);
  const outDir = options.outDir ?? join(docDir, `${stem}.exports`);

  const markdown = options.markdown ?? readFileSync(docPath, 'utf8');
  const transform = transformForExport(markdown, { docDir });

  mkdirSync(outDir, { recursive: true });
  return { docPath, docDir, stem, outDir, transform };
}

/** 在系统临时目录建立工作目录，用完清理 */
export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), 'hymd-export-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 写 UTF-8 临时文件并返回路径 */
export function writeTempFile(dir: string, name: string, content: string): string {
  const filePath = join(dir, name);
  writeFileSync(filePath, content, 'utf8');
  return filePath;
}
