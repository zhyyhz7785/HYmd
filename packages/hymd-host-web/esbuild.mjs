import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');
const vscodeMedia = join(__dirname, '..', 'hymd-vscode', 'media');
const watch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [join(__dirname, 'src', 'main.ts')],
  outfile: join(distDir, 'host.js'),
  bundle: true,
  sourcemap: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  alias: {
    '@hymd/webview-core': join(__dirname, '..', 'hymd-webview-core', 'src', 'index.ts'),
    '@hymd/parser': join(__dirname, '..', 'hymd-parser', 'src', 'browser.ts'),
    '@hymd/parser/browser': join(__dirname, '..', 'hymd-parser', 'src', 'browser.ts'),
  },
  loader: {
    '.css': 'css',
    '.woff': 'file',
    '.woff2': 'file',
    '.ttf': 'file',
  },
  assetNames: 'fonts/[name]-[hash]',
};

async function copyStatic() {
  mkdirSync(distDir, { recursive: true });
  cpSync(join(__dirname, 'index.html'), join(distDir, 'index.html'));
  cpSync(join(vscodeMedia, 'editor.css'), join(distDir, 'editor.css'));
  cpSync(join(vscodeMedia, 'block-cards.css'), join(distDir, 'block-cards.css'));
  cpSync(join(__dirname, 'media', 'host-theme.css'), join(distDir, 'host-theme.css'));
}

async function main() {
  await copyStatic();
  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('watching hymd-host-web...');
  } else {
    await esbuild.build(buildOptions);
    console.log('hymd-host-web build complete');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
