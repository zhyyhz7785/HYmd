import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import { replaceAll } from '@milkdown/utils';
import {
  applyTheme,
  applyUiStyle,
  decorateHymdBlocks,
  setBlockCardPostMessage,
} from './blockCards.js';
import type { HostToWebviewMessage, HymdUiStyle, WebviewToHostMessage } from './protocol.js';
import { createSyncController } from './syncController.js';
import { SheetAssetsClient } from './sheetAssetsClient.js';
import {
  disposeAllSheetPreviews,
  handleSheetSnapshotMessage,
} from './sheetPreview.js';
import {
  disposeAllSlidePreviews,
  handleSlideSourceMessage,
} from './slidePreview.js';
import {
  handleSheetSavedMessage,
  handleSheetSnapshotForOverlay,
  initSheetOverlay,
  setOverlaySyncCallback,
} from './sheetOverlay.js';

export interface HymdEditorBridge {
  postMessage(msg: WebviewToHostMessage): void;
}

export type SheetHandlingMode = 'host' | 'client';

export interface CreateHymdEditorOptions {
  editorRoot: HTMLElement;
  overlayRoot: HTMLElement;
  bridge: HymdEditorBridge;
  /** host=VS Code 扩展处理 sheet；client=webview 内 sheetAssetsClient + readFile/writeFile */
  sheetMode?: SheetHandlingMode;
  /** 独立壳可注入 frontmatter（Milkdown 不编辑 YAML 头） */
  getFrontmatter?: () => string;
  setFrontmatter?: (fm: string) => void;
  onEdit?: (content: string, version: number) => void;
}

export interface HymdEditorHandle {
  handleHostMessage(msg: HostToWebviewMessage): Promise<void>;
  getCrepe(): Crepe | null;
}

export function createHymdEditor(options: CreateHymdEditorOptions): HymdEditorHandle {
  const { editorRoot, overlayRoot, bridge, sheetMode = 'host' } = options;
  let crepe: Crepe | null = null;
  let documentPath = '';
  let sheetClient: SheetAssetsClient | null = null;

  const sync = createSyncController((content, version) => {
    if (sync.isOverlayOpen()) return;
    sheetClient?.updateBody(content);
    if (options.onEdit) {
      options.onEdit(content, version);
    } else {
      bridge.postMessage({ type: 'edit', content, version });
    }
  });

  if (sheetMode === 'client') {
    sheetClient = new SheetAssetsClient((msg) => bridge.postMessage(msg));
  }

  function postMessage(msg: WebviewToHostMessage): void {
    if (sheetMode === 'client' && sheetClient) {
      if (msg.type === 'requestSheetSnapshot') {
        void sheetClient.handleRequestSheetSnapshot(msg.blockId);
        return;
      }
      if (msg.type === 'saveSheetSnapshot') {
        void sheetClient.handleSaveSheetSnapshot(
          msg.blockId,
          msg.data as import('@hymd/blocks-sheet').UniverWorkbookSnapshot,
          async (body) => {
            sheetClient?.updateBody(body);
            await applyExternalContent(body);
            sync.reset(body);
            sync.bumpAndEmit(body);
          },
        );
        return;
      }
    }
    bridge.postMessage(msg);
  }

  setBlockCardPostMessage(postMessage);
  initSheetOverlay(overlayRoot, postMessage);
  setOverlaySyncCallback((open) => sync.setOverlayOpen(open));

  async function ensureCrepe(initial: string): Promise<Crepe> {
    if (crepe) return crepe;

    crepe = new Crepe({
      root: editorRoot,
      defaultValue: initial,
      features: {
        toolbar: true,
        table: true,
        latex: false,
        codeBlock: true,
        linkTooltip: true,
        listItem: true,
      },
    });

    crepe.on((api: { markdownUpdated: (fn: (ctx: unknown, md: string, prev: string) => void) => void }) => {
      api.markdownUpdated((_ctx: unknown, markdown: string, prevMarkdown: string) => {
        if (markdown === prevMarkdown) return;
        if (sync.isOverlayOpen()) return;
        sync.onLocalEdit(markdown);
        requestAnimationFrame(() => decorateHymdBlocks(editorRoot));
      });
    });

    await crepe.create();
    decorateHymdBlocks(editorRoot);
    return crepe;
  }

  async function applyExternalContent(content: string): Promise<void> {
    if (!crepe) return;
    if (sync.isComposing() || sync.isOverlayOpen()) {
      sync.bufferExternal(content);
      return;
    }
    disposeAllSheetPreviews();
    disposeAllSlidePreviews();
    await crepe.editor.action(replaceAll(content));
    decorateHymdBlocks(editorRoot);
  }

  function setupImeBuffer(): void {
    document.addEventListener('compositionstart', () => sync.setComposing(true));
    document.addEventListener('compositionend', () => {
      sync.setComposing(false);
      const buffered = sync.takeBufferedExternal();
      if (buffered !== null) void applyExternalContent(buffered);
    });
  }

  setupImeBuffer();

  async function handleHostMessage(msg: HostToWebviewMessage): Promise<void> {
    if (sheetClient?.handleFileResult(msg)) return;

    if (sheetMode === 'host') {
      handleSheetSnapshotMessage(msg);
      handleSheetSnapshotForOverlay(msg);
      handleSheetSavedMessage(msg);
      handleSlideSourceMessage(msg);
    } else {
      if (msg.type === 'sheetSnapshotData') {
        handleSheetSnapshotMessage(msg);
        handleSheetSnapshotForOverlay(msg);
      } else if (msg.type === 'sheetSaved') {
        handleSheetSavedMessage(msg);
      } else if (msg.type === 'slideSourceData') {
        handleSlideSourceMessage(msg);
      }
    }

    switch (msg.type) {
      case 'init': {
        applyTheme(msg.theme);
        applyUiStyle(msg.uiStyle);
        documentPath = msg.documentPath ?? '';
        const fm = msg.frontmatter ?? options.getFrontmatter?.() ?? '';
        if (sheetClient && documentPath) {
          sheetClient.setDocumentContext(documentPath, fm, msg.content);
        }
        await ensureCrepe(msg.content);
        sync.reset(msg.content);
        break;
      }
      case 'externalUpdate':
        if (sync.shouldIgnoreExternal(msg.version) || sync.isOverlayOpen()) return;
        sheetClient?.updateBody(msg.content);
        await applyExternalContent(msg.content);
        sync.reset(msg.content);
        break;
      case 'themeChanged':
        applyTheme(msg.theme);
        break;
      case 'uiStyleChanged':
        applyUiStyle(msg.uiStyle);
        decorateHymdBlocks(editorRoot);
        break;
      default:
        break;
    }
  }

  return {
    handleHostMessage,
    getCrepe: () => crepe,
  };
}

export type { HymdUiStyle };
