import {
  extractBlockId,
  extractSlideSourcePath,
  extractSnapshotPath,
  isHymdBlockLang,
  type WebviewToHostMessage,
} from './protocol.js';
import { registerSheetPreview, disposeRemovedPreviews } from './sheetPreview.js';
import { registerSlidePreview, disposeRemovedSlidePreviews } from './slidePreview.js';
import { openSheetOverlay } from './sheetOverlay.js';

const BLOCK_LABELS: Record<string, string> = {
  sheet: '表格',
  slide: '幻灯',
  layout: '排版',
  calc: '计算',
};

let postMessageFn: ((msg: WebviewToHostMessage) => void) | null = null;

export function setBlockCardPostMessage(fn: (msg: WebviewToHostMessage) => void): void {
  postMessageFn = fn;
}

export function applyTheme(theme: 'light' | 'dark' | 'high-contrast'): void {
  document.body.dataset.theme = theme;
}

export function applyUiStyle(uiStyle: 'hymd' | 'vscode'): void {
  document.body.dataset.ui = uiStyle;
}

export function decorateHymdBlocks(root: HTMLElement | null): void {
  if (!root || !postMessageFn) return;

  const activeSheetIds = new Set<string>();
  const activeSlideIds = new Set<string>();

  root.querySelectorAll('pre code').forEach((codeEl) => {
    const code = codeEl as HTMLElement;
    const classes = Array.from(code.classList);
    const langClass = classes.find((c) => c.startsWith('language-'));
    if (!langClass) return;

    const lang = langClass.replace('language-', '');
    if (!isHymdBlockLang(lang)) return;

    const pre = code.closest('pre');
    if (!pre) return;

    const blockType = lang.trim().split(/\s+/)[0]?.toLowerCase() ?? lang;
    const body = code.textContent ?? '';
    const blockId = extractBlockId(lang, body) ?? `${blockType}-anon`;

    pre.classList.add('hymd-block-card');
    pre.dataset.hymdBlock = blockType;
    if (blockId) pre.dataset.hymdId = blockId;

    if (!pre.querySelector('.hymd-block-badge')) {
      const badge = document.createElement('div');
      badge.className = 'hymd-block-badge';
      const dot = document.createElement('span');
      dot.className = 'hymd-block-dot';
      dot.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'hymd-block-label';
      label.textContent = `${BLOCK_LABELS[blockType] ?? blockType}${blockId ? ` · ${blockId}` : ''}`;
      badge.append(dot, label);
      pre.insertBefore(badge, pre.firstChild);
    }

    if (blockType === 'sheet' && blockId) {
      activeSheetIds.add(blockId);
      setupSheetCard(pre, blockId, body, postMessageFn!);
    } else if (blockType === 'slide' && blockId) {
      activeSlideIds.add(blockId);
      setupSlideCard(pre, blockId, body, postMessageFn!);
    } else {
      code.style.display = '';
    }
  });

  disposeRemovedPreviews(activeSheetIds);
  disposeRemovedSlidePreviews(activeSlideIds);
}

function setupSheetCard(
  pre: HTMLElement,
  blockId: string,
  body: string,
  postMessage: (msg: WebviewToHostMessage) => void,
): void {
  const code = pre.querySelector('code');
  if (code) (code as HTMLElement).style.display = 'none';

  let previewWrap = pre.querySelector('.hymd-sheet-preview-wrap') as HTMLElement | null;
  if (!previewWrap) {
    previewWrap = document.createElement('div');
    previewWrap.className = 'hymd-sheet-preview-wrap';

    const toolbar = document.createElement('div');
    toolbar.className = 'hymd-sheet-card-toolbar';

    const meta = document.createElement('span');
    meta.className = 'hymd-sheet-card-meta';
    const snap = extractSnapshotPath(body);
    meta.textContent = snap ? snap : '内嵌 / 空表';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'hymd-sheet-edit-btn';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openSheetOverlay(blockId, postMessage);
    });

    toolbar.append(meta, editBtn);

    const previewHost = document.createElement('div');
    previewHost.className = 'hymd-sheet-preview-host';
    previewHost.dataset.blockId = blockId;
    previewHost.setAttribute('contenteditable', 'false');

    previewWrap.append(toolbar, previewHost);
    pre.appendChild(previewWrap);

    registerSheetPreview(blockId, previewHost, postMessage);
  }
}

function setupSlideCard(
  pre: HTMLElement,
  blockId: string,
  body: string,
  postMessage: (msg: WebviewToHostMessage) => void,
): void {
  const code = pre.querySelector('code');
  if (code) (code as HTMLElement).style.display = 'none';

  let previewWrap = pre.querySelector('.hymd-slide-preview-wrap') as HTMLElement | null;
  if (!previewWrap) {
    previewWrap = document.createElement('div');
    previewWrap.className = 'hymd-slide-preview-wrap';

    const toolbar = document.createElement('div');
    toolbar.className = 'hymd-slide-card-toolbar';

    const meta = document.createElement('span');
    meta.className = 'hymd-slide-card-meta';
    const src = extractSlideSourcePath(body);
    meta.textContent = src ? src : '内嵌幻灯';

    const actions = document.createElement('div');
    actions.className = 'hymd-slide-card-actions';

    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'hymd-slide-open-btn';
    openBtn.textContent = '打开源文档';
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      postMessage({ type: 'openSlideSource', blockId });
    });

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'hymd-slide-export-btn';
    exportBtn.textContent = '导出 pptx';
    exportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      postMessage({ type: 'requestExport', format: 'pptx', blockId });
    });

    actions.append(openBtn, exportBtn);
    toolbar.append(meta, actions);

    const previewHost = document.createElement('div');
    previewHost.className = 'hymd-slide-preview-host';
    previewHost.dataset.blockId = blockId;
    previewHost.setAttribute('contenteditable', 'false');

    previewWrap.append(toolbar, previewHost);
    pre.appendChild(previewWrap);

    registerSlidePreview(blockId, previewHost, postMessage);
  }
}
