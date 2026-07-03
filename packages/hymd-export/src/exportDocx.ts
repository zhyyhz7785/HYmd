import { join } from 'node:path';
import { prepareExport, withTempDir, writeTempFile, type ExportOptions } from './exportShared.js';
import { resolveReferenceDoc } from './referenceDoc.js';
import { checkPandoc, resolvePandoc, runCommand } from './runners.js';

export interface DocxExportResult {
  outPath: string;
  referenceDoc?: string;
  warnings: string[];
}

/** 导出 docx：transform → Pandoc（reference-doc 按 theme 匹配） */
export async function exportDocx(options: ExportOptions): Promise<DocxExportResult> {
  await checkPandoc(options.pandocPath);
  const prepared = prepareExport(options);
  const outPath = join(prepared.outDir, `${prepared.stem}.docx`);

  const referenceDoc = resolveReferenceDoc({
    docPath: prepared.docPath,
    theme: prepared.transform.theme,
    format: 'docx',
    templatesDir: options.templatesDir,
  });

  await withTempDir(async (tmp) => {
    const inputMd = writeTempFile(tmp, 'input.md', prepared.transform.markdown);
    const args = [
      inputMd,
      '-f',
      'markdown',
      '-t',
      'docx',
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

  return { outPath, referenceDoc, warnings: prepared.transform.warnings };
}
