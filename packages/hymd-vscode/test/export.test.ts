import { describe, expect, it, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultTemplatesDir, documentStem } from '@hymd/export';
import { extractSlideSourcePath } from '../src/protocol.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = join(__dirname, '../../../samples');

vi.mock('vscode', () => ({
  Uri: {
    file: (p: string) => ({ fsPath: p }),
  },
  workspace: {
    fs: {
      readFile: async (uri: { fsPath: string }) =>
        Buffer.from(readFileSync(uri.fsPath, 'utf8')),
    },
  },
}));

describe('slide protocol helpers', () => {
  it('extractSlideSourcePath', () => {
    const body = 'source: ./03-slide-mixed.hy.assets/intro-deck.marp.md\n';
    expect(extractSlideSourcePath(body)).toBe('./03-slide-mixed.hy.assets/intro-deck.marp.md');
  });
});

describe('slideAssets', () => {
  let readSlideSource: typeof import('../src/slideAssets.js').readSlideSource;
  let slideSourceUri: typeof import('../src/slideAssets.js').slideSourceUri;

  beforeAll(async () => {
    const mod = await import('../src/slideAssets.js');
    readSlideSource = mod.readSlideSource;
    slideSourceUri = mod.slideSourceUri;
  });

  it('readSlideSource loads external marp file', async () => {
    const vscode = await import('vscode');
    const docUri = vscode.Uri.file(join(samplesDir, '03-slide-mixed.hy.md'));
    const md = readFileSync(docUri.fsPath, 'utf8');
    const result = await readSlideSource(docUri, 'intro-deck', md);
    expect(result.markdown).toContain('marp: true');
    expect(result.sourcePath).toContain('intro-deck.marp.md');

    const uri = slideSourceUri(docUri, 'intro-deck', md);
    expect(uri?.fsPath).toContain('intro-deck.marp.md');
  });
});

describe('export path resolution', () => {
  it('defaultTemplatesDir resolves to package templates', () => {
    const dir = defaultTemplatesDir();
    expect(dir).toContain('templates');
  });

  it('documentStem for hy.md files', () => {
    expect(documentStem('/path/report.hy.md')).toBe('report.hy');
  });
});
