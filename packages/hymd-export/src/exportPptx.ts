import { isAbsolute, join, resolve } from 'node:path';
import { prepareExport, withTempDir, writeTempFile, type ExportOptions } from './exportShared.js';
import { resolveReferenceDoc } from './referenceDoc.js';
import { checkPandoc, resolveBrowser, resolveMarpCli, resolvePandoc, runCommand } from './runners.js';

export interface PptxExportResult {
  /** 生成的 pptx 文件（slide 块各一份；无 slide 块时为整文档一份） */
  outPaths: string[];
  /** marp = slide 块经 Marp CLI；pandoc = 整文档回退 */
  mode: 'marp' | 'pandoc';
  warnings: string[];
}

/**
 * 导出 pptx：
 * - 文档含 slide 块 → 每个 slide 块经 Marp CLI 出 `<stem>.<blockId>.pptx`
 * - 无 slide 块 → 整文档经 Pandoc 出 `<stem>.pptx`（reference-doc 匹配）
 */
export async function exportPptx(options: ExportOptions): Promise<PptxExportResult> {
  const prepared = prepareExport(options);
  const warnings = [...prepared.transform.warnings];

  if (prepared.transform.slides.length > 0) {
    const marp = resolveMarpCli(options.marpPath, options.marpResolveDir);
    const browser = resolveBrowser(options.browserPath);
    if (!browser) {
      warnings.push('未找到 Edge/Chrome，Marp 将自行探测浏览器；若失败请在设置中指定浏览器路径');
    }

    const outPaths: string[] = [];
    await withTempDir(async (tmp) => {
      for (const slide of prepared.transform.slides) {
        const input = slide.sourcePath
          ? isAbsolute(slide.sourcePath)
            ? slide.sourcePath
            : resolve(prepared.docDir, slide.sourcePath)
          : writeTempFile(tmp, `${slide.blockId}.marp.md`, slide.markdown);

        const outPath = join(prepared.outDir, `${prepared.stem}.${slide.blockId}.pptx`);
        const args = [...marp.args, input, '-o', outPath, '--allow-local-files', '--no-stdin'];
        if (browser) {
          args.push('--browser-path', browser);
        }
        await runCommand(marp.command, args);
        outPaths.push(outPath);
      }
    });
    return { outPaths, mode: 'marp', warnings };
  }

  await checkPandoc(options.pandocPath);
  const outPath = join(prepared.outDir, `${prepared.stem}.pptx`);
  const referenceDoc = resolveReferenceDoc({
    docPath: prepared.docPath,
    theme: prepared.transform.theme,
    format: 'pptx',
    templatesDir: options.templatesDir,
  });

  await withTempDir(async (tmp) => {
    const inputMd = writeTempFile(tmp, 'input.md', prepared.transform.markdown);
    const args = [
      inputMd,
      '-f',
      'markdown',
      '-t',
      'pptx',
      '-o',
      outPath,
      '--resource-path',
      prepared.docDir,
    ];
    if (referenceDoc) {
      args.push('--reference-doc', referenceDoc);
    }
    await runCommand(resolvePandoc(options.pandocPath), args);
  });

  return { outPaths: [outPath], mode: 'pandoc', warnings };
}
