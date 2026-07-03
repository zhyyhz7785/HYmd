import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol.js';
import { mountSheetEditor, type SheetMountHandle, type UniverWorkbookSnapshot } from '@hymd/blocks-sheet';
import { refreshSheetPreview } from './sheetPreview.js';

type PostMessage = (msg: WebviewToHostMessage) => void;

let overlayRoot: HTMLElement | null = null;
let editorHandle: SheetMountHandle | null = null;
let activeBlockId: string | null = null;
let postMessageFn: PostMessage | null = null;
let pendingOverlayBlockId: string | null = null;
let overlaySyncCb: ((open: boolean) => void) | null = null;

export function initSheetOverlay(root: HTMLElement, postMessage: PostMessage): void {
  overlayRoot = root;
  postMessageFn = postMessage;
}

export function setOverlaySyncCallback(cb: (open: boolean) => void): void {
  overlaySyncCb = cb;
}

export function handleSheetSavedMessage(msg: HostToWebviewMessage): void {
  if (msg.type !== 'sheetSaved') return;
  if (!msg.ok) {
    alert(msg.error ?? '保存失败');
    return;
  }
  closeSheetOverlay();
  if (postMessageFn) {
    refreshSheetPreview(msg.blockId, postMessageFn);
  }
}

export function handleSheetSnapshotForOverlay(msg: HostToWebviewMessage): void {
  if (msg.type !== 'sheetSnapshotData') return;
  if (pendingOverlayBlockId !== msg.blockId) return;

  pendingOverlayBlockId = null;

  if (msg.error || !msg.data) {
    alert(msg.error ?? '无法加载表格');
    closeSheetOverlay();
    return;
  }

  showEditor(msg.blockId, msg.data as UniverWorkbookSnapshot);
}

function showEditor(blockId: string, snapshot: UniverWorkbookSnapshot): void {
  if (!overlayRoot) return;

  activeBlockId = blockId;
  overlayRoot.hidden = false;
  overlayRoot.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'hymd-sheet-overlay-toolbar';

  const title = document.createElement('span');
  title.className = 'hymd-sheet-overlay-title';
  title.textContent = `编辑表格 · ${blockId}`;

  const actions = document.createElement('div');
  actions.className = 'hymd-sheet-overlay-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'hymd-sheet-overlay-btn hymd-sheet-overlay-btn-primary';
  saveBtn.textContent = '保存';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'hymd-sheet-overlay-btn';
  cancelBtn.textContent = '取消';

  actions.append(saveBtn, cancelBtn);
  toolbar.append(title, actions);

  const editorHost = document.createElement('div');
  editorHost.className = 'hymd-sheet-overlay-editor';
  editorHost.setAttribute('contenteditable', 'false');

  overlayRoot.append(toolbar, editorHost);

  editorHandle?.dispose();
  editorHandle = mountSheetEditor(editorHost, snapshot);

  saveBtn.addEventListener('click', () => {
    if (!editorHandle || !activeBlockId || !postMessageFn) return;
    const data = editorHandle.save();
    if (!data) return;
    postMessageFn({
      type: 'saveSheetSnapshot',
      blockId: activeBlockId,
      data,
    });
  });

  cancelBtn.addEventListener('click', () => closeSheetOverlay());
}

export function openSheetOverlay(blockId: string, postMessage: PostMessage): void {
  postMessageFn = postMessage;
  pendingOverlayBlockId = blockId;
  overlaySyncCb?.(true);
  postMessage({ type: 'overlayState', open: true });
  postMessage({ type: 'requestSheetSnapshot', blockId });
}

export function closeSheetOverlay(): void {
  editorHandle?.dispose();
  editorHandle = null;
  activeBlockId = null;
  pendingOverlayBlockId = null;

  if (overlayRoot) {
    overlayRoot.hidden = true;
    overlayRoot.innerHTML = '';
  }

  overlaySyncCb?.(false);
  postMessageFn?.({ type: 'overlayState', open: false });
}
