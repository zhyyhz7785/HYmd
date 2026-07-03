import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const mediaOut = join(__dirname, 'dist', 'media');

const common = {
  bundle: true,
  sourcemap: true,
  logLevel: 'info',
};

/** @type {esbuild.BuildOptions} */
const extensionBuild = {
  ...common,
  entryPoints: [join(__dirname, 'src', 'extension.ts')],
  outfile: join(__dirname, 'dist', 'extension.js'),
  platform: 'node',
  format: 'cjs',
  external: ['vscode', '@hymd/parser'],
  target: 'node18',
};

/** @type {esbuild.BuildOptions} */
const webviewBuild = {
  ...common,
  entryPoints: [join(__dirname, 'src-webview', 'index.ts')],
  outfile: join(__dirname, 'dist', 'media', 'webview.js'),
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  loader: {
    '.css': 'css',
    '.woff': 'file',
    '.woff2': 'file',
    '.ttf': 'file',
  },
  assetNames: 'fonts/[name]-[hash]',
};

async function copyStaticAssets() {
  mkdirSync(mediaOut, { recursive: true });
  cpSync(join(__dirname, 'media'), mediaOut, { recursive: true });
}

async function buildOnce() {
  mkdirSync(mediaOut, { recursive: true });
  cpSync(join(__dirname, 'media'), mediaOut, { recursive: true });
  await esbuild.build(extensionBuild);
  await esbuild.build(webviewBuild);
  console.log('hymd-vscode build complete');
}

async function main() {
  if (watch) {
    await copyStaticAssets();
    const extCtx = await esbuild.context(extensionBuild);
    const webCtx = await esbuild.context(webviewBuild);
    await extCtx.watch();
    await webCtx.watch();
    console.log('watching hymd-vscode...');
  } else {
    await buildOnce();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
