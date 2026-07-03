import { createEmptySnapshot, type UniverWorkbookSnapshot } from '@hymd/blocks-sheet';
import {
  buildExternalSheetBody,
  findBlockById,
  parseHymd,
  resolveSheetSource,
  serializeHymd,
  sheetDimensions,
  updateBlockBody,
} from '@hymd/parser/browser';
import { joinFrontmatter } from './frontmatterGuard.js';
import { deliverSheetSnapshot } from './sheetPreview.js';
import { handleSheetSavedMessage } from './sheetOverlay.js';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol.js';

function documentStemFromPath(documentPath: string): string {
  const name = documentPath.replace(/\\/g, '/').split('/').pop() ?? 'doc';
  return name.replace(/\.md$/i, '');
}

function defaultSnapshotRelPath(documentPath: string, blockId: string): string {
  const stem = documentStemFromPath(documentPath);
  return `./${stem}.assets/${blockId}.univer.json`;
}

function normalizeRelPath(relPath: string): string {
  return relPath.replace(/^\.\//, '').replace(/\\/g, '/');
}

export class SheetAssetsClient {
  private documentPath = '';
  private frontmatter = '';
  private body = '';
  private nextRequestId = 0;
  private pendingFiles = new Map<
    string,
    { resolve: (content: string) => void; reject: (err: Error) => void }
  >();

  constructor(private readonly postToHost: (msg: WebviewToHostMessage) => void) {}

  setDocumentContext(documentPath: string, frontmatter: string, body: string): void {
    this.documentPath = documentPath;
    this.frontmatter = frontmatter;
    this.body = body;
  }

  updateBody(body: string): void {
    this.body = body;
  }

  handleFileResult(msg: HostToWebviewMessage): boolean {
    if (msg.type !== 'fileResult') return false;
    const pending = this.pendingFiles.get(msg.requestId);
    if (!pending) return false;
    this.pendingFiles.delete(msg.requestId);
    if (!msg.ok) {
      pending.reject(new Error(msg.error ?? '文件读写失败'));
    } else {
      pending.resolve(msg.content ?? '');
    }
    return true;
  }

  private fullMarkdown(): string {
    return joinFrontmatter(this.frontmatter, this.body);
  }

  private readFileViaHost(relPath: string): Promise<string> {
    const requestId = `f${++this.nextRequestId}`;
    return new Promise((resolve, reject) => {
      this.pendingFiles.set(requestId, { resolve, reject });
      this.postToHost({ type: 'readFile', requestId, relPath });
    });
  }

  private writeFileViaHost(relPath: string, content: string): Promise<void> {
    const requestId = `f${++this.nextRequestId}`;
    return new Promise((resolve, reject) => {
      this.pendingFiles.set(requestId, {
        resolve: () => resolve(),
        reject,
      });
      this.postToHost({ type: 'writeFile', requestId, relPath, content });
    });
  }

  async readSheetSnapshot(blockId: string): Promise<UniverWorkbookSnapshot> {
    const markdown = this.fullMarkdown();
    const doc = parseHymd(markdown);
    const block = findBlockById(doc, blockId);
    if (!block || block.type !== 'sheet') {
      throw new Error(`Sheet block not found: ${blockId}`);
    }

    const source = resolveSheetSource(block);
    if (source.kind === 'inline') {
      return source.data;
    }
    if (source.kind === 'external') {
      const text = await this.readFileViaHost(normalizeRelPath(source.path));
      return JSON.parse(text) as UniverWorkbookSnapshot;
    }

    const { rows, cols } = sheetDimensions(block);
    return createEmptySnapshot(rows, cols, blockId);
  }

  async writeSheetSnapshot(
    blockId: string,
    data: UniverWorkbookSnapshot,
    preferredPath?: string,
  ): Promise<{ snapshotPath: string; body: string }> {
    const markdown = this.fullMarkdown();
    const doc = parseHymd(markdown);
    const block = findBlockById(doc, blockId);
    if (!block || block.type !== 'sheet') {
      throw new Error(`Sheet block not found: ${blockId}`);
    }

    const { rows, cols } = sheetDimensions(block);
    const source = resolveSheetSource(block);
    const snapshotRel =
      preferredPath ??
      (source.kind === 'external' ? source.path : defaultSnapshotRelPath(this.documentPath, blockId));

    await this.writeFileViaHost(
      normalizeRelPath(snapshotRel),
      JSON.stringify(data, null, 2),
    );

    const newBody = buildExternalSheetBody(rows, cols, snapshotRel);
    const updated = updateBlockBody(doc, blockId, newBody);
    const bodyOnly = serializeHymd(updated);
    this.body = bodyOnly;
    return { snapshotPath: snapshotRel, body: bodyOnly };
  }

  async handleRequestSheetSnapshot(blockId: string): Promise<void> {
    try {
      const data = await this.readSheetSnapshot(blockId);
      deliverSheetSnapshot(blockId, data);
    } catch (e) {
      deliverSheetSnapshot(blockId, null, e instanceof Error ? e.message : String(e));
    }
  }

  async handleSaveSheetSnapshot(
    blockId: string,
    data: UniverWorkbookSnapshot,
    onBodyUpdated: (body: string) => Promise<void>,
  ): Promise<void> {
    try {
      const result = await this.writeSheetSnapshot(blockId, data);
      await onBodyUpdated(result.body);
      deliverSheetSnapshot(blockId, data);
      handleSheetSavedMessage({
        type: 'sheetSaved',
        blockId,
        ok: true,
        snapshotPath: result.snapshotPath,
      });
    } catch (e) {
      handleSheetSavedMessage({
        type: 'sheetSaved',
        blockId,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
