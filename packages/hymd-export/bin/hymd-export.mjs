#!/usr/bin/env node
import { resolve } from 'node:path';
import { exportAll, exportDocx, exportPdf, exportPptx } from '../dist/index.js';

const HELP = `用法：hymd-export <file.hy.md> [选项]

选项：
  -f, --format <fmt>     导出格式：docx | pptx | pdf | all（默认 all）
  -o, --out-dir <dir>    输出目录（默认 <文档>.exports/）
  --pandoc <path>        pandoc 可执行文件路径
  --marp <path>          Marp CLI 路径（默认自动解析依赖内 marp-cli）
  --browser <path>       Edge/Chrome 路径（PDF 与 Marp 渲染用）
  --templates-dir <dir>  reference-doc 模板目录
  -h, --help             显示帮助
`;

function parseArgs(argv) {
  const opts = { format: 'all' };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-f':
      case '--format':
        opts.format = argv[++i];
        break;
      case '-o':
      case '--out-dir':
        opts.outDir = resolve(argv[++i]);
        break;
      case '--pandoc':
        opts.pandocPath = argv[++i];
        break;
      case '--marp':
        opts.marpPath = argv[++i];
        break;
      case '--browser':
        opts.browserPath = argv[++i];
        break;
      case '--templates-dir':
        opts.templatesDir = resolve(argv[++i]);
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        rest.push(arg);
        break;
    }
  }
  opts.file = rest[0];
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.file) {
    console.log(HELP);
    process.exitCode = opts.help ? 0 : 1;
    return;
  }

  const exportOptions = {
    docPath: resolve(opts.file),
    outDir: opts.outDir,
    pandocPath: opts.pandocPath,
    marpPath: opts.marpPath,
    browserPath: opts.browserPath,
    templatesDir: opts.templatesDir,
  };

  switch (opts.format) {
    case 'docx': {
      const r = await exportDocx(exportOptions);
      report([r.outPath], r.warnings);
      break;
    }
    case 'pptx': {
      const r = await exportPptx(exportOptions);
      report(r.outPaths, r.warnings);
      break;
    }
    case 'pdf': {
      const r = await exportPdf(exportOptions);
      report([r.outPath], r.warnings);
      break;
    }
    case 'all': {
      const r = await exportAll(exportOptions);
      const outputs = [
        ...(r.docx ? [r.docx.outPath] : []),
        ...(r.pptx ? r.pptx.outPaths : []),
        ...(r.pdf ? [r.pdf.outPath] : []),
      ];
      report(outputs, r.warnings);
      for (const [fmt, msg] of Object.entries(r.errors)) {
        console.error(`[失败] ${fmt}：${msg}`);
        process.exitCode = 2;
      }
      break;
    }
    default:
      console.error(`未知格式：${opts.format}（支持 docx | pptx | pdf | all）`);
      process.exitCode = 1;
  }
}

function report(outputs, warnings) {
  for (const w of warnings) console.warn(`[警告] ${w}`);
  for (const out of outputs) console.log(`已导出：${out}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
