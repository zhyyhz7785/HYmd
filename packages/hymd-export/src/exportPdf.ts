import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareExport, withTempDir, writeTempFile, type ExportOptions } from './exportShared.js';
import { checkPandoc, resolveBrowser, resolvePandoc, runCommand } from './runners.js';
import type { PageSettings } from './transform.js';

export interface PdfExportResult {
  outPath: string;
  warnings: string[];
}

/** CSS @page 不支持 A0–A2 关键字，用具体尺寸映射 */
const PAGE_SIZES: Record<string, string> = {
  A0: '841mm 1189mm',
  A1: '594mm 841mm',
  A2: '420mm 594mm',
  A3: 'A3',
  A4: 'A4',
  A5: 'A5',
  Letter: 'letter',
};

/** frontmatter page 设置 → 打印 CSS（@page mm 边距 + 基础排版） */
export function buildPrintCss(page?: PageSettings): string {
  const preset = page?.preset ?? 'A4';
  const size = PAGE_SIZES[preset] ?? PAGE_SIZES[preset.toUpperCase()] ?? 'A4';
  const m = page?.margin_mm;
  const margin =
    m && m.length === 4 ? `${m[0]}mm ${m[1]}mm ${m[2]}mm ${m[3]}mm` : '20mm';

  return `@page { size: ${size}; margin: ${margin}; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif; font-size: 11pt; line-height: 1.65; margin: 0; max-width: none; }
h1, h2, h3, h4 { page-break-after: avoid; line-height: 1.3; }
table { border-collapse: collapse; margin: 0.6em 0; }
th, td { border: 1px solid #888; padding: 4px 10px; }
thead th, tr:first-child th { background: #f0f0f0; }
pre { background: #f6f6f6; padding: 8px 10px; overflow-x: auto; font-size: 10pt; }
code { font-family: Consolas, "Courier New", monospace; }
blockquote { border-left: 3px solid #bbb; margin-left: 0; padding-left: 12px; color: #555; }
img { max-width: 100%; }
`;
}

/** 导出 PDF：transform → Pandoc standalone HTML → Edge/Chrome headless 打印 */
export async function exportPdf(options: ExportOptions): Promise<PdfExportResult> {
  await checkPandoc(options.pandocPath);
  const browser = resolveBrowser(options.browserPath);
  if (!browser) {
    throw new Error(
      'PDF 导出需要 Edge 或 Chrome 浏览器（headless 打印）。未在常见位置找到，请在设置中指定浏览器路径。',
    );
  }

  const prepared = prepareExport(options);
  const outPath = join(prepared.outDir, `${prepared.stem}.pdf`);

  await withTempDir(async (tmp) => {
    const inputMd = writeTempFile(tmp, 'input.md', prepared.transform.markdown);
    const cssPath = writeTempFile(tmp, 'print.css', buildPrintCss(prepared.transform.page));
    const htmlPath = join(tmp, 'output.html');

    await runCommand(resolvePandoc(options.pandocPath), [
      inputMd,
      '-f',
      'markdown',
      '-t',
      'html5',
      '--standalone',
      '--embed-resources',
      '--mathml',
      '--resource-path',
      prepared.docDir,
      '--css',
      cssPath,
      '--metadata',
      'lang=zh-CN',
      '-o',
      htmlPath,
    ]);

    await runCommand(browser, [
      '--headless',
      '--disable-gpu',
      '--disable-extensions',
      '--no-pdf-header-footer',
      `--print-to-pdf=${outPath}`,
      pathToFileURL(htmlPath).href,
    ]);
  });

  return { outPath, warnings: prepared.transform.warnings };
}
