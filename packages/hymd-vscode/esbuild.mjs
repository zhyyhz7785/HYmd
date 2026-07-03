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
  external: ['vscode', '@hymd/export'],
  target: 'node18',
  alias: {
    '@hymd/webview-core/protocol': join(__dirname, '..', 'hymd-webview-core', 'src', 'protocol.ts'),
    '@hymd/webview-core/frontmatter': join(__dirname, '..', 'hymd-webview-core', 'src', 'frontmatterGuard.ts'),
    '@hymd/parser': join(__dirname, '..', 'hymd-parser', 'src', 'browser.ts'),
    '@hymd/parser/browser': join(__dirname, '..', 'hymd-parser', 'src', 'browser.ts'),
  },
};

/** @type {esbuild.BuildOptions} */
const webviewBuild = {
  ...common,
  entryPoints: [join(__dirname, 'src-webview', 'index.ts')],
  outfile: join(__dirname, 'dist', 'media', 'webview.js'),
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
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

async function copyStaticAssets() {
  mkdirSync(mediaOut, { recursive: true });
  cpSync(join(__dirname, 'media'), mediaOut, { recursive: true });
}

/** @type {esbuild.BuildOptions} */
const layoutPreviewBuild = {
  ...common,
  entryPoints: [join(__dirname, 'src-webview', 'layout-preview', 'index.ts')],
  outfile: join(__dirname, 'dist', 'media', 'layout-preview.js'),
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  alias: {
    '@hymd/parser': join(__dirname, '..', 'hymd-parser', 'src', 'browser.ts'),
    '@hymd/parser/browser': join(__dirname, '..', 'hymd-parser', 'src', 'browser.ts'),
    '@hymd/layout/browser': join(__dirname, '..', 'hymd-layout', 'src', 'browser.ts'),
  },
  loader: {
    '.css': 'css',
    '.woff': 'file',
    '.woff2': 'file',
    '.ttf': 'file',
  },
  assetNames: 'fonts/[name]-[hash]',
};

async function buildOnce() {
  mkdirSync(mediaOut, { recursive: true });
  cpSync(join(__dirname, 'media'), mediaOut, { recursive: true });
  console.log('building extension...');
  await esbuild.build(extensionBuild);
  console.log('building webview...');
  await esbuild.build(webviewBuild);
  console.log('building layout-preview...');
  await esbuild.build(layoutPreviewBuild);
  console.log('hymd-vscode build complete');
}

async function main() {
  if (watch) {
    await copyStaticAssets();
    const extCtx = await esbuild.context(extensionBuild);
    const webCtx = await esbuild.context(webviewBuild);
    const layoutCtx = await esbuild.context(layoutPreviewBuild);
    await extCtx.watch();
    await webCtx.watch();
    await layoutCtx.watch();
    console.log('watching hymd-vscode...');
  } else {
    await buildOnce();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
