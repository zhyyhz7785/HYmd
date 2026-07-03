import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';
import { replaceAll } from '@milkdown/utils';
import type { HostToWebviewMessage, WebviewToHostMessage } from '../src/protocol.js';
import { decorateHymdBlocks, applyTheme } from './blockCards.js';
import { createSyncController } from './syncController.js';

declare function acquireVsCodeApi(): {
  postMessage(message: WebviewToHostMessage): void;
};

const vscode = acquireVsCodeApi();
let crepe: Crepe | null = null;
let sync = createSyncController((content, version) => {
  vscode.postMessage({ type: 'edit', content, version });
});

async function ensureCrepe(initial: string): Promise<Crepe> {
  if (crepe) return crepe;

  crepe = new Crepe({
    root: '#editor-root',
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

  crepe.on((api) => {
    api.markdownUpdated((_ctx, markdown, prevMarkdown) => {
      if (markdown === prevMarkdown) return;
      sync.onLocalEdit(markdown);
      requestAnimationFrame(() => decorateHymdBlocks(document.getElementById('editor-root')));
    });
  });

  await crepe.create();
  decorateHymdBlocks(document.getElementById('editor-root'));
  return crepe;
}

async function applyExternalContent(content: string): Promise<void> {
  if (!crepe) return;
  if (sync.isComposing()) {
    sync.bufferExternal(content);
    return;
  }
  await crepe.editor.action(replaceAll(content));
  decorateHymdBlocks(document.getElementById('editor-root'));
}

function setupImeBuffer(): void {
  document.addEventListener('compositionstart', () => sync.setComposing(true));
  document.addEventListener('compositionend', () => {
    sync.setComposing(false);
    const buffered = sync.takeBufferedExternal();
    if (buffered !== null) void applyExternalContent(buffered);
  });
}

window.addEventListener('message', (event) => {
  const msg = event.data as HostToWebviewMessage;
  void handleHostMessage(msg);
});

async function handleHostMessage(msg: HostToWebviewMessage): Promise<void> {
  switch (msg.type) {
    case 'init':
      applyTheme(msg.theme);
      await ensureCrepe(msg.content);
      sync.reset(msg.content);
      break;
    case 'externalUpdate':
      if (sync.shouldIgnoreExternal(msg.version)) return;
      await applyExternalContent(msg.content);
      sync.reset(msg.content);
      break;
    case 'themeChanged':
      applyTheme(msg.theme);
      break;
  }
}

setupImeBuffer();
vscode.postMessage({ type: 'ready' });
