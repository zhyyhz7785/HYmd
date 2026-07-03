import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol.js';
import { mountSheetPreview, type SheetMountHandle, type UniverWorkbookSnapshot } from '@hymd/blocks-sheet';

type PostMessage = (msg: WebviewToHostMessage) => void;

interface PreviewEntry {
  blockId: string;
  container: HTMLElement;
  handle: SheetMountHandle | null;
  observer: IntersectionObserver | null;
}

const previews = new Map<string, PreviewEntry>();
const pendingSnapshots = new Map<string, Array<(data: UniverWorkbookSnapshot | null, error?: string) => void>>();

export function handleSheetSnapshotMessage(msg: HostToWebviewMessage): void {
  if (msg.type !== 'sheetSnapshotData') return;

  const waiters = pendingSnapshots.get(msg.blockId) ?? [];
  pendingSnapshots.delete(msg.blockId);

  for (const cb of waiters) {
    if (msg.error || !msg.data) {
      cb(null, msg.error);
    } else {
      cb(msg.data as UniverWorkbookSnapshot);
    }
  }
}

function requestSnapshot(blockId: string, postMessage: PostMessage): Promise<UniverWorkbookSnapshot | null> {
  return new Promise((resolve) => {
    const waiters = pendingSnapshots.get(blockId) ?? [];
    waiters.push((data, error) => {
      if (error) console.warn('[hymd-sheet]', error);
      resolve(data);
    });
    pendingSnapshots.set(blockId, waiters);
    postMessage({ type: 'requestSheetSnapshot', blockId });
  });
}

function mountPreview(entry: PreviewEntry, data: UniverWorkbookSnapshot): void {
  if (entry.handle) {
    entry.handle.dispose();
    entry.handle = null;
  }
  entry.handle = mountSheetPreview(entry.container, data);
}

function setupLazyMount(entry: PreviewEntry, postMessage: PostMessage): void {
  if (entry.observer) entry.observer.disconnect();

  entry.observer = new IntersectionObserver(
    (records) => {
      for (const record of records) {
        if (record.isIntersecting && !entry.handle) {
          void requestSnapshot(entry.blockId, postMessage).then((data) => {
            if (data && entry.container.isConnected) {
              mountPreview(entry, data);
            }
          });
        } else if (!record.isIntersecting && entry.handle) {
          entry.handle.dispose();
          entry.handle = null;
        }
      }
    },
    { rootMargin: '120px' },
  );

  entry.observer.observe(entry.container);
}

export function registerSheetPreview(
  blockId: string,
  container: HTMLElement,
  postMessage: PostMessage,
): void {
  const existing = previews.get(blockId);
  if (existing) {
    existing.container = container;
    setupLazyMount(existing, postMessage);
    return;
  }

  const entry: PreviewEntry = { blockId, container, handle: null, observer: null };
  previews.set(blockId, entry);
  setupLazyMount(entry, postMessage);
}

export function refreshSheetPreview(blockId: string, postMessage: PostMessage): void {
  const entry = previews.get(blockId);
  if (!entry) return;

  if (entry.handle) {
    entry.handle.dispose();
    entry.handle = null;
  }

  void requestSnapshot(blockId, postMessage).then((data) => {
    if (data && entry.container.isConnected) {
      mountPreview(entry, data);
    }
  });
}

export function disposeAllSheetPreviews(): void {
  for (const entry of previews.values()) {
    entry.observer?.disconnect();
    entry.handle?.dispose();
  }
  previews.clear();
}

export function disposeRemovedPreviews(activeIds: Set<string>): void {
  for (const [id, entry] of previews) {
    if (!activeIds.has(id)) {
      entry.observer?.disconnect();
      entry.handle?.dispose();
      previews.delete(id);
    }
  }
}

/** 独立壳：webview 内直接注入 snapshot 数据（不经 host 中转） */
export function deliverSheetSnapshot(blockId: string, data: UniverWorkbookSnapshot | null, error?: string): void {
  handleSheetSnapshotMessage({
    type: 'sheetSnapshotData',
    blockId,
    data: data ?? undefined,
    error,
  });
}
