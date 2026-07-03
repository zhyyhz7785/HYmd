import MarpCore from '@marp-team/marp-core';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol.js';

type MarpInstance = { render: (md: string) => { html: string; css: string } };
type MarpCtor = new (opts?: { html?: boolean }) => MarpInstance;
const Marp = MarpCore as unknown as MarpCtor;

type PostMessage = (msg: WebviewToHostMessage) => void;

interface SlidePreviewEntry {
  blockId: string;
  container: HTMLElement;
  observer: IntersectionObserver | null;
  loaded: boolean;
}

const previews = new Map<string, SlidePreviewEntry>();
const pendingSources = new Map<
  string,
  Array<(markdown: string | null, sourcePath?: string, error?: string) => void>
>();

export function handleSlideSourceMessage(msg: HostToWebviewMessage): void {
  if (msg.type !== 'slideSourceData') return;

  const waiters = pendingSources.get(msg.blockId) ?? [];
  pendingSources.delete(msg.blockId);

  for (const cb of waiters) {
    if (msg.error || !msg.markdown) {
      cb(null, msg.sourcePath, msg.error);
    } else {
      cb(msg.markdown, msg.sourcePath);
    }
  }
}

function requestSlideSource(
  blockId: string,
  postMessage: PostMessage,
): Promise<{ markdown: string; sourcePath?: string } | null> {
  return new Promise((resolve) => {
    const waiters = pendingSources.get(blockId) ?? [];
    waiters.push((markdown, sourcePath, error) => {
      if (error) console.warn('[hymd-slide]', error);
      if (!markdown) {
        resolve(null);
        return;
      }
      resolve({ markdown, sourcePath });
    });
    pendingSources.set(blockId, waiters);
    postMessage({ type: 'requestSlideSource', blockId });
  });
}

/** 渲染 Marp 首页缩略图 HTML（仅显示第一页） */
export function renderSlideThumbnail(markdown: string): { html: string; css: string } {
  const marp = new Marp({ html: true });
  const { html, css } = marp.render(markdown);
  const scopedCss = `${css}
.marpit > svg:first-child { display: none; }
section:not(:first-of-type) { display: none !important; }
section:first-of-type {
  width: 100% !important;
  height: auto !important;
  aspect-ratio: 16 / 9;
  font-size: 0.55em;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}
`;
  return { html, css: scopedCss };
}

function mountThumbnail(entry: SlidePreviewEntry, markdown: string): void {
  entry.container.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'hymd-slide-preview-inner';

  const style = document.createElement('style');
  const { html, css } = renderSlideThumbnail(markdown);
  style.textContent = css;
  wrap.append(style);

  const content = document.createElement('div');
  content.className = 'hymd-slide-preview-content';
  content.innerHTML = html;
  wrap.append(content);
  entry.container.append(wrap);
  entry.loaded = true;
}

function setupLazyMount(entry: SlidePreviewEntry, postMessage: PostMessage): void {
  if (entry.observer) entry.observer.disconnect();

  entry.observer = new IntersectionObserver(
    (records) => {
      for (const record of records) {
        if (record.isIntersecting && !entry.loaded) {
          void requestSlideSource(entry.blockId, postMessage).then((data) => {
            if (data && entry.container.isConnected) {
              mountThumbnail(entry, data.markdown);
            }
          });
        }
      }
    },
    { rootMargin: '120px' },
  );

  entry.observer.observe(entry.container);
}

export function registerSlidePreview(
  blockId: string,
  container: HTMLElement,
  postMessage: PostMessage,
): void {
  const existing = previews.get(blockId);
  if (existing) {
    existing.container = container;
    existing.loaded = false;
    setupLazyMount(existing, postMessage);
    return;
  }

  const entry: SlidePreviewEntry = { blockId, container, observer: null, loaded: false };
  previews.set(blockId, entry);
  setupLazyMount(entry, postMessage);
}

export function disposeAllSlidePreviews(): void {
  for (const entry of previews.values()) {
    entry.observer?.disconnect();
  }
  previews.clear();
}

export function disposeRemovedSlidePreviews(activeIds: Set<string>): void {
  for (const [id, entry] of previews) {
    if (!activeIds.has(id)) {
      entry.observer?.disconnect();
      previews.delete(id);
    }
  }
}
