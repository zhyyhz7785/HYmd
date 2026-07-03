/**
 * 将 hymd-editor 扩展构建产物同步到 hymd-code fork。
 * 用法：node scripts/sync-to-fork.mjs [fork路径]
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'packages', 'hymd-vscode');
const forkRoot = resolve(process.argv[2] ?? join(root, '..', 'hymd-code'));
const dest = join(forkRoot, 'extensions', 'hymd-editor');

const copyList = ['package.json', 'dist', 'media'];

function copyParserDep() {
  const parserPkg = join(root, 'packages', 'hymd-parser');
  const parserDest = join(dest, 'node_modules', '@hymd', 'parser');
  mkdirSync(parserDest, { recursive: true });
  cpSync(join(parserPkg, 'dist'), join(parserDest, 'dist'), { recursive: true });
  cpSync(join(parserPkg, 'package.json'), join(parserDest, 'package.json'));
}

if (!existsSync(join(src, 'dist', 'extension.js'))) {
  console.error('请先运行: npm run build:vscode');
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const item of copyList) {
  const from = join(src, item);
  if (!existsSync(from)) continue;
  cpSync(from, join(dest, item), { recursive: true });
}

copyParserDep();

console.log(`已同步 hymd-editor → ${dest}`);
