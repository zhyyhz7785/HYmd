import { parseHymd } from '@hymd/parser';
import {
  DomPaginationHost,
  buildPreviewCss,
  paginate,
  pxToMm,
  renderDocumentBlocks,
  resolvePageGeometry,
  resolveTheme,
  toPixelGeometry,
} from '@hymd/layout/browser';
import type { PageGeometry } from '@hymd/layout/browser';
import type { LayoutHostToWebviewMessage, LayoutWebviewToHostMessage } from '../../src/protocol.js';

declare function acquireVsCodeApi(): {
  postMessage(message: LayoutWebviewToHostMessage): void;
};

declare global {
  interface Window {
    __HYMD_LAYOUT_INITIAL__?: string;
  }
}

const vscode = acquireVsCodeApi();

const pagesRoot = document.getElementById('pages-root')!;
const templateHost = document.getElementById('template-host')!;
const viewport = document.getElementById('viewport')!;
const pageIndicator = document.getElementById('page-indicator')!;

let content = window.__HYMD_LAYOUT_INITIAL__ ?? '';
let layoutScale = 2;
let zoom = 1;
let fitWidth = true;
let showGuides = true;
let currentPage = 0;
let totalPages = 1;
let lastGeometry: PageGeometry | undefined;

function post(msg: LayoutWebviewToHostMessage): void {
  vscode.postMessage(msg);
}

function computeFitScale(geo: PageGeometry): number {
  const pad = 32;
  const avail = Math.max(100, viewport.clientWidth - pad);
  const paperPxAt1 = geo.widthMm;
  return Math.min(4, Math.max(0.4, avail / paperPxAt1));
}

function applyZoomTransform(): void {
  pagesRoot.style.transform = zoom === 1 ? '' : `scale(${zoom})`;
  pagesRoot.style.transformOrigin = 'left top';
}

function scrollToPage(pageIndex: number): void {
  const wrap = pagesRoot.querySelector(`[data-page-index="${pageIndex}"]`) as HTMLElement | null;
  if (!wrap) return;
  const top = wrap.offsetTop * zoom;
  viewport.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
}

function measureGeoDelta(geo: PageGeometry, scale: number): number {
  const paper = pagesRoot.querySelector('.hymd-paper') as HTMLElement | null;
  if (!paper) return 0;
  const logicalWidthPx = paper.offsetWidth;
  const actualMm = pxToMm(logicalWidthPx, scale);
  return Math.abs(actualMm - geo.widthMm);
}

function updatePageIndicator(): void {
  pageIndicator.textContent = `${currentPage + 1} / ${totalPages}`;
}

function renderDocument(text: string): void {
  content = text;
  const doc = parseHymd(text);
  const geo = resolvePageGeometry(doc.frontmatter);
  lastGeometry = geo;
  const theme = resolveTheme(typeof doc.frontmatter.theme === 'string' ? doc.frontmatter.theme : undefined);

  if (fitWidth) layoutScale = computeFitScale(geo);
  const px = toPixelGeometry(geo, layoutScale);

  const rendered = renderDocumentBlocks(doc);
  templateHost.innerHTML = '';
  const templates: HTMLElement[] = rendered.map((block) => {
    const el = document.createElement('div');
    el.innerHTML = block.html;
    const node = el.firstElementChild as HTMLElement;
    templateHost.appendChild(node);
    return node;
  });

  pagesRoot.className = showGuides ? 'hymd-pages show-guides' : 'hymd-pages';
  pagesRoot.style.width = `${px.paperWidthPx * zoom}px`;

  let styleEl = document.getElementById('hymd-layout-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'hymd-layout-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildPreviewCss(theme, px);

  const host = new DomPaginationHost(pagesRoot, templates, px);
  const result = paginate(host, templates.length, { columns: px.columns }, host.tailBlockIndexOf);
  totalPages = result.pages;
  if (currentPage >= totalPages) currentPage = totalPages - 1;
  updatePageIndicator();
  applyZoomTransform();

  requestAnimationFrame(() => {
    const delta = measureGeoDelta(geo, layoutScale);
    post({
      type: 'layoutStats',
      page: currentPage + 1,
      totalPages,
      geoDeltaMm: delta,
    });
  });
}

function setupToolbar(): void {
  document.getElementById('btn-zoom-out')!.addEventListener('click', () => {
    fitWidth = false;
    zoom = Math.max(0.25, Math.round((zoom - 0.1) * 10) / 10);
    applyZoomTransform();
    if (lastGeometry) {
      post({
        type: 'layoutStats',
        page: currentPage + 1,
        totalPages,
        geoDeltaMm: measureGeoDelta(lastGeometry, layoutScale),
      });
    }
  });

  document.getElementById('btn-zoom-in')!.addEventListener('click', () => {
    fitWidth = false;
    zoom = Math.min(3, Math.round((zoom + 0.1) * 10) / 10);
    applyZoomTransform();
    if (lastGeometry) {
      post({
        type: 'layoutStats',
        page: currentPage + 1,
        totalPages,
        geoDeltaMm: measureGeoDelta(lastGeometry, layoutScale),
      });
    }
  });

  document.getElementById('btn-zoom-reset')!.addEventListener('click', () => {
    fitWidth = false;
    zoom = 1;
    applyZoomTransform();
    if (lastGeometry) {
      post({
        type: 'layoutStats',
        page: currentPage + 1,
        totalPages,
        geoDeltaMm: measureGeoDelta(lastGeometry, layoutScale),
      });
    }
  });

  document.getElementById('btn-fit-width')!.addEventListener('click', () => {
    fitWidth = true;
    zoom = 1;
    renderDocument(content);
  });

  document.getElementById('btn-prev-page')!.addEventListener('click', () => {
    if (currentPage > 0) {
      currentPage -= 1;
      updatePageIndicator();
      scrollToPage(currentPage);
      post({ type: 'layoutStats', page: currentPage + 1, totalPages, geoDeltaMm: lastGeometry ? measureGeoDelta(lastGeometry, layoutScale) : 0 });
    }
  });

  document.getElementById('btn-next-page')!.addEventListener('click', () => {
    if (currentPage < totalPages - 1) {
      currentPage += 1;
      updatePageIndicator();
      scrollToPage(currentPage);
      post({ type: 'layoutStats', page: currentPage + 1, totalPages, geoDeltaMm: lastGeometry ? measureGeoDelta(lastGeometry, layoutScale) : 0 });
    }
  });

  const guides = document.getElementById('chk-guides') as HTMLInputElement;
  guides.addEventListener('change', () => {
    showGuides = guides.checked;
    pagesRoot.classList.toggle('show-guides', showGuides);
  });

  window.addEventListener('resize', () => {
    if (!fitWidth) return;
    renderDocument(content);
  });
}

window.addEventListener('message', (event: MessageEvent<LayoutHostToWebviewMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'layoutInit':
    case 'layoutUpdate':
      renderDocument(msg.content);
      break;
  }
});

setupToolbar();
post({ type: 'layoutReady' });
