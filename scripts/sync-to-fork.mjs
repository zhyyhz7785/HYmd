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

/** parser 已 bundle 进 extension.js；此处仅保留占位说明，不再复制 node_modules */
function copyParserDep() {
  // bundled — no runtime node_modules/@hymd/parser required
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
